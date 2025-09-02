import nodemailer from 'nodemailer'
import logger from '../logger/index.js'

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
  await transporter.sendMail({
    from: SMTP_SENDER,
    to,
    subject,
    html,
  })

  logger.info({ message: "Mail send", to, subject })
}

export { sendMail }