import express from 'express'

import { authenticateToken, isAdmin } from "../../middlewares/auth.js"

import authRoutes from './routes/auth.js'
import usersRoutes from './routes/users.js'

const router = express.Router()

router.use('/auth', authRoutes)

router.use(authenticateToken)
router.use(isAdmin)

router.use('/users', usersRoutes)

export default router