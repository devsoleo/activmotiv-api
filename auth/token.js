import jwt from 'jsonwebtoken'

import logger from '../logger/index.js'

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader?.split(' ')[1]

  if (token == null) return res.sendStatus(401)

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      logger.error(err)
      return res.sendStatus(403)
    }

    req.user = user

    next()
  })
}