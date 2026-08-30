import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "capy — the experience network for physical intelligence",
  description: "turn robot failures into targeted experience, verified capability gain, and fair contributor payouts.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
