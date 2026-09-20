import { createServer } from "node:http";
import { APIError, TypeSafeClient } from "@typesafe-ai/sdk";
import { tetrisQuestion } from "./tetris";
import { decisionRequest, decisionResponse } from "@/lib/protocol";
import { fits, type Game } from "@/games/tetris/rules";

let active = 0;
const recent: number[] = [];

const server = createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  const send = (status: number, body: unknown) => {
    if (!res.destroyed) {
      res.writeHead(status);
      res.end(JSON.stringify(body));
    }
  };
  if (req.method === "GET" && req.url === "/api/health")
    return send(200, { ok: true });
  if (req.method !== "POST" || req.url !== "/api/decision")
    return send(404, { error: "Not found" });
  if (
    req.headers.origin &&
    ![
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:4173",
      "http://127.0.0.1:4173",
    ].includes(req.headers.origin)
  ) {
    return send(403, { error: "Origin not allowed" });
  }
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (!apiKey)
    return send(503, {
      error: "Set TYPESAFE_API_KEY in the server environment",
    });
  if (!req.headers["content-type"]?.startsWith("application/json"))
    return send(415, { error: "Expected JSON" });
  const now = Date.now();
  while (recent.length && recent[0] < now - 60000) recent.shift();
  if (active >= 2 || recent.length >= 120)
    return send(429, { error: "Too many requests. Wait before retrying." });
  recent.push(now);
  active++;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  const abort = () => controller.abort();
  res.on("close", abort);
  try {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 16384) {
        send(413, { error: "Request too large" });
        return;
      }
      chunks.push(Buffer.from(chunk));
    }
    let body: unknown;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      return send(400, { error: "Invalid JSON" });
    }
    const parsed = decisionRequest.safeParse(body);
    if (!parsed.success)
      return send(400, { error: "Invalid game observation" });
    const data = parsed.data;
    const game: Game = {
      board: data.board,
      piece: data.piece,
      index: 0,
      lines: 0,
      over: false,
    };
    if (!fits(game.board, game.piece))
      return send(400, { error: "Game is already over" });
    const client = new TypeSafeClient({
      apiKey,
      baseURL: "https://api.typesafe.ai",
      defaultModel: "jev-latest",
      timeout: 10000,
      retry: { maxRetries: 0 },
      logLevel: "off",
    });
    const { targets, ...question } = tetrisQuestion(
      game,
      data.next,
      data.strategy,
    );
    const result = await client.systemOne(question, {
      signal: controller.signal,
    });
    const answer = result.answers.placement;
    if (!Object.hasOwn(targets, answer.choice))
      throw new Error("Unknown placement returned by TypeSafe");
    const response = decisionResponse.parse({
      decisionId: data.decisionId,
      target: targets[answer.choice],
      confidence: answer.confidence,
      probabilities: answer.probabilities,
      inputTokens: result.usage.input_tokens,
    });
    send(200, response);
  } catch (error) {
    if (controller.signal.aborted)
      send(504, { error: "Decision timed out or was cancelled" });
    else if (error instanceof APIError) {
      const status =
        error.status === 401 ? 401 : error.status === 429 ? 429 : 502;
      send(status, {
        error:
          status === 401
            ? "TypeSafe rejected this API key"
            : status === 429
              ? "TypeSafe rate limit reached"
              : "TypeSafe request failed",
      });
    } else send(502, { error: "Unable to obtain a valid TypeSafe decision" });
  } finally {
    clearTimeout(timer);
    res.off("close", abort);
    active--;
  }
});
server.requestTimeout = 20000;
server.headersTimeout = 10000;
const port = Number(process.env.API_PORT ?? 3001);
if (!Number.isInteger(port) || port < 0 || port > 65535)
  throw new Error("Invalid API_PORT");
server.listen(port, "127.0.0.1", () => {
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing server address");
  console.info(JSON.stringify({ url: `http://127.0.0.1:${address.port}` }));
});
