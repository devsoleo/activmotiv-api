import nodemailer from 'nodemailer'
import logger from '../logger/index.js'

const NODE_ENV = process.env.NODE_ENV || 'development'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USERNAME,
    pass: process.env.SMTP_PASSWORD,
  }
})

const sendMail = async (to, subject, html, attachments) => {
  if (NODE_ENV != 'production') return

  await transporter.sendMail({
    from: process.env.SMTP_SENDER,
    to,
    subject,
    html,
    attachments
  })

  logger.info({ message: "Mail send", subject })
}

export { sendMail }