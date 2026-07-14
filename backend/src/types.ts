export type EventType =
  | "scan_start" | "scan_progress" | "scan_complete"
  | "read_file" | "edit_file" | "create_file"
  | "npm_start" | "npm_progress" | "npm_complete"
  | "build_start" | "build_progress" | "build_error"
  | "build_complete"
  | "test_start" | "test_result"
  | "task_complete"
  | "terminal_output";

export interface AgentEvent {
  type: EventType;
  payload: Record<string, unknown>;
  timestamp: number;
}
