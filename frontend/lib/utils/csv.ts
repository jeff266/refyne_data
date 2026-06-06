/**
 * CSV Building Utilities
 *
 * Helper functions for generating CSV exports.
 * Follows RFC 4180 (CSV format specification).
 */

/**
 * Escape a value for CSV output
 *
 * - Wraps value in double quotes
 * - Escapes internal double quotes by doubling them
 * - Handles null/undefined as empty string
 *
 * @param value - Value to escape
 * @returns CSV-safe string
 */
export function escapeCSV(value: any): string {
  const str = value !== null && value !== undefined ? String(value) : '';
  // Double-quote escaping per RFC 4180
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Build CSV content from headers and rows
 *
 * @param headers - Column headers
 * @param rows - Data rows (each row is array of values)
 * @returns CSV content as string
 */
export function buildCSV(headers: string[], rows: any[][]): string {
  const csvRows = [
    headers.map(escapeCSV).join(','),
    ...rows.map((row) => row.map(escapeCSV).join(',')),
  ];
  return csvRows.join('\n');
}
