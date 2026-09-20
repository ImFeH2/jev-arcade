import type { Match } from "@/games/tetris/match";

export function formatTime(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export function matchWinner(match: Match) {
  const { player, jev } = match.endedAt;
  if (player === null || jev === null)
    throw new Error("Match result requested before both boards finished");
  if (player === jev) return null;
  return player > jev ? "player" : "jev";
}

export function matchStatus(match: Match | null) {
  if (!match) return "Ready";
  if (match.finished) {
    const winner = matchWinner(match);
    return winner === null
      ? "Draw"
      : winner === "player"
        ? "You win"
        : "Jev wins";
  }
  if (match.paused) return "Paused";
  if (match.error) return match.error;
  if (match.player.over) return "Jev playing";
  if (match.jev.over) return "You playing";
  return "Playing";
}

export function boardStatus(match: Match | null, side: "player" | "jev") {
  if (!match) return "Ready";
  if (match.finished) {
    const winner = matchWinner(match);
    return winner === null ? "Draw" : winner === side ? "Won" : "Lost";
  }
  if (match[side].over) return "Finished";
  if (match.paused) return "Paused";
  if (side === "jev" && match.error) return "Unavailable";
  if (side === "jev" && match.waiting) return "Thinking";
  return "Playing";
}
