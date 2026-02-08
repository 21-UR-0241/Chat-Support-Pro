// test-resend.js
// Quick test to verify Resend API is working
// Usage: node test-resend.js your-email@gmail.com

require('dotenv').config();
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const testEmail = process.argv[2];

if (!testEmail) {
  console.error('Usage: node test-resend.js your-email@gmail.com');
  process.exit(1);
}

if (!process.env.RESEND_API_KEY) {
  console.error('❌ Missing RESEND_API_KEY in .env');
  process.exit(1);
}

async function test() {
  console.log(`📧 Sending test email to ${testEmail}...`);

  const { data, error } = await resend.emails.send({
    from: 'Montreal Peptides Canada <support@montrealpeptides.ca>',
    to: [testEmail],
    subject: 'Chat Notification Test ✅',
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 40px auto; padding: 32px; background: #fff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
        <div style="display: inline-block; background: #1a5632; color: white; width: 44px; height: 44px; line-height: 44px; text-align: center; border-radius: 10px; font-size: 20px; font-weight: 700; margin-bottom: 20px;">MP</div>
        <h1 style="font-size: 20px; color: #1a202c;">It works! ✅</h1>
        <p style="color: #718096; line-height: 1.6;">Your Resend email notification system is configured correctly. Offline customers will receive emails like this when agents reply.</p>
        <div style="background: #f7fafc; border-radius: 8px; padding: 14px 16px; border-left: 3px solid #1a5632; margin: 20px 0;">
          <div style="font-weight: 600; font-size: 13px; color: #4a5568; margin-bottom: 6px;">Support Agent</div>
          <div style="font-size: 14px; color: #1a202c;">This is what an offline notification email looks like!</div>
        </div>
        <p style="font-size: 12px; color: #a0aec0; margin-top: 24px;">Sent from Resend via send.montrealpeptides.ca</p>
      </div>
    `,
  });

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  console.log(`✅ Sent! Resend ID: ${data.id}`);
  console.log('Check your inbox (and spam folder).');
}

test().catch(err => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});