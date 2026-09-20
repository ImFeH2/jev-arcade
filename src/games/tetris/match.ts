import { createGame, type Game } from "@/games/tetris/rules";
import type { Strategy } from "@/lib/protocol";

export type Match = {
  player: Game;
  jev: Game;
  pieces: number[];
  elapsed: number;
  waiting: boolean;
  paused: boolean;
  error: string;
  tokens: number;
  calls: number;
  confidence: number;
  strategy: Strategy;
  endedAt: { player: number | null; jev: number | null };
  finished: boolean;
};

export function createMatch(pieces: number[], strategy: Strategy): Match {
  return {
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
    strategy,
    endedAt: { player: null, jev: null },
    finished: false,
  };
}

export function updateFinished(match: Match) {
  for (const side of ["player", "jev"] as const) {
    if (match[side].over && match.endedAt[side] === null)
      match.endedAt[side] = match.elapsed;
  }
  match.finished = match.player.over && match.jev.over;
}
