import express from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import helmet from 'helmet'
import dayjs from 'dayjs'
import cors from 'cors'

import logger from './logger/index.js'
import pool from './database/postgresql/index.js'
import { sendMail } from './mailer/index.js'

dotenv.config()

const NODE_ENV = process.env.NODE_ENV || 'development'

const PORT = process.env.PORT || 3000
const JWT_SECRET = process.env.JWT_SECRET

const JWT_ACCESS_TOKEN_EXPIRES_IN = '1y'
const JWT_REFRESH_TOKEN_EXPIRES_IN = '1y'

await pool.migrateDatabase()

const app = express()

app.use(express.json())
app.use(helmet())
app.disable('x-powered-by')

app.use(cors({
  origin: NODE_ENV == 'production' ? 'https://admin.activmotiv.fr' : '*'
}))

app.use((req, res, next) => {
  const from = req.headers["x-forwarded-for"] || req.connection.remoteAddress

  logger.http({ message: `${req.method} ${req.originalUrl} ${from}` })

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
app.post('/auth/first-login', async (req, res) => {
  const { uid, password } = req.body

  if (!uid || !password) return res.sendStatus(400)

  const client = await pool.getClient()

  try {
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
  } finally {
    client.release()
  }
})

app.post('/auth/reset-password', authenticateToken, async (req, res) => {
  const user = req.user
  const { current_password, new_password } = req.body

  if ((!current_password || !new_password) || (current_password == new_password)) return res.sendStatus(400)

  const client = await pool.getClient()

  try {
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
  } finally {
    client.release()
  }
})

app.post('/auth/login', async (req, res) => {
  const { uid, password } = req.body

  if (!uid || !password) return res.sendStatus(400)

  const client = await pool.getClient()

  try {
    const q1 = await client.query('SELECT * FROM users WHERE uid = $1', [uid])
    const u = q1.rows[0]

    if (!u) {
      // Simuler une vérification afin d'éviter une faille de sécurité basée sur le temps de réponse
      await bcrypt.compare(password, '$2b$12$xhpvflnGo7ajmPMp97U2Geq9yBPOXnLUc.wj/LEU291SstVuzOrSO')

      logger.warn({ message: "Login failed", reason: "Unknown user", uid })

      return res.sendStatus(401)
    }

    await client.query('UPDATE users SET last_login = NOW() WHERE uid = $1', [u.uid])

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

    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_ACCESS_TOKEN_EXPIRES_IN })
    const refreshToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_REFRESH_TOKEN_EXPIRES_IN })

    logger.info({ message: "Login successful", uid: u.uid })

    return res.status(200).json({ accessToken, refreshToken })
  } catch (err) {
    logger.error(err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

app.post('/auth/refresh', async (req, res) => {
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

      const newAccessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_ACCESS_TOKEN_EXPIRES_IN })
      const newRefreshToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_REFRESH_TOKEN_EXPIRES_IN })

      logger.info({ message: "Token successfully renewed !" })

      return res.status(200).json({ accessToken: newAccessToken, refreshToken: newRefreshToken })
    })
  } catch (err) {
    logger.error(err)
    return res.sendStatus(500)
  }
})


// Admin
app.post('/admin/create-account', authenticateToken, async (req, res) => {
  const user = req.user
  const { account_uid, account_is_admin } = req.body

  if (!user.admin) return res.sendStatus(403)
  if (!account_uid || !account_is_admin) return res.sendStatus(400)

  const client = await pool.getClient()

  try {
    await client.query('INSERT INTO users(uid, admin) VALUES($1, $2)', [account_uid, account_is_admin])

    logger.info({ message: "User created", uid: account_uid })

    return res.sendStatus(200)
  } catch (err) {
    logger.error(err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

// SAM
app.get('/sam/images', authenticateToken, async (req, res) => {
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

app.get('/sam/image/:imageId', authenticateToken, async (req, res) => {
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

app.put('/sam/image/:imageId', authenticateToken, async (req, res) => {
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

// Notifications
app.get('/notifications', authenticateToken, async (req, res) => {
  return res.status(200).json([
    { id: "0", title: "F-SUS", body: "Vous avez votre F-SUS à remplir !", action: { type: "link", path: "/(forms)/fsus", text: "Remplir mon F-SUS" } },
    { id: "1", title: "Questionnaire", body: "Vous avez un questionnaire à remplir !", action: { type: "link", path: "/(forms)/generic", text: "Remplir le questionnaire" } },
    { id: "2", title: "Évaluez vos images", body: "Pensez à évaluer vos images !", action: { type: "link", path: "/(tabs)/(settings)/images", text: "Évaluer mes images" } },
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

  const client = await pool.getClient()

  try {
    const q1 = await client.query('SELECT id FROM tracking_opening WHERE user_id = $1', [user.id])

    return res.status(200).json({ amount: q1.rowCount })
  } catch (err) {
    logger.error(err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

app.put('/tracking/opening', authenticateToken, async (req, res) => {
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
    logger.error(err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

// Forms
app.post('/forms/fsus', authenticateToken, async (req, res) => {
  const user = req.user
  const { results } = req.body

  if (!results) return res.sendStatus(400)

  const timestamp = Date.now()

  const filename = `fsus-${user.uid}-${dayjs(timestamp).format('DD-MM-YYYY')}.csv`

  sendMail(`FSUS de ${user.uid}`, `Voir ${filename} en pièce-jointe.`, [
    {
      filename,
      content: `uid;date;${Array.from({length: 10}, (_, i) => `q${i+1}`).join(";")}\n${user.uid};${dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss')};${results.toString().split(",").join(";")}`,
    }
  ])

  logger.info({ message: "Form completed", results: results.toString() })

  return res.sendStatus(200)
})

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} (${NODE_ENV})`)
})
