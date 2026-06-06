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
  metadataBase: new URL("https://simobi.my.id"),
  title: "SIMOBI | Smart Mobility UNDIP",
  description:
    "Pantau posisi buggy, halte, rute, kepadatan penumpang, dan kondisi layanan kampus UNDIP melalui SIMOBI.",
  icons: {
    icon: {
      url: "/icon-192.png",
      type: "image/png",
      sizes: "192x192",
    },
    shortcut: "/icon-192.png",
    apple: {
      url: "/icon-192.png",
      type: "image/png",
      sizes: "192x192",
    },
  },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "/landing",
    siteName: "SIMOBI",
    title: "SIMOBI | Smart Mobility UNDIP",
    description:
      "Pantau posisi buggy, halte, rute, kepadatan penumpang, dan kondisi layanan kampus UNDIP.",
    images: [
      {
        url: "/og-simobi.jpg",
        width: 1200,
        height: 630,
        alt: "Pantau mobilitas kampus dengan web SIMOBI",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SIMOBI | Smart Mobility UNDIP",
    description:
      "Pantau posisi buggy, halte, rute, kepadatan penumpang, dan kondisi layanan kampus UNDIP.",
    images: ["/og-simobi.jpg"],
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
