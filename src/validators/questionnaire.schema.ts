import { z } from 'zod'

export const questionnaireResultItemSchema = z.object({
    question: z.string(),
    answer: z.any()
})

export const questionnaireSchema = z.object({
    results: z.array(questionnaireResultItemSchema),
    timestamp: z.number()
})

export type QuestionnaireDTO = z.infer<typeof questionnaireSchema>
