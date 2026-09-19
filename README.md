# Jev Arcade

Play survival Tetris against Jev using the official TypeSafe SDK.

## Development

Requires Node.js 24 and pnpm.

```sh
pnpm install
pnpm dev
```

Fill in `TYPESAFE_API_KEY` in the root `.env` file before starting. The server loads this file automatically; restart it after changing the key. The file is ignored by Git.

Open http://127.0.0.1:5173 and select Start. Vite forwards `/api` requests to the local Node.js service on port 3001.

The official SDK reads the key on the server. Keep it out of `VITE_*` variables and source files. Model calls use your TypeSafe account and consume tokens.

## Preview

```sh
pnpm build
pnpm preview
```

Open http://127.0.0.1:4173. Preview runs the compiled frontend and Node.js API without hot reload. Source edits take effect after rebuilding and restarting.

Development and preview both use API port 3001; stop one before starting the other.

## Tetris

Each player has an independent board with the same seven-bag piece sequence. Gravity accelerates every 30 seconds of active play. The match ends when either board tops out; the other player wins. Simultaneous top-outs are a draw.

- Arrow keys: move, rotate, or soft drop.
- Space: hard drop.
- On-screen buttons support touch input.
- Jev chooses one action: left, right, down, drop, rotate, or none. It uses the same movement rules as the player.
- Gravity and the shared clock continue during model requests. Only one request runs at a time, with at least 500 ms between starts; unchanged observations are not requested again.
- Requests stop before starting, while paused, and after either player loses. In-flight requests are cancelled on pause, exit, or when their piece expires.
- Switching tabs pauses the match. Resume explicitly to continue.
- API errors stop further model requests until Retry; gameplay continues.
- Help opens keyboard controls and appears automatically on the first visit. Dismissing it is remembered in localStorage.

The server sends the current board, piece position and shape, next pieces, recent actions, and measured outcomes of reachable placements to the official SDK. The model selects the next button.

## Checks

```sh
pnpm test
pnpm build
pnpm lint
pnpm format:check
```

Run `pnpm format` to format the project with Biome.

With the local service running and `TYPESAFE_API_KEY` configured in its environment, run `pnpm test:live` to verify a real official API decision. This check consumes tokens. Never commit API keys.

`pnpm build` checks browser and server types, creates the frontend in `dist/client/`, and bundles the server into `dist/server/`. The API service is required for Jev decisions.
