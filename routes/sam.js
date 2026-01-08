import express from 'express'

import logger from '../logger/index.js'
import pool from '../database/postgresql/index.js'

import { authenticateToken } from "../middlewares/auth.js"

const router = express.Router()

router.get('/images', authenticateToken, async (req, res) => {
  const user = req.user

  const client = await pool.getClient()

  try {
    const q1 = await client.query('SELECT image, valence, arousal, hidden FROM images WHERE user_id = $1', [user.id])

    return res.status(200).json({ images: q1.rows })
  } catch (err) {
    logger.error(err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

router.get('/image/:imageId', authenticateToken, async (req, res) => {
  const user = req.user
  const { imageId } = req.params

  const client = await pool.getClient()

  try {
    const q1 = await client.query('SELECT image, valence, arousal, hidden FROM images WHERE image = $1 AND user_id = $2', [imageId, user.id])

    if (q1.rowCount == 0) return res.sendStatus(404)

    return res.status(200).json(q1.rows[0])
  } catch (err) {
    logger.error(err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

router.put('/image/:imageId', authenticateToken, async (req, res) => {
  const user = req.user
  const { imageId } = req.params
  const { valence, arousal, hidden } = req.body

  if (!valence && !arousal && !hidden) return res.sendStatus(400)

  const client = await pool.getClient()

  try {
    const q1 = await client.query('SELECT * FROM images WHERE image = $1 AND user_id = $2', [imageId, user.id])

    if (q1.rows.length == 0) {
      await client.query('INSERT INTO images (image, user_id, valence, arousal, hidden) VALUES ($1, $2, $3, $4, $5) RETURNING id', [imageId, user.id, valence, arousal, hidden])
    } else {
      await client.query('UPDATE images SET valence = $1, arousal = $2, hidden = $3 WHERE image = $4 AND user_id = $5', [valence, arousal, hidden, imageId, user.id])
    }

    return res.sendStatus(200)
  } catch (err) {
    logger.error(err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

export default router