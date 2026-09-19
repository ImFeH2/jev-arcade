import { useEffect, useRef, useState } from "react";
import {
  act,
  createGame,
  interval,
  sequence,
  shape,
  tick,
  type Action,
  type Game,
} from "@/games/tetris/rules";
import { decisionResponse } from "@/lib/protocol";

export type Command = Exclude<Action, "none">;
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
  finished: boolean;
};

export function useMatch(round: number) {
  const [view, setView] = useState<Match | null>(null);
  const command = useRef<(action: Command) => void>(() => {});
  const pause = useRef<() => void>(() => {});
  const retry = useRef<() => void>(() => {});

  useEffect(() => {
    if (!round) return;
    const pieces = sequence(crypto.getRandomValues(new Uint32Array(1))[0]);
    const match: Match = {
      player: createGame(pieces),
      jev: createGame(pieces),
      pieces,
      elapsed: 0,
      waiting: false,
      paused: document.hidden,
      error: "",
      tokens: 0,
      calls: 0,
      confidence: 0,
      finished: false,
    };
    let disposed = false;
    let controller: AbortController | null = null;
    let requestedIndex = -1;
    let requestedAt = -Infinity;
    let decidedObservation = "";
    let pending: { index: number; action: Action } | null = null;
    const previousActions: Action[] = [];
    let historyIndex = match.jev.index;
    let fall = 0;
    let last = performance.now();
    let painted = 0;
    let frame = 0;

    const publish = () => {
      if (!disposed) setView({ ...match });
    };
    const runnable = () => !match.paused && !match.finished && !document.hidden;
    const finish = () => {
      if (historyIndex !== match.jev.index) {
        historyIndex = match.jev.index;
        previousActions.length = 0;
      }
      match.finished = match.player.over || match.jev.over;
      if (match.finished) {
        controller?.abort();
        pending = null;
        match.waiting = false;
      } else if (controller && requestedIndex !== match.jev.index) {
        controller.abort();
      }
    };
    command.current = (action) => {
      if (!runnable()) return;
      match.player = act(match.player, pieces, action);
      finish();
      publish();
    };
    pause.current = () => {
      if (match.finished) return;
      match.paused = !match.paused;
      if (match.paused) {
        controller?.abort();
        pending = null;
        decidedObservation = "";
      }
      publish();
    };
    retry.current = () => {
      if (match.finished) return;
      match.error = "";
      decidedObservation = "";
      publish();
    };

    const decide = async () => {
      match.waiting = true;
      match.calls++;
      controller = new AbortController();
      const current = controller;
      const index = match.jev.index;
      requestedIndex = index;
      const decisionId = `${round}:${match.calls}`;
      publish();
      try {
        const response = await fetch("/api/decision", {
          method: "POST",
          signal: AbortSignal.any([current.signal, AbortSignal.timeout(17000)]),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            game: "tetris",
            decisionId,
            board: match.jev.board,
            piece: match.jev.piece,
            next: pieces.slice(index + 1, index + 4),
            previousActions,
          }),
        });
        if (!response.ok) {
          const message =
            response.status === 503
              ? "Set TYPESAFE_API_KEY in the server environment and restart the API."
              : response.status === 401
                ? "Check TYPESAFE_API_KEY in the server environment."
                : response.status === 429
                  ? "Rate limit reached. Wait, then retry."
                  : "The official API request failed. Retry to continue.";
          throw new Error(message);
        }
        const result = decisionResponse.parse(await response.json());
        if (disposed || current.signal.aborted || match.finished) return;
        if (result.decisionId !== decisionId)
          throw new Error("Mismatched decision received");
        match.tokens += result.inputTokens;
        match.confidence = result.confidence;
        if (match.jev.index === index)
          pending = { index, action: result.action };
      } catch (error) {
        if (!disposed && !current.signal.aborted && !match.finished)
          match.error =
            error instanceof Error ? error.message : "Decision failed";
      } finally {
        if (!disposed && controller === current) {
          match.waiting = false;
          controller = null;
          publish();
        }
      }
    };

    const animate = (now: number) => {
      const delta = now - last;
      last = now;
      if (runnable()) {
        match.elapsed += delta;
        if (pending) {
          if (pending.index === match.jev.index) {
            match.jev = act(match.jev, pieces, pending.action);
            previousActions.push(pending.action);
            if (previousActions.length > 8) previousActions.shift();
          }
          pending = null;
          finish();
        }
        if (!match.finished) {
          fall += delta;
          if (fall >= interval(match.elapsed)) {
            fall %= interval(match.elapsed);
            match.player = tick(match.player, pieces);
            match.jev = tick(match.jev, pieces);
            finish();
          }
        }
        const observation = JSON.stringify([
          match.jev.index,
          match.jev.piece.x,
          match.jev.piece.y,
          shape(match.jev.piece),
        ]);
        if (
          !match.finished &&
          !match.error &&
          !controller &&
          !pending &&
          observation !== decidedObservation &&
          now - requestedAt >= 500
        ) {
          decidedObservation = observation;
          requestedAt = now;
          void decide();
        }
      }
      if (match.finished || now - painted > 50) {
        publish();
        painted = now;
      }
      if (!match.finished) frame = requestAnimationFrame(animate);
    };

    const keydown = (event: KeyboardEvent) => {
      if (!runnable()) return;
      if (
        event.target instanceof HTMLElement &&
        (["INPUT", "TEXTAREA"].includes(event.target.tagName) ||
          event.target.isContentEditable ||
          event.target.closest('[role="alertdialog"], [role="dialog"]') ||
          (event.target.closest("button") && event.key === " "))
      )
        return;
      const keys: Record<string, Command> = {
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowUp: "rotate",
        ArrowDown: "down",
        " ": "drop",
      };
      if (keys[event.key]) {
        event.preventDefault();
        if ((event.key === " " || event.key === "ArrowUp") && event.repeat)
          return;
        command.current(keys[event.key]);
      }
    };
    const visibility = () => {
      if (document.hidden && !match.paused && !match.finished) pause.current();
    };
    window.addEventListener("keydown", keydown);
    document.addEventListener("visibilitychange", visibility);
    publish();
    frame = requestAnimationFrame(animate);
    return () => {
      disposed = true;
      controller?.abort();
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", keydown);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [round]);

  return {
    view: round ? view : null,
    command: (action: Command) => command.current(action),
    pause: () => pause.current(),
    retry: () => retry.current(),
  };
}
