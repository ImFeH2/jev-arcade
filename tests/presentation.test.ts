import assert from "node:assert/strict";
import test from "node:test";
import {
  boardStatus,
  formatTime,
  matchStatus,
} from "@/games/tetris/presentation";
import { createMatch, updateFinished } from "@/games/tetris/match";
import { drop, sequence, tick } from "@/games/tetris/rules";

test("thinking, pause and API errors leave independent board statuses", () => {
  const match = createMatch(sequence(19), "lookahead");
  assert.equal(matchStatus(null), "Ready");
  assert.equal(boardStatus(null, "player"), "Ready");
  match.waiting = true;
  assert.equal(boardStatus(match, "jev"), "Thinking");
  assert.equal(boardStatus(match, "player"), "Playing");
  match.paused = true;
  assert.equal(matchStatus(match), "Paused");
  match.paused = false;
  match.error = "Rate limit reached. Wait, then retry.";
  assert.equal(matchStatus(match), match.error);
  assert.equal(boardStatus(match, "jev"), "Unavailable");
  assert.equal(boardStatus(match, "player"), "Playing");
  assert.equal(formatTime(61999), "01:01");
});

test("either board can finish while the other continues until its own top-out", () => {
  for (const first of ["player", "jev"] as const) {
    const second = first === "player" ? "jev" : "player";
    const match = createMatch(sequence(19), "metrics");
    while (!match[first].over) match[first] = drop(match[first], match.pieces);
    match.elapsed = 1000;
    updateFinished(match);
    assert.equal(match.finished, false);
    assert.equal(match.endedAt[first], 1000);
    assert.equal(boardStatus(match, first), "Finished");
    assert.equal(boardStatus(match, second), "Playing");
    assert.equal(
      matchStatus(match),
      second === "player" ? "You playing" : "Jev playing",
    );
    const finishedBoard = match[first];
    const previousY = match[second].piece.y;
    match.elapsed = 2000;
    match[first] = tick(match[first], match.pieces);
    match[second] = tick(match[second], match.pieces);
    updateFinished(match);
    assert.equal(match[first], finishedBoard);
    assert.equal(match[second].piece.y, previousY + 1);
    assert.equal(match.endedAt[first], 1000);
    assert.equal(match.finished, false);
    while (!match[second].over)
      match[second] = drop(match[second], match.pieces);
    updateFinished(match);
    assert.equal(match.finished, true);
    assert.equal(boardStatus(match, first), "Lost");
    assert.equal(boardStatus(match, second), "Won");
    assert.equal(
      matchStatus(match),
      second === "player" ? "You win" : "Jev wins",
    );
  }
});

test("simultaneous top-outs are a draw", () => {
  const match = createMatch(sequence(8), "lookahead");
  while (!match.finished) {
    match.player = drop(match.player, match.pieces);
    match.jev = drop(match.jev, match.pieces);
    updateFinished(match);
  }
  assert.equal(matchStatus(match), "Draw");
  assert.equal(boardStatus(match, "player"), "Draw");
  assert.equal(boardStatus(match, "jev"), "Draw");
});
