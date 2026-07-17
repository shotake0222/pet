export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 min-h-screen flex items-center justify-center">
      {/* モバイルサイズのコンテナ（最大幅をスマホサイズに固定） */}
      <div className="w-full max-w-md h-[100dvh] bg-black relative overflow-hidden shadow-2xl sm:border-x sm:border-gray-800">
        {children}
      </div>
    </div>
  );
}