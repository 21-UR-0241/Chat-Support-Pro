// routes/email.js
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

router.post('/send', authMiddleware, async (req, res) => {
  const { to, subject, body, conversationId, customerName } = req.body;

  if (!to || !subject || !body) {
    return res.status(400).json({ error: 'to, subject, and body are required' });
  }

  const { data, error } = await resend.emails.send({
    from: 'Support <support@yourdomain.com>',
    to,
    subject,
    html: `<div style="font-family:sans-serif;line-height:1.6">${body.replace(/\n/g, '<br>')}</div>`,
  });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, id: data.id });
});