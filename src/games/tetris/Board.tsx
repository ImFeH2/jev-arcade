import { AnimatePresence } from "motion/react";
import * as motion from "motion/react-m";
import { useId, type ReactNode, type Ref } from "react";
import {
  HEIGHT,
  SHAPES,
  WIDTH,
  landing,
  shape,
  type Game,
} from "@/games/tetris/rules";

const COLORS = [
  "transparent",
  "#61d7e8",
  "#e9d372",
  "#b5a2ed",
  "#a4cd83",
  "#eb8c88",
  "#8caaf0",
  "#dfac78",
];
const NAMES = ["I", "O", "T", "S", "Z", "J", "L"];

type Props = {
  game: Game;
  label: string;
  next: number[];
  status: string;
  started: boolean;
  ref?: Ref<SVGSVGElement>;
  children?: ReactNode;
};

export function Board({
  game,
  label,
  next,
  status,
  started,
  ref,
  children,
}: Props) {
  const titleId = useId();
  const cells = game.board.map((row) => [...row]);
  const ghost = new Set<number>();
  const covered = ["Paused", "Won", "Lost", "Draw"].includes(status);

  if (started && !game.over) {
    const final = landing(game);
    shape(final).forEach((row, y) =>
      row.forEach((cell, x) => {
        if (cell) ghost.add((final.y + y) * WIDTH + final.x + x);
      }),
    );
    shape(game.piece).forEach((row, y) =>
      row.forEach((cell, x) => {
        if (cell)
          cells[game.piece.y + y][game.piece.x + x] = game.piece.kind + 1;
      }),
    );
  }

  return (
    <section className="station" aria-labelledby={titleId}>
      <div className="station-content">
        <header className="station-header">
          <div>
            <h2 id={titleId}>{label}</h2>
            <span className="station-status">{status}</span>
          </div>
          <div className="line-count">
            <span>Lines</span>
            <strong>{game.lines}</strong>
          </div>
        </header>

        <div className="next-pieces" aria-label={`${label} next pieces`}>
          <span>Next</span>
          {started ? (
            next.map((kind, index) => (
              <svg
                key={index}
                width="36"
                height="26"
                viewBox="0 0 48 32"
                aria-label={`${index + 1}: ${NAMES[kind]}`}
                role="img"
              >
                {SHAPES[kind].flatMap((row, y) =>
                  row.map((cell, x) =>
                    cell ? (
                      <rect
                        key={`${x}:${y}`}
                        x={x * 10}
                        y={y * 10 + 5}
                        width="9"
                        height="9"
                        rx="1"
                        fill={COLORS[kind + 1]}
                      />
                    ) : null,
                  ),
                )}
              </svg>
            ))
          ) : (
            <span className="empty-next">—</span>
          )}
        </div>
        <div className="station-details">{children}</div>
        <div className="board-frame">
          <svg
            className="board"
            ref={ref}
            tabIndex={ref ? -1 : undefined}
            viewBox={`0 0 ${WIDTH * 24} ${HEIGHT * 24}`}
            role="img"
            aria-label={`${label}: ${game.lines} lines cleared, ${status}`}
          >
            {cells.flatMap((row, y) =>
              row.map((cell, x) => (
                <rect
                  key={`${x}:${y}`}
                  x={x * 24 + 1}
                  y={y * 24 + 1}
                  width="22"
                  height="22"
                  rx="2"
                  fill={cell ? COLORS[cell] : "#141414"}
                  stroke={
                    ghost.has(y * WIDTH + x) && !cell ? "#777" : "#202020"
                  }
                  strokeWidth="1"
                />
              )),
            )}
          </svg>
          <AnimatePresence initial={false}>
            {covered && (
              <motion.div
                className="board-overlay"
                key={status}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
              >
                {status}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
