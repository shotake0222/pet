export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    // 修正: 外側コンテナに `min-h-screen`（Tailwindの固定 100vh）を使っていたが、
    // 内側コンテナは `var(--app-height, 100dvh)`（page.tsx側で
    // window.visualViewport.height から動的に算出）を使っており、
    // 両者の単位が一致していなかった。モバイルブラウザのアドレスバーの
    // 表示/非表示状態によって 100vh と --app-height の値がズレると、
    // `items-center` による上下中央寄せの結果、隙間が上下に生まれ、
    // ドキュメントのスクロール位置やアドレスバーの挙動次第で下側の隙間が
        // 画面外に隠れて「上だけナビゲーションバー一本分空いている」ように
    // 見えていた。
    // 対処として、外側コンテナにも同じ `var(--app-height, 100dvh)` を
    // 適用して単位を統一し、さらに `fixed inset-0` にすることで
    // ドキュメントのスクロール位置に一切左右されないようにした。
    <div
      className="bg-gray-900 fixed inset-0 flex items-center justify-center overflow-hidden"
      style={{ height: 'var(--app-height, 100dvh)' }}
    >
      {/* モバイルサイズのコンテナ（最大幅をスマホサイズに固定） */}
      <div
        className="w-full max-w-md bg-black relative overflow-hidden shadow-2xl sm:border-x sm:border-gray-800"
        style={{ height: 'var(--app-height, 100dvh)' }}
      >
        {children}
      </div>
    </div>
  );
}
