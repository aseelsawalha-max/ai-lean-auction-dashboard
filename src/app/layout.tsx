import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Lean Auction Dashboard",
  description: "Admin operations dashboard for auction photo tracking and analytics",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
