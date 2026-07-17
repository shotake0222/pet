import './globals.css'; // ← ★これが一番重要です！Tailwindを読み込む記述
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'ぺたる',
  description: 'AR Pet App',
};

// 🌟 これが無いと env(safe-area-inset-*) が常に 0px 扱いになり、
//    Android端末でジェスチャーバー分の余白が正しく計算されません。
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
