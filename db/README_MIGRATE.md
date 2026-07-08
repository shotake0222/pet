Supabase マイグレーション適用手順

このリポジトリの `db/migrations/` に SQL ファイルを用意しています。
ファイルを本番 Supabase に適用する方法をいくつか示します。接続情報（DATABASE_URL または Supabase プロジェクトの URL とサービスロール鍵）があれば代行できます。

方法 A — Supabase SQL エディタ（推奨、GUI）
1. Supabase ダッシュボードにログインし、対象プロジェクトを開く
2. 左メニューの「SQLエディタ」を開き、`New query` を選択
3. `db/migrations/001_create_rarities.sql` → `002_create_attributes.sql` → `003_create_pet_master_attributes.sql` の順にファイル内容をコピーして `Run` を実行

方法 B — psql で直接実行 (DATABASE_URL がある場合)
1. 環境変数を設定:

```bash
export DATABASE_URL="postgres://<user>:<pass>@<host>:5432/<db>?sslmode=require"
```

2. マイグレーションを順に実行:

```bash
psql "$DATABASE_URL" -f db/migrations/001_create_rarities.sql
psql "$DATABASE_URL" -f db/migrations/002_create_attributes.sql
psql "$DATABASE_URL" -f db/migrations/003_create_pet_master_attributes.sql
```

方法 C — Supabase CLI
1. Supabase CLI をインストールしてログイン
2. `supabase db push` などのコマンドでローカルマイグレーションを適用（プロジェクト構成が必要）

注意事項:
- 本番環境での実行前にバックアップを取得してください（テーブルやデータの損失を防ぐため）。
- 既に `pet_masters` テーブルのスキーマが変更される可能性は低いですが、事前に影響範囲をレビューしてください。

私が代行する場合に必要な情報:
- Supabase プロジェクトの `Service Role` API キー（安全なチャネルで提供してください）または安全な `DATABASE_URL`（読み書き可能）
- 適用して良い時間帯や、バックアップ実行の可否

提供いただければこちらでマイグレーションを実行します（セキュリティに注意してください）。
