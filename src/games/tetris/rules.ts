export const ACTIONS = [
  "left",
  "right",
  "down",
  "drop",
  "rotate",
  "none",
] as const;
export type Action = (typeof ACTIONS)[number];
export const WIDTH = 10;
export const HEIGHT = 20;
export const SHAPES = [
  [[1, 1, 1, 1]],
  [
    [1, 1],
    [1, 1],
  ],
  [
    [0, 1, 0],
    [1, 1, 1],
  ],
  [
    [0, 1, 1],
    [1, 1, 0],
  ],
  [
    [1, 1, 0],
    [0, 1, 1],
  ],
  [
    [1, 0, 0],
    [1, 1, 1],
  ],
  [
    [0, 0, 1],
    [1, 1, 1],
  ],
];
export type Piece = { kind: number; rotation: number; x: number; y: number };
export type Game = {
  board: number[][];
  piece: Piece;
  index: number;
  lines: number;
  over: boolean;
};
export type Placement = {
  id: string;
  rotation: number;
  x: number;
  y: number;
  path: Action[];
};

export function cells(piece: Piece) {
  return shape(piece).flatMap((row, y) =>
    row.flatMap((cell, x) => (cell ? [[piece.x + x, piece.y + y]] : [])),
  );
}

export function footprint(piece: Piece) {
  return JSON.stringify(cells(piece));
}

export function shape(piece: Piece) {
  let cells = SHAPES[piece.kind].map((row) => [...row]);
  for (let i = 0; i < piece.rotation; i++) {
    cells = cells[0].map((_, x) => cells.map((row) => row[x]).reverse());
  }
  return cells;
}

export function fits(board: number[][], piece: Piece) {
  return shape(piece).every((row, y) =>
    row.every(
      (cell, x) =>
        !cell ||
        (piece.x + x >= 0 &&
          piece.x + x < WIDTH &&
          piece.y + y >= 0 &&
          piece.y + y < HEIGHT &&
          board[piece.y + y][piece.x + x] === 0),
    ),
  );
}

export function sequence(seed: number, count = 4096) {
  let value = seed >>> 0;
  const random = () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
  const result: number[] = [];
  while (result.length < count) {
    const bag = [0, 1, 2, 3, 4, 5, 6];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    result.push(...bag);
  }
  return result.slice(0, count);
}

export function spawn(kind: number): Piece {
  return {
    kind,
    rotation: 0,
    x: Math.floor((WIDTH - SHAPES[kind][0].length) / 2),
    y: 0,
  };
}

export function createGame(pieces: number[]): Game {
  return {
    board: Array.from({ length: HEIGHT }, () => Array<number>(WIDTH).fill(0)),
    piece: spawn(pieces[0]),
    index: 0,
    lines: 0,
    over: false,
  };
}

export function move(game: Game, dx: number, dy: number): Game {
  const piece = { ...game.piece, x: game.piece.x + dx, y: game.piece.y + dy };
  return !game.over && fits(game.board, piece) ? { ...game, piece } : game;
}

export function rotate(game: Game): Game {
  for (const dx of [0, -1, 1, -2, 2]) {
    const piece = {
      ...game.piece,
      rotation: (game.piece.rotation + 1) % 4,
      x: game.piece.x + dx,
    };
    if (!game.over && fits(game.board, piece)) return { ...game, piece };
  }
  return game;
}

export function landing(game: Game, piece = game.piece) {
  while (fits(game.board, { ...piece, y: piece.y + 1 }))
    piece = { ...piece, y: piece.y + 1 };
  return piece;
}

export function lock(game: Game, pieces: number[]): Game {
  if (game.over) return game;
  const board = game.board.map((row) => [...row]);
  shape(game.piece).forEach((row, y) =>
    row.forEach((cell, x) => {
      if (cell) board[game.piece.y + y][game.piece.x + x] = game.piece.kind + 1;
    }),
  );
  const remaining = board.filter((row) => row.some((cell) => cell === 0));
  const cleared = HEIGHT - remaining.length;
  const nextBoard = [
    ...Array.from({ length: cleared }, () => Array<number>(WIDTH).fill(0)),
    ...remaining,
  ];
  const index = game.index + 1;
  if (index >= pieces.length) throw new Error("Piece sequence exhausted");
  const piece = spawn(pieces[index]);
  return {
    board: nextBoard,
    piece,
    index,
    lines: game.lines + cleared,
    over: !fits(nextBoard, piece),
  };
}

export function tick(game: Game, pieces: number[]) {
  const next = move(game, 0, 1);
  return next === game ? lock(game, pieces) : next;
}

export function drop(game: Game, pieces: number[]) {
  return lock({ ...game, piece: landing(game) }, pieces);
}

export function placements(game: Game): Placement[] {
  if (game.over) return [];
  const queue: { game: Game; path: Action[] }[] = [{ game, path: [] }];
  const visited = new Set<string>();
  const result = new Map<string, Placement>();
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    const pose = JSON.stringify(current.game.piece);
    if (visited.has(pose)) continue;
    visited.add(pose);
    const final = landing(current.game);
    const key = footprint(final);
    if (!result.has(key)) {
      result.set(key, {
        id: `r${final.rotation}x${final.x}`,
        rotation: final.rotation,
        x: final.x,
        y: final.y,
        path: [...current.path, "drop"],
      });
    }
    for (const action of ["left", "right", "rotate"] as const) {
      const next = act(current.game, [], action);
      if (next !== current.game && !visited.has(JSON.stringify(next.piece)))
        queue.push({ game: next, path: [...current.path, action] });
    }
  }
  return [...result.values()];
}

export function targetAction(game: Game, target: Piece): Action | null {
  if (game.over || game.piece.kind !== target.kind) return null;
  const key = footprint(target);
  const reachable = placements(game).find(
    (option) => footprint({ ...game.piece, ...option }) === key,
  );
  return reachable?.path[0] ?? null;
}

export function act(game: Game, pieces: number[], action: Action): Game {
  if (game.over) return game;
  if (action === "left") return move(game, -1, 0);
  if (action === "right") return move(game, 1, 0);
  if (action === "down") return tick(game, pieces);
  if (action === "drop") return drop(game, pieces);
  if (action === "rotate") return rotate(game);
  return game;
}

export function interval(elapsed: number) {
  return Math.max(100, 800 - Math.floor(elapsed / 30000) * 60);
}
