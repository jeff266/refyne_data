/**
 * Debug email sending with detailed error logging
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function debugEmailSend() {
  console.log('\n🔍 Email Send Debug');
  console.log('═'.repeat(80));

  // Check environment variables
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Refyne <noreply@refyne.io>';

  console.log('\n1️⃣ Environment Check:');
  console.log(`   RESEND_API_KEY: ${resendKey ? resendKey.substring(0, 10) + '...' : 'NOT SET'}`);
  console.log(`   RESEND_FROM_EMAIL: ${fromEmail}`);

  if (!resendKey) {
    console.error('\n❌ RESEND_API_KEY not set in .env.local');
    process.exit(1);
  }

  // Load Resend
  console.log('\n2️⃣ Loading Resend package...');
  let Resend: any;
  try {
    Resend = (await import('resend')).Resend;
    console.log('   ✅ Resend package loaded');
  } catch (error) {
    console.error('   ❌ Failed to load Resend:', error);
    process.exit(1);
  }

  const resend = new Resend(resendKey);

  // Send test email
  console.log('\n3️⃣ Sending test email...');

  const testEmail = 'jeff@refynedata.com'; // Update this if needed

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to: testEmail,
      subject: 'Test Email from Refyne',
      html: `
        <h1>Test Email</h1>
        <p>This is a test email from Refyne to verify email delivery.</p>
        <p>If you receive this, the email system is working!</p>
        <p>Sent at: ${new Date().toISOString()}</p>
      `,
    });

    console.log('\n   ✅ Email sent successfully!');
    console.log('   Response:', JSON.stringify(result, null, 2));
    console.log('\n📬 Check your inbox at:', testEmail);
    console.log('   (Also check spam/junk folder)');

  } catch (error: any) {
    console.error('\n   ❌ Email send failed!');
    console.error('   Error:', error.message);

    if (error.response) {
      console.error('   Response:', JSON.stringify(error.response, null, 2));
    }

    if (error.statusCode === 403) {
      console.error('\n   🔑 API Key Issue: The API key may be invalid or not authorized');
    } else if (error.statusCode === 422) {
      console.error('\n   📧 Email Format Issue: Check the from/to email addresses');
    }

    process.exit(1);
  }

  console.log('\n' + '═'.repeat(80));
  process.exit(0);
}

debugEmailSend();
