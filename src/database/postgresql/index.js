import pg from 'pg'
import runMigrations from 'node-pg-migrate'
import dotenv from 'dotenv'

import logger from '@/logger/index.js'

dotenv.config()

const options = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
}

const { Pool } = pg
const pool = new Pool(options)

pool.connect().then(() => {
  logger.info("Successfully connected to PostgreSQL database !")
}).catch(err => {
  logger.error("Error :", err)
  process.exit(-1)
})

const migrateDatabase = async () => {
  await runMigrations({
    dir: './migrations',
    databaseUrl: options,
    direction: 'up',
    verbose: false,
  }).catch(err => {
    logger.error("Error migrating database :", err)
    process.exit(-1)
  })
}

const query = async (text, params, callback) => {
  return await pool.query(text, params, callback)
}

const getClient = () => pool.connect()

export default {
  query,
  getClient,
  migrateDatabase
}