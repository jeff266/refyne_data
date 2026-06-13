import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { checkRateLimit, rateLimiters } from '@/lib/api/rate-limit';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { normalizeQuestion } from '@/lib/assistant/normalize-question';
import { buildWorkspaceContext } from '@/lib/assistant/context-builder';
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
  console.log('[Assistant] Step 1a: Function entered');
  console.log('[Assistant] Step 1b: Request URL:', req.url);
  console.log('[Assistant] Step 1c: Request method:', req.method);

  // 1. Auth
  let ctx;
  try {
    console.log('[Assistant] Step 1d: Calling getOrgContext');
    ctx = await getOrgContext();
    console.log('[Assistant] Step 1e: getOrgContext returned:', ctx ? 'success' : 'null');
  } catch (e) {
    console.log('[Assistant] Step 1f: Auth failed, error:', e);
    console.error('[Assistant] Auth error stack:', e instanceof Error ? e.stack : 'no stack');
    return authError(e) ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Assistant] Step 2: Auth success, orgId:', ctx.orgId, 'userId:', ctx.userId);

  try {
    if (!ctx.userId) {
      console.log('[Assistant] Step 2: No userId');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Assistant] Step 3: Checking rate limit');
    // 2. Rate limit (per user, not org)
    const limited = await checkRateLimit(rateLimiters.assistant, ctx.userId);
    if (limited) {
      console.log('[Assistant] Step 3: Rate limited');
      return limited;
    }

    console.log('[Assistant] Step 4: Parsing body');
    // 3. Parse and validate body
    const body = await req.json();
    const { message, history, suggestionClicked } = body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      console.log('[Assistant] Step 4: Invalid message');
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    console.log('[Assistant] Step 5: Message validated, length:', message.length);

    console.log('[Assistant] Step 6: Loading workspace context');
    // 4. Load workspace context
    const { data: wsContext } = await supabaseAdmin
      .from('workspace_context')
      .select('interpreted_context, built_at')
      .eq('org_id', ctx.orgId)
      .single();

    let contextText = wsContext?.interpreted_context || '';
    console.log('[Assistant] Step 6: Context loaded, has context:', !!contextText);

    // First-time: build context synchronously (adds ~1-2s to first message, cached after)
    if (!contextText) {
      console.log('[Assistant] Step 7: Building workspace context');
      try {
        contextText = await buildWorkspaceContext(ctx.orgId, 'first_chat');
        console.log('[Assistant] Step 7: Context built successfully');
      } catch (err) {
        console.error('[Assistant] Step 7: Context build failed:', err);
        contextText = ''; // graceful degradation
      }
    }

    console.log('[Assistant] Step 8: Compacting history, history length:', history?.length || 0);
    // 5. Compact history if needed
    const processedHistory = await compactHistory(history || []);
    console.log('[Assistant] Step 8: History compacted, processed length:', processedHistory.length);

    console.log('[Assistant] Step 9: Building messages array');
    // 6. Build messages array
    const messages: Anthropic.MessageParam[] = [
      ...processedHistory.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user' as const, content: message },
    ];
    console.log('[Assistant] Step 9: Messages built, total:', messages.length);

    console.log('[Assistant] Step 10: Logging question');
    // 7. Log question (non-blocking - fire and forget, before streaming)
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

    console.log('[Assistant] Step 11: Building system blocks');
    // 8. Build system blocks with workspace context
    const systemBlocks: Anthropic.Messages.TextBlockParam[] = [
      {
        type: 'text',
        text: REFYNE_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ];

    // Add workspace context as second cached block if available
    if (contextText) {
      const updatedDate = wsContext?.built_at
        ? new Date(wsContext.built_at).toLocaleDateString()
        : 'recently';

      systemBlocks.push({
        type: 'text',
        text: `WORKSPACE CONTEXT (updated ${updatedDate}):\n\n${contextText}`,
        cache_control: { type: 'ephemeral' },
      });
    }
    console.log('[Assistant] Step 11: System blocks built, count:', systemBlocks.length);

    console.log('[Assistant] Step 12: Creating Anthropic stream');
    // 9. Stream Claude response with cached system prompts
    const stream = await anthropic.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: systemBlocks,
      messages,
    });
    console.log('[Assistant] Step 12: Stream created successfully');

    console.log('[Assistant] Step 13: Returning streaming response');
    // 8. Return streaming response
    const response = new Response(stream.toReadableStream(), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
    console.log('[Assistant] Step 14: Response created, returning');
    return response;
  } catch (error: unknown) {
    console.error('[Assistant] ERROR: Caught exception at step:', error);
    console.error('[Assistant] ERROR: Stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('[Assistant] ERROR: Message:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Failed to get response from assistant' },
      { status: 500 }
    );
  }
}
