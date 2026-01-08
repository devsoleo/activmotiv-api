import jwt from 'jsonwebtoken'

import logger from '../logger/index.js'

export const isAdmin = (req, res, next) => {
  if (!req.user.admin) return res.sendStatus(403)
  next()
}

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader?.split(' ')[1]

  if (token == null) return res.sendStatus(401)

  logger.info(`jwt_payload : ${JSON.stringify(jwt.decode(token))}`)

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      logger.error(err)
      return res.sendStatus(403)
    }

    req.user = user

    next()
  })
}