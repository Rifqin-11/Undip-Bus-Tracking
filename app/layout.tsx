import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SIMOBI - Sistem Monitoring Buggy Listrik Realtime",
  description:
    "Sistem monitoring buggy listrik realtime untuk Smart Mobility Universitas Diponegoro.",
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <svg
          aria-hidden="true"
          className="pointer-events-none fixed h-0 w-0"
          focusable="false"
        >
          <defs>
            <filter id="liquid-glass-distort" x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.012 0.03"
                numOctaves="2"
                seed="7"
                result="noise"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale="14"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>
        </svg>
        {children}
      </body>
    </html>
  );
}
