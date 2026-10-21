import express from 'express'
import dayjs from 'dayjs'

import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'

import { isAdmin } from '@/middlewares/auth.js'

const router = express.Router()

router.post('/create', async (req, res) => {
  const { account_uid, team, account_is_admin, creation_date, created_at } = req.body
  const dateValue = creation_date || created_at

  if (!account_uid) {
    return res.sendStatus(400)
  }

  const client = await pool.getClient()

  try {
    await client.query('BEGIN')

    let assignedTeam = team !== undefined && team !== null ? Number.parseInt(team, 10) : undefined

    if (assignedTeam === undefined || Number.isNaN(assignedTeam)) {
      if (account_is_admin === true || account_is_admin === 'true') {
        assignedTeam = 0
      } else {
        const countRes = await client.query('SELECT COUNT(*) FROM users WHERE team > 0')
        const totalUsers = Number.parseInt(countRes.rows[0].count, 10)

        const usedInBlockCount = totalUsers % 3
        let availableTeams = [1, 2, 3]

        if (usedInBlockCount > 0) {
          const recentRes = await client.query(
            'SELECT team FROM users WHERE team > 0 ORDER BY id DESC LIMIT $1',
            [usedInBlockCount]
          )
          const usedTeams = new Set(recentRes.rows.map(row => row.team))
          availableTeams = availableTeams.filter(t => !usedTeams.has(t))
        }

        const randomIndex = Math.floor(Math.random() * availableTeams.length)
        assignedTeam = availableTeams[randomIndex]
      }
    }

    if (dateValue && dateValue.toString().trim() !== '') {
      await client.query(
        'INSERT INTO users (uid, team, created_at) VALUES ($1, $2, $3)',
        [account_uid, assignedTeam, dateValue]
      )
    } else {
      await client.query(
        'INSERT INTO users (uid, team) VALUES ($1, $2)',
        [account_uid, assignedTeam]
      )
    }

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
    const q1 = await client.query(
      'SELECT id, uid, team, last_login, created_at, created_at AS creation_date FROM users ORDER BY id DESC',
      []
    )

    return res.status(200).json({ users: q1.rows })
  } catch (err) {
    logger.error("Error :", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

// PUT /admin/users/:id/team - Update user team/status
router.put('/:id/team', isAdmin, async (req, res) => {
  const { id } = req.params
  const { team } = req.body

  if (team === undefined || typeof team !== 'number') {
    return res.status(400).json({ error: "Le paramètre team (nombre) est requis" })
  }

  const client = await pool.getClient()

  try {
    await client.query('UPDATE users SET team = $1 WHERE id = $2', [team, id])
    logger.info({ message: "User team updated", userId: id, team })
    return res.sendStatus(200)
  } catch (err) {
    logger.error("Error updating user team:", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

// GET /admin/users/:id/end-date - Get calculated end date for a user
router.get('/:id/end-date', isAdmin, async (req, res) => {
  const { id } = req.params

  const client = await pool.getClient()

  try {
    const result = await client.query(
      'SELECT id, team, created_at FROM users WHERE id = $1',
      [id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Utilisateur non trouvé" })
    }

    const user = result.rows[0]
    const team = user.team ? Number.parseInt(user.team) : 1

    const endDate = user.created_at
      ? dayjs(user.created_at).tz().add(7 * 7 + ((team - 1) * 7), 'day').toISOString()
      : null

    return res.status(200).json({ endDate })
  } catch (err) {
    logger.error("Error calculating user end date:", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

export default router
