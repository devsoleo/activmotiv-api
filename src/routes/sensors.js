import express from 'express'
import dayjs from 'dayjs'

import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'

import { authenticateToken } from '@/middlewares/auth.js'

const router = express.Router()

router.get('/stepper', authenticateToken, async (req, res) => {
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

router.post('/toggle', authenticateToken, async (req, res) => {
  const user = req.user
  const { weekDayIndex } = req.body

  const client = await pool.getClient()

  const formattedDate = dayjs().tz().startOf('isoWeek').add(weekDayIndex, 'day').format('YYYY-MM-DD')

  try {
    await pool.query(
      `WITH deleted AS (
        DELETE FROM sensor WHERE user_id = $1 AND day = $2 RETURNING 1
      )
      INSERT INTO sensor (user_id, day)
      SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM deleted)`,
      [user.id, formattedDate]
    )

    return res.sendStatus(200)
  } catch (err) {
    logger.error("Error :", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

router.get('/today', authenticateToken, async (req, res) => {
  const user = req.user
  const client = await pool.getClient()

  try {
    const result = await client.query(
      `SELECT COUNT(*) FROM sensor WHERE user_id = $1 AND confirmed IS TRUE AND updated_at >= (CURRENT_DATE AT TIME ZONE 'Europe/Paris')`,
      [user.id]
    )

    const confirmed = Number.parseInt(result.rows[0].count, 10) > 0
    return res.status(200).json({ confirmed })
  } catch (err) {
    logger.error("Error checking sensor status:", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

export default router
