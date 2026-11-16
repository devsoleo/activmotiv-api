import express from 'express'
import dayjs from 'dayjs'
import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'
import { getUserStudyPhase, isUserInFormPhase, getUserFormPhasePosition, FORMS_PHASES_BY_TEAM } from '@/utils/phases.js'

const router = express.Router()

router.get('/users/active', async (req, res) => {
  const client = await pool.getClient()

  try {
    const r = await client.query('SELECT * FROM users WHERE team > 0')

    const list = r.rows

    return res.status(200).json({ list })

  } catch (err) {
    logger.error("Error :", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

router.get('/users/:phase', async (req, res) => {
  const { phase } = req.params

  if (phase === 'active') {
    return res.redirect('/admin/analytics/users/active')
  }

  const client = await pool.getClient()

  try {
    const r = await client.query('SELECT id, uid, team, created_at FROM users WHERE team > 0')

    const list = r.rows.filter((v, _) => {
      return getUserStudyPhase(v) == ['baseline', 'intervention', 'followup'].indexOf(phase)
    })

    return res.status(200).json({ list })

  } catch (err) {
    logger.error("Error :", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

router.get('/user/:uid', async (req, res) => {
  const { uid } = req.params
  const client = await pool.getClient()

  try {
    const userRes = await client.query('SELECT * FROM users WHERE LOWER(TRIM(uid)) = LOWER(TRIM($1))', [uid])
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: "Utilisateur non trouvé" })
    }
    const user = userRes.rows[0]

    // 1. Popup total stats
    const qStats = await client.query(
      `SELECT COALESCE(COUNT(*), 0) AS amount, COALESCE(SUM(duration), 0) AS total_duration FROM popups WHERE user_id = $1`,
      [user.id]
    )
    const amount = Number.parseInt(qStats.rows[0].amount, 10)
    const duration = Number.parseInt(qStats.rows[0].total_duration, 10)

    // 2. Daily openings for current week (Monday to Sunday)
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
    const opening = labels.map((label) => ({ label, value: 0 }))
    for (const row of qWeekly.rows) {
      const dow = Number.parseInt(row.dow, 10)
      const index = dow - 1
      if (index >= 0 && index < 7) {
        opening[index].value = Number.parseInt(row.count, 10)
      }
    }

    // 3. Sensor steppers for current week
    const rSensor = await client.query(
      `SELECT day FROM sensor WHERE user_id = $1
        AND day >= date_trunc('week', now() AT TIME ZONE 'Europe/Paris')::date
        AND day <  date_trunc('week', now() AT TIME ZONE 'Europe/Paris')::date + 7;`,
      [user.id]
    )
    const weekStart = dayjs().tz().startOf('isoWeek')
    const todayIndex = dayjs().tz().isoWeekday() - 1
    const doneSensorDays = new Set(rSensor.rows.map(d => dayjs(d.day).tz().format('YYYY-MM-DD')))

    const sensorDays = labels.map((label, i) => {
      const current = weekStart.add(i, 'day')
      return {
        label,
        status: doneSensorDays.has(current.format('YYYY-MM-DD')) ? 'done' : i < todayIndex ? 'not-done' : 'empty'
      }
    })

    // 4. Form steppers (Current or most recent questionnaire phase)
    let formDays = ['J1', 'J2', 'J3', 'J4', 'J5', 'J6', 'J7'].map(label => ({ label, status: 'empty', selected: false }))
    const inFormPhase = isUserInFormPhase(user)

    if (user.team > 0 && user.created_at) {
      const t0 = dayjs(user.created_at).tz()
      const phases = FORMS_PHASES_BY_TEAM[user.team] || [0, 3, 6]

      let activePhaseIdx = phases.findIndex((start_week) => {
        const start = t0.add(start_week * 7, 'day')
        const end = start.add(7, 'day')
        return dayjs().tz().isBetween(start, end, 'day', '[)')
      })

      if (activePhaseIdx === -1) {
        for (let i = 0; i < phases.length; i++) {
          const start = t0.add(phases[i] * 7, 'day')
          if (dayjs().tz().isAfter(start)) {
            activePhaseIdx = i
          }
        }
      }
      if (activePhaseIdx === -1) activePhaseIdx = 0

      const startWeek = phases[activePhaseIdx]
      const phaseStart = t0.add(startWeek * 7, 'day').startOf('day')
      const phaseEnd = phaseStart.add(7, 'day')

      const rForms = await client.query(
        `SELECT completed_at
         FROM forms
         WHERE user_id = $1
           AND completed_at >= $2
           AND completed_at < $3
         ORDER BY completed_at`,
        [user.id, phaseStart.toISOString(), phaseEnd.toISOString()]
      )

      const completedDays = new Set(
        rForms.rows.map(r => dayjs(r.completed_at).tz().format('YYYY-MM-DD'))
      )

      const today = dayjs().tz().startOf('day')
      const userPosition = getUserFormPhasePosition(user)

      formDays = ['J1', 'J2', 'J3', 'J4', 'J5', 'J6', 'J7'].map((label, i) => {
        const stepDate = phaseStart.add(i, 'day')
        const dateStr = stepDate.format('YYYY-MM-DD')
        const isSelected = inFormPhase && i === userPosition

        if (completedDays.has(dateStr)) {
          return { label, status: 'done', selected: isSelected }
        }

        const isPast = stepDate.isBefore(today, 'day') || (stepDate.isSame(today, 'day') && dayjs().tz().hour() >= 13)
        return {
          label,
          status: isPast ? 'not-done' : 'empty',
          selected: isSelected
        }
      })
    }

    return res.status(200).json({
      user: { id: user.id, uid: user.uid, team: user.team, created_at: user.created_at },
      amount,
      duration,
      opening,
      sensorDays,
      formDays,
      inFormPhase
    })
  } catch (err) {
    logger.error("Error fetching user tracking analytics:", err)
    return res.status(500).json({ error: "Erreur serveur" })
  } finally {
    client.release()
  }
})

export default router
