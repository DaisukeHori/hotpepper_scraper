import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HotPepper Beauty Scraper - 美容室データ収集ツール",
  description: "HotPepper Beautyから美容室・サロンの情報（店舗名、住所、電話番号、営業時間など）を一括取得してCSVでダウンロード。複合キーワード検索対応。",
  keywords: ["HotPepper Beauty", "美容室", "サロン", "スクレイピング", "データ収集", "CSV"],
  authors: [{ name: "HotPepper Scraper" }],
  openGraph: {
    title: "HotPepper Beauty Scraper",
    description: "美容室・サロン情報を一括取得してCSVダウンロード",
    type: "website",
    locale: "ja_JP",
  },
  twitter: {
    card: "summary",
    title: "HotPepper Beauty Scraper",
    description: "美容室・サロン情報を一括取得してCSVダウンロード",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
