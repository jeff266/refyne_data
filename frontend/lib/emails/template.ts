/**
 * Shared Email Template with Refyne Brand Standards
 *
 * Brand Standards:
 * - Header background: #162944 (navy)
 * - Button: square corners, #2E6BA8 (steel blue)
 * - No border-radius
 * - No emojis
 * - Font: Jost (body), Lora (headings)
 * - From: hello@refynedata.com
 * - Footer: "Refyne - CRM data quality for HubSpot teams"
 */

interface EmailTemplateOptions {
  title: string;
  preheader?: string;
  content: string;
  showUnsubscribe?: boolean;
  unsubscribeUrl?: string;
}

/**
 * Generate complete email HTML with brand standards
 */
export function buildEmailTemplate(options: EmailTemplateOptions): string {
  const { title, preheader, content, showUnsubscribe = true, unsubscribeUrl } = options;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  ${preheader ? `<meta name="description" content="${preheader}">` : ''}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600;700&family=Lora:wght@600;700&display=swap" rel="stylesheet">
  <style>
    body { margin: 0; padding: 0; font-family: 'Jost', sans-serif; }
    h1, h2, h3, h4, h5, h6 { font-family: 'Lora', Georgia, serif; }
  </style>
</head>
<body style="margin: 0; padding: 0; background: #f5f5f5; font-family: 'Jost', sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="padding: 32px 24px; background: #162944;">
              <div style="font-family: 'Lora', Georgia, serif; font-size: 24px; font-weight: 700; color: #ffffff;">
                Refyne
              </div>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px 24px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px; text-align: center; border-top: 1px solid #e5e7eb; background: #f9fafb;">
              <div style="font-family: 'Jost', sans-serif; font-size: 12px; color: #6b7280; margin-bottom: 8px;">
                Refyne - CRM data quality for HubSpot teams
              </div>
              ${
                showUnsubscribe
                  ? `
              <div style="font-family: 'Jost', sans-serif; font-size: 11px; color: #9ca3af;">
                ${unsubscribeUrl ? `<a href="${unsubscribeUrl}" style="color: #2E6BA8; text-decoration: none;">Unsubscribe</a> · ` : ''}
                <a href="https://app.refynedata.com/settings" style="color: #2E6BA8; text-decoration: none;">Settings</a>
              </div>
              `
                  : ''
              }
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate branded button HTML
 */
export function buildButton(text: string, url: string): string {
  return `
    <table cellpadding="0" cellspacing="0" style="margin: 20px 0;">
      <tr>
        <td>
          <a href="${url}" style="display: inline-block; padding: 14px 28px; background: #2E6BA8; color: #ffffff; text-decoration: none; font-family: 'Jost', sans-serif; font-size: 15px; font-weight: 600;">
            ${text}
          </a>
        </td>
      </tr>
    </table>
  `.trim();
}

/**
 * Generate section heading
 */
export function buildHeading(text: string, level: 1 | 2 | 3 = 2): string {
  const sizes = {
    1: '24px',
    2: '18px',
    3: '16px',
  };

  return `
    <h${level} style="font-family: 'Lora', Georgia, serif; font-size: ${sizes[level]}; font-weight: 600; color: #1f2937; margin: 24px 0 12px 0;">
      ${text}
    </h${level}>
  `.trim();
}

/**
 * Generate paragraph
 */
export function buildParagraph(text: string): string {
  return `
    <p style="font-family: 'Jost', sans-serif; font-size: 15px; color: #1f2937; line-height: 1.6; margin: 16px 0;">
      ${text}
    </p>
  `.trim();
}

/**
 * Generate info card
 */
export function buildInfoCard(content: string): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb; border: 1px solid #e5e7eb; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          ${content}
        </td>
      </tr>
    </table>
  `.trim();
}

/**
 * Generate data row (label: value)
 */
export function buildDataRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding: 8px 0; font-family: 'Jost', sans-serif; font-size: 13px; color: #6b7280; border-top: 1px solid #e5e7eb;">
        ${label}
      </td>
      <td style="padding: 8px 0; font-family: 'Jost', sans-serif; font-size: 13px; color: #1f2937; font-weight: 600; text-align: right; border-top: 1px solid #e5e7eb;">
        ${value}
      </td>
    </tr>
  `.trim();
}
