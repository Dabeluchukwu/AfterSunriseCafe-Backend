import axios from "axios";

/**
 * Send a transactional email via Brevo.
 * @param {Object} opts
 * @param {string} opts.to - recipient email
 * @param {string} opts.toName - recipient name (optional)
 * @param {string} opts.subject
 * @param {string} opts.html - HTML body
 * @param {string} [opts.text] - plain text fallback
 * @param {string} [opts.replyTo] - reply-to email
 */
export const sendEmail = async ({
  to,
  toName = "",
  subject,
  html,
  text,
  replyTo,
}) => {
  if (!process.env.BREVO_API_KEY) {
    throw new Error("BREVO_API_KEY is not configured");
  }

  const payload = {
    sender: {
      email: process.env.BREVO_SENDER_EMAIL,
      name: process.env.BREVO_SENDER_NAME || "After Sunrise Bakery",
    },
    to: [{ email: to, name: toName }],
    subject,
    htmlContent: html,
    textContent: text || html.replace(/<[^>]+>/g, ""),
  };

  if (replyTo) payload.replyTo = { email: replyTo };

  try {
    const { data } = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      payload,
      {
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );
    return data;
  } catch (error) {
    const msg =
      error.response?.data?.message || error.message || "Brevo send failed";
    throw new Error(`Email send failed: ${msg}`);
  }
};