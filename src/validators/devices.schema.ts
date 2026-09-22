import { z } from 'zod'

const deviceSchema = z.object({
    brand: z.string().min(1).max(50),
    designName: z.string().nullable(),
    deviceType: z.number().int(),
    deviceYearClass: z.number().int().nullable(),
    isDevice: z.boolean(),
    manufacturer: z.string(),
    modelName: z.string(),
    osBuildFingerprint: z.string(),
    osBuildId: z.string(),
    osInternalBuildId: z.string(),
    osName: z.string(),
    osVersion: z.string(),
    platformApiLevel: z.number().int(),
    productName: z.string(),
    supportedCpuArchitectures: z.array(z.string()).transform((val) => val.join(',')),
    totalMemory: z.number().positive(),
})

export const updateDeviceRequestSchema = z.object({
    androidId: z.string().nullable().optional(),
    device: deviceSchema
})

export type UpdateDeviceRequest = z.infer<typeof updateDeviceRequestSchema>