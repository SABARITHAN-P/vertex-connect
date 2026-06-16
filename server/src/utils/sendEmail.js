const nodemailer = require("nodemailer");
const dns = require("dns");
const axios = require("axios");

// Force Node's DNS resolver to prioritize IPv4 address lookup over IPv6.
// This resolves ENETUNREACH issues on cloud hosts like Render that lack IPv6 connectivity.
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

/**
 * Gets an active access token from Google OAuth2 using the refresh token.
 */
const getGmailAccessToken = async () => {
  try {
    const response = await axios.post("https://oauth2.googleapis.com/token", {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    });
    return response.data.access_token;
  } catch (error) {
    const errMsg = error.response?.data?.error_description || error.response?.data?.error || error.message;
    console.error("Failed to refresh Google OAuth access token:", errMsg);
    throw new Error(`Google OAuth authentication failed: ${errMsg}`);
  }
};

/**
 * Helper to build an RFC 822 compliant raw email and encode it to Base64Url format.
 */
const buildRawEmail = (to, from, subject, messageText) => {
  const emailLines = [
    `From: Vertex Connect <${from}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "MIME-Version: 1.0",
    "",
    messageText,
  ];
  const email = emailLines.join("\r\n");
  
  // Base64url encode the raw email content
  return Buffer.from(email)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

const sendEmail = async (to, subject, text) => {
  try {
    // 1. Primary: Use Gmail HTTP API if Google OAuth credentials are provided.
    // This bypasses Render's SMTP port restrictions completely because it runs over HTTPS (port 443).
    if (
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN &&
      process.env.EMAIL_USER
    ) {
      console.log("Attempting to send email via Google Gmail HTTP API...");
      const accessToken = await getGmailAccessToken();
      const raw = buildRawEmail(to, process.env.EMAIL_USER, subject, text);

      const response = await axios.post(
        "https://gmail.googleapis.com/v1/users/me/messages/send",
        { raw },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      
      console.log("Email sent successfully via Gmail HTTP API:", response.data.id);
      return;
    }

    // 2. Secondary: Use Brevo HTTP REST API if Brevo credentials are provided.
    // Runs over HTTPS (port 443) and sends from the user's verified sender email address.
    if (process.env.BREVO_API_KEY && process.env.EMAIL_USER) {
      console.log("Attempting to send email via Brevo HTTP REST API...");
      const senderEmail = process.env.EMAIL_USER;
      
      const response = await axios.post(
        "https://api.brevo.com/v3/smtp/email",
        {
          sender: {
            name: "Vertex Connect",
            email: senderEmail,
          },
          to: [
            {
              email: to,
            },
          ],
          subject: subject,
          textContent: text,
        },
        {
          headers: {
            "api-key": process.env.BREVO_API_KEY,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
        }
      );
      
      console.log("Email sent successfully via Brevo REST API:", response.data.messageId);
      return;
    }
    // 3. Fallback: Standard Nodemailer SMTP (works locally, but blocked on Render Free tier)
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error("SMTP email credentials are not configured on the server (EMAIL_USER / EMAIL_PASS).");
    }

    console.log("Attempting to send email via Nodemailer SMTP...");
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      family: 4 // Force IPv4 socket connection
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      text,
    };

    await transporter.sendMail(mailOptions);
    console.log("Email sent successfully via SMTP");
  } catch (error) {
    // Extract a clear, readable error message
    const errorDetails = error.response?.data?.message || error.response?.data?.messageId || error.response?.data || error.message;
    console.error("Email Sending Error Details:", errorDetails);
    throw new Error(errorDetails);
  }
};

module.exports = sendEmail;
