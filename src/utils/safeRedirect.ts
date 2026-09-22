// ログイン後の遷移先として安全なパス（同一オリジン内の相対パス）だけを許可する
export function safeNextPath(next: string | null | undefined, fallback = '/home'): string {
  if (!next) return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  return next;
}
