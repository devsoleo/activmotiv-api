import cron from 'node-cron'

import { handleNotifications } from '@/crons/notifications.js'

export const runCrons = async () => {
  handleNotifications()
  cron.schedule('* * * * *', handleNotifications)
}

