import express from 'express'
import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'
import { computeEndDate } from '@/utils/phases.js'

const router = express.Router()

// PUT /admin/users/create - Create new user
router.post('/create', async (req, res) => {
  const { uid, is_admin, created_at } = req.body

  if (!uid) return res.sendStatus(400)

  const client = await pool.getClient()
  let assignedTeam = 0

  try {
    await client.query('BEGIN')

    if (!is_admin) {
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

    await client.query('INSERT INTO users (uid, team, created_at) VALUES ($1, $2, $3)', [uid, assignedTeam, created_at])

    await client.query('COMMIT')

    logger.info({ message: "User created", uid })

    return res.sendStatus(200)
  } catch (err) {
    await client.query('ROLLBACK')
    logger.error("Error :", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

router.get('/profile/:uid', async (req, res) => {
  const { uid } = req.params

  const client = await pool.getClient()

  try {
    const q1 = await client.query(
      'SELECT id, uid, team, last_login, created_at FROM users WHERE uid = $1',
      [uid]
    )

    if (q1.rows.length === 0) {
      return res.status(404).json({ error: "Utilisateur non trouvé" })
    }

    const user = q1.rows[0]

    return res.status(200).json({
      ...user,
      ends_at: computeEndDate(user)
    })
  } catch (err) {
    logger.error("Error :", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

router.get('/list', async (req, res) => {
  const client = await pool.getClient()

  try {
    const q1 = await client.query('SELECT id, uid, team, last_login, created_at FROM users ORDER BY id DESC', [])

    const users = q1.rows.map(user => ({
      ...user,
      ends_at: computeEndDate(user)
    }))

    return res.status(200).json({ users })
  } catch (err) {
    logger.error("Error :", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

// GET /admin/users/:uid/end-date - Get calculated end date for a user
router.get('/:uid/end-date', async (req, res) => {
  const { uid } = req.params

  const client = await pool.getClient()

  try {
    const result = await client.query(
      'SELECT id, team, created_at FROM users WHERE uid = $1',
      [uid]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Utilisateur non trouvé" })
    }

    return res.status(200).json({ date: computeEndDate(result.rows[0]) })
  } catch (err) {
    logger.error("Error calculating user end date:", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

// PUT /admin/users/:id/team - Update user team/status
router.put('/:id/team', async (req, res) => {
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

// DELETE /admin/users/:id - Delete a single user
router.delete('/:id', async (req, res) => {
  const { id } = req.params
  const client = await pool.getClient()

  try {
    const result = await client.query('DELETE FROM users WHERE id = $1 RETURNING id, uid', [id])
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Utilisateur non trouvé" })
    }
    logger.info({ message: "User deleted", id, uid: result.rows[0].uid })
    return res.status(200).json({ success: true, uid: result.rows[0].uid })
  } catch (err) {
    logger.error("Error deleting user:", err)
    return res.status(500).json({ error: "Erreur lors de la suppression de l'utilisateur" })
  } finally {
    client.release()
  }
})

// POST /admin/users/delete-batch - Delete multiple users by ID
router.post('/delete-batch', async (req, res) => {
  const { ids } = req.body
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Le paramètre ids (tableau) est requis" })
  }

  const client = await pool.getClient()

  try {
    const result = await client.query('DELETE FROM users WHERE id = ANY($1::int[]) RETURNING id, uid', [ids])
    logger.info({ message: "Users deleted in batch", deletedCount: result.rowCount, deleted: result.rows })
    return res.status(200).json({ success: true, count: result.rowCount, deleted: result.rows })
  } catch (err) {
    logger.error("Error batch deleting users:", err)
    return res.status(500).json({ error: "Erreur lors de la suppression des utilisateurs" })
  } finally {
    client.release()
  }
})

export default router
