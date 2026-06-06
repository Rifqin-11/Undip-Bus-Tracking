import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { I18nProvider } from "@/lib/i18n/client";
import { locales, normalizeLocale } from "@/lib/i18n/config";
import { getServerT } from "@/lib/i18n/server";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

type LocaleParams = Promise<{ locale: string }>;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: LocaleParams;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = await getServerT(locale, "common");

  return {
    metadataBase: new URL("https://simobi.my.id"),
    title: t("metadataTitle"),
    description: t("metadataDescription"),
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "SIMOBI",
    },
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
      locale: locale === "id" ? "id_ID" : "en_US",
      url: `/${locale}`,
      siteName: "SIMOBI",
      title: t("metadataTitle"),
      description: t("metadataDescription"),
      images: [
        {
          url: "/og-simobi.jpg",
          width: 1200,
          height: 630,
          alt: "SIMOBI Smart Mobility UNDIP",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t("metadataTitle"),
      description: t("metadataDescription"),
      images: ["/og-simobi.jpg"],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#e2e8f0",
  colorScheme: "light",
};

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: LocaleParams;
}>) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);

  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <svg
          aria-hidden="true"
          className="pointer-events-none fixed h-0 w-0"
          focusable="false"
        >
          <defs>
            <filter
              id="liquid-glass-distort"
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
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
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
