import express from 'express'
import dayjs from 'dayjs'

import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'
import { sendMail } from '@/mailer/index.js'

import { authenticateToken } from '@/middlewares/auth.js'
import { formSchema } from '@/validators/form.schema.js'
import { isUserInFormPhase, getUserFormPhasePosition } from '@/utils/phases.js'
import { cpSync } from 'node:fs'

const router = express.Router()

const processForm = async (client, user, label, results, timestamp) => {
  const filename = `${label}-${user.uid}-${dayjs(timestamp).format('DD-MM-YYYY')}.csv`

  const headers = results.map(r => r.question)
  const answers = results.map(r => Array.isArray(r.answer) ? r.answer.join(',') : r.answer)

  const content_header = `uid;date;${headers.join(';')}`
  const content_results = `${user.uid};${dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss')};${answers.join(';')}`

  const formData = {
    results,
    timestamp
  }

  await client.query(`INSERT INTO forms (user_id, label, data, completed_at) VALUES ($1, $2, $3, $4)`, [
    user.id,
    label,
    JSON.stringify(formData),
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
      `SELECT id, user_id, label, data, completed_at FROM forms WHERE user_id = $1 ORDER BY completed_at DESC`,
      [req.user.id]
    )
    return res.json({ forms: rows })
  } catch (err) {
    logger.error("Error fetching forms:", err)
    return res.sendStatus(500)
  }
})

router.get('/status', authenticateToken, async (req, res) => {
  const isAdmin = req.user.team === 0

  if (isAdmin) return res.status(200).json({ inPhase: true })

  const currentHour = dayjs().tz().hour()
  const inTimeWindow = currentHour >= 5 && currentHour <= 22

  const client = await pool.getClient()

  try {
    const completedTodayCount = await client.query(`SELECT COUNT(*) FROM forms WHERE user_id = $1 AND completed_at >= (CURRENT_DATE AT TIME ZONE 'Europe/Paris')`, [req.user.id])

    const count = completedTodayCount?.rows?.[0]?.count ? Number.parseInt(completedTodayCount.rows[0].count) : 0

    const doneToday = count > 0

    const result = await client.query('SELECT team, created_at FROM users WHERE id = $1', [req.user.id])
    const user = result.rows[0]

    const inPhase = (isUserInFormPhase(user) || user?.team == 0)
    console.log({ inPhase, inTimeWindow, doneToday })
    return res.status(200).json({ inPhase, inTimeWindow, doneToday })
  } catch (err) {
    logger.error("Error :", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

router.post('/:label', authenticateToken, async (req, res) => {
  const { label } = req.params

  const validation = formSchema.safeParse(req.body.data)

  if (!validation.success) return res.status(400).json({ errors: validation.error.format() })

  const data = validation.data

  const client = await pool.getClient()

  try {
    await processForm(client, req.user, label, data.results, data.timestamp)

    logger.info({ message: "Questionnaire completed" })

    return res.sendStatus(200)
  } catch (err) {
    logger.error("Error :", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

router.get('/stepper', authenticateToken, async (req, res) => {
  const user = req.user

  const client = await pool.getClient()

  try {
    const r1 = await client.query(`SELECT team, created_at FROM users WHERE id = $1`, [user.id])

    const u = r1.rows[0]

    if (isUserInFormPhase(u)) {
      const userPosition = getUserFormPhasePosition(u) - 1

      const labels = ['J1', 'J2', 'J3', 'J4', 'J5', 'J6', 'J7']

      const enrichedDates = labels.map((l, i) => ({
        label: l,
        status: 'empty',
        selected: i == userPosition
      }))

      const r2 = await client.query(
        `SELECT
          completed_at,
          completed_at::date - (CURRENT_DATE - $2::int) AS day_index
        FROM forms
        WHERE user_id = $1
          AND completed_at >= CURRENT_DATE - $2::int
          AND completed_at <  CURRENT_DATE - $2::int + 7
        ORDER BY completed_at`,
        [user.id, userPosition]
      )

      const today = dayjs().startOf('day')
      const windowStart = today.subtract(userPosition, 'day')

      // Set des index de jours ayant au moins une complétion
      const completedIdx = new Set(r2.rows.map(r => r.day_index))

      const days = enrichedDates.map((d, i) => ({
        ...d,
        status:
          windowStart.add(i, 'day').isAfter(today, 'day') || i === userPosition
            ? completedIdx.has(i) ? 'done' : 'empty'
            : completedIdx.has(i) ? 'done' : 'not-done',
      }))

      if (dayjs().tz().hour() >= 13 && days[userPosition].status === 'empty') {
        days[userPosition].status = 'not-done'
      }

      return res.status(200).json({ days })
    }

    return res.status(200).json({})
  } catch (err) {
    logger.error("Error :", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

export default router
