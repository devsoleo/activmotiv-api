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
    dayjs(timestamp).toISOString()
  ])

  await client.query(`
    INSERT INTO notifications (device_id, template, scheduled_at)
    SELECT id, $1, $2
    FROM devices
    WHERE user_id = $3 AND is_active = true
    LIMIT 1
  `, [
    label, 
    dayjs(timestamp).add(process.env.NOTIFICATION_DAYS_INTERVAL, 'day').toISOString(), 
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

const PHASES_BY_TEAM = {
  1: [
    { startDays: 1, endDays: 1 + 7 },            // Phase 1: 1 -> 8
    { startDays: 1 + 14, endDays: 1 + 21 },      // Phase 2: 15 -> 22
    { startDays: 1 + 28, endDays: 1 + 35 }       // Phase 3: 29 -> 36
  ],
  2: [
    { startDays: 1 + 7, endDays: 1 + 14 },       // Phase 1: 8 -> 15
    { startDays: 1 + 21, endDays: 1 + 28 },      // Phase 2: 22 -> 29
    { startDays: 1 + 35, endDays: 1 + 42 }       // Phase 3: 36 -> 43
  ],
  3: [
    { startDays: 1 + 7, endDays: 1 + 14 },       // Phase 1: 8 -> 15
    { startDays: 1 + 28, endDays: 1 + 35 },      // Phase 2: 29 -> 36
    { startDays: 1 + 42, endDays: 1 + 49 }       // Phase 3: 43 -> 50
  ]
}

router.get('/status', authenticateToken, async (req, res) => {
  if (dayjs().tz().hour() >= 13) {
    return res.status(200).json({ display: false })
  }

  const client = await pool.getClient()

  try {
    const completedTodayResult = await client.query(
      `SELECT COUNT(*) FROM questionnaires WHERE user_id = $1 AND completed_at >= (CURRENT_DATE AT TIME ZONE 'Europe/Paris')`,
      [req.user.id]
    )

    if (parseInt(completedTodayResult.rows[0].count, 10) > 0) {
      return res.status(200).json({ display: false })
    }

    const result = await client.query('SELECT team, created_at FROM users WHERE id = $1', [req.user.id])
    const u = result.rows[0]

    if (!u || !u.created_at || u.team == null) {
      return res.status(200).json({ display: false })
    }

    const team = parseInt(u.team, 10)
    const teamPhases = PHASES_BY_TEAM[team]

    if (!teamPhases) {
      return res.status(200).json({ display: false })
    }

    const now = Date.now()
    let display = false

    for (const phase of teamPhases) {
      const debut = dayjs(u.created_at).tz().add(phase.startDays, 'day')
      const fin = dayjs(u.created_at).tz().add(phase.endDays, 'day')

      if (now >= debut.valueOf() && now <= fin.valueOf()) {
        display = true
        break
      }
    }

    return res.status(200).json({ display })
  } catch (err) {
    logger.error("Error checking questionnaire status:", err)
    return res.sendStatus(500)
  } finally {
    client.release()
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
