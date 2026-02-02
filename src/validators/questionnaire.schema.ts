import { z } from 'zod'

export const questionnaireSchema = z.object({
    headers: z.array(z.string().min(2).max(3)),
    results: z.array(z.array(z.any())),
    timestamp: z.number()
})

export type QuestionnaireDTO = z.infer<typeof questionnaireSchema>