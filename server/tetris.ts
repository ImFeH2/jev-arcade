import { randomInt } from "node:crypto";
import { choice, type JsonValue } from "@typesafe-ai/sdk";
import { cells, drop, placements, type Game } from "@/games/tetris/rules";
import type { Strategy } from "@/lib/protocol";

const NAMES = ["I", "O", "T", "S", "Z", "J", "L"];

export function describeBoard(board: number[][]) {
  let holes = 0;
  const heights = board[0].map((_, x) => {
    const top = board.findIndex((row) => row[x] !== 0);
    if (top < 0) return 0;
    holes += board.slice(top + 1).filter((row) => row[x] === 0).length;
    return board.length - top;
  });
  return {
    holes,
    maxHeight: Math.max(...heights),
    totalHeight: heights.reduce((sum, height) => sum + height, 0),
    bumpiness: heights
      .slice(1)
      .reduce((sum, height, x) => sum + Math.abs(height - heights[x]), 0),
  };
}

function features(board: number[][]) {
  const measured = describeBoard(board);
  return {
    holesAfter: measured.holes,
    aggregateHeightAfter: measured.totalHeight,
    maxHeightAfter: measured.maxHeight,
    bumpinessAfter: measured.bumpiness,
  };
}

function outcomes(game: Game, pieces: number[]) {
  const before = describeBoard(game.board);
  return placements(game).map((option) => {
    const piece = {
      kind: game.piece.kind,
      rotation: option.rotation,
      x: option.x,
      y: option.y,
    };
    const after = drop({ ...game, piece }, pieces);
    const filled = game.board.map((row) => [...row]);
    for (const [x, y] of cells(piece)) filled[y][x] = piece.kind + 1;
    return {
      piece,
      after,
      facts: {
        ...features(after.board),
        clearedLines: after.lines - game.lines,
        holesDelta: describeBoard(after.board).holes - before.holes,
      },
      holesCreated: describeBoard(filled).holes - before.holes,
    };
  });
}

export function tetrisQuestion(game: Game, next: number[], strategy: Strategy) {
  const pieces = [game.piece.kind, ...next];
  const candidates = outcomes({ ...game, index: 0 }, pieces);
  if (!candidates.length) throw new Error("No reachable placements");
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const targets = Object.fromEntries(
    candidates.map((candidate, i) => [
      `p_${i.toString(36).padStart(2, "0")}`,
      candidate.piece,
    ]),
  );
  const criteria = Object.fromEntries(
    candidates.map((candidate, i) => {
      const id = `p_${i.toString(36).padStart(2, "0")}`;
      if (strategy === "metrics") {
        return [
          id,
          JSON.stringify({
            ...candidate.facts,
            rotation: candidate.piece.rotation,
            leftmostColumn: candidate.piece.x,
          }),
        ];
      }
      const following = outcomes(candidate.after, pieces);
      const columns = following.flatMap((option) =>
        cells(option.piece).map(([x]) => x),
      );
      const reach = following.length
        ? `The next ${NAMES[next[0]]}-piece could reach ${following.length} placements spanning columns ${Math.min(...columns)}-${Math.max(...columns)} (of 0-9). Its best follow-up options: fewest new holes ${Math.min(...following.map((option) => option.holesCreated))}, lowest resulting height ${Math.min(...following.map((option) => option.facts.maxHeightAfter))}, most lines ${Math.max(...following.map((option) => option.facts.clearedLines))}.`
        : `The next ${NAMES[next[0]]}-piece would have NO legal placement (game over).`;
      return [
        id,
        `Place the current ${NAMES[game.piece.kind]}-piece. Rotation state ${candidate.piece.rotation}, left edge at column ${candidate.piece.x}. Resulting stack max height: ${candidate.facts.maxHeightAfter}/20. New holes created by this placement: ${candidate.holesCreated}. Resulting surface bumpiness: ${candidate.facts.bumpinessAfter}. Lines cleared: ${candidate.facts.clearedLines}. ${reach}`,
      ];
    }),
  );
  const state: Record<string, JsonValue> =
    strategy === "metrics"
      ? {
          objective:
            "Clear rows and survive as long as possible without topping out.",
          currentPiece: NAMES[game.piece.kind],
          nextVisible: next.map((kind) => NAMES[kind]),
          currentFeatures: features(game.board),
        }
      : {
          game: "Tetris",
          board_columns: 10,
          board_rows: 20,
          current_piece: NAMES[game.piece.kind],
          upcoming_pieces_in_order: next.map((kind) => NAMES[kind]),
          goal: "Survive as long as possible: keep the stack low, avoid creating holes, keep the surface flat for future pieces.",
        };
  const instructions =
    strategy === "metrics"
      ? "Choose one reachable placement. Prioritize survival, avoiding buried empty cells, and clearing lines while keeping the stack manageable. All consequences are already computed. Do not recalculate geometry. A hole is an empty cell below an occupied cell in the same column. Lower holes, height and bumpiness are usually better; clearing lines is beneficial."
      : "Which option is best this turn? Weigh resulting height, new holes, and bumpiness together — avoid holes above all, then prefer low and flat. Never pick an option that leaves the next piece few reachable placements. Next-piece minima and maxima may come from different placements.";
  return {
    targets,
    state,
    questions: { placement: choice(instructions, criteria) },
  };
}
