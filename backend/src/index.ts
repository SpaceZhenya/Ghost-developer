import express from "express";
import cors from "cors";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { runAgent } from "./agent/ollamaAgent";

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
        const task = msg.text || "Create a sample React app";
        const abortController = sessions.get(sessionId)!.abortController;
        ws.send(JSON.stringify({ type: "session_start", payload: { task } }));
        runRealTask(ws, task, abortController.signal);
      } else if (msg.type === "stop") {
        const session = sessions.get(sessionId);
        if (session) session.abortController.abort();
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

async function runRealTask(ws: WebSocket, task: string, signal: AbortSignal) {
  try {
    for await (const events of runAgent(task, signal)) {
      if (signal.aborted) break;
      for (const evt of events) {
        if (signal.aborted) break;
        const progress = evt.type === "task_complete" ? 100 : undefined;
        ws.send(JSON.stringify({ ...evt, progress }));
      }
    }
  } catch (err) {
    ws.send(JSON.stringify({
      type: "terminal_output",
      payload: { line: `Error: ${err}`, level: "error" },
      timestamp: Date.now(),
    }));
  }

  if (!signal.aborted) {
    ws.send(JSON.stringify({ type: "session_end", payload: { status: "completed" } }));
  }
}

const PORT = 4000;
server.listen(PORT, () => {
  console.log(`Ghost Developer backend running on port ${PORT} with Ollama AI agent`);
});
