import { choice } from "@typesafe-ai/sdk";
import {
  act,
  drop,
  landing,
  placements,
  move,
  rotate,
  shape,
  SHAPES,
  type Action,
  type Game,
} from "@/games/tetris/rules";

const NAMES = ["I", "O", "T", "S", "Z", "J", "L"];

function shapeRows(cells: number[][]) {
  return cells.map((row) => row.map((cell) => (cell ? "#" : ".")).join(""));
}

export function canvasRows(game: Game) {
  const rows: string[][] = game.board.map((row) =>
    row.map((cell) => (cell ? "#" : ".")),
  );
  for (const [piece, marker] of [
    [landing(game), "+"],
    [game.piece, "@"],
  ] as const) {
    shape(piece).forEach((row, y) =>
      row.forEach((cell, x) => {
        if (cell) rows[piece.y + y][piece.x + x] = marker;
      }),
    );
  }
  return rows.map((row) => row.join(""));
}

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
  const afterPress = (action: Action) => {
    const moved = act({ ...game, index: 0 }, pieces, action);
    const placed = moved.index === 0 ? drop(moved, pieces) : moved;
    return {
      linesCleared: placed.lines - game.lines,
      gameOver: placed.over,
      ...describeBoard(placed.board),
    };
  };
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
      board: {
        columns: "0123456789",
        rows: canvasRows(game),
        legend: {
          ".": "empty",
          "#": "settled block",
          "@": "the piece you control",
          "+": "where it lands if dropped now",
        },
      },
      currentPiece: {
        name: NAMES[game.piece.kind],
        marker: "@",
        rows: shapeRows(shape(game.piece)),
        afterClockwiseRotation: shapeRows(shape(rotate(game).piece)),
        x: game.piece.x,
        y: game.piece.y,
        rotation: game.piece.rotation,
        previousActions,
      },
      nextPieces: next.map((kind) => ({
        name: NAMES[kind],
        rotation: 0,
        rows: shapeRows(SHAPES[kind]),
      })),
      legend:
        "Coordinates and row indexes start at 0, x rightward and y downward. Piece shapes use # for a cell and . for empty space. afterDrop measures pressing that button once and then dropping straight down; targets may need several button presses. rotation counts clockwise quarter-turns from the spawn shape; all next pieces spawn at rotation 0. Reachable targets describe future placements after clearing rows: holes = covered empty cells; maxHeight = tallest column; totalHeight = sum of column heights; bumpiness = adjacent height differences.",
    },
    questions: {
      action: choice(
        "Control `currentPiece`, marked @ in `board.rows`. Favor fewer holes, a low and even pile, and cleared lines. Choose one available button toward a good target; drop when positioned for it. Avoid gameOver.",
        {
          left: {
            button: "Move one column left.",
            available: canMoveLeft,
            afterDrop: afterPress("left"),
            targets: Object.values(criteria).filter(
              (target) => canMoveLeft && target.column < game.piece.x,
            ),
          },
          right: {
            button: "Move one column right.",
            available: canMoveRight,
            afterDrop: afterPress("right"),
            targets: Object.values(criteria).filter(
              (target) => canMoveRight && target.column > game.piece.x,
            ),
          },
          down: { button: "Move one row down.", afterDrop: afterPress("down") },
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
            afterDrop: afterPress("rotate"),
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
