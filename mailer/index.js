import nodemailer from 'nodemailer'
import logger from '../logger/index.js'

const SMTP_TO = process.env.SMTP_TO
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

const sendMail = async (subject, html, attachments) => {
  await transporter.sendMail({
    from: SMTP_SENDER,
    to: SMTP_TO,
    subject,
    html,
    attachments
  })

  logger.info({ message: "Mail send", subject })
}

export { sendMail }