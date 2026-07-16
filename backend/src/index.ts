import express from "express";
import cors from "cors";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { runDemoSession, totalSteps } from "./demoSession";

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

interface SessionState {
  ws: WebSocket;
  abortController: AbortController;
}

const sessions = new Map<string, SessionState>();

wss.on("connection", (ws, req) => {
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, { ws, abortController: new AbortController() });

  ws.on("message", async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "run_task") {
        const abortController = sessions.get(sessionId)!.abortController;
        runDemo(ws, abortController.signal);
      }
    } catch (err) {
      ws.send(JSON.stringify({ type: "error", payload: { message: String(err) } }));
    }
  });

  ws.on("close", () => {
    const session = sessions.get(sessionId);
    if (session) {
      session.abortController.abort();
      sessions.delete(sessionId);
    }
  });
});

async function runDemo(ws: WebSocket, signal: AbortSignal) {
  const stepSize = 100 / totalSteps;

  ws.send(JSON.stringify({ type: "session_start", payload: { totalSteps } }));

  for await (const events of runDemoSession()) {
    if (signal.aborted) break;
    for (const evt of events) {
      if (signal.aborted) break;
      ws.send(JSON.stringify({ ...evt, progress: evt.type === "task_complete" ? 100 : undefined }));
    }
  }

  ws.send(JSON.stringify({ type: "session_end", payload: { status: "completed" } }));
}

const PORT = 4000;
server.listen(PORT, () => {
  console.log(`Ghost Developer backend running on port ${PORT}`);
});
