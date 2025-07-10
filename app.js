import express from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import helmet from 'helmet'
import pool from './database/postgresql/index.js'

dotenv.config()

await pool.migrateDatabase()

const app = express()

app.use(express.json())
app.use(helmet())
app.disable('x-powered-by')

const PORT = process.env.PORT || 3000
const JWT_SECRET = process.env.JWT_SECRET

// Security
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader?.split(' ')[1]

  if (token == null) return res.sendStatus(401)

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.error(err)
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

  if (!uid || !password) return res.status(400).json({ message: 'Bad Request' })

  try {
    const client = await pool.getClient()

    await client.query('UPDATE users SET password = $1 WHERE uid = $2', [bcrypt.hashSync(password, 12), uid])

    return res.status(200).json({ messages: 'OK' })
  } catch (err) {
    console.log(err)
    return res.status(500).json({ message: 'Internal Server Error' })
  }
})

app.post('/login', async (req, res) => {
  const { uid, password } = req.body

  if (!uid || !password) return res.status(400).json({ message: 'Bad Request' })

  try {
    const client = await pool.getClient()

    const userQuery = await client.query('SELECT * FROM users WHERE uid = $1', [uid])
    const user = userQuery.rows[0]

    if (!user) {
      // Simuler une vérification afin d'éviter une faille de sécurité basée sur le temps de réponse
      await bcrypt.compare(password, '$2a$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const validPassword = await bcrypt.compare(password, user.password)

    if (!validPassword) return res.status(401).json({ message: 'Unauthorized' })

    const token = jwt.sign({
      id: user.id,
      uid: user.uid,
      admin: user.admin
    }, JWT_SECRET, { expiresIn: '24h' })

    client.release()

    return res.status(200).json({ message: 'Login successful', token })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal Server Error' })
  }
})

app.post('/create-account', authenticateToken, async (req, res) => {
  const user = req.user
  const { uid, password } = req.body

  if (!uid || !password) return res.status(400).json({ message: 'Bad Request' })

  try {
    const client = await pool.getClient()

    await client.query('INSERT INTO users(uid, password) VALUES($1, $2)', [uid, bcrypt.hashSync(password, 12)])

    return res.status(200).json({ messages: 'OK' })
  } catch (err) {
    console.log(err)
    return res.status(500).json({ message: 'Internal Server Error' })
  }
})

// Images
app.get('/images/:imageId/rating', authenticateToken, async (req, res) => {
  const user = req.user
  const { imageId } = req.params

  try {
    const client = await pool.getClient()

    const q1 = await client.query('SELECT id, valence, arousal FROM images WHERE image = $1 AND user_id = $2', [imageId, user.id])

    const { valence, arousal } = q1.rows[0] || { valence: 1, arousal: 1 }

    client.release()

    return res.status(200).json({ message: 'OK', data: { valence, arousal } })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal Server Error' })
  }
})

app.put('/images/:imageId/display', authenticateToken, async (req, res) => {
  const user = req.user
  const { imageId } = req.params
  const { display } = req.body

  if (!display) return res.status(400).json({ message: 'Bad Request' })
})

app.put('/images/:imageId/rating', authenticateToken, async (req, res) => {
  const user = req.user
  const { imageId } = req.params
  const { valence, arousal } = req.body

  if (!valence || !arousal) return res.status(400).json({ message: 'Bad Request' })

  try {
    const client = await pool.getClient()

    const q1 = await client.query('SELECT * FROM images WHERE image = $1 AND user_id = $2', [imageId, user.id])

    if (q1.rows.length == 0) {
      await client.query('INSERT INTO images (image, user_id, valence, arousal) VALUES ($1, $2, $3, $4) RETURNING id', [imageId, user.id, valence, arousal])
    } else {
      await client.query('UPDATE images SET valence = $1, arousal = $2 WHERE image = $3 AND user_id = $4', [valence, arousal, imageId, user.id])
    }

    client.release()

    return res.status(200).json({ message: 'OK' })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Internal Server Error' })
  }
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
