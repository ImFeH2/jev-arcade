import type { Match } from "@/games/tetris/useMatch";

export function formatTime(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export function matchStatus(match: Match | null) {
  if (!match) return "Ready";
  if (match.finished) {
    if (match.player.over && match.jev.over) return "Draw";
    return match.player.over ? "Jev wins" : "You win";
  }
  if (match.paused) return "Paused";
  if (match.error) return match.error;
  return "Playing";
}

export function boardStatus(match: Match | null, side: "player" | "jev") {
  if (!match) return "Ready";
  if (match.finished) {
    if (match.player.over && match.jev.over) return "Draw";
    return match[side].over ? "Lost" : "Won";
  }
  if (match.paused) return "Paused";
  if (side === "jev" && match.error) return "Unavailable";
  if (side === "jev" && match.waiting) return "Thinking";
  return "Playing";
}
