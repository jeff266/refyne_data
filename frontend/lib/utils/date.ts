/**
 * Date Formatting Utilities
 *
 * Centralized date formatting functions used across the app.
 */

/**
 * Format ISO timestamp for display (e.g., "Jun 6, 4:59 AM")
 *
 * @param isoString - ISO 8601 timestamp
 * @returns Formatted timestamp
 */
export function formatTimestamp(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Format ISO date for display (e.g., "Jun 6, 2026")
 *
 * @param isoString - ISO 8601 date
 * @returns Formatted date
 */
export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Get date label for grouping (TODAY, YESTERDAY, or formatted date)
 *
 * Uses client-side timezone for "today" calculation.
 *
 * @param isoString - ISO 8601 timestamp
 * @returns Date label (TODAY, YESTERDAY, or YYYY-MM-DD)
 */
export function getDateLabel(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();

  // Start of today in client timezone
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Start of yesterday
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  if (date >= todayStart) {
    return 'TODAY';
  } else if (date >= yesterdayStart) {
    return 'YESTERDAY';
  } else {
    // Return formatted date (e.g., "JUNE 5, 2026")
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).toUpperCase();
  }
}
