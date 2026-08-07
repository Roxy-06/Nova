import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "SignalCraft — Autonomous Intelligence", description: "A live autonomous technology analyst." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
