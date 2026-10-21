import express from 'express'
import dayjs from 'dayjs'
import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'
import { getUserQPhase, getUserStudyPhase } from '@/utils/phases.js'

const router = express.Router()

const TARGET_PARTICIPANTS = 18

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

  const client = await pool.getClient()

  try {
    const r = await client.query('SELECT id, uid, team, created_at FROM users WHERE team > 0')

    const list = r.rows.filter((v, i) => {
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

export default router
