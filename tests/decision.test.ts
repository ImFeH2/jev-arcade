import assert from "node:assert/strict";
import test from "node:test";
import {
  act,
  createGame,
  drop,
  footprint,
  move,
  placements,
  sequence,
  targetAction,
  tick,
} from "@/games/tetris/rules";
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

test("Metrics describes every reachable target using its actual outcome", () => {
  const pieces = sequence(42);
  const game = createGame(pieces);
  const question = tetrisQuestion(game, pieces.slice(1, 4), "metrics");
  assert.equal(question.state.currentPiece, "Z");
  assert.equal(Object.keys(question.targets).length, placements(game).length);
  assert.deepEqual(
    Object.keys(question.targets),
    Object.keys(question.questions.placement.criteria),
  );
  for (const [id, target] of Object.entries(question.targets)) {
    let replay = game;
    while (replay.index === game.index) {
      const action = targetAction(replay, target);
      assert.ok(action);
      replay = act(replay, pieces, action);
    }
    const facts = JSON.parse(question.questions.placement.criteria[id]);
    const measured = describeBoard(replay.board);
    assert.deepEqual(facts, {
      holesAfter: measured.holes,
      aggregateHeightAfter: measured.totalHeight,
      maxHeightAfter: measured.maxHeight,
      bumpinessAfter: measured.bumpiness,
      clearedLines: replay.lines - game.lines,
      holesDelta: measured.holes - describeBoard(game.board).holes,
      rotation: target.rotation,
      leftmostColumn: target.x,
    });
  }
});

test("Lookahead describes consequences and next-piece reach without recommending a target", () => {
  const pieces = sequence(17);
  let game = createGame(pieces);
  game = drop(move(game, -3, 0), pieces);
  const next = pieces.slice(game.index + 1, game.index + 4);
  const question = tetrisQuestion(game, next, "lookahead");
  assert.equal(Object.keys(question.targets).length, placements(game).length);
  for (const [id, target] of Object.entries(question.targets)) {
    const after = drop({ ...game, piece: target }, pieces);
    const following = placements(after);
    const text = question.questions.placement.criteria[id];
    assert.ok(text.includes(`Lines cleared: ${after.lines - game.lines}.`));
    assert.ok(
      text.includes(
        `Resulting stack max height: ${describeBoard(after.board).maxHeight}/20.`,
      ),
    );
    assert.ok(text.includes(`could reach ${following.length} placements`));
  }
  for (const strategy of ["metrics", "lookahead"] as const) {
    const { targets, ...request } = tetrisQuestion(game, next, strategy);
    assert.equal(
      new Set(Object.values(targets).map(footprint)).size,
      Object.keys(targets).length,
    );
    const json = JSON.stringify(request);
    for (const field of [
      "decision_score",
      "recommended",
      "best_placement_found",
      "previousActions",
    ])
      assert.equal(json.includes(field), false);
  }
});

test("targets remain executable across gravity and expire when no longer reachable", () => {
  const pieces = sequence(91);
  let game = createGame(pieces);
  for (let i = 0; i < 60 && !game.over; i++) {
    const options = placements(game);
    for (const option of options) {
      let replay = game;
      for (const action of option.path) replay = act(replay, pieces, action);
      const target = { ...game.piece, ...option };
      assert.deepEqual(
        replay.board,
        drop({ ...game, piece: target }, pieces).board,
      );
    }
    const option = options[i % options.length];
    const target = {
      kind: game.piece.kind,
      rotation: option.rotation,
      x: option.x,
      y: option.y,
    };
    const index = game.index;
    while (!game.over && game.index === index) {
      const action = targetAction(game, target);
      if (action) game = act(game, pieces, action);
      if (game.index === index) game = tick(game, pieces);
    }
  }
  const straight = createGame([0, 1]);
  const edge = placements(straight).find(
    (option) => option.rotation === 1 && option.x === 0,
  );
  assert.ok(edge);
  let low = straight;
  for (let row = 0; row < 19; row++) low = tick(low, [0, 1]);
  assert.equal(targetAction(low, { ...straight.piece, ...edge }), null);
});
