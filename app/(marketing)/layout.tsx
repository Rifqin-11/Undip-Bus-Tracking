import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SIMOBI | Smart Mobility UNDIP",
  description:
    "Landing page SIMOBI, sistem monitoring dan tracking real-time armada buggy listrik kampus UNDIP.",
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#e2e8f0",
  colorScheme: "light",
};

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      style={{ minHeight: "100svh", height: "auto", overflow: "auto" }}
    >
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-slate-100 antialiased`}
        style={{ minHeight: "100svh", height: "auto", overflow: "auto" }}
      >
        {children}
      </body>
    </html>
  );
}
