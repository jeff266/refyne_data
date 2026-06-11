/**
 * Normalize a question for pattern matching.
 * Strips punctuation, filler words, and converts to lowercase.
 */
export function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/[?!.,;:'"]/g, '') // Remove punctuation (handles contractions like "what's" → "whats")
    .replace(/\b(do|does|can|how|what|whats|when|where|why|is|are|the|a|an|i|me|my|you)\b/g, '') // Remove filler words
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}
