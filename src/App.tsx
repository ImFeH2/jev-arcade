import { AlertDialog, Dialog, Theme } from "@radix-ui/themes";
import { AnimatePresence, MotionConfig } from "motion/react";
import * as motion from "motion/react-m";
import { useRef, useState } from "react";
import { ActionButton } from "@/components/ActionButton";
import { StrategySelect } from "@/components/StrategySelect";
import type { Strategy } from "@/lib/protocol";
import { Board } from "@/games/tetris/Board";
import {
  boardStatus,
  formatTime,
  matchStatus,
} from "@/games/tetris/presentation";
import { createGame } from "@/games/tetris/rules";
import { useMatch, type Command } from "@/games/tetris/useMatch";
import { readTutorialPreference, saveTutorialPreference } from "@/lib/tutorial";
import "@/styles/App.css";

const EMPTY = createGame([0]);
const CONTROLS: {
  action: Command;
  label: string;
  symbol: string;
  key: string;
}[] = [
  { action: "left", label: "Move left", symbol: "←", key: "←" },
  { action: "right", label: "Move right", symbol: "→", key: "→" },
  { action: "rotate", label: "Rotate", symbol: "↻", key: "↑" },
  { action: "down", label: "Soft drop", symbol: "↓", key: "↓" },
  { action: "drop", label: "Hard drop", symbol: "Drop", key: "Space" },
];

export default function App() {
  const [round, setRound] = useState(0);
  const [strategy, setStrategy] = useState<Strategy>("lookahead");
  const [exitOpen, setExitOpen] = useState(false);
  const [tutorialPreference, setTutorialPreference] = useState(
    readTutorialPreference,
  );
  const [tutorialOpen, setTutorialOpen] = useState(!tutorialPreference.seen);
  const resumeAfterTutorial = useRef(false);
  const gameArea = useRef<SVGSVGElement>(null);
  const { view, command, pause, retry } = useMatch(round, strategy);
  const running = !!view && !view.finished;
  const canPlay = running && !view.paused && !view.player.over;
  const status = matchStatus(view);
  const focusGame = () => gameArea.current?.focus({ preventScroll: true });

  const openTutorial = (open: boolean) => {
    if (open) {
      resumeAfterTutorial.current = running && !view.paused;
      if (resumeAfterTutorial.current) pause();
    } else {
      if (!tutorialPreference.error) {
        const error = saveTutorialPreference();
        if (error) {
          setTutorialPreference({ seen: false, error });
          return;
        }
      }
      if (resumeAfterTutorial.current && view?.paused && !view.finished)
        pause();
      resumeAfterTutorial.current = false;
    }
    setTutorialOpen(open);
  };

  return (
    <Theme appearance="dark" accentColor="gray" grayColor="gray" radius="large">
      <MotionConfig
        reducedMotion="user"
        transition={{ type: "spring", bounce: 0, duration: 0.3 }}
      >
        <Dialog.Root open={tutorialOpen} onOpenChange={openTutorial}>
          <main className="app-shell">
            <aside className="global-panel" aria-label="Match controls">
              <header className="app-header">
                <span className="brand">Jev Arcade</span>
                <h1>Tetris</h1>
                <Dialog.Trigger>
                  <ActionButton variant="soft">Help</ActionButton>
                </Dialog.Trigger>
              </header>

              <div className="toolbar">
                <div className="match-actions">
                  <ActionButton
                    className="primary-action"
                    onClick={() => {
                      if (running) pause();
                      else setRound((value) => value + 1);
                      focusGame();
                    }}
                  >
                    {running
                      ? view.paused
                        ? "Resume"
                        : "Pause"
                      : view?.finished
                        ? "Play again"
                        : "Start"}
                  </ActionButton>
                  {running && (
                    <AlertDialog.Root
                      open={exitOpen}
                      onOpenChange={(open) => {
                        if (open && !view.paused) pause();
                        setExitOpen(open);
                      }}
                    >
                      <AlertDialog.Trigger>
                        <ActionButton variant="soft">End</ActionButton>
                      </AlertDialog.Trigger>
                      <AlertDialog.Content
                        maxWidth="360px"
                        onCloseAutoFocus={(event) => {
                          event.preventDefault();
                          focusGame();
                        }}
                      >
                        <AlertDialog.Title>End match?</AlertDialog.Title>
                        <AlertDialog.Description>
                          This ends the current match.
                        </AlertDialog.Description>
                        <div className="dialog-actions">
                          <AlertDialog.Cancel>
                            <ActionButton variant="soft">Cancel</ActionButton>
                          </AlertDialog.Cancel>
                          <AlertDialog.Action>
                            <ActionButton
                              className="primary-action"
                              onClick={() => setRound(0)}
                            >
                              End
                            </ActionButton>
                          </AlertDialog.Action>
                        </div>
                      </AlertDialog.Content>
                    </AlertDialog.Root>
                  )}
                  {running && view.error && (
                    <ActionButton
                      variant="soft"
                      onClick={() => {
                        retry();
                        focusGame();
                      }}
                    >
                      Retry
                    </ActionButton>
                  )}
                </div>
                <StrategySelect
                  value={strategy}
                  pending={
                    !!view && !view.jev.over && strategy !== view.strategy
                  }
                  onChange={setStrategy}
                />
                <div
                  className="direction-pad"
                  role="group"
                  aria-label="Your controls"
                >
                  {CONTROLS.map(({ action, label, symbol, key }) => (
                    <ActionButton
                      key={action}
                      variant="soft"
                      aria-label={label}
                      title={`${label} (${key})`}
                      disabled={!canPlay}
                      onClick={() => {
                        command(action);
                        focusGame();
                      }}
                    >
                      <span aria-hidden="true">{symbol}</span>
                    </ActionButton>
                  ))}
                </div>
              </div>

              <div className="match-banner" role="status" aria-atomic="true">
                <AnimatePresence initial={false}>
                  <motion.span
                    key={status}
                    className="status-message"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.14 }}
                  >
                    {status}
                  </motion.span>
                </AnimatePresence>
              </div>

              <div className="match-info">
                <dl className="shared-metrics">
                  <div>
                    <dt>Time</dt>
                    <dd className="clock">{formatTime(view?.elapsed ?? 0)}</dd>
                  </div>
                  <div>
                    <dt>Speed level</dt>
                    <dd>{Math.floor((view?.elapsed ?? 0) / 30000) + 1}</dd>
                  </div>
                </dl>
              </div>
            </aside>
            <div className="workspace" aria-label="Tetris match">
              <Board
                ref={gameArea}
                game={view?.player ?? EMPTY}
                label="You"
                status={boardStatus(view, "player")}
                started={!!view}
                next={
                  view
                    ? view.pieces.slice(
                        view.player.index + 1,
                        view.player.index + 4,
                      )
                    : []
                }
              />
              <Board
                game={view?.jev ?? EMPTY}
                label="Jev"
                status={boardStatus(view, "jev")}
                started={!!view}
                next={
                  view
                    ? view.pieces.slice(view.jev.index + 1, view.jev.index + 4)
                    : []
                }
              >
                <dl className="jev-metrics">
                  <div>
                    <dt>Requests</dt>
                    <dd>{view?.calls ?? 0}</dd>
                  </div>
                  <div>
                    <dt>Confidence</dt>
                    <dd>
                      {view?.calls
                        ? `${Math.round(view.confidence * 100)}%`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>Input tokens</dt>
                    <dd>{(view?.tokens ?? 0).toLocaleString()}</dd>
                  </div>
                </dl>
              </Board>
            </div>
          </main>
          <Dialog.Content
            aria-describedby={undefined}
            maxWidth="360px"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              focusGame();
            }}
          >
            <Dialog.Title>Controls</Dialog.Title>
            {tutorialPreference.error && (
              <p className="storage-notice" role="alert">
                {tutorialPreference.error}
              </p>
            )}
            <dl className="tutorial-controls">
              {CONTROLS.map(({ action, label, key }) => (
                <div key={action}>
                  <dt>{label}</dt>
                  <dd>
                    <kbd>{key}</kbd>
                  </dd>
                </div>
              ))}
            </dl>
            <div className="dialog-actions">
              <Dialog.Close>
                <ActionButton className="primary-action">
                  {tutorialPreference.error ? "Continue" : "Got it"}
                </ActionButton>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Root>
      </MotionConfig>
    </Theme>
  );
}
