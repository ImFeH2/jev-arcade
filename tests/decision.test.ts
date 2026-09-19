import assert from "node:assert/strict";
import test from "node:test";
import { act, createGame, placements, shape } from "@/games/tetris/rules";
import { describeBoard, tetrisQuestion } from "../server/tetris";

test("board descriptions count covered holes, heights, and uneven surfaces", () => {
  const { board } = createGame([0]);
  assert.deepEqual(describeBoard(board), {
    holes: 0,
    maxHeight: 0,
    totalHeight: 0,
    bumpiness: 0,
  });
  board[17][0] = 1;
  board[19][0] = 1;
  assert.deepEqual(describeBoard(board), {
    holes: 1,
    maxHeight: 3,
    totalHeight: 3,
    bumpiness: 3,
  });
});

test("wall-bound moves are unavailable and rotated pieces retain targets", () => {
  const pieces = [5, 0, 1, 2];
  let game = createGame(pieces);
  for (let i = 0; i < 10; i++) game = act(game, pieces, "right");
  const request = tetrisQuestion(game, [0, 1, 2], []);
  assert.equal(request.questions.action.criteria.right.available, false);
  assert.deepEqual(request.questions.action.criteria.right.targets, []);
  game = act(game, pieces, "rotate");
  game = act(game, pieces, "down");
  assert.ok(placements(game).length > 0);
  assert.deepEqual(
    tetrisQuestion(game, [0, 1, 2], []).state.currentPiece.cells,
    shape(game.piece),
  );
  assert.equal(act(game, pieces, "none"), game);
  assert.equal(act({ ...game, over: true }, pieces, "drop").index, game.index);
});

test("Jev receives actual placement outcomes and named piece shapes", () => {
  const game = createGame([0, 1]);
  game.board[19] = [0, 0, 0, 0, 2, 2, 2, 2, 2, 2];
  const request = tetrisQuestion(game, [1, 2, 3], []);
  assert.deepEqual(Object.keys(request.questions.action.criteria), [
    "left",
    "right",
    "down",
    "drop",
    "rotate",
    "none",
  ]);
  assert.equal(request.state.currentPiece.name, "I");
  assert.deepEqual(request.state.currentPiece.cells, [[1, 1, 1, 1]]);
  assert.deepEqual(
    request.questions.action.criteria.left.targets.find(
      (target) => target.rotation === 0 && target.column === 0,
    ),
    {
      rotation: 0,
      column: 0,
      linesCleared: 1,
      gameOver: false,
      holes: 0,
      maxHeight: 0,
      totalHeight: 0,
      bumpiness: 0,
    },
  );
});
