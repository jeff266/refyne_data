/**
 * Claude AI Client
 *
 * Shared infrastructure for AI summary generation using Claude Haiku.
 */

import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '@/lib/db/supabase';
import { createHash } from 'crypto';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const HAIKU = 'claude-haiku-4-5-20251001';

/**
 * Generate an AI summary using Claude Haiku.
 * Automatically logs to ai_summaries table for audit trail.
 */
export async function generateSummary<T>(
  systemPrompt: string,
  userPrompt: string,
  orgId: string,
  surface: string,
  inputData: object
): Promise<T> {
  const message = await anthropic.messages.create({
    model: HAIKU,
    max_tokens: 500,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = message.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { text: string }).text)
    .join('');

  const clean = text.replace(/```json|```/g, '').trim();
  const output = JSON.parse(clean) as T;

  // Fire and forget audit log
  if (supabase) {
    void (async () => {
      try {
        await supabase.from('ai_summaries').upsert(
          {
            org_id: orgId,
            surface,
            input_hash: sha256(JSON.stringify(inputData)),
            input_data: inputData,
            output_data: output as object,
            model: HAIKU,
            tokens_used: message.usage.input_tokens + message.usage.output_tokens,
          },
          { onConflict: 'org_id,surface,input_hash' }
        );
      } catch (err) {
        console.error('Failed to log AI summary:', err);
      }
    })();
  }

  return output;
}

/**
 * SHA-256 hash function for input deduplication.
 */
function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}
