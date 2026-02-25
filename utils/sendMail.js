// utils/sendMail.js
const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || "smtp.gmail.com",
  port: parseInt(process.env.MAIL_PORT) || 465,
  secure: true, // ✅ Use SSL
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false, // Helps with some network environments
  },
});

/* 🔍 VERIFY SMTP ON SERVER START */
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ SMTP VERIFY FAILED:", error.message);
  } else {
    console.log("✅ SMTP SERVER READY");
  }
});

/**
 * Send mail
 */
const sendMail = async ({ to, subject, html, attachments = [] }) => {
  const mailOptions = {
    from: `"PRITHU" <${process.env.MAIL_USER}>`,
    to,
    subject,
    html,
    attachments,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log("✅ Email sent:", info.messageId);
  return info;
};

const sendMailSafeSafe = async ({ to, subject, html, attachments = [] }) => {
  if (!to) {
    console.warn("⚠️ Email not sent: 'to' missing");
    return;
  }
  try {
    return await sendMail({ to, subject, html, attachments });
  } catch (err) {
    console.error("❌ Failed to send email:", err.message);
    throw err;
  }
};

module.exports = { sendMail, sendMailSafeSafe };
