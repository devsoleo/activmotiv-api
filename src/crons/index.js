import cron from 'node-cron'

import { handleFormNotifications, handleFormRecallNotifications } from '@/crons/notifications.js'
import { handleOpeningAlerts } from '@/crons/alerts.js'

export const runCrons = async () => {
  await handleFormNotifications()
  await handleFormRecallNotifications()
  await handleOpeningAlerts()

  cron.schedule('* * * * *', handleFormNotifications)
  cron.schedule('* * * * *', handleFormRecallNotifications)

  cron.schedule('5 0 * * *', handleOpeningAlerts)
}
