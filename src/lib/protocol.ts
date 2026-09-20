import { z } from "zod";
export const strategySchema = z.enum(["metrics", "lookahead"]);
export type Strategy = z.infer<typeof strategySchema>;

const pieceSchema = z
  .object({
    kind: z.number().int().min(0).max(6),
    rotation: z.number().int().min(0).max(3),
    x: z.number().int().min(0).max(9),
    y: z.number().int().min(0).max(19),
  })
  .strict();

export const decisionRequest = z
  .object({
    game: z.literal("tetris"),
    decisionId: z.string().min(1).max(80),
    board: z
      .array(z.array(z.number().int().min(0).max(7)).length(10))
      .length(20),
    piece: pieceSchema,
    next: z.array(z.number().int().min(0).max(6)).length(3),
    strategy: strategySchema,
  })
  .strict();

export const decisionResponse = z.object({
  decisionId: z.string(),
  target: pieceSchema,
  confidence: z.number().min(0).max(1),
  inputTokens: z.number().int().nonnegative(),
  probabilities: z.record(z.string(), z.number().min(0).max(1)),
});
export type DecisionResponse = z.infer<typeof decisionResponse>;
