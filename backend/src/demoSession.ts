import { AgentEvent } from "./types";

function event(type: AgentEvent["type"], payload: Record<string, unknown> = {}): AgentEvent {
  return { type, payload, timestamp: Date.now() };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const fileContents: Record<string, string> = {
  "src/Login.tsx": `import { useState } from "react";\n\nexport function Login() {\n  const [email, setEmail] = useState("");\n  const [password, setPassword] = useState("");\n\n  return (\n    <div className="login-container">\n      <h1>Sign In</h1>\n      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />\n      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />\n      <button onClick={() => alert("Logged in!")}>Login</button>\n    </div>\n  );\n}\n`,
  "src/Dashboard.tsx": `import { useState, useEffect } from "react";\n\nexport function Dashboard() {\n  const [data, setData] = useState<{ id: number; name: string }[]>([]);\n\n  useEffect(() => {\n    fetch("/api/data").then((r) => r.json()).then(setData);\n  }, []);\n\n  return (\n    <div className="dashboard">\n      <h1>Dashboard</h1>\n      <ul>{data.map((item) => <li key={item.id}>{item.name}</li>)}</ul>\n    </div>\n  );\n}\n`,
  "src/App.tsx": `import { Login } from "./Login";\nimport { Dashboard } from "./Dashboard";\n\nexport default function App() {\n  return (\n    <div className="app">\n      <Login />\n      <Dashboard />\n    </div>\n  );\n}\n`,
  "src/api.ts": `import express from "express";\n\nconst app = express();\napp.get("/api/data", (_req, res) => {\n  res.json([{ id: 1, name: "Project Alpha" }, { id: 2, name: "Project Beta" }]);\n});\nconst PORT = 3001;\napp.listen(PORT, () => console.log(\`API running on port \${PORT}\`));\n`,
};

const steps: (() => Promise<AgentEvent[]>)[] = [
  async () => {
    const steps = ["src/", "src/components/", "src/pages/", "public/", "package.json", "tsconfig.json"];
    const events: AgentEvent[] = [event("scan_start", { root: "/project" })];
    for (const s of steps) {
      await delay(200);
      events.push(event("scan_progress", { path: s }));
    }
    events.push(event("scan_complete", { files: Object.keys(fileContents) }));
    return events;
  },
  async () => [
    event("read_file", { path: "package.json", content: JSON.stringify({ name: "app", dependencies: { react: "^18.0.0", "react-dom": "^18.0.0" } }, null, 2) }),
  ],
  async () => [
    event("read_file", { path: "src/Login.tsx", content: fileContents["src/Login.tsx"] }),
  ],
  async () => [
    event("edit_file", { path: "src/Login.tsx", diff: "@@ -1,12 +1,15 @@\n+import { FormEvent } from \"react\";" }),
  ],
  async () => {
    await delay(300);
    return [event("create_file", { path: "src/components/Header.tsx", content: `export function Header() { return <header>Ghost Developer</header>; }` })];
  },
  async () => [
    event("read_file", { path: "src/api.ts", content: fileContents["src/api.ts"] }),
  ],
  async () => {
    await delay(400);
    return [event("npm_start", { command: "npm install" })];
  },
  async () => {
    const packages = ["react", "react-dom", "express", "typescript"];
    const events: AgentEvent[] = [];
    for (const pkg of packages) {
      await delay(600);
      events.push(event("npm_progress", { package: pkg }));
    }
    events.push(event("npm_complete", { installed: packages.length }));
    return events;
  },
  async () => [
    event("terminal_output", { line: "added 1,234 packages in 12s", level: "info" }),
  ],
  async () => [
    event("build_start", {}),
  ],
  async () => {
    await delay(800);
    return [event("build_progress", { stage: "TypeScript compilation", status: "in_progress" })];
  },
  async () => {
    await delay(1000);
    return [event("build_progress", { stage: "Bundling", status: "in_progress" })];
  },
  async () => [
    event("build_error", { file: "src/Login.tsx", line: 5, message: "Property 'email' does not exist on type '{}'" }),
  ],
  async () => [
    event("terminal_output", { line: "ERROR in src/Login.tsx:5 - Property 'email' does not exist", level: "error" }),
  ],
  async () => {
    await delay(500);
    return [event("edit_file", { path: "src/Login.tsx", diff: "@@ -3,1 +3,1 @@\n-const [email, setEmail] = useState(\"\");\n+const [email, setEmail] = useState<string>(\"\");" })];
  },
  async () => [
    event("terminal_output", { line: "Fix applied: added type annotation to useState", level: "info" }),
  ],
  async () => {
    await delay(600);
    return [event("build_progress", { stage: "Bundling", status: "retry" })];
  },
  async () => {
    await delay(1000);
    return [event("build_complete", { duration: "4.2s" })];
  },
  async () => [
    event("terminal_output", { line: "Build succeeded in 4.2s", level: "success" }),
  ],
  async () => [
    event("test_start", { runner: "vitest" }),
  ],
  async () => {
    await delay(1200);
    return [event("test_result", { passed: 8, failed: 0, total: 8 })];
  },
  async () => [
    event("terminal_output", { line: "Tests: 8 passed, 8 total (1.2s)", level: "success" }),
  ],
  async () => [
    event("task_complete", { summary: "Login page with form validation, Dashboard with data fetching, Header component, and Express API server. All tests pass. Build successful." }),
  ],
];

export async function* runDemoSession(): AsyncGenerator<AgentEvent[]> {
  for (let i = 0; i < steps.length; i++) {
    const events = await steps[i]();
    yield events;
    await delay(100);
  }
}

export const totalSteps = steps.length;
