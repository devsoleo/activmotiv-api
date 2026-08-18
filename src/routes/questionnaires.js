import express from 'express'
import dayjs from 'dayjs'

import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'
import { sendMail } from '@/mailer/index.js'

import { authenticateToken } from '@/middlewares/auth.js'
import { questionnaireSchema } from '@/validators/questionnaire.schema.js'

const router = express.Router()

const processQuestionnaire = async (client, user, label, results, timestamp) => {
  const filename = `${label}-${user.uid}-${dayjs(timestamp).format('DD-MM-YYYY')}.csv`

  const headers = results.map(r => r.question)
  const answers = results.map(r => Array.isArray(r.answer) ? r.answer.join(',') : r.answer)

  const content_header = `uid;date;${headers.join(';')}`
  const content_results = `${user.uid};${dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss')};${answers.join(';')}`

  const questionnaireData = {
    results,
    timestamp
  }

  await client.query(`INSERT INTO questionnaires (user_id, label, data, completed_at) VALUES ($1, $2, $3, $4)`, [
    user.id,
    label,
    JSON.stringify(questionnaireData),
    dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss')
  ])

  await client.query(`
    INSERT INTO notifications (device_id, template, scheduled_at)
    SELECT id, $1, $2
    FROM devices
    WHERE user_id = $3 AND is_active = true
    LIMIT 1
  `, [
    label, 
    dayjs(timestamp).add(process.env.NOTIFICATION_DAYS_INTERVAL, 'day').format('YYYY-MM-DD HH:mm:ss'), 
    user.id
  ])

  sendMail(process.env.SMTP_TO, `Questionnaire ${label} de ${user.uid}`, `Voir ${filename} en pièce-jointe.`, [
    {
      filename,
      content: content_header + '\n' + content_results
    }
  ])
}

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, user_id, label, data, completed_at FROM questionnaires WHERE user_id = $1 ORDER BY completed_at DESC`,
      [req.user.id]
    )
    return res.json({ questionnaires: rows })
  } catch (err) {
    logger.error("Error fetching questionnaires:", err)
    return res.sendStatus(500)
  }
})

router.post('/:label', authenticateToken, async (req, res) => {
  const { label } = req.params

  const validation = questionnaireSchema.safeParse(req.body.data)

  if (!validation.success) return res.status(400).json({ errors: validation.error.format() })

  const data = validation.data

  const client = await pool.getClient()

  try {
    await processQuestionnaire(client, req.user, label, data.results, data.timestamp)

    logger.info({ message: "Questionnaire completed" })

    return res.sendStatus(200)
  } catch (err) {
    logger.error("Error :", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

export default router
