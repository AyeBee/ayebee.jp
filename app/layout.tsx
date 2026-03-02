import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_JP, Roboto } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";

// 必要なサブセット/ウェイトだけ指定（重いと表示が遅くなる）
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const noto = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-noto",
  display: "swap",
});
const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "900"],
  style: ["normal", "italic"],
  variable: "--font-roboto",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "あやびーのぺーじ",
    template: "%s | あやびーのぺーじ",
  },
  description: "やっつけプロフィールページ",
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    url: "https://ayebee.jp/",
    siteName: "あやびーのぺーじ",
    title: "あやびーのぺーじ",
    description: "やっつけプロフィールページ",
  },
  twitter: {
    card: "summary_large_image",
    title: "あやびーのぺーじ",
    description: "やっつけプロフィールページ",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#111111" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ja"
      className={`${inter.variable} ${noto.variable} ${roboto.variable}`}
    >
      <body>
        {process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID && (
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID} />
        )}
        {children}
      </body>
    </html>
  );
}
