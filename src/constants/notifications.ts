export type NotificationTemplateKey = 'REMIND_FSUS' | 'REMIND_GENERIC'

export const NOTIFICATION_TEMPLATES: Record<NotificationTemplateKey, { title: string, body: string }> = {
  REMIND_FSUS: {
    title: "Rappel questionnaire",
    body: "Veuillez remplir votre F-SUS."
  },
  REMIND_GENERIC: {
    title: "Rappel questionnaire",
    body: "Veuillez remplir votre générique."
  }
}