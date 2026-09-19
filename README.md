# Jev Arcade

Play survival Tetris against Jev using the official TypeSafe SDK.

## Development

Requires Node.js 24 and pnpm.

```sh
pnpm install
pnpm dev
```

Set `TYPESAFE_API_KEY` in the server environment before running `pnpm dev`. Restart the API after changing this environment variable.

Open http://127.0.0.1:5173 and select Start. Vite forwards `/api` requests to the local Node.js service on port 3001.

The official SDK reads the key on the server. Keep it out of `VITE_*` variables and source files. Model calls use your TypeSafe account and consume tokens.

## Tetris

Each player has an independent board with the same seven-bag piece sequence. Gravity accelerates every 30 seconds of active play. The longest survival time wins; there are no attacks.

- Arrow keys: move, rotate, or soft drop.
- Space: hard drop.
- On-screen buttons support touch input.
- Both boards and clocks pause while Jev chooses a placement.
- Switching tabs pauses the match. Resume explicitly to continue.
- API errors pause play and allow an explicit retry or exit.

## Checks

```sh
pnpm test
pnpm build
pnpm lint
```

With the local service running and `TYPESAFE_API_KEY` configured in its environment, run `pnpm test:live` to verify a real official API decision. This check consumes tokens. Never commit API keys.

`pnpm build` checks browser and server types and creates the frontend in `dist/`. The API service is required for Jev decisions.
