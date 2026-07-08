"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = createClient();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    const ensureAdmin = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) {
          router.replace('/login');
          return;
        }

        const { data: profile, error } = await supabase
          .from('user_profiles')
          .select('is_admin')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          console.error('admin check failed', error);
          router.replace('/home');
          return;
        }

        if (!profile?.is_admin) {
          router.replace('/home');
          return;
        }
      } catch (e) {
        router.replace('/login');
        return;
      } finally {
        if (mounted) setChecking(false);
      }
    };

    ensureAdmin();
    return () => { mounted = false };
  }, [router, supabase]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-gray-500">認証情報を確認しています…</div>
      </div>
    );
  }

  return (
    <div>
      <header>
        <h1>🔧 Straid AR 管理ダッシュボード</h1>
      </header>
      <main>{children}</main>
    </div>
  );
}