const nodemailer = require("nodemailer");
const dns = require("dns");

// Force Node's DNS resolver to prioritize IPv4 address lookup over IPv6.
// This resolves ENETUNREACH issues on cloud hosts like Render that lack IPv6 connectivity.
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

const sendEmail = async (to, subject, text) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error("SMTP email credentials are not configured on the server (EMAIL_USER / EMAIL_PASS).");
    }

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
    console.log("Email sent successfully");
  } catch (error) {
    console.error("Email Sending Error:", error.message);
    throw error; // Rethrow to propagate to controller and frontend
  }
};

module.exports = sendEmail;
