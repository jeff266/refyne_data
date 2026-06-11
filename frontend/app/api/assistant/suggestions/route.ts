import { NextResponse } from 'next/server';
import { getOrgContext, authError } from '@/lib/auth/clerk-helpers';
import { supabaseAdmin } from '@/lib/db/admin-client';

// Hardcoded fallback suggestions
const DEFAULT_SUGGESTIONS = [
  {
    text: 'How do I normalize phone numbers?',
    icon: 'Phone',
  },
  {
    text: "What's a Grade A duplicate?",
    icon: 'GitMerge',
  },
  {
    text: 'How does the merge survivor work?',
    icon: 'Shield',
  },
  {
    text: 'How do I import a contact list?',
    icon: 'Upload',
  },
];

export async function GET() {
  // Auth required
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return authError(e) ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ctx.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch top suggested patterns
    const { data: patterns, error } = await supabaseAdmin
      .from('assistant_question_patterns')
      .select('suggested_prompt_text, suggested_prompt_icon, count')
      .or('is_suggested.eq.true,count.gte.5')
      .order('count', { ascending: false })
      .limit(4);

    if (error) {
      console.error('[Assistant Suggestions] Failed to fetch patterns:', error);
      throw error;
    }

    // If we have at least 4 patterns, use them
    if (patterns && patterns.length >= 4) {
      return NextResponse.json({
        suggestions: patterns.map((p) => ({
          text: p.suggested_prompt_text || '',
          icon: p.suggested_prompt_icon || 'MessageCircle',
        })),
      });
    }

    // Otherwise, combine patterns with defaults to reach 4
    const dynamicSuggestions = (patterns || []).map((p) => ({
      text: p.suggested_prompt_text || '',
      icon: p.suggested_prompt_icon || 'MessageCircle',
    }));

    const needed = 4 - dynamicSuggestions.length;
    const fallbackSuggestions = DEFAULT_SUGGESTIONS.slice(0, needed);

    return NextResponse.json({
      suggestions: [...dynamicSuggestions, ...fallbackSuggestions],
    });
  } catch (error) {
    console.error('[Assistant Suggestions] Error:', error);

    // On error, return defaults
    return NextResponse.json({
      suggestions: DEFAULT_SUGGESTIONS,
    });
  }
}
