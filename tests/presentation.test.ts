import assert from "node:assert/strict";
import test from "node:test";
import {
  boardStatus,
  formatTime,
  matchStatus,
} from "@/games/tetris/presentation";
import { createGame, sequence } from "@/games/tetris/rules";
import type { Match } from "@/games/tetris/useMatch";

test("Jev thinking leaves the player playing and either loss ends the result", () => {
  const pieces = sequence(19);
  const match: Match = {
    player: createGame(pieces),
    jev: createGame(pieces),
    pieces,
    elapsed: 0,
    waiting: false,
    paused: false,
    error: "",
    tokens: 0,
    calls: 0,
    confidence: 0,
    finished: false,
  };
  assert.equal(matchStatus(null), "Ready");
  assert.equal(boardStatus(null, "player"), "Ready");
  match.waiting = true;
  assert.equal(boardStatus(match, "jev"), "Thinking");
  assert.equal(boardStatus(match, "player"), "Playing");
  assert.equal(matchStatus(match), "Playing");
  match.paused = true;
  assert.equal(matchStatus(match), "Paused");
  assert.equal(boardStatus(match, "jev"), "Paused");
  match.paused = false;
  match.error = "Rate limit reached. Wait, then retry.";
  assert.equal(matchStatus(match), match.error);
  assert.equal(boardStatus(match, "jev"), "Unavailable");
  assert.equal(boardStatus(match, "player"), "Playing");
  match.player.over = true;
  match.finished = true;
  assert.equal(matchStatus(match), "Jev wins");
  assert.equal(boardStatus(match, "player"), "Lost");
  assert.equal(boardStatus(match, "jev"), "Won");
  match.player.over = false;
  match.jev.over = true;
  assert.equal(matchStatus(match), "You win");
  match.player.over = true;
  assert.equal(matchStatus(match), "Draw");
  assert.equal(boardStatus(match, "jev"), "Draw");
  assert.equal(formatTime(0), "00:00");
  assert.equal(formatTime(61999), "01:01");
});
