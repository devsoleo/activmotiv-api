import nodemailer from 'nodemailer'

const SMTP_HOST = process.env.SMTP_HOST
const SMTP_USERNAME = process.env.SMTP_USERNAME
const SMTP_PASSWORD = process.env.SMTP_PASSWORD
const SMTP_SENDER = process.env.SMTP_SENDER

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: 587,
  secure: false,
  auth: {
    user: SMTP_USERNAME,
    pass: SMTP_PASSWORD,
  },
})

const sendMail = async (to, subject, html) => {
  const info = await transporter.sendMail({
    from: SMTP_SENDER,
    to,
    subject,
    // text: "Hello world?", // plain‑text body
    html,
  })

  console.log("Message sent:", info.messageId)
}

export { sendMail }