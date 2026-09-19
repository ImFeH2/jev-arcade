import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import test from "node:test";

test("local API reports missing server credentials and rejects cross-origin requests", {
  timeout: 15000,
}, async () => {
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "server/index.ts"],
    {
      env: {
        ...process.env,
        TSX_TSCONFIG_PATH: "tsconfig.server.json",
        API_PORT: "0",
        TYPESAFE_API_KEY: undefined,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const exited = once(child, "exit");
  let diagnostics = "";
  child.stderr.on("data", (chunk) => {
    diagnostics += chunk.toString();
  });
  try {
    const started = await Promise.race([
      once(child.stdout, "data"),
      exited.then(() => {
        throw new Error(`API failed to start: ${diagnostics}`);
      }),
      new Promise<never>((_, reject) => {
        const timer = setTimeout(
          () => reject(new Error("Startup timeout")),
          10000,
        );
        timer.unref();
      }),
    ]);
    const { url } = JSON.parse(started[0].toString()) as { url: string };
    const health = await fetch(`${url}/api/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true });
    const missingKey = await fetch(`${url}/api/decision`, { method: "POST" });
    assert.equal(missingKey.status, 503);
    assert.deepEqual(await missingKey.json(), {
      error: "Set TYPESAFE_API_KEY in the server environment",
    });
    assert.equal(missingKey.headers.get("cache-control"), "no-store");
    const origin = await fetch(`${url}/api/decision`, {
      method: "POST",
      headers: { Origin: "https://example.com" },
    });
    assert.equal(origin.status, 403);
    const missingRoute = await fetch(`${url}/api/unknown`);
    assert.equal(missingRoute.status, 404);
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await exited;
  }
});
