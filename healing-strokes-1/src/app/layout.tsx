import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Healing Strokes — make room for a little wonder",
  description:
    "A private, turn-by-turn creative gathering. Draw together, breathe in between, and discover something unexpected.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
