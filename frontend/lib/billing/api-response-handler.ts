import { addToast } from '@/components/ui/toast';

/**
 * Handle API responses and show upgrade prompts for 402 errors
 *
 * @param response - Fetch response object
 * @param action - Human-readable action name (e.g., "merge records")
 * @returns true if response is ok, false if error
 */
export async function handleApiResponse(
  response: Response,
  action?: string
): Promise<boolean> {
  if (response.ok) {
    return true;
  }

  // 402 Payment Required - show upgrade prompt
  if (response.status === 402) {
    const actionText = action ? ` to ${action}` : '';
    addToast(
      'error',
      `Upgrade required${actionText}`,
      {
        text: 'View plans',
        href: '/settings/billing'
      }
    );
    return false;
  }

  // 403 for feature_not_enabled (beta gates)
  if (response.status === 403) {
    const data = await response.json().catch(() => ({}));
    if (data.error === 'feature_not_enabled') {
      addToast(
        'error',
        'This feature is in beta',
        {
          text: 'Request access',
          href: 'mailto:jeff@refynedata.com?subject=Beta Feature Access Request'
        }
      );
      return false;
    }
  }

  // Other errors - no upgrade prompt
  return false;
}

/**
 * Wrapper for fetch that automatically handles 402 responses
 *
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param action - Human-readable action name for error messages
 * @returns Fetch response or null if 402 error
 */
export async function fetchWithUpgradePrompt(
  url: string,
  options?: RequestInit,
  action?: string
): Promise<Response | null> {
  const response = await fetch(url, options);
  const ok = await handleApiResponse(response, action);
  return ok ? response : null;
}
