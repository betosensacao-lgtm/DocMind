import type { Metadata } from "next";
import { Toaster } from "sonner";
import "@/styles/globals.css";
import { RealtimeDashboard } from "@/components/realtime-dashboard";

export const metadata: Metadata = {
  title: "DocMind - Document Intelligence Platform",
  description: "AI-powered document analysis, extraction, and Q&A platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster richColors position="top-center" />
        <RealtimeDashboard />
      </body>
    </html>
  );
}
