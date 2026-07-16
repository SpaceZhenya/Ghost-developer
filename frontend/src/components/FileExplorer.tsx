"use client";

import { useState, useMemo } from "react";
import { PROJECT_FILES, FileNode } from "@/lib/types";
import { useAgent } from "@/hooks/useAgent";

function buildDynamicTree(staticRoots: FileNode[], extraPaths: string[]): FileNode[] {
  if (extraPaths.length === 0) return staticRoots;

  const root: FileNode = { name: "project", path: "/", type: "folder", children: [] };
  const pathMap = new Map<string, FileNode>();
  pathMap.set("/", root);

  function ensureDir(dirPath: string): FileNode {
    if (pathMap.has(dirPath)) return pathMap.get(dirPath)!;
    const parts = dirPath.replace(/^\//, "").split("/").filter(Boolean);
    let current = "/";
    for (const part of parts) {
      const parent = current;
      current = current === "/" ? `/${part}` : `${current}/${part}`;
      if (!pathMap.has(current)) {
        const node: FileNode = { name: part, path: current, type: "folder", children: [] };
        pathMap.set(current, node);
        const parentNode = pathMap.get(parent)!;
        if (!parentNode.children) parentNode.children = [];
        if (!parentNode.children.find((c) => c.path === current)) {
          parentNode.children.push(node);
        }
      }
    }
    return pathMap.get(current)!;
  }

  // Insert static files
  for (const staticRoot of staticRoots) {
    root.children = root.children || [];
    root.children.push(staticRoot);
    // Register all static paths
    function register(n: FileNode) {
      pathMap.set(n.path, n);
      if (n.children) n.children.forEach(register);
    }
    register(staticRoot);
  }

  // Insert extra AI-generated files
  for (const rawPath of extraPaths) {
    const cleanPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
    const parts = cleanPath.split("/").filter(Boolean);
    const fileName = parts.pop()!;
    const dirPath = parts.length === 0 ? "/" : "/" + parts.join("/");
    ensureDir(dirPath);
    const fileNode: FileNode = { name: fileName, path: cleanPath, type: "file" };
    if (!pathMap.has(cleanPath)) {
      pathMap.set(cleanPath, fileNode);
      const parentNode = pathMap.get(dirPath)!;
      if (!parentNode.children) parentNode.children = [];
      if (!parentNode.children.find((c) => c.path === cleanPath)) {
        parentNode.children.push(fileNode);
      }
    }
  }

  return root.children || [];
}

function FileTree({ node, depth = 0, activeFile, onFileSelect }: { node: FileNode; depth?: number; activeFile: string; onFileSelect: (p: string) => void }) {
  const [expanded, setExpanded] = useState(depth < 2);

  const isFolder = node.type === "folder";
  const isActive = node.path === activeFile || node.path === `/${activeFile?.replace(/^\//, "")}` || `/${node.path?.replace(/^\//, "")}` === activeFile;

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 py-1 px-2 cursor-pointer text-sm rounded-sm ${
          isActive ? "bg-[#37373d] text-white" : "text-[#cccccc] hover:bg-[#2a2d2e]"
        }`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={() => {
          if (isFolder) setExpanded(!expanded);
          else onFileSelect(node.path);
        }}
      >
        {isFolder ? (
          <span className="text-xs w-4">{expanded ? "▼" : "▶"}</span>
        ) : (
          <span className="text-xs w-4">📄</span>
        )}
        <span className="truncate">{node.name}</span>
      </div>
      {isFolder && expanded && node.children?.map((child) => (
        <FileTree key={child.path} node={child} depth={depth + 1} activeFile={activeFile} onFileSelect={onFileSelect} />
      ))}
    </div>
  );
}

export function FileExplorer({ activeFile, onFileSelect }: { activeFile: string; onFileSelect: (p: string) => void }) {
  const { state } = useAgent();

  const tree = useMemo(() => buildDynamicTree(PROJECT_FILES, state.filesModified), [state.filesModified]);

  return (
    <div className="py-2">
      <div className="px-3 mb-1">
        <div className="text-xs text-[#858585] uppercase tracking-wider">Workspace</div>
      </div>
      {tree.map((node) => (
        <FileTree key={node.path} node={node} activeFile={activeFile} onFileSelect={onFileSelect} />
      ))}
    </div>
  );
}
