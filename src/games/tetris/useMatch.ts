import { useEffect, useRef, useState } from "react";
import {
  act,
  interval,
  sequence,
  targetAction,
  tick,
  type Action,
  type Piece,
} from "@/games/tetris/rules";
import { createMatch, updateFinished, type Match } from "@/games/tetris/match";
import { decisionResponse, type Strategy } from "@/lib/protocol";

export type Command = Exclude<Action, "none">;

export function useMatch(round: number, strategy: Strategy) {
  const [view, setView] = useState<Match | null>(null);
  const selectedStrategy = useRef(strategy);
  useEffect(() => {
    selectedStrategy.current = strategy;
  }, [strategy]);
  const command = useRef<(action: Command) => void>(() => {});
  const pause = useRef<() => void>(() => {});
  const retry = useRef<() => void>(() => {});

  useEffect(() => {
    if (!round) return;
    const pieces = sequence(crypto.getRandomValues(new Uint32Array(1))[0]);
    const match = createMatch(pieces, selectedStrategy.current);
    match.paused = document.hidden;
    let strategyIndex = match.jev.index;
    let disposed = false;
    let controller: AbortController | null = null;
    let requestedIndex = -1;
    let requestedAt = -Infinity;
    let pending: { index: number; target: Piece } | null = null;
    let actedAt = -Infinity;
    let fall = 0;
    let last = performance.now();
    let painted = 0;
    let frame = 0;

    const publish = () => {
      if (!disposed) setView({ ...match });
    };
    const runnable = () => !match.paused && !match.finished && !document.hidden;
    const finish = () => {
      updateFinished(match);
      if (strategyIndex !== match.jev.index) {
        strategyIndex = match.jev.index;
        match.strategy = selectedStrategy.current;
      }
      if (match.jev.over) {
        controller?.abort();
        pending = null;
        match.waiting = false;
        match.error = "";
      } else {
        if (controller && requestedIndex !== match.jev.index)
          controller.abort();
        if (pending && pending.index !== match.jev.index) pending = null;
      }
    };
    command.current = (action) => {
      if (!runnable() || match.player.over) return;
      match.player = act(match.player, pieces, action);
      finish();
      publish();
    };
    pause.current = () => {
      if (match.finished) return;
      match.paused = !match.paused;
      if (match.paused) {
        controller?.abort();
      }
      publish();
    };
    retry.current = () => {
      if (match.jev.over) return;
      match.error = "";
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
            strategy: match.strategy,
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
        if (disposed || current.signal.aborted || match.jev.over) return;
        if (result.decisionId !== decisionId)
          throw new Error("Mismatched decision received");
        match.tokens += result.inputTokens;
        match.confidence = result.confidence;
        if (match.jev.index === index)
          pending = { index, target: result.target };
      } catch (error) {
        if (!disposed && !current.signal.aborted && !match.jev.over)
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
        fall += delta;
        while (!match.finished && fall >= interval(match.elapsed)) {
          fall -= interval(match.elapsed);
          match.player = tick(match.player, pieces);
          match.jev = tick(match.jev, pieces);
          finish();
        }
        if (pending && !match.jev.over && now - actedAt >= 100) {
          const action =
            pending.index === match.jev.index
              ? targetAction(match.jev, pending.target)
              : null;
          if (action) {
            actedAt = now;
            match.jev = act(match.jev, pieces, action);
            finish();
          } else pending = null;
        }
        if (
          !match.jev.over &&
          !match.error &&
          !controller &&
          !pending &&
          now - requestedAt >= 500
        ) {
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
      if (!runnable() || match.player.over) return;
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
