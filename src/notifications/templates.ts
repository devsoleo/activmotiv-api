export type NotificationTemplateKey = 'FORM' | 'SENSOR' | 'FORM_RECALL'

export const SENSOR_NOTIFICATION_BODIES = [
  "Bonjour, pensez à mettre le capteur à la taille aujourd'hui. Retirer le seulement pour la douche ou les activités à risque. Merci !",
  "Bonjour, votre capteur est-il bien en place ? Portez-le en continu, sauf pour la douche et les activités pouvant l'endommager. Merci !",
  "Bonjour, avez-vous toujours votre capteur à la taille ? Enlevez le seulement pour la douche ou les activités à risque. Merci !",
  "Petit check : portez-vous bien le capteur à la taille ? Retirer le seulement pour la douche ou en cas d'activité à risque. Merci !"
]

export function getRandomSensorBody(): string {
  const randomIndex = Math.floor(Math.random() * SENSOR_NOTIFICATION_BODIES.length)
  return SENSOR_NOTIFICATION_BODIES[randomIndex]
}

export const NOTIFICATION_TEMPLATES: Record<NotificationTemplateKey, { title: string, body: string, sound?: string, channelId?: string, color?: string, imageUrl?: string }> = {
  FORM: {
    title: "Rappel questionnaire",
    body: "C'est l'heure de remplir votre questionnaire !",
    channelId: "form",
    color: '#29B6F6',
    imageUrl: 'https://activmotiv.fr/static/notifications/ema.png?key=b4b01d6c7472362a30ac5470aac7f6be'
  },
  FORM_RECALL: {
    title: "Rappel questionnaire",
    body: "Rappel : vous n'avez pas encore rempli votre questionnaire aujourd'hui !",
    channelId: "form",
    color: '#29B6F6',
    imageUrl: 'https://activmotiv.fr/static/notifications/ema.png?key=b4b01d6c7472362a30ac5470aac7f6be'
  },
  SENSOR: {
    title: "Rappel port du capteur",
    get body() {
      return getRandomSensorBody()
    },
    channelId: "sensor",
    color: '#EF5350',
    imageUrl: 'https://activmotiv.fr/static/notifications/sensor.png?key=b4b01d6c7472362a30ac5470aac7f6be'
  }
}
