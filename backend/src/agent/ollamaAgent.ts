import { Workspace } from "./workspace";
import { AgentEvent, EventType } from "../types";

const OLLAMA_URL = "http://localhost:11434";
const MODEL = "deepseek-coder:6.7b";

function ev(type: EventType, payload: Record<string, unknown> = {}): AgentEvent {
  return { type, payload, timestamp: Date.now() };
}

async function ollamaGenerate(prompt: string, abortSignal?: AbortSignal): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  const combinedSignal = abortSignal
    ? combineAbortSignals(abortSignal, controller.signal)
    : controller.signal;

  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        stream: false,
        options: { temperature: 0.2, max_tokens: 4096 },
      }),
      signal: combinedSignal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama HTTP ${res.status}: ${text}`);
    }

    const data = await res.json();
    return (data.response || "").trim();
  } finally {
    clearTimeout(timeout);
  }
}

function combineAbortSignals(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const s of signals) {
    if (s.aborted) {
      controller.abort(s.reason);
      return controller.signal;
    }
    s.addEventListener("abort", () => controller.abort(s.reason), { once: true });
  }
  return controller.signal;
}

function cleanCode(code: string): string {
  return code
    .replace(/^```[\w]*\n?/gm, "")
    .replace(/\n```$/gm, "")
    .replace(/^```$/gm, "")
    .trim();
}

export async function* runAgent(task: string, signal: AbortSignal): AsyncGenerator<AgentEvent[]> {
  const workspace = new Workspace();

  yield [ev("scan_start", { root: "/project" })];

  // Phase 1: Generate plan (list of files)
  const planPrompt = `You are a senior software engineer. Generate a complete React + TypeScript project based on this task:

"${task}"

List ONLY the file paths (one per line) that need to be created under src/. 
Include all necessary files: components, hooks, utilities, API routes, types, styles.
Do NOT include node_modules, package.json, or config files.
Example:
src/App.tsx
src/components/Login.tsx
src/api.ts

Files:`;

  let planText: string;
  try {
    planText = await ollamaGenerate(planPrompt, signal);
  } catch (e) {
    yield [ev("terminal_output", { line: `AI Error: ${e}`, level: "error" })];
    yield [ev("task_complete", { summary: `Failed: ${e}` })];
    return;
  }

  const files = planText
    .split("\n")
    .map((f: string) => f.trim())
    .filter((f: string) => f && !f.startsWith("```") && !f.startsWith("Files") && !f.startsWith("src/") === false || f.startsWith("src/"))
    .filter((f: string) => f.startsWith("src/") || f.startsWith("public/"));

  if (files.length === 0) {
    // Fallback: generate some default files
    files.push("src/App.tsx", "src/index.ts", "src/types.ts");
  }

  for (const f of files) {
    yield [ev("scan_progress", { path: f })];
  }
  yield [ev("scan_complete", { files })];

  if (signal.aborted) return;

  // Phase 2: Generate code for each file
  for (const filePath of files) {
    if (signal.aborted) return;

    yield [ev("read_file", { path: filePath, content: "" })];

    const extension = filePath.split(".").pop() || "ts";
    const langHint =
      extension === "tsx" || extension === "jsx"
        ? "React TypeScript (TSX)"
        : extension === "ts"
        ? "TypeScript"
        : extension === "css"
        ? "CSS"
        : extension === "json"
        ? "JSON"
        : "TypeScript";

    const codePrompt = `Generate production-quality ${langHint} code for the file "${filePath}".

Task: ${task}

Project: React 18 + TypeScript project.

IMPORTANT:
- Return ONLY the raw source code
- NO markdown formatting, NO backticks, NO explanation
- Use proper TypeScript types
- Follow React best practices (hooks, functional components)
- Include all necessary imports

Code:`;

    let code: string;
    try {
      code = await ollamaGenerate(codePrompt, signal);
    } catch (e) {
      yield [ev("terminal_output", { line: `Error generating ${filePath}: ${e}`, level: "error" })];
      continue;
    }

    code = cleanCode(code);

    if (!code) {
      code = `// ${filePath}\n// TODO: Implement per task: ${task}\n`;
    }

    workspace.createFile(filePath, code);

    yield [
      ev("create_file", { path: filePath, content: code }),
      ev("terminal_output", { line: `Created ${filePath} (${code.length} chars)`, level: "success" }),
    ];
  }

  if (signal.aborted) return;

  const createdFiles = workspace.getFiles();
  const fileList = createdFiles.map((f) => f.path).join(", ");

  yield [
    ev("task_complete", {
      summary: `Created ${createdFiles.length} files for task: ${task}\nFiles: ${fileList}`,
    }),
  ];
}
