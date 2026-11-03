import express from 'express'
import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'

const router = express.Router()

router.get('/csv', async (req, res) => {
    return res.status(200).json({ forms: {} })
})

router.get('/', async (req, res) => {
  const client = await pool.getClient()

  try {
    const { rows } = await client.query(
      `SELECT 
        f.id,
        f.user_id,
        u.uid AS user_uid,
        f.label,
        f.completed_at,
        f.data
       FROM forms f
       JOIN users u ON f.user_id = u.id
       ORDER BY f.completed_at DESC`
    )

    return res.status(200).json({ questionnaires: rows })
  } catch (err) {
    logger.error("Error fetching questionnaires:", err)
    return res.status(500).json({ error: "Erreur lors de la récupération des questionnaires" })
  } finally {
    client.release()
  }
})

export default router
