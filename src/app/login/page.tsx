'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const redirectToAppropriatePage = async (userId: string) => {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('admin check failed', error);
      router.push('/home');
      return;
    }

    if (profile?.is_admin) {
      router.push('/admin');
    } else {
      router.push('/home');
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await redirectToAppropriatePage(session.user.id);
      }
    };
    checkSession();
  }, [router, supabase.auth]);

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setMessage({ text: 'メールアドレスとパスワードの両方を入力してください', type: 'error' });
      return;
    }

    if (password.length < 6) {
      setMessage({ text: 'パスワードは6文字以上で入力してください', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          if (error.message?.includes('Invalid login credentials')) {
            setMessage({
              text: 'ログインに失敗しました。初回利用の場合は「初回登録」を選んでください。既に登録済みの方はメールアドレスとパスワードを確認してください。',
              type: 'error',
            });
          } else {
            throw error;
          }
          return;
        }

        if (data.session?.user) {
          await redirectToAppropriatePage(data.session.user.id);
        } else {
          setMessage({ text: 'ログインに失敗しました', type: 'error' });
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/home`,
          },
        });

        if (error) throw error;

        if (data.session?.user) {
          await redirectToAppropriatePage(data.session.user.id);
        } else {
          setMessage({
            text: '登録用メールを送信しました。受信ボックスのリンクを開いてからログインしてください。',
            type: 'success',
          });
        }
      }
    } catch (error: any) {
      const messageText = error?.message || (mode === 'login' ? 'ログインに失敗しました' : '登録に失敗しました');
      setMessage({ text: messageText, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/home`,
        },
      });
      if (error) throw error;
      // OAuth will redirect the user; in some environments it may return here.
    } catch (error: any) {
      setMessage({ text: error.message || 'Googleログインに失敗しました', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      {/* ログインカード */}
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 space-y-8 border border-gray-100">
        
        {/* ヘッダー部分 */}
        <div className="text-center space-y-3">
          <div className="flex justify-center mb-2">
            <span className="text-5xl" role="img" aria-label="paw">🐾</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Straid AR</h1>
          <p className="text-slate-500 font-medium text-sm">ログインしてペットに会いに行こう</p>
        </div>

        {/* メッセージ表示エリア */}
        {message && (
          <div className={`p-4 rounded-xl text-sm font-bold text-center ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
            {message.text}
          </div>
        )}

        <div className="space-y-6">
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            <p className="font-bold mb-1">初回ログインの案内</p>
            <p>Googleログインが最も確実です。パスワードログインは、すでに登録済みのメールアドレスでのみ利用できます。初めての方は「初回登録」を選んでください。</p>
          </div>

          {/* Google ログインボタン */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 text-slate-700 font-bold py-3.5 px-4 rounded-xl shadow-sm hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-95 disabled:opacity-50"
          >
            {/* SVGに直接 width="24" height="24" を指定して巨大化を防ぎます */}
            <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Googleで続ける
          </button>

          {/* 区切り線 */}
          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink-0 mx-4 text-gray-400 text-xs font-bold uppercase tracking-wider">または</span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>

          {/* メール／パスワードログインフォーム */}
          <form onSubmit={handlePasswordAuth} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-bold text-slate-700 mb-1.5 ml-1">メールアドレス</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border-2 border-gray-200 p-3.5 rounded-xl text-slate-900 bg-gray-50 focus:bg-white focus:ring-0 focus:border-blue-500 outline-none transition-all font-medium"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-bold text-slate-700 mb-1.5 ml-1">パスワード</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                className="w-full border-2 border-gray-200 p-3.5 rounded-xl text-slate-900 bg-gray-50 focus:bg-white focus:ring-0 focus:border-blue-500 outline-none transition-all font-medium"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-800 hover:shadow-xl transition-all active:scale-95 disabled:bg-slate-400 disabled:scale-100 flex justify-center items-center"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                mode === 'login' ? 'ログイン' : '初回登録'
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setMessage(null);
              }}
              className="w-full text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              {mode === 'login' ? '初回登録はこちら' : 'ログインに戻る'}
            </button>
          </form>
        </div>
        
      </div>
    </div>
  );
}