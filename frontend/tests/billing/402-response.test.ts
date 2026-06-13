/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleApiResponse } from '@/lib/billing/api-response-handler';
import * as toastModule from '@/components/ui/toast';

// Mock addToast
vi.mock('@/components/ui/toast', () => ({
  addToast: vi.fn(),
}));

describe('402 Response Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. returns true for successful responses', async () => {
    const response = new Response(null, { status: 200 });
    const result = await handleApiResponse(response);

    expect(result).toBe(true);
    expect(toastModule.addToast).not.toHaveBeenCalled();
  });

  it('2. shows upgrade toast for 402 responses', async () => {
    const response = new Response(null, { status: 402 });
    const result = await handleApiResponse(response, 'merge records');

    expect(result).toBe(false);
    expect(toastModule.addToast).toHaveBeenCalledWith(
      'error',
      'Upgrade required to merge records',
      {
        text: 'View plans',
        href: '/settings/billing'
      }
    );
  });

  it('3. shows upgrade toast without action text when not provided', async () => {
    const response = new Response(null, { status: 402 });
    const result = await handleApiResponse(response);

    expect(result).toBe(false);
    expect(toastModule.addToast).toHaveBeenCalledWith(
      'error',
      'Upgrade required',
      {
        text: 'View plans',
        href: '/settings/billing'
      }
    );
  });

  it('4. shows beta access request for 403 feature_not_enabled', async () => {
    const response = new Response(
      JSON.stringify({ error: 'feature_not_enabled' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    );
    const result = await handleApiResponse(response);

    expect(result).toBe(false);
    expect(toastModule.addToast).toHaveBeenCalledWith(
      'error',
      'This feature is in beta',
      {
        text: 'Request access',
        href: 'mailto:jeff@refynedata.com?subject=Beta Feature Access Request'
      }
    );
  });

  it('5. returns false for other error statuses without toast', async () => {
    const response = new Response(null, { status: 500 });
    const result = await handleApiResponse(response);

    expect(result).toBe(false);
    expect(toastModule.addToast).not.toHaveBeenCalled();
  });

  it('6. returns false for 403 non-beta errors without upgrade toast', async () => {
    const response = new Response(
      JSON.stringify({ error: 'forbidden' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    );
    const result = await handleApiResponse(response);

    expect(result).toBe(false);
    // Should not show upgrade toast for regular 403
    expect(toastModule.addToast).not.toHaveBeenCalled();
  });
});
