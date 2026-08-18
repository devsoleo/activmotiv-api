export type NotificationTemplateKey = 'REMIND_DAILY' // | 'REMIND_GENERIC'

export const NOTIFICATION_TEMPLATES: Record<NotificationTemplateKey, { title: string, body: string }> = {
  REMIND_DAILY: {
    title: "Rappel questionnaire quotidien",
    body: "Veuillez remplir le questionnaire."
  }
}