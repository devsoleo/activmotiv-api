import express from 'express'
import dayjs from 'dayjs'

import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'

import { authenticateToken } from '@/middlewares/auth.js'

const router = express.Router()

router.get('/steppers/sensor', authenticateToken, async (req, res) => {
  const user = req.user

  const client = await pool.getClient()

  try {
    const r1 = await client.query(`SELECT created_at FROM users WHERE id = $1`, [user.id])

    const created_at = r1.rows[0].created_at

    const r2 = await client.query(`SELECT day FROM sensor WHERE user_id = $1
      AND day >= date_trunc('week', now() AT TIME ZONE 'Europe/Paris')::date
      AND day <  date_trunc('week', now() AT TIME ZONE 'Europe/Paris')::date + 7;`, [user.id])

    const labels = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
    const weekStart = dayjs().tz().startOf('isoWeek')
    const todayIndex = dayjs().tz().isoWeekday() - 1

    const enrichedDates = r2.rows.map((d) => ({
      ...d,
      label: labels[dayjs(d.day).isoWeekday() - 1],
      status: 'done',
      isTogglable: false,
    }))

    const doneDays = new Set(
      enrichedDates.map((d) => dayjs(d.day).tz().format('YYYY-MM-DD'))
    )

    const week = labels.map((label, i) => {
      const current = weekStart.add(i, 'day');
      return {
        label,
        status: doneDays.has(current.format('YYYY-MM-DD')) ? 'done' : i < todayIndex ? 'not-done' : 'empty',
        isTogglable: i <= todayIndex && !current.isBefore(created_at, 'day')
      }
    })

    return res.status(200).json({ days: week })
  } catch (err) {
    logger.error("Error :", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

router.get('/steppers/form', authenticateToken, async (req, res) => {
  const user = req.user

  const client = await pool.getClient()

  try {
    const r1 = await client.query(`SELECT created_at FROM users WHERE id = $1`, [user.id])

    const created_at = r1.rows[0].created_at

    const r2 = await client.query(`SELECT day FROM sensor WHERE user_id = $1
      AND day >= date_trunc('week', now() AT TIME ZONE 'Europe/Paris')::date
      AND day <  date_trunc('week', now() AT TIME ZONE 'Europe/Paris')::date + 7;`, [user.id])

    const labels = ['J1', 'J2', 'J3', 'J4', 'J5', 'J6', 'J7']
    const weekStart = dayjs().tz().startOf('isoWeek')
    const todayIndex = dayjs().tz().isoWeekday() - 1

    const enrichedDates = r2.rows.map((d) => ({
      ...d,
      label: labels[dayjs(d.day).isoWeekday() - 1],
      status: 'done',
      isTogglable: false,
    }))

    const doneDays = new Set(
      enrichedDates.map((d) => dayjs(d.day).tz().format('YYYY-MM-DD'))
    )

    const week = labels.map((label, i) => {
      const current = weekStart.add(i, 'day');
      return {
        label,
        status: doneDays.has(current.format('YYYY-MM-DD')) ? 'done' : i < todayIndex ? 'not-done' : 'empty',
        isTogglable: i <= todayIndex && !current.isBefore(created_at, 'day')
      }
    })

    return res.status(200).json({ days: week })
  } catch (err) {
    logger.error("Error :", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

router.get('/popup', authenticateToken, async (req, res) => {
  const user = req.user

  const client = await pool.getClient()

  try {
    // 1. Get total count and total duration of popups
    const qStats = await client.query(
      `SELECT COALESCE(COUNT(*), 0) AS amount, COALESCE(SUM(duration), 0) AS total_duration FROM popups WHERE user_id = $1`,
      [user.id]
    )
    const amount = Number.parseInt(qStats.rows[0].amount)
    const total_duration = Number.parseInt(qStats.rows[0].total_duration)

    // 2. Get daily opening count for the current week (Monday to Sunday)
    const qWeekly = await client.query(
      `SELECT 
        EXTRACT(ISODOW FROM measured_at AT TIME ZONE 'Europe/Paris') AS dow,
        COUNT(*) AS count
       FROM popups 
       WHERE user_id = $1 
         AND measured_at >= date_trunc('week', (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Paris'))
         AND measured_at < date_trunc('week', (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Paris')) + INTERVAL '1 week'
       GROUP BY dow`,
      [user.id]
    )

    const labels = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
    const opening = labels.map((label, index) => ({
      label,
      value: 0
    }))

    for (const row of qWeekly.rows) {
      const dow = Number.parseInt(row.dow, 10) // 1 = Monday, 7 = Sunday
      const index = dow - 1
      if (index >= 0 && index < 7) {
        opening[index].value = Number.parseInt(row.count, 10)
      }
    }

    return res.status(200).json({
      amount,
      duration: total_duration,
      opening
    })
  } catch (err) {
    logger.error("Error :", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

router.put('/popup', authenticateToken, async (req, res) => {
  const user = req.user
  const { timestamp, images, duration } = req.body

  if (!duration) return res.sendStatus(400)

  const client = await pool.getClient()

  try {
    await client.query(`INSERT INTO popups (user_id, duration, image_top, image_bottom, measured_at) VALUES ($1, $2,  $3, $4, $5)`, [user.id, duration, images.top, images.bottom, dayjs(timestamp).toISOString()])

    return res.sendStatus(200)
  } catch (err) {
    logger.error("Error :", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

export default router