import { z } from "zod";
import { ACTIONS } from "@/games/tetris/rules";

export const decisionRequest = z
  .object({
    game: z.literal("tetris"),
    decisionId: z.string().min(1).max(80),
    board: z
      .array(z.array(z.number().int().min(0).max(7)).length(10))
      .length(20),
    piece: z
      .object({
        kind: z.number().int().min(0).max(6),
        rotation: z.number().int().min(0).max(3),
        x: z.number().int().min(0).max(9),
        y: z.number().int().min(0).max(19),
      })
      .strict(),
    next: z.array(z.number().int().min(0).max(6)).length(3),
    previousActions: z.array(z.enum(ACTIONS)).max(8),
  })
  .strict();

export const decisionResponse = z.object({
  decisionId: z.string(),
  action: z.enum(ACTIONS),
  confidence: z.number().min(0).max(1),
  inputTokens: z.number().int().nonnegative(),
  probabilities: z.record(z.string(), z.number().min(0).max(1)),
});
export type DecisionResponse = z.infer<typeof decisionResponse>;
