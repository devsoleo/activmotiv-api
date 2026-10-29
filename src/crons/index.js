import cron from 'node-cron'

import { handleNotifications } from '@/crons/notifications.js'
import { handleOpeningAlerts } from '@/crons/alerts.js'

export const runCrons = async () => {
  handleNotifications()
  handleOpeningAlerts()

  cron.schedule('* * * * *', handleNotifications)
  cron.schedule('5 0 * * *', handleOpeningAlerts)
}
