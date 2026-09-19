import { choice } from "@typesafe-ai/sdk";
import {
  drop,
  placements,
  move,
  rotate,
  shape,
  SHAPES,
  type Action,
  type Game,
} from "@/games/tetris/rules";

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

export function tetrisQuestion(
  game: Game,
  next: number[],
  previousActions: Action[],
) {
  const pieces = [game.piece.kind, ...next];
  const currentDrop = drop({ ...game, index: 0 }, pieces);
  const canMoveLeft = move(game, -1, 0) !== game;
  const canMoveRight = move(game, 1, 0) !== game;
  const criteria = Object.fromEntries(
    placements(game).map((option) => {
      const after = drop(
        {
          ...game,
          index: 0,
          piece: { ...game.piece, rotation: option.rotation, x: option.x },
        },
        pieces,
      );
      return [
        option.id,
        {
          rotation: option.rotation,
          column: option.x,
          linesCleared: after.lines - game.lines,
          gameOver: after.over,
          ...describeBoard(after.board),
        },
      ];
    }),
  );
  return {
    state: {
      board: game.board.map((row) => row.map((cell) => Number(cell !== 0))),
      currentPiece: {
        name: NAMES[game.piece.kind],
        cells: shape(game.piece),
        x: game.piece.x,
        y: game.piece.y,
        rotation: game.piece.rotation,
      },
      previousActions,
      nextPieces: next.map((kind) => ({
        name: NAMES[kind],
        cells: SHAPES[kind],
      })),
      legend:
        "Coordinates start at 0, x rightward and y downward. Board: 0 empty, 1 occupied. Reachable targets describe future placements after clearing rows: holes = covered empty cells; maxHeight = tallest column; totalHeight = sum of column heights; bumpiness = adjacent height differences. rotation counts clockwise quarter-turns from the initial shape.",
    },
    questions: {
      action: choice(
        "Play Tetris. Favor fewer holes, a low and even pile, and cleared lines. Choose one available button toward a good target; drop when positioned for it. Avoid gameOver.",
        {
          left: {
            button: "Move one column left.",
            available: canMoveLeft,
            targets: Object.values(criteria).filter(
              (target) => canMoveLeft && target.column < game.piece.x,
            ),
          },
          right: {
            button: "Move one column right.",
            available: canMoveRight,
            targets: Object.values(criteria).filter(
              (target) => canMoveRight && target.column > game.piece.x,
            ),
          },
          down: "Move one row down without changing column or rotation.",
          drop: {
            button: "Drop and lock now.",
            result: {
              ...describeBoard(currentDrop.board),
              linesCleared: currentDrop.lines - game.lines,
              gameOver: currentDrop.over,
            },
          },
          rotate: {
            button: "Rotate clockwise once.",
            available:
              JSON.stringify(shape(rotate(game).piece)) !==
              JSON.stringify(shape(game.piece)),
            targets: Object.values(criteria).filter(
              (target) => target.rotation !== game.piece.rotation,
            ),
          },
          none: "Wait for gravity without pressing a button.",
        },
      ),
    },
  };
}
