import assert from "node:assert/strict";
import {
  act,
  createGame,
  drop,
  sequence,
  targetAction,
} from "@/games/tetris/rules";
import { decisionResponse } from "@/lib/protocol";

for (const strategy of ["metrics", "lookahead"] as const) {
  const pieces = sequence(17);
  let game = createGame(pieces);
  const response = await fetch("http://127.0.0.1:3001/api/decision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      game: "tetris",
      decisionId: `live:${strategy}`,
      board: game.board,
      piece: game.piece,
      next: pieces.slice(1, 4),
      strategy,
    }),
  });
  assert.equal(response.status, 200, `API returned ${response.status}`);
  const result = decisionResponse.parse(await response.json());
  assert.equal(result.decisionId, `live:${strategy}`);
  assert.ok(result.inputTokens > 0);
  const expected = drop({ ...game, piece: result.target }, pieces);
  while (game.index === 0) {
    const action = targetAction(game, result.target);
    assert.ok(action);
    game = act(game, pieces, action);
  }
  assert.deepEqual(game.board, expected.board);
  console.info(
    `Official Jev target verified: ${strategy}; input tokens: ${result.inputTokens}`,
  );
}
