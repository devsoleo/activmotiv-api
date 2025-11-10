import express from 'express'
import dayjs from 'dayjs'

import logger from '../logger/index.js'
import pool from '../database/postgresql/index.js'
import { sendMail } from '../mailer/index.js'

import { authenticateToken } from "../auth/token.js"

const router = express.Router()

const processQuestionnaire = async (client, user, label, headers, results, timestamp) => {
  const filename = `${label}-${user.uid}-${dayjs(timestamp).format('DD-MM-YYYY')}.csv`

  if (label == 'generic') {
    headers.splice(headers.indexOf("a1") + 1, 0, "a1_utile")
    headers.splice(headers.indexOf("a1") + 1, 0, "a1_benefique")
    headers.splice(headers.indexOf("a1") + 1, 0, "a1_sage")

    headers.splice(headers.indexOf("a2") + 1, 0, "a2_agreable")
    headers.splice(headers.indexOf("a2") + 1, 0, "a2_amusant")
    headers.splice(headers.indexOf("a2") + 1, 0, "a2_plaisant")

    headers = headers.filter(i => i !== 'a1' && i !== 'a2')
  }

  const content_header = `uid;date;${headers.toString().split(',').join(';')}`
  const content_results = `${user.uid};${dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss')};${results.toString().split(',').join(';')}`

  await client.query('INSERT INTO questionnaires (user_id, label, validation_date) VALUES ($1, $2, $3)', [user.id, label, dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss')])

  sendMail(process.env.SMTP_TO, `Questionnaire ${label} de ${user.uid}`, `Voir ${filename} en pièce-jointe.`, [
    {
      filename,
      content: content_header + '\n' + content_results
    }
  ])
}

router.put('/cache', authenticateToken, async (req, res) => {
  const user = req.user
  const cache = req.body.cache

  if (!cache || cache == {}) return res.sendStatus(400)

  const client = await pool.getClient()

  try {
    for (const [label, value] of Object.entries(cache)) {
      const { header, results, timestamp } = value[0]

      await processQuestionnaire(client, user, label, header, results, timestamp)

      logger.info({ message: "Questionnaire completed" })
    }

    return res.sendStatus(200)
  } catch (err) {
    logger.error(err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

export default router