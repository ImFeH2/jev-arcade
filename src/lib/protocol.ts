import { z } from 'zod'

export const decisionRequest = z.object({
  game: z.literal('tetris'),
  decisionId: z.string().min(1).max(80),
  board: z.array(z.array(z.number().int().min(0).max(7)).length(10)).length(20),
  kind: z.number().int().min(0).max(6),
  next: z.array(z.number().int().min(0).max(6)).length(3),
}).strict()

export const decisionResponse = z.object({
  decisionId: z.string(),
  action: z.string(),
  confidence: z.number().min(0).max(1),
  inputTokens: z.number().int().nonnegative(),
  probabilities: z.record(z.string(), z.number().min(0).max(1)),
})
export type DecisionResponse = z.infer<typeof decisionResponse>
