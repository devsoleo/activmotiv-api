import express from 'express'
import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'
import { authenticateToken } from '@/middlewares/auth.js'

const router = express.Router()

const DAYS_OF_WEEK = new Set(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'])
const REMINDER_TYPES = ['SENSOR', 'FORM']

const DEFAULT_REMINDERS = {
  SENSOR: {
    MON: '08:00',
    TUE: '08:00',
    WED: '08:00',
    THU: '08:00',
    FRI: '08:00',
    SAT: '08:00',
    SUN: '08:00',
  },
  FORM: {
    MON: '08:00',
    TUE: '08:00',
    WED: '08:00',
    THU: '08:00',
    FRI: '08:00',
    SAT: '10:00',
    SUN: '10:00',
  },
}

// Validate HH:mm time string is between 05h00 and 13h00 inclusive (bypassed for admin)
const isAllowedTime = (timeStr, isAdmin = false) => {
  if (typeof timeStr !== 'string') return false
  const match = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/.exec(timeStr)
  if (!match) return false
  if (isAdmin) return true
  const hours = Number.parseInt(match[1], 10)
  const minutes = Number.parseInt(match[2], 10)

  if (hours < 5 || hours > 13) return false
  if (hours === 13 && minutes > 0) return false

  return true
}

// GET /reminders
router.get('/', authenticateToken, async (req, res) => {
  const user = req.user
  const client = await pool.getClient()

  try {
    const result = await client.query(
      `SELECT label, day_of_week, TO_CHAR(reminder_time, 'HH24:MI') as reminder_time
       FROM reminders
       WHERE user_id = $1`,
      [user.id]
    )

    const responseData = {
      SENSOR: { ...DEFAULT_REMINDERS.SENSOR },
      FORM: { ...DEFAULT_REMINDERS.FORM },
    }

    for (const row of result.rows) {
      if (responseData[row.label] && DAYS_OF_WEEK.has(row.day_of_week)) {
        responseData[row.label][row.day_of_week] = row.reminder_time
      }
    }

    console.log(responseData)

    return res.status(200).json(responseData)
  } catch (err) {
    logger.error('Error fetching reminders:', err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

// PUT /reminders
router.put('/', authenticateToken, async (req, res) => {
  const user = req.user
  const body = req.body

  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Body must be an object' })
  }

  const client = await pool.getClient()

  try {
    await client.query('BEGIN')

    for (const type of REMINDER_TYPES) {
      const typeData = body[type]
      if (typeData && typeof typeData === 'object') {
        for (const day of DAYS_OF_WEEK) {
          const timeVal = typeData[day]
          if (timeVal !== undefined && timeVal !== null) {
            if (!isAllowedTime(timeVal, user.team === 0)) {
              await client.query('ROLLBACK')
              return res.status(400).json({
                error: `L'heure de rappel doit être comprise entre 00h00 et 13h00 (reçu '${timeVal}' pour ${type} - ${day}).`,
              })
            }

            await client.query(
              `INSERT INTO reminders (user_id, label, day_of_week, reminder_time, updated_at)
               VALUES ($1, $2, $3, $4::time, NOW())
               ON CONFLICT (user_id, label, day_of_week) DO UPDATE SET
                 reminder_time = EXCLUDED.reminder_time,
                 updated_at = NOW()`,
              [user.id, type, day, `${timeVal}:00`]
            )
          }
        }
      }
    }

    await client.query('COMMIT')

    const result = await client.query(
      `SELECT label, day_of_week, TO_CHAR(reminder_time, 'HH24:MI') as reminder_time
       FROM reminders 
       WHERE user_id = $1`,
      [user.id]
    )

    const responseData = {
      SENSOR: { ...DEFAULT_REMINDERS.SENSOR },
      FORM: { ...DEFAULT_REMINDERS.FORM },
    }

    for (const row of result.rows) {
      if (responseData[row.label] && DAYS_OF_WEEK.has(row.day_of_week)) {
        responseData[row.label][row.day_of_week] = row.reminder_time
      }
    }

    return res.status(200).json(responseData)
  } catch (err) {
    await client.query('ROLLBACK')
    logger.error('Error updating reminders:', err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

export default router
