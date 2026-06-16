const nodemailer = require("nodemailer");
const dns = require("dns");
const axios = require("axios");

// Force Node's DNS resolver to prioritize IPv4 address lookup over IPv6.
// This resolves ENETUNREACH issues on cloud hosts like Render that lack IPv6 connectivity.
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

const sendEmail = async (to, subject, text) => {
  try {
    // 1. Check if Resend API is configured (required for Render Free tier to bypass blocked SMTP ports)
    if (process.env.RESEND_API_KEY) {
      console.log("Attempting to send email via Resend API...");
      const fromEmail = process.env.EMAIL_FROM || "onboarding@resend.dev";
      
      const response = await axios.post(
        "https://api.resend.com/emails",
        {
          from: `Vertex Connect <${fromEmail}>`,
          to: [to],
          subject: subject,
          text: text,
        },
        {
          headers: {
            "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      
      console.log("Email sent successfully via Resend API:", response.data);
      return;
    }

    // 2. Fallback to standard Nodemailer SMTP (works locally, but blocked on Render Free tier)
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
    const errorDetails = error.response?.data?.message || error.response?.data || error.message;
    console.error("Email Sending Error Details:", errorDetails);
    throw new Error(errorDetails);
  }
};

module.exports = sendEmail;
