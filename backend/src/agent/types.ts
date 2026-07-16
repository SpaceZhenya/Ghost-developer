export interface FileEntry {
  path: string;
  content: string;
}

export interface TaskPlan {
  files: string[];
  description: string;
}

export interface AgentStep {
  type: "plan" | "generate" | "create" | "install" | "build" | "complete";
  description: string;
}
