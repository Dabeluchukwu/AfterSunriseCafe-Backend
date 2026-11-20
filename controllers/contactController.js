import Message from "../models/Message.js";
import { sendEmail } from "../utils/sendEmail.js";

// @desc    Submit a contact message (public)
// @route   POST /api/contact
// @access  Public
export const createMessage = async (req, res, next) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      res.status(400);
      throw new Error("Name, email, subject, and message are required");
    }

    // 1. Save to DB first — this is the source of truth
    const doc = await Message.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || "",
      subject: subject.trim(),
      message: message.trim(),
      status: "unread",
    });

    // 2. Fire off both emails in parallel, but never let failures
    //    break the request. We log warnings instead.
    sendContactEmails(doc).catch((err) =>
      console.warn("Contact auto-email failed:", err.message)
    );

    // 3. Respond immediately — user sees success regardless of email state
    res.status(201).json({
      message: "Your message has been received. We'll get back to you soon!",
      id: doc._id,
    });
  } catch (error) {
    next(error);
  }
};

// Helper: sends the two auto-emails (ack to user + notification to admin)
async function sendContactEmails(doc) {
  const senderName = doc.name;
  const senderEmail = doc.email;
  const subjectLine = doc.subject;
  const bodyText = doc.message;
  const phoneLine = doc.phone || "—";
  const submittedAt = new Date(doc.createdAt).toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const adminEmail = process.env.BREVO_SENDER_EMAIL || "aftersunrise001@gmail.com";

  // --- A. Acknowledgment to the sender ---
  const ackHtml = `
    <div style="font-family: Arial, sans-serif; color:#1F2937; line-height:1.6; max-width:560px;">
      <h2 style="color:#DC2626; margin:0 0 12px;">We've received your message 🥐</h2>
      <p>Hi ${escapeHtml(senderName)},</p>
      <p>
        Thank you for reaching out to <strong>After Sunrise Bakery</strong>.
        We've received your inquiry and will get back to you as soon as possible
        (usually within a few hours during business hours).
      </p>
      <p style="background:#FDF2F8; border-left:4px solid #F9A8D4; padding:12px 16px; margin:20px 0;">
        <strong>Your message:</strong><br/>
        <em>"${escapeHtml(subjectLine)}"</em><br/>
        <span style="color:#6b7280; font-size:13px;">${escapeHtml(bodyText).replace(/\n/g, "<br/>")}</span>
      </p>
      <p>If you'd like to reach us faster, you can call us on
        <strong>07042660291</strong> or WhatsApp <strong>08088659045</strong>.
      </p>
      <p>Warm regards,<br/><strong>After Sunrise Bakery</strong></p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="font-size:12px;color:#9ca3af;">
        This is an automated confirmation — please do not reply directly to this email.
        Replies go to ${adminEmail}.
      </p>
    </div>
  `;

  // --- B. Notification to the admin ---
  const adminHtml = `
    <div style="font-family: Arial, sans-serif; color:#1F2937; line-height:1.6; max-width:600px;">
      <h2 style="color:#DC2626; margin:0 0 12px;">📬 New contact message</h2>
      <p>A new message just came through the website contact form.</p>
      <table style="border-collapse:collapse; width:100%; font-size:14px;">
        <tr><td style="padding:6px 0; width:120px; color:#6b7280;">From</td>
            <td style="padding:6px 0;"><strong>${escapeHtml(senderName)}</strong></td></tr>
        <tr><td style="padding:6px 0; color:#6b7280;">Email</td>
            <td style="padding:6px 0;">${escapeHtml(senderEmail)}</td></tr>
        <tr><td style="padding:6px 0; color:#6b7280;">Phone</td>
            <td style="padding:6px 0;">${escapeHtml(phoneLine)}</td></tr>
        <tr><td style="padding:6px 0; color:#6b7280;">Subject</td>
            <td style="padding:6px 0;"><strong>${escapeHtml(subjectLine)}</strong></td></tr>
        <tr><td style="padding:6px 0; color:#6b7280;">Submitted</td>
            <td style="padding:6px 0;">${escapeHtml(submittedAt)}</td></tr>
      </table>
      <div style="margin:20px 0; padding:16px; background:#FEF2F2; border-left:4px solid #DC2626;">
        <strong>Message:</strong><br/>
        ${escapeHtml(bodyText).replace(/\n/g, "<br/>")}
      </div>
      <p>
        <a href="${process.env.CLIENT_URL || "http://localhost:3000"}/admin/messages"
           style="display:inline-block; background:#DC2626; color:#fff; padding:10px 18px;
                  border-radius:6px; text-decoration:none; font-weight:600;">
          Open Inbox →
        </a>
      </p>
      <p style="font-size:12px;color:#9ca3af;">
        You can reply directly from the admin dashboard — the reply will be emailed to the sender.
      </p>
    </div>
  `;

  // Send both in parallel; each wrapped so one failure doesn't kill the other
  const results = await Promise.allSettled([
    sendEmail({
      to: senderEmail,
      toName: senderName,
      subject: "We received your message — After Sunrise Bakery",
      html: ackHtml,
      text: `Hi ${senderName},\n\nThank you for reaching out to After Sunrise Bakery. We've received your message and will get back to you shortly.\n\nYour message: "${subjectLine}"\n\n— After Sunrise Bakery\nPhone: 07042660291 | WhatsApp: 08088659045`,
      replyTo: adminEmail,
    }),
    sendEmail({
      to: adminEmail,
      toName: "After Sunrise Admin",
      subject: `📬 New message from ${senderName}: ${subjectLine}`,
      html: adminHtml,
      text: `New message from ${senderName} (${senderEmail}, ${phoneLine})\nSubject: ${subjectLine}\n\n${bodyText}`,
      replyTo: senderEmail,
    }),
  ]);

  // Log individual failures so you can see them in server logs
  results.forEach((r, i) => {
    const label = i === 0 ? "ack (to sender)" : "notification (to admin)";
    if (r.status === "rejected") {
      console.warn(`Contact auto-email ${label} failed:`, r.reason?.message);
    }
  });
}

// @desc    Get all messages (admin)
// @route   GET /api/contact
// @access  Private
export const getMessages = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status && ["unread", "read", "replied"].includes(status)) {
      filter.status = status;
    }
    const messages = await Message.find(filter).sort({ createdAt: -1 });
    res.json(messages);
  } catch (error) {
    next(error);
  }
};

// @desc    Get a single message (admin)
// @route   GET /api/contact/:id
// @access  Private
export const getMessageById = async (req, res, next) => {
  try {
    const doc = await Message.findById(req.params.id);
    if (!doc) {
      res.status(404);
      throw new Error("Message not found");
    }
    res.json(doc);
  } catch (error) {
    next(error);
  }
};

// @desc    Mark message as read (admin)
// @route   PUT /api/contact/:id/read
// @access  Private
export const markAsRead = async (req, res, next) => {
  try {
    const doc = await Message.findById(req.params.id);
    if (!doc) {
      res.status(404);
      throw new Error("Message not found");
    }
    if (doc.status === "unread") {
      doc.status = "read";
      await doc.save();
    }
    res.json(doc);
  } catch (error) {
    next(error);
  }
};

// @desc    Reply to a message via Brevo (admin)
// @route   POST /api/contact/:id/reply
// @access  Private
export const replyToMessage = async (req, res, next) => {
  try {
    const { reply } = req.body;
    if (!reply || !reply.trim()) {
      res.status(400);
      throw new Error("Reply text is required");
    }

    const doc = await Message.findById(req.params.id);
    if (!doc) {
      res.status(404);
      throw new Error("Message not found");
    }

    const html = `
      <div style="font-family: Arial, sans-serif; color: #1F2937; line-height: 1.6;">
        <p>Hi ${escapeHtml(doc.name)},</p>
        <p>${escapeHtml(reply).replace(/\n/g, "<br/>")}</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="font-size:12px;color:#6b7280;">
          — After Sunrise Bakery<br/>
          Reply to: ${process.env.BREVO_SENDER_EMAIL}<br/>
          Phone: 07042660291 · WhatsApp: 08088659045
        </p>
      </div>
    `;

    await sendEmail({
      to: doc.email,
      toName: doc.name,
      subject: `Re: ${doc.subject}`,
      html,
      text: reply,
      replyTo: process.env.BREVO_SENDER_EMAIL,
    });

    doc.reply = reply.trim();
    doc.status = "replied";
    doc.repliedAt = new Date();
    await doc.save();

    res.json({ message: "Reply sent", data: doc });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a message (admin)
// @route   DELETE /api/contact/:id
// @access  Private
export const deleteMessage = async (req, res, next) => {
  try {
    const doc = await Message.findById(req.params.id);
    if (!doc) {
      res.status(404);
      throw new Error("Message not found");
    }
    await doc.deleteOne();
    res.json({ message: "Message deleted" });
  } catch (error) {
    next(error);
  }
};

// Tiny helper to prevent HTML injection in the reply body
function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}