import assert from "node:assert/strict";
import test from "node:test";
import {
  createGame,
  drop,
  fits,
  interval,
  lock,
  move,
  placements,
  rotate,
  sequence,
  shape,
  tick,
  WIDTH,
  HEIGHT,
} from "@/games/tetris/rules";
import { decisionRequest } from "@/lib/protocol";

test("seven-bag sequences are deterministic, complete, and independent", () => {
  const pieces = sequence(42, 140);
  assert.deepEqual(pieces, sequence(42, 140));
  assert.notDeepEqual(pieces, sequence(43, 140));
  for (let i = 0; i < 140; i += 7)
    assert.deepEqual([...pieces.slice(i, i + 7)].sort(), [0, 1, 2, 3, 4, 5, 6]);
  const player = createGame(pieces);
  const jev = createGame(pieces);
  player.board[19][0] = 1;
  assert.equal(jev.board[19][0], 0);
});

test("movement stays inside the board and rotation completes a cycle", () => {
  for (let kind = 0; kind < 7; kind++) {
    let game = createGame([kind]);
    const original = shape(game.piece);
    for (let i = 0; i < 4; i++) game = rotate(game);
    assert.deepEqual(shape(game.piece), original);
    for (let i = 0; i < 20; i++) game = move(game, -1, 0);
    assert.equal(move(game, -1, 0), game);
    assert.ok(fits(game.board, game.piece));
  }
});

test("hard drop locks a piece and advances the shared sequence", () => {
  const pieces = sequence(8);
  const next = drop(createGame(pieces), pieces);
  assert.equal(next.index, 1);
  assert.equal(next.piece.kind, pieces[1]);
  assert.equal(next.board.flat().filter(Boolean).length, 4);
});

test("completed rows clear and score while retaining board dimensions", () => {
  const game = createGame([0, 1]);
  game.board[19] = [0, 0, 0, 0, 2, 2, 2, 2, 2, 2];
  game.piece.x = 0;
  const result = drop(game, [0, 1]);
  assert.equal(result.lines, 1);
  assert.equal(result.board.flat().filter(Boolean).length, 0);
  assert.equal(result.board.length, HEIGHT);
  assert.ok(result.board.every((row) => row.length === WIDTH));
});

test("blocked spawn ends the game and further ticks do nothing", () => {
  const game = createGame([1, 1]);
  game.board[0][4] = 1;
  game.piece = { kind: 1, rotation: 0, x: 0, y: 18 };
  const result = lock(game, [1, 1]);
  assert.equal(result.over, true);
  assert.equal(tick(result, [1, 1]), result);
});

test("every proposed placement is valid through gravity on changing boards", () => {
  const pieces = sequence(91);
  let game = createGame(pieces);
  for (let i = 0; i < 100 && !game.over; i++) {
    const options = placements(game);
    assert.ok(options.length > 0 && options.length <= 40);
    for (const option of options) {
      assert.ok(fits(game.board, { ...game.piece, ...option, y: 0 }));
      assert.ok(fits(game.board, { ...game.piece, ...option }));
      assert.equal(
        fits(game.board, { ...game.piece, ...option, y: option.y + 1 }),
        false,
      );
    }
    const option = options[i % options.length];
    game = drop({ ...game, piece: { ...game.piece, ...option, y: 0 } }, pieces);
  }
});

test("speed increases with active time and request validation rejects invalid data", () => {
  assert.equal(interval(0), 800);
  assert.equal(interval(30000), 740);
  assert.equal(interval(9999999), 100);
  const valid = {
    game: "tetris",
    decisionId: "1:0",
    board: createGame([0]).board,
    piece: createGame([0]).piece,
    next: [1, 2, 3],
    previousActions: [],
  };
  assert.equal(decisionRequest.safeParse(valid).success, true);
  assert.equal(
    decisionRequest.safeParse({ ...valid, board: [] }).success,
    false,
  );
  assert.equal(
    decisionRequest.safeParse({ ...valid, apiKey: "unexpected" }).success,
    false,
  );
});
