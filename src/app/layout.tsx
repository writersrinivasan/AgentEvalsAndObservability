import type { Metadata } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Nav } from "@/components/Nav";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "EvalOps Lab · Agent Evals & Observability",
  description: "How do you know your agent is actually good? A hands-on, build-first workshop with LangGraph.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${mono.variable} antialiased`}>
      <body className="min-h-screen">
        <Nav />
        <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-6 sm:px-6">{children}</main>
        <footer className="border-t border-line py-6 text-center text-xs text-muted">
          EvalOps Lab · Build first, then break it down · LangGraph.js + Claude
        </footer>
      </body>
    </html>
  );
}
