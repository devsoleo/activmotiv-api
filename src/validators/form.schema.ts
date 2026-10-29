import { z } from 'zod'

export const formResultItemSchema = z.object({
    uid: z.string().length(3),
    question: z.string(),
    answer: z.any()
})

export const formSchema = z.object({
    results: z.array(formResultItemSchema),
    timestamp: z.number()
})

export type FormDTO = z.infer<typeof formSchema>
