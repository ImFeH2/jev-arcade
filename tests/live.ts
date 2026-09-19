import assert from "node:assert/strict";
import { ACTIONS, createGame, sequence } from "@/games/tetris/rules";
import { decisionResponse } from "@/lib/protocol";

const pieces = sequence(17);
const game = createGame(pieces);
const response = await fetch("http://127.0.0.1:3001/api/decision", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    game: "tetris",
    decisionId: "live:0",
    board: game.board,
    piece: game.piece,
    next: pieces.slice(1, 4),
    previousActions: [],
  }),
});
assert.equal(response.status, 200, `API returned ${response.status}`);
const result = decisionResponse.parse(await response.json());
assert.equal(result.decisionId, "live:0");
assert.ok(ACTIONS.includes(result.action));
assert.ok(result.inputTokens > 0);
console.info(
  `Official Jev decision verified: ${result.action}; input tokens: ${result.inputTokens}`,
);
