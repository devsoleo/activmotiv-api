export type NotificationTemplateKey =  'QUESTIONNAIRE' | 'SENSOR'

export const NOTIFICATION_TEMPLATES: Record<NotificationTemplateKey, { title: string, body: string, sound?: string, channelId?: string, color?: string, imageUrl?: string }> = {
  QUESTIONNAIRE: {
    title: "Rappel questionnaire",
    body: "C'est l'heure de remplir votre questionnaire !",
    channelId: "questionnaire",
    color: '#29B6F6',
    imageUrl: 'https://activmotiv.fr/static/notifications/ema.png?key=b4b01d6c7472362a30ac5470aac7f6be'
  },
  SENSOR: {
    title: "Rappel port du capteur",
    body: "N'oubliez pas votre capteur ce matin !",
    channelId: "sensor",
    color: '#EF5350',
    imageUrl: 'https://activmotiv.fr/static/notifications/sensor.png?key=b4b01d6c7472362a30ac5470aac7f6be'
  }
}
