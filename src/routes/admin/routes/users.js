import express from 'express'

import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'

import { isAdmin } from '@/middlewares/auth.js'

const router = express.Router()

router.post('/create', async (req, res) => {
  const { account_uid, account_is_admin } = req.body

  if (!account_uid || !account_is_admin) return res.sendStatus(400)

  const client = await pool.getClient()

  try {
    await client.query('BEGIN')

    const countRes = await client.query('SELECT COUNT(*) FROM users')
    const totalUsers = parseInt(countRes.rows[0].count, 10)

    const usedInBlockCount = totalUsers % 3
    let availableTeams = [1, 2, 3]

    if (usedInBlockCount > 0) {
      const recentRes = await client.query(
        'SELECT team FROM users ORDER BY id DESC LIMIT $1',
        [usedInBlockCount]
      )
      const usedTeams = recentRes.rows.map(row => row.team)
      availableTeams = availableTeams.filter(t => !usedTeams.includes(t))
    }

    const randomIndex = Math.floor(Math.random() * availableTeams.length)
    const assignedTeam = availableTeams[randomIndex]

    await client.query(
      'INSERT INTO users (uid, admin, team) VALUES ($1, $2, $3)',
      [account_uid, account_is_admin, assignedTeam]
    )

    await client.query('COMMIT')

    logger.info({ message: "User created", uid: account_uid, team: assignedTeam })

    return res.sendStatus(200)
  } catch (err) {
    await client.query('ROLLBACK')
    logger.error("Error :", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

router.get('/list', isAdmin, async (req, res) => {
  const client = await pool.getClient()

  try {
    const q1 = await client.query('SELECT id, uid, admin, last_login, created_at FROM users', [])

    return res.status(200).json({ users: q1.rows })
  } catch (err) {
    logger.error("Error :", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

export default router