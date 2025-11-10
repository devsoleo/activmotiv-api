import express from 'express'
import dayjs from 'dayjs'

import logger from '../logger/index.js'
import pool from '../database/postgresql/index.js'

import { authenticateToken } from "../auth/token.js"

const router = express.Router()

router.get('/', authenticateToken, async (req, res) => {
  const user = req.user

  const client = await pool.getClient()

  try {
    const q1 = await client.query('SELECT id FROM tracking_opening WHERE user_id = $1', [user.id])

    return res.status(200).json({ amount: q1.rowCount, opening: [
      {label: 'L', value: 100},
      {label: 'M', value: 50},
      {label: 'M', value: 74},
      {label: 'J', value: 32},
      {label: 'V', value: 60},
      {label: 'S', value: 25},
      {label: 'D', value: 100}
    ] })
  } catch (err) {
    logger.error(err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

router.put('/opening', authenticateToken, async (req, res) => {
  const user = req.user
  const { measurements } = req.body

  if (!measurements) return res.sendStatus(400)

  const client = await pool.getClient()

  try {
    for (const timestamp of measurements) {
      const formated_date = dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss')

      await client.query('INSERT INTO tracking_opening (user_id, measurement_date) VALUES ($1, $2)', [user.id, formated_date])
    }

    return res.sendStatus(200)
  } catch (err) {
    console.log(err)
    logger.error(err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

export default router