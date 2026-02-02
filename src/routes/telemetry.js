import express from 'express'
import dayjs from 'dayjs'

import logger from '@/logger/index.js'
import pool from '@/database/postgresql/index.js'

import { authenticateToken } from "@/middlewares/auth.js"

import { updateDeviceRequestSchema } from '@/validators/devices.schema.js'

const router = express.Router()

router.put('/device', authenticateToken, async (req, res) => {
  const validation = updateDeviceRequestSchema.safeParse(req.body)

  if (!validation.success) {
    logger.error("Error :", validation.error.message)
    return res.status(400).json({ errors: validation.error.format() })
  }

  const data = validation.data
  const user_id = req.user.id

  const client = await pool.getClient()

  try {
    await client.query(`BEGIN`)

    await client.query(`UPDATE devices SET is_active = false WHERE user_id = $1 AND android_id != $2`, [user_id, data.androidId])

    await client.query(`
      INSERT INTO devices (
        user_id, is_active, android_id, brand,
        design_name, device_type, device_year_class, is_device,
        manufacturer, model_name, os_build_fingerprint, os_build_id,
        os_internal_build_id, os_name, os_version, platform_api_level,
        product_name, supported_cpu_architectures, total_memory
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14, $15, $16,
        $17, $18, $19
      ) ON CONFLICT (user_id, android_id) DO UPDATE SET 
        is_active = EXCLUDED.is_active,
        os_build_fingerprint = EXCLUDED.os_build_fingerprint,
        os_build_id = EXCLUDED.os_build_id,
        os_internal_build_id = EXCLUDED.os_internal_build_id,
        os_version = EXCLUDED.os_version,
        platform_api_level = EXCLUDED.platform_api_level
      `,
      [
        user_id, true, data.androidId, data.device.brand,
        data.device.designName, data.device.deviceType, data.device.deviceYearClass, data.device.isDevice,
        data.device.manufacturer, data.device.modelName, data.device.osBuildFingerprint, data.device.osBuildId,
        data.device.osInternalBuildId, data.device.osName, data.device.osVersion, data.device.platformApiLevel,
        data.device.productName, data.device.supportedCpuArchitectures, data.device.totalMemory
    ])

    await client.query(`COMMIT`)

    return res.sendStatus(200)
  } catch (err) {
    logger.error("Error :", err)
    return res.sendStatus(500)
  } finally {
    client.release()
  }
})

export default router