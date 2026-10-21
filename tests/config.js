import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import { vi } from 'vitest'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Europe/Paris')

// Mock pool database
vi.mock('@/database/postgresql/index.js', () => ({
  default: {
    getClient: vi.fn(),
    query: vi.fn(),
  },
}));

// Mock logger - affiche les logs de l'API dans la console
vi.mock('@/logger/index.js', () => ({
  default: {
    info: vi.fn((...args) => console.log('[API INFO]', ...args)),
    error: vi.fn((...args) => console.error('[API ERROR]', ...args)),
    warn: vi.fn((...args) => console.warn('[API WARN]', ...args)),
  }
}));

// Mock auth middleware
vi.mock('@/middlewares/auth.js', () => ({
  authenticateToken: (req, res, next) => {
    if (req.headers['x-test-user']) {
      req.user = JSON.parse(req.headers['x-test-user'])
    } else {
      req.user = { id: 1, uid: 'user-1', team: 1, admin: false }
    }
    next()
  },
  isAdmin: (req, res, next) => next()
}));