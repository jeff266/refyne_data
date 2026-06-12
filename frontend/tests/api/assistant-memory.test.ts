/**
 * Assistant Memory Tests
 *
 * Tests prompt caching and conversation compaction features
 * for the Refyne Assistant API.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Use vi.hoisted to share mock function across module boundary
const mockCreate = vi.hoisted(() => vi.fn());
const mockStream = vi.hoisted(() => vi.fn());

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = {
      create: mockCreate,
      stream: mockStream,
    };
  },
}));

// Now import after mocks are set up
import { POST } from '@/app/api/assistant/chat/route';
import * as clerkHelpers from '@/lib/auth/clerk-helpers';
import * as rateLimit from '@/lib/api/rate-limit';

// Mock clerk helpers
vi.mock('@/lib/auth/clerk-helpers', () => ({
  getOrgContext: vi.fn(),
  authError: vi.fn(),
}));

// Mock rate limit
vi.mock('@/lib/api/rate-limit', () => ({
  checkRateLimit: vi.fn(),
  rateLimiters: {
    assistant: {},
  },
}));

// Mock supabaseAdmin for workspace context and logging
vi.mock('@/lib/db/admin-client', () => ({
  supabaseAdmin: {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'workspace_context') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null }),
            }),
          }),
        };
      }
      // For assistant_questions logging
      return {
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
    }),
  },
}));

describe('Assistant Memory - Conversation Compaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default auth mock
    vi.mocked(clerkHelpers.getOrgContext).mockResolvedValue({
      userId: 'user_test123',
      orgId: 'org_test123',
      sessionId: 'sess_test123',
    });

    // Default rate limit mock (not limited)
    vi.mocked(rateLimit.checkRateLimit).mockResolvedValue(null);
  });

  it('1. Short history (under threshold): passed through unchanged', async () => {
    const shortHistory = [
      { role: 'user', content: 'What is Refyne?' },
      { role: 'assistant', content: 'Refyne is a HubSpot data quality tool.' },
      { role: 'user', content: 'How does dedup work?' },
      { role: 'assistant', content: 'Dedup finds duplicate records...' },
    ];

    mockStream.mockResolvedValue({
      toReadableStream: () => new ReadableStream(),
    });

    const request = new NextRequest('http://localhost/api/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Tell me more',
        history: shortHistory,
      }),
    });

    await POST(request);

    // Should call stream once (no summarization needed)
    expect(mockStream).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledTimes(0);

    // Should pass all history messages plus new message
    const callArgs = mockStream.mock.calls[0][0];
    expect(callArgs.messages).toHaveLength(shortHistory.length + 1);
    expect(callArgs.messages[0].content).toBe('What is Refyne?');
  });

  it('2. Long history (over threshold): compacted to summary + recent turns', async () => {
    // Create 12 messages (exceeds COMPACT_THRESHOLD of 10)
    const longHistory = Array.from({ length: 12 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Message ${i + 1}`,
    }));

    // Mock summarization response (create) and main response (stream)
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Summary of earlier conversation' }],
    });

    mockStream.mockResolvedValue({
      toReadableStream: () => new ReadableStream(),
    });

    const request = new NextRequest('http://localhost/api/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'New question',
        history: longHistory,
      }),
    });

    await POST(request);

    // Should call create once for summary, stream once for main response
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockStream).toHaveBeenCalledTimes(1);

    // First call should be for summarization
    const summaryCall = mockCreate.mock.calls[0][0];
    expect(summaryCall.max_tokens).toBe(200);
    expect(summaryCall.messages[0].content).toContain('Summarize this conversation');

    // Stream call should use compacted history
    const mainCall = mockStream.mock.calls[0][0];
    // 2 (summary block) + 4 (recent turns) + 1 (new message) = 7
    expect(mainCall.messages).toHaveLength(7);
  });

  it('3. Compacted history contains summary block as first message pair', async () => {
    const longHistory = Array.from({ length: 12 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Message ${i + 1}`,
    }));

    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Earlier topics: dedup and normalize' }],
    });

    mockStream.mockResolvedValue({
      toReadableStream: () => new ReadableStream(),
    });

    const request = new NextRequest('http://localhost/api/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Question',
        history: longHistory,
      }),
    });

    await POST(request);

    const mainCall = mockStream.mock.calls[0][0];

    // First message should be summary from user
    expect(mainCall.messages[0].role).toBe('user');
    expect(mainCall.messages[0].content).toContain('[Earlier conversation summary:');
    expect(mainCall.messages[0].content).toContain('Earlier topics: dedup and normalize');

    // Second message should be assistant acknowledgment
    expect(mainCall.messages[1].role).toBe('assistant');
    expect(mainCall.messages[1].content).toContain('Understood');
  });

  it('4. Compacted history preserves last 4 messages verbatim', async () => {
    const longHistory = Array.from({ length: 12 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Message ${i + 1}`,
    }));

    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Summary' }],
    });

    mockStream.mockResolvedValue({
      toReadableStream: () => new ReadableStream(),
    });

    const request = new NextRequest('http://localhost/api/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Question',
        history: longHistory,
      }),
    });

    await POST(request);

    const mainCall = mockStream.mock.calls[0][0];

    // Last 4 history messages should be messages 9-12
    // (summary block is messages 0-1, recent is messages 2-5, new message is 6)
    expect(mainCall.messages[2].content).toBe('Message 9');
    expect(mainCall.messages[3].content).toBe('Message 10');
    expect(mainCall.messages[4].content).toBe('Message 11');
    expect(mainCall.messages[5].content).toBe('Message 12');
  });

  it('5. Summary generation called once per compaction (not on every message)', async () => {
    const longHistory = Array.from({ length: 12 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Message ${i + 1}`,
    }));

    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Summary' }],
    });

    mockStream.mockResolvedValue({
      toReadableStream: () => new ReadableStream(),
    });

    const request = new NextRequest('http://localhost/api/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Question',
        history: longHistory,
      }),
    });

    await POST(request);

    // Should call create once for summary, stream once for main response
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockStream).toHaveBeenCalledTimes(1);

    // First call should be summarization
    expect(mockCreate.mock.calls[0][0].max_tokens).toBe(200);

    // Stream call should be main response
    expect(mockStream.mock.calls[0][0].max_tokens).toBe(1000);
  });

  it('6. Rate limit uses userId not orgId as identifier', async () => {
    mockStream.mockResolvedValue({
      toReadableStream: () => new ReadableStream(),
    });

    const request = new NextRequest('http://localhost/api/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Question',
        history: [],
      }),
    });

    await POST(request);

    // Should call checkRateLimit with userId, not orgId
    expect(rateLimit.checkRateLimit).toHaveBeenCalledWith(
      expect.anything(),
      'user_test123'
    );
  });

  it('8. Compaction with exactly COMPACT_THRESHOLD messages: no compaction', async () => {
    // Exactly 10 messages (COMPACT_THRESHOLD)
    const exactHistory = Array.from({ length: 10 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Message ${i + 1}`,
    }));

    mockStream.mockResolvedValue({
      toReadableStream: () => new ReadableStream(),
    });

    const request = new NextRequest('http://localhost/api/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Question',
        history: exactHistory,
      }),
    });

    await POST(request);

    // Should call stream once (no summarization at threshold)
    expect(mockStream).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledTimes(0);

    // Should have all 10 history messages + new message
    const callArgs = mockStream.mock.calls[0][0];
    expect(callArgs.messages).toHaveLength(11);
  });

  it('9. Compaction with COMPACT_THRESHOLD + 1 messages: compaction triggered', async () => {
    // 11 messages (COMPACT_THRESHOLD + 1)
    const overHistory = Array.from({ length: 11 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `Message ${i + 1}`,
    }));

    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Summary' }],
    });

    mockStream.mockResolvedValue({
      toReadableStream: () => new ReadableStream(),
    });

    const request = new NextRequest('http://localhost/api/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Question',
        history: overHistory,
      }),
    });

    await POST(request);

    // Should call create once for summary, stream once for main (compaction triggered)
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockStream).toHaveBeenCalledTimes(1);
  });

  it('10. Empty history: no compaction, passes through', async () => {
    mockStream.mockResolvedValue({
      toReadableStream: () => new ReadableStream(),
    });

    const request = new NextRequest('http://localhost/api/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Question',
        history: [],
      }),
    });

    await POST(request);

    // Should call stream once (no history to compact)
    expect(mockStream).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledTimes(0);

    // Should have only the new message
    const callArgs = mockStream.mock.calls[0][0];
    expect(callArgs.messages).toHaveLength(1);
    expect(callArgs.messages[0].content).toBe('Question');
  });
});

describe('Assistant Memory - Prompt Caching', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(clerkHelpers.getOrgContext).mockResolvedValue({
      userId: 'user_test123',
      orgId: 'org_test123',
      sessionId: 'sess_test123',
    });

    vi.mocked(rateLimit.checkRateLimit).mockResolvedValue(null);
  });

  it('7. Prompt caching: system passed as array with cache_control block', async () => {
    mockStream.mockResolvedValue({
      toReadableStream: () => new ReadableStream(),
    });

    const request = new NextRequest('http://localhost/api/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Question',
        history: [],
      }),
    });

    await POST(request);

    const callArgs = mockStream.mock.calls[0][0];

    // System should be an array
    expect(Array.isArray(callArgs.system)).toBe(true);

    // Should have one element with cache_control
    expect(callArgs.system).toHaveLength(1);
    expect(callArgs.system[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('Refyne Assistant'),
      cache_control: { type: 'ephemeral' },
    });
  });
});
