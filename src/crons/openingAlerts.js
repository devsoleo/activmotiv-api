import dayjs from 'dayjs'
import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'
import { sendMail } from '@/mailer/index.js'
import { isUserInQPhase } from '@/utils/phases.js'

export const handleOpeningAlerts = async () => {
  const client = await pool.getClient()

  try {
    const yesterday = dayjs().tz().subtract(1, 'day')
    const dayStart = yesterday.startOf('day').toISOString()
    const dayEnd = yesterday.endOf('day').toISOString()

    const { rows: users } = await client.query(
      `SELECT id, uid, team, created_at 
       FROM users 
       WHERE team > 0 AND created_at <= $1`,
      [dayEnd]
    )

    for (const user of users) {
      if (!isUserInQPhase(user)) {
        continue
      }

      const { rows: popupRows } = await client.query(
        `SELECT COUNT(*) AS count 
         FROM popups 
         WHERE user_id = $1 AND measured_at >= $2 AND measured_at <= $3`,
        [user.id, dayStart, dayEnd]
      )

      const openingCount = Number.parseInt(popupRows[0].count, 10)

      if (openingCount === 0) {
        const recipient = process.env.SMTP_TO
        if (!recipient) {
          logger.warn(`Aucun destinataire SMTP_TO configuré pour l'alerte d'inactivité du user ${user.uid}`)
          continue
        }

        const formattedDate = yesterday.format('DD/MM/YYYY')
        const subject = `[ActivMotiv] Alerte d'inactivité - Aucune ouverture pour ${user.uid} le ${formattedDate}`
        const html = `
          <p>Bonjour,</p>
          <p>L'utilisateur <strong>${user.uid}</strong> n'a enregistré <strong>aucune ouverture</strong> sur l'application pendant la journée du <strong>${formattedDate}</strong>.</p>
          <ul>
            <li><strong>Code utilisateur (UID) :</strong> ${user.uid}</li>
            <li><strong>Équipe :</strong> ${user.team ?? 'Non assignée'}</li>
            <li><strong>Date :</strong> ${formattedDate}</li>
          </ul>
        `

        await sendMail(recipient, subject, html)
        logger.info(`Alerte d'inactivité (0 ouverture le ${formattedDate}) envoyée par mail pour le user ${user.uid}`)
      }
    }
  } catch (error) {
    logger.error('Erreur lors du contrôle des ouvertures par journée:', error)
  } finally {
    client.release()
  }
}

export default handleOpeningAlerts
