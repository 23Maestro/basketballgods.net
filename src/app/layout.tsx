import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wemby Shot Lab — 2026 Playoffs",
  description:
    "Victor Wembanyama 2026 playoff field-goal arcs and full-run court chart.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
