import express from 'express'
import dayjs from 'dayjs'

import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'
import { sendMail } from '@/mailer/index.js'

import { authenticateToken } from '@/middlewares/auth.js'
import { questionnaireSchema } from '@/validators/questionnaire.schema.js'

const router = express.Router()

const processQuestionnaire = async (client, user, label, headers, results, timestamp) => {
  const filename = `${label}-${user.uid}-${dayjs(timestamp).format('DD-MM-YYYY')}.csv`

  if (label == 'generic') {
    headers.splice(headers.indexOf('a1') + 1, 0, 'a1_utile')
    headers.splice(headers.indexOf('a1') + 1, 0, 'a1_benefique')
    headers.splice(headers.indexOf('a1') + 1, 0, 'a1_sage')
    headers.splice(headers.indexOf('a2') + 1, 0, 'a2_agreable')
    headers.splice(headers.indexOf('a2') + 1, 0, 'a2_amusant')
    headers.splice(headers.indexOf('a2') + 1, 0, 'a2_plaisant')

    headers = headers.filter(i => i !== 'a1' && i !== 'a2')
  }

  const content_header = `uid;date;${headers.toString().split(',').join(';')}`
  const content_results = `${user.uid};${dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss')};${results.toString().split(',').join(';')}`

  await client.query(`INSERT INTO questionnaires (user_id, label, completed_at) VALUES ($1, $2, $3)`, [user.id, label, dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss')])
  
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

router.post('/:label', authenticateToken, async (req, res) => {
  const { label } = req.params

  const validation = questionnaireSchema.safeParse(req.body.data)

  if (!validation.success) return res.status(400).json({ errors: validation.error.format() })

  const data = validation.data

  const client = await pool.getClient()

  try {
    await processQuestionnaire(client, req.user, label, data.headers, data.results, data.timestamp)

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