import express from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import helmet from 'helmet'
import dayjs from 'dayjs'

import pool from './database/postgresql/index.js'
import logger from './logger/index.js'

dotenv.config()

await pool.migrateDatabase()

const app = express()

app.use(express.json())
app.use(helmet())
app.disable('x-powered-by')

const PORT = process.env.PORT || 3000
const JWT_SECRET = process.env.JWT_SECRET

app.use((req, res, next) => {
  const from = req.headers["x-forwarded-for"] || req.connection.remoteAddress

  logger.http({
    message: req.method + ' ' + req.originalUrl + ' ' + from
  })

  next()
})

// Security
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader?.split(' ')[1]

  if (token == null) return res.sendStatus(401)

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      logger.error(err)
      return res.sendStatus(403)
    }

    req.user = user

    next()
  })
}

app.get('/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() })
})

// Authentication
app.post('/first-login', async (req, res) => {
  const { uid, password } = req.body

  if (!uid || !password) return res.sendStatus(400)

  try {
    const client = await pool.getClient()

    const q1 = await client.query('UPDATE users SET password = $1 WHERE uid = $2 AND password IS NULL', [bcrypt.hashSync(password, 12), uid])

    if (q1.rowCount == 0) {
      logger.warn({ message: 'Password hasn\'t been created', uid })

      return res.sendStatus(500)
    }

    logger.info({ message: 'Password created', uid })

    return res.sendStatus(200)
  } catch (err) {
    logger.error(err)
    return res.sendStatus(500)
  }
})

app.post('/auth/reset-password', authenticateToken, async (req, res) => {
  const user = req.user
  const { current_password, new_password } = req.body

  if ((!current_password || !new_password) || (current_password == new_password)) return res.sendStatus(400)

  try {
    const client = await pool.getClient()

    const q1 = await client.query('SELECT password FROM users WHERE uid = $1', [user.uid])
    const u = q1.rows[0]

    const validPassword = await bcrypt.compare(current_password, u.password)

    if (!validPassword) {
      logger.warn({ message: "Password reset failed", reason: "Wrong current password", uid: user.uid })

      return res.sendStatus(401)
    }

    await client.query('UPDATE users SET password = $1 WHERE uid = $2', [bcrypt.hashSync(new_password, 12), user.uid])

    logger.info({ message: 'Password reset', uid: user.uid })

    return res.sendStatus(200)
  } catch (err) {
    logger.error(err)
    return res.sendStatus(500)
  }
})

app.post('/login', async (req, res) => {
  const { uid, password } = req.body

  if (!uid || !password) return res.sendStatus(400)

  try {
    const client = await pool.getClient()

    const q1 = await client.query('SELECT * FROM users WHERE uid = $1', [uid])
    const u = q1.rows[0]

    if (!u) {
      // Simuler une vérification afin d'éviter une faille de sécurité basée sur le temps de réponse
      await bcrypt.compare(password, '$2b$12$xhpvflnGo7ajmPMp97U2Geq9yBPOXnLUc.wj/LEU291SstVuzOrSO')

      logger.warn({ message: "Login failed", reason: "Unknown user", uid })

      return res.sendStatus(401)
    }

    const validPassword = await bcrypt.compare(password, u.password)

    if (!validPassword) {
      logger.warn({ message: "Login failed", reason: "Wrong password", uid })

      return res.sendStatus(401)
    }

    const payload = {
      id: u.id,
      uid: u.uid,
      admin: u.admin
    }

    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '10min' })
    const refreshToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' })

    client.release()

    logger.info({ message: "Login successful", uid: u.uid })

    return res.status(200).json({ accessToken, refreshToken })
  } catch (err) {
    logger.error(err)
    return res.sendStatus(500)
  }
})

app.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body

  if (!refreshToken) return res.sendStatus(401)

  try {
    jwt.verify(refreshToken, process.env.JWT_SECRET, (err, payload) => {
      if (err) {
        logger.error(err)
        return res.sendStatus(403)
      }

      delete payload.iat
      delete payload.exp

      console.log(payload)

      const newAccessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '10min' })
      const newRefreshToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' })

      return res.status(200).json({ accessToken: newAccessToken, refreshToken: newRefreshToken })
    })
  } catch (err) {
    logger.error(err)
    console.error(err)
    return res.sendStatus(500)
  }
})


// Admin
app.post('/admin/create-account', authenticateToken, async (req, res) => {
  const user = req.user
  const { account_uid, account_is_admin } = req.body

  if (!user.admin) return res.sendStatus(403)
  if (!account_uid || !account_is_admin) return res.sendStatus(400)

  try {
    const client = await pool.getClient()

    await client.query('INSERT INTO users(uid, admin) VALUES($1, $2)', [account_uid, account_is_admin])

    logger.info({ message: "User created", uid: account_uid })

    return res.sendStatus(200)
  } catch (err) {
    logger.error(err)
    return res.sendStatus(500)
  }
})

// Images
app.get('/images/:imageId/rating', authenticateToken, async (req, res) => {
  const user = req.user
  const { imageId } = req.params

  try {
    const client = await pool.getClient()

    const q1 = await client.query('SELECT id, valence, arousal FROM images WHERE image = $1 AND user_id = $2', [imageId, user.id])

    const { valence, arousal } = q1.rows[0] || { valence: null, arousal: null }

    client.release()

    return res.status(200).json({ valence, arousal })
  } catch (err) {
    logger.error(err)
    return res.sendStatus(500)
  }
})

app.put('/images/:imageId/rating', authenticateToken, async (req, res) => {
  const user = req.user
  const { imageId } = req.params
  const { valence, arousal } = req.body

  if (!valence && !arousal) return res.sendStatus(400)

  try {
    const client = await pool.getClient()

    const q1 = await client.query('SELECT * FROM images WHERE image = $1 AND user_id = $2', [imageId, user.id])

    if (q1.rows.length == 0) {
      await client.query('INSERT INTO images (image, user_id, valence, arousal) VALUES ($1, $2, $3, $4) RETURNING id', [imageId, user.id, valence, arousal])
    } else {
      await client.query('UPDATE images SET valence = $1, arousal = $2 WHERE image = $3 AND user_id = $4', [valence, arousal, imageId, user.id])
    }

    client.release()

    return res.sendStatus(200)
  } catch (err) {
    logger.error(err)
    return res.sendStatus(500)
  }
})

// Notifications
app.get('/notifications', authenticateToken, async (req, res) => {
  return res.status(200).json([
    { id: "0", title: "Questionnaire F-SUS", body: "Vous avez un questionnaire à remplir !", action: { type: "link", path: "/(forms)/fsus", text: "Remplir le questionnaire" } },
    { id: "1", title: "Complétez votre profil !", body: "Pensez à compléter votre profil et à choisir vos images !", action: { type: "link", path: "/(tabs)/(settings)/images", text: "Choisir mes images" } },
  ])
})

// Tracking
app.get('/tracking/opening', authenticateToken, async (req, res) => {
  return res.status(200).json([
    {label: 'L', value: 25},
    {label: 'M', value: 50},
    {label: 'M', value: 74},
    {label: 'J', value: 32},
    {label: 'V', value: 60},
    {label: 'S', value: 25},
    {label: 'D', value: 30}
  ])
})

app.get('/tracking/opening/amount', authenticateToken, async (req, res) => {
  const user = req.user

  try {
    const client = await pool.getClient()

    const q1 = await client.query('SELECT id FROM tracking_opening WHERE user_id = $1', [user.id])

    client.release()

    return res.status(200).json({ amount: q1.rowCount })
  } catch (err) {
    logger.error(err)
    return res.sendStatus(500)
  }
})

app.put('/tracking/opening', authenticateToken, async (req, res) => {
  const user = req.user
  const { measurements } = req.body

  if (!measurements) return res.sendStatus(400)

  try {
    const client = await pool.getClient()

    for (const timestamp of measurements) {
      const formated_date = dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss')

      await client.query('INSERT INTO tracking_opening (user_id, measurement_date) VALUES ($1, $2)', [user.id, formated_date])
    }

    client.release()

    return res.sendStatus(200)
  } catch (err) {
    logger.error(err)
    return res.sendStatus(500)
  }
})

// Forms
app.post('/forms/fsus', authenticateToken, async (req, res) => {
  const user = req.user
  const { results } = req.body

  if (!results) return res.sendStatus(400)

  return res.sendStatus(200)
})

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`)
})
