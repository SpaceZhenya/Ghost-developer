import { FileEntry } from "./types";

export class Workspace {
  private files: Map<string, FileEntry> = new Map();

  constructor(initialFiles: FileEntry[] = []) {
    for (const f of initialFiles) {
      this.files.set(f.path, f);
    }
  }

  getFiles(): FileEntry[] {
    return Array.from(this.files.values());
  }

  getFile(path: string): FileEntry | undefined {
    return this.files.get(path);
  }

  createFile(path: string, content: string): void {
    this.files.set(path, { path, content });
  }

  deleteFile(path: string): boolean {
    return this.files.delete(path);
  }

  fileExists(path: string): boolean {
    return this.files.has(path);
  }

  getFileTree(): string {
    const tree: string[] = [];
    const sorted = Array.from(this.files.keys()).sort();
    for (const path of sorted) {
      tree.push(path);
    }
    return tree.length > 0 ? tree.join("\n") : "(empty project)";
  }

  getFileContent(path: string): string {
    return this.files.get(path)?.content ?? "";
  }
}
