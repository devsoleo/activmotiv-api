import express from 'express'
import dotenv from 'dotenv'
import helmet from 'helmet'
import cors from 'cors'

import logger from './logger/index.js'
import pool from './database/postgresql/index.js'
import packageJson from './package.json' with { type: 'json' }

import adminRoutes from './routes/admin.js'
import authRoutes from './routes/auth.js'
import trackingRoutes from './routes/tracking.js'
import tasksRoutes from './routes/tasks.js'
import questionnairesRoutes from './routes/questionnaires.js'
import samRoutes from './routes/sam.js'

dotenv.config()

const NODE_ENV = process.env.NODE_ENV || 'development'
const PORT = process.env.PORT || 3000
const APP_VERSION = packageJson.version

await pool.migrateDatabase()

const app = express()

app.use(express.json())
app.use(helmet())
app.disable('x-powered-by')

app.use(cors({
  origin: NODE_ENV == 'production' ? 'https://admin.activmotiv.fr' : '*'
}))

const isVersionSupported = (clientVersion, serverVersion) => {
  const clientParts = clientVersion.split('.').map(Number)
  const serverParts = serverVersion.split('.').map(Number)

  return (clientParts[0] == serverParts[0] && clientParts[1] == serverParts[1])
}

app.use((req, res, next) => {
  const from = req.headers["x-forwarded-for"] || req.connection.remoteAddress
  const clientVersion = req.headers['x-client-version']

  if (!clientVersion) return res.sendStatus(412)

  if (!isVersionSupported(clientVersion, APP_VERSION)) return res.sendStatus(412)

  logger.http({ message: `${req.method} ${req.originalUrl} ${from} ${clientVersion}` })

  next()
})

app.get('/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() })
})

app.use('/admin', adminRoutes)
app.use('/auth', authRoutes)
app.use('/tracking', trackingRoutes)
app.use('/tasks', tasksRoutes)
app.use('/questionnaires', questionnairesRoutes)
app.use('/sam', samRoutes)

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} (version=${APP_VERSION} | env=${NODE_ENV})`)
})
