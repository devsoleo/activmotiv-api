import express from 'express'
import dotenv from 'dotenv'
import helmet from 'helmet'
import cors from 'cors'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import isoWeek from 'dayjs/plugin/isoWeek.js'
import admin from 'firebase-admin'

import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'

import adminRoutes from '@/routes/admin/index.js'
import authRoutes from '@/routes/auth.js'
import analyticsRoutes from '@/routes/analytics.js'
import telemetryRoutes from '@/routes/telemetry.js'
import questionnairesRoutes from '@/routes/questionnaires.js'
import samRoutes from '@/routes/sam.js'
import notificationsRoutes from '@/routes/notifications.js'
import popupsRoutes from '@/routes/popups.js'
import remindersRoutes from '@/routes/reminders.js'
import sensorRoutes from '@/routes/sensor.js'
import packageJson from '../package.json' with { type: 'json' }
import { runCrons } from '@/crons/index.js'

dotenv.config()

const NODE_ENV = process.env.NODE_ENV || 'development'
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'
const PORT = process.env.PORT || 3000
const APP_VERSION = packageJson.version

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(isoWeek)
dayjs.tz.setDefault('Europe/Paris')

await pool.migrateDatabase()

admin.initializeApp({ credential: admin.credential.cert('./serviceAccountKey.json') })

runCrons()

const app = express()

app.use(express.json())
app.use(helmet())
app.disable('x-powered-by')

app.use(cors({ origin: CORS_ORIGIN }))

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

app.use('/auth', authRoutes)
app.use('/analytics', analyticsRoutes)
app.use('/telemetry', telemetryRoutes)
app.use('/questionnaires', questionnairesRoutes)
app.use('/sam', samRoutes)
app.use('/notifications', notificationsRoutes)
app.use('/popups', popupsRoutes)
app.use('/reminders', remindersRoutes)
app.use('/sensor', sensorRoutes)
app.use('/admin', adminRoutes)

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} (version=${APP_VERSION} | env=${NODE_ENV})`)
})
