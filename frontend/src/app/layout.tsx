import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ghost Developer — AI Coding Assistant",
  description: "Autonomous AI software engineer that works inside a real IDE. Watch an AI agent scan code, edit files, install dependencies, build, and fix errors in real-time.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased overflow-hidden">
        {children}
      </body>
    </html>
  );
}
