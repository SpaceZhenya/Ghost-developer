"use client";

import { AgentProvider } from "@/hooks/useAgent";
import { VSCodeLayout } from "@/components/VSCodeLayout";

export default function Home() {
  return (
    <AgentProvider>
      <VSCodeLayout />
    </AgentProvider>
  );
}
