import winston from 'winston'

const NODE_ENV = process.env.NODE_ENV || 'development'

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
}

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaString = Object.keys(meta).length ? JSON.stringify(meta) : ''
    return `[${timestamp}] ${level}: ${message} ${metaString}`
  })
)

const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
)

const logger = winston.createLogger({
  levels,
  transports: [
    new winston.transports.Console({ level: 'debug', format: consoleFormat }),
    ...(NODE_ENV == 'production' ? [new winston.transports.File({ level: 'http', format: fileFormat, filename: './logs/activmotiv.log' })] : [])
  ]
})

export default logger