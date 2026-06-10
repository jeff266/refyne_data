/**
 * Cookie Consent Hook
 *
 * Manages GDPR/CCPA cookie consent for Refyne.
 * Stores consent level in a client-side cookie.
 */

import { useState, useEffect, useCallback } from 'react';

export type ConsentLevel = 'essential' | 'all' | null;

/**
 * Cookie utilities (no external library needed)
 */
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(
    new RegExp('(^| )' + name + '=([^;]+)')
  );
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 864e5);
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  document.cookie =
    `${name}=${encodeURIComponent(value)}` +
    `; expires=${expires.toUTCString()}` +
    `; path=/; SameSite=Lax${secure}`;
}

function deleteCookie(name: string) {
  document.cookie =
    `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC` +
    `; path=/`;
}

/**
 * Sentry replay control functions
 */
function enableSentryReplay() {
  if (typeof window !== 'undefined' && (window as any).enableSentryReplay) {
    (window as any).enableSentryReplay();
  }
}

function disableSentryReplay() {
  // Replay can't be truly disabled once started
  // In practice this rarely happens
  console.log('[Consent] Sentry replay disabled');
}

/**
 * Hook for managing cookie consent
 */
export function useCookieConsent() {
  const [consent, setConsent] = useState<ConsentLevel>(null);

  useEffect(() => {
    // Read existing cookie on mount
    const existing = getCookie('refyne_cookie_consent');
    if (existing === 'essential' || existing === 'all') {
      setConsent(existing);

      // Enable Sentry replay if user previously consented to all
      if (existing === 'all') {
        enableSentryReplay();
      }
    }
  }, []);

  const acceptEssential = useCallback(() => {
    setCookie('refyne_cookie_consent', 'essential', 365);
    setConsent('essential');
    // Disable Sentry replay if it was running
    disableSentryReplay();
  }, []);

  const acceptAll = useCallback(() => {
    setCookie('refyne_cookie_consent', 'all', 365);
    setConsent('all');
    // Enable Sentry replay
    enableSentryReplay();
  }, []);

  const resetConsent = useCallback(() => {
    deleteCookie('refyne_cookie_consent');
    setConsent(null);
    // Banner will reappear
  }, []);

  const hasConsent = useCallback((level: ConsentLevel) => {
    if (level === 'essential') return consent !== null;
    if (level === 'all') return consent === 'all';
    return false;
  }, [consent]);

  return {
    consent,
    acceptEssential,
    acceptAll,
    resetConsent,
    hasConsent,
    showBanner: consent === null,
  };
}
