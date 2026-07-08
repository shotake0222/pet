import './globals.css'; // ← ★これが一番重要です！Tailwindを読み込む記述
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Straid AR',
  description: 'AR Pet App',
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