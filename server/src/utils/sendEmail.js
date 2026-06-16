const nodemailer = require("nodemailer");

const sendEmail = async (to, subject, text) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error("SMTP email credentials are not configured on the server (EMAIL_USER / EMAIL_PASS).");
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      family: 4 // Force IPv4 to prevent ENETUNREACH errors on cloud hosts like Render
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
