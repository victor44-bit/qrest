// lib/mailer.ts
import nodemailer from "nodemailer";

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM_NAME = "Qrest",
} = process.env;

if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
  console.warn("[mailer] Missing SMTP env vars – emails will fail to send.");
}

export const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT || 465),
  secure: Number(SMTP_PORT || 465) === 465, // 465 -> true, 587 -> false
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

export function fromAddress() {
  return `${MAIL_FROM_NAME} <${SMTP_USER}>`;
}

// ✅ Export a convenience helper since your route imports `sendMail`
export async function sendMail(opts: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}) {
  return transporter.sendMail({
    from: fromAddress(),
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
}
