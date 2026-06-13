import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tennis Diary",
  description: "Log the professional tennis matches you've watched.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
