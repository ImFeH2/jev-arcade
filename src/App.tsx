import { AlertDialog, Dialog, Theme } from "@radix-ui/themes";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useRef, useState } from "react";
import { ActionButton } from "@/components/ActionButton";
import { Board } from "@/games/tetris/Board";
import {
  boardStatus,
  formatTime,
  matchStatus,
} from "@/games/tetris/presentation";
import { createGame } from "@/games/tetris/rules";
import { useMatch, type Command } from "@/games/tetris/useMatch";
import "@/styles/App.css";

const EMPTY = createGame([0]);
const TUTORIAL_KEY = "jev-arcade:tetris-controls";
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
  const [exitOpen, setExitOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(
    () => localStorage.getItem(TUTORIAL_KEY) !== "seen",
  );
  const resumeAfterTutorial = useRef(false);
  const gameArea = useRef<HTMLDivElement>(null);
  const { view, command, pause, retry } = useMatch(round);
  const running = !!view && !view.finished;
  const canPlay = running && !view.paused;
  const status = matchStatus(view);
  const focusGame = () => gameArea.current?.focus({ preventScroll: true });

  const openTutorial = (open: boolean) => {
    if (open) {
      resumeAfterTutorial.current = running && !view.paused;
      if (resumeAfterTutorial.current) pause();
    } else {
      localStorage.setItem(TUTORIAL_KEY, "seen");
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

            <div
              className="workspace"
              ref={gameArea}
              tabIndex={-1}
              aria-label="Tetris match"
            >
              <Board
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
              <aside
                className="match-info"
                aria-label="Match information"
                tabIndex={0}
              >
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
                <div className="jev-metrics">
                  <h2>Jev</h2>
                  <dl>
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
                </div>
              </aside>
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
              />
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
                <ActionButton className="primary-action">Got it</ActionButton>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Root>
      </MotionConfig>
    </Theme>
  );
}
