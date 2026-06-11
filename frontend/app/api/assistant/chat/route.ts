import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { checkRateLimit, rateLimiters } from '@/lib/api/rate-limit';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { normalizeQuestion } from '@/lib/assistant/normalize-question';
import Anthropic from '@anthropic-ai/sdk';

// Using claude-haiku-4-5-20251001 (Haiku 4.5 - fast, efficient model for assistant)
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Conversation compaction settings
const COMPACT_THRESHOLD = 10;  // total messages
const RECENT_TURNS_TO_KEEP = 4;  // messages kept verbatim (2 exchanges)

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

const REFYNE_SYSTEM_PROMPT = `You are Refyne Assistant, a helpful guide built into Refyne, a HubSpot CRM data quality tool.

You help RevOps practitioners use Refyne effectively. You only answer questions about Refyne and HubSpot data quality. For anything else, politely redirect to Refyne's features.

WHAT REFYNE DOES:
Refyne is a four-stage data quality pipeline for HubSpot: Normalize, Dedup, Enrich, Monitor.

NORMALIZE:
- Standardizes field values across HubSpot records
- Harmonies are rules that define how a field should be formatted (e.g. phone numbers to E.164, company names to Title Case)
- Library harmonies are pre-built and recommended
- Custom harmonies are org-specific rules
- To run normalization: go to Clean > Normalize, select object type (Companies or Contacts), click "Normalize all" or select specific records
- Preview shows changes before writing to HubSpot
- Issues count shows how many records don't match the harmony rule

DEDUP:
- Finds and merges duplicate companies/contacts
- Clusters are groups of likely duplicate records
- Grades: A (97%+), B (85-96%), C (70-84%), D (60-69%) confidence
- Grade A clusters can be bulk-approved
- Signals show why records were matched: Domain exact, LinkedIn exact, Name 25%, etc.
- Survivorship rules determine which record's field values survive a merge
- To run a scan: Dedup > Run scan button
- Incremental scans run nightly automatically
- Full scans run weekly

ENRICH:
- Fills empty fields using data providers
- BYOK: Bring your own Apollo/ZoomInfo/Cognism keys
- Refyne Search: built-in managed enrichment
- Go to Enrich, select fields and providers, preview results, then apply selectively
- Credits are used for managed enrichment only, not for BYOK providers

HARMONIES:
- Harmonies live at Configure > Harmonies
- Library harmonies: pre-built, recommended
- Custom harmonies: create your own rules
- Each harmony maps to a HubSpot property
- Toggle on/off per harmony
- Test a harmony before activating

IMPORT (Event List Import):
- Import CSV files of contacts for events/lists
- 7-step wizard: Upload, Filter, Map, Match, Configure, Owners, Confirm
- Matching engine finds existing HubSpot contacts
- Buckets: Customer, Open Deal, Former Customer, Known Contact, New Contact, Needs Review
- Each bucket gets configured write behavior
- Owner assignment rules distribute contacts to your team

SETTINGS:
- General: workspace name, timezone
- Billing: plan, usage, credits
- Team: invite members, manage roles
- Policies: dedup rules, enrichment policy, survivorship rules, field exclusions
- Harmonies: matching rules (signal groups)
- Name Registry: custom brand/acronym rules
- Beta: enable beta features

COMMON QUESTIONS:

Q: Why aren't my phone numbers normalizing?
A: Check that the Phone Number Formatter harmony is active (toggle on). Also verify the harmony is mapped to the correct HubSpot property (company.phone or contact phone). Go to Configure > Harmonies and look for "Phone Number Formatter".

Q: What's the difference between Grade A and B?
A: Grade A means 97%+ confidence the records are duplicates - typically exact domain or LinkedIn match. Grade B is 85-96% - strong signals but not a perfect single-field match. Grade A can be bulk-approved safely. Review Grade B manually.

Q: How do I prevent a merge from happening?
A: In the cluster review, click "Reject" to mark the pair as not a duplicate. It won't appear in future scans. For systematic exclusions, go to Settings > Policies > Dedup and add a field exclusion or configure parent/child awareness.

Q: My HubSpot connection needs to be updated - what do I do?
A: Go to Settings > Connections and click "Reconnect HubSpot". This takes 30 seconds and preserves all your settings. Your connection may need updating when Refyne adds new features that require additional HubSpot permissions.

Q: What are enrichment credits?
A: Credits are consumed when using Refyne Search (our managed enrichment). BYOK providers (Apollo, ZoomInfo, Cognism) use your own provider accounts and don't consume Refyne credits. Check usage at Settings > Usage.

Q: How do I set up owner assignment for imports?
A: In the Import wizard, Step 6 (Owners), you can create rules: assign based on contact's geography, company size, job title, or other fields. Unmatched contacts go to a weighted round-robin fallback.

WHAT YOU DON'T KNOW:
- The user's specific HubSpot data or records
- Their current settings or configuration
- Whether a specific run succeeded or failed
- Their billing status

When users ask about their specific data, tell them to check the relevant page in Refyne directly.
Example: "I can't see your specific records, but you can check that on the Normalize page under Clean > Normalize."

TONE:
- Short, direct answers
- Give exact UI navigation paths
- If you don't know, say so and suggest contacting support
- Never make up features that don't exist
- Use "you" not "the user"`;

/**
 * Compact conversation history when it exceeds threshold.
 * Summarizes older turns and keeps recent turns verbatim.
 */
async function compactHistory(history: Message[]): Promise<Message[]> {
  if (history.length <= COMPACT_THRESHOLD) {
    return history;
  }

  const older = history.slice(0, -RECENT_TURNS_TO_KEEP);
  const recent = history.slice(-RECENT_TURNS_TO_KEEP);

  // Generate summary of older conversation
  const summaryResponse = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [
      {
        role: 'user',
        content: `Summarize this conversation history concisely in 3-5 sentences. Focus on what features were discussed and what was resolved.

History: ${JSON.stringify(older)}`,
      },
    ],
  });

  const summaryContent = summaryResponse.content[0];
  if (summaryContent.type !== 'text') {
    throw new Error('Unexpected summary response type');
  }

  const summary = summaryContent.text;

  return [
    {
      role: 'user',
      content: `[Earlier conversation summary: ${summary}]`,
    },
    {
      role: 'assistant',
      content: 'Understood. I have context from our earlier discussion.',
    },
    ...recent,
  ];
}

export async function POST(req: NextRequest) {
  // 1. Auth
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (!ctx.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Rate limit (per user, not org)
    const limited = await checkRateLimit(rateLimiters.assistant, ctx.userId);
    if (limited) return limited;

    // 3. Parse and validate body
    const body = await req.json();
    const { message, history, suggestionClicked } = body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // 4. Compact history if needed
    const processedHistory = await compactHistory(history || []);

    // 5. Build messages array
    const messages: Anthropic.MessageParam[] = [
      ...processedHistory.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user' as const, content: message },
    ];

    // 6. Call Claude with cached system prompt
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: [
        {
          type: 'text',
          text: REFYNE_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages,
    });

    const assistantMessage = response.content[0];
    if (assistantMessage.type !== 'text') {
      throw new Error('Unexpected response type from Anthropic');
    }

    // 7. Log question (non-blocking - fire and forget)
    const normalized = normalizeQuestion(message);
    supabaseAdmin
      .from('assistant_questions')
      .insert({
        org_id: ctx.orgId,
        user_id: ctx.userId,
        question: message,
        question_normalized: normalized,
        suggestion_clicked: suggestionClicked === true,
      });

    // 8. Return response
    return NextResponse.json({ response: assistantMessage.text });
  } catch (error: unknown) {
    console.error('Assistant chat error:', error);
    return NextResponse.json(
      { error: 'Failed to get response from assistant' },
      { status: 500 }
    );
  }
}
