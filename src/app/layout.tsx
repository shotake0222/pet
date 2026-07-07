import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

// --- 【追加】PWA用のメタデータ ---
export const metadata: Metadata = {
  title: "Straid AR",
  description: "NFCとGPSで遊べるAR育成ゲーム",
  manifest: "/manifest.json", // manifest.json へのパス
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Straid AR",
  },
  formatDetection: {
    telephone: false,
  },
};

// --- 【追加】ビューポート（フルスクリーン＆ピンチズーム防止） ---
export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // AR画面で意図せずズームされるのを防ぐ
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    
      {children}
    
  );
}