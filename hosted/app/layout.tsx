import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Common Ground — choose a place together",
  description: "Compare a shared Qloo venue shortlist while keeping each person's cultural interests visible.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
