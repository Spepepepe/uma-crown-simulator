# Uma Crown Simulator - 作業ログ運用

このファイルを読んだ AI は、`worklog/` 配下の作業記録（work）とバックログ（backlog）を以下のルールで作成・更新してください。

`worklog/` は個人のタスク管理用であり `.gitignore` で追跡対象外にしている。コミット・プッシュの対象にしないこと。

---

## ディレクトリ構成

```
worklog/
├── README.md                     # テンプレート集（個人用）
├── work/                         # 作業記録
│   └── YYYY/
│       └── MM/
│           └── DD/
│               └── YYYYMMDD_{slug}.md
└── backlog/                      # バックログ（フラットに配置）
    └── {status}_{area}_{YYYYMMDD}_{slug}.md
```

---

## 作業記録（work）

### 配置・命名

- 配置: `worklog/work/YYYY/MM/DD/`（年 4 桁 / 月 2 桁 / 日 2 桁。ゼロ埋め必須）
- ファイル名: `YYYYMMDD_{slug}.md`
  - 例: `worklog/work/2026/10/03/20261003_worklog-setup.md`
- ディレクトリとファイル名の日付は必ず一致させる
- 日付は作業を開始した日とする（日をまたいでも新しいファイルは作らず、同じファイルに追記する）

### 作業記録 ID

- 拡張子を除いたファイル名（例: `20261003_worklog-setup`）を作業記録 ID とする
- backlog から参照するときはこの ID を使う

---

## バックログ（backlog）

### 配置・命名

- 配置: `worklog/backlog/` 直下（サブディレクトリは作らない）
- ファイル名: `{status}_{area}_{YYYYMMDD}_{slug}.md`
  - `YYYYMMDD` は **作成元の作業記録の日付**
  - 例: `open_backend_20261003_race-cache.md`

### status（状態）

| status | 意味 |
|--------|------|
| `open` | 未着手・対応中 |
| `done` | 完了 |
| `drop` | 対応しないと判断して取り下げ |

### area（領域）

以下の固定リストから 1 つ選ぶ。リストにない値を使わないこと。複数領域にまたがる場合は主たる領域を選ぶ。

| area | 対象 |
|------|------|
| `backend` | `backend/`（NestJS・Prisma） |
| `frontend` | `frontend/`（Angular） |
| `shared` | `shared/`（共有型定義） |
| `infra` | `terraform/`・`k8s/`・Docker 関連 |
| `ci` | `.github/workflows/` |
| `master-data` | ウマ娘・レース等のマスタデータ |
| `docs` | `README.md`・`docs/` |
| `prompts` | `prompts/`・`CLAUDE.md` |

### バックログ ID と状態変更

- ファイル名から `{status}_` を除いた部分（例: `backend_20261003_race-cache`）を **バックログ ID** とする
- 状態を変えるときはファイル名の `{status}_` 部分だけをリネームする（ID 部分は変えない）
  - 例: `open_backend_20261003_race-cache.md` → `done_backend_20261003_race-cache.md`
- 作業記録などから backlog を参照するときは、状態変更で参照が切れないよう **バックログ ID** で書く（ファイル名で書かない）

---

## AI の運用手順

1. **作業記録を作る** — タスクの完了時に、当日の作業記録を作成する（同じ作業の記録が既にあれば追記する）
2. **バックログを登録する** — 作業中に見つかった後続課題・スコープ外の課題は `open_` で backlog に登録し、作業記録の「作成したバックログ」にバックログ ID を記載する
3. **バックログを閉じる** — 作業で backlog を解消したら `done_` にリネームし、本文の `closed_by` に作業記録 ID を記入する。作業記録の「対応したバックログ」にもバックログ ID を記載する
4. **取り下げる** — 対応不要と判断したら `drop_` にリネームし、本文に理由を残す

### バックログの確認方法

- 状態・領域はファイル名だけで判断する（本文を読む必要はない）
  - 未完了の一覧: `ls worklog/backlog/open_*`
  - 領域別: `ls worklog/backlog/open_backend_*`
- `worklog/` は `.gitignore` 対象のため、Grep / Glob ツールでは検索結果に出ない場合がある。**必ず Bash の `ls` でパスを明示して確認する**こと

---

## テンプレート

### 作業記録

```markdown
# {作業タイトル}

- date: YYYY-MM-DD
- area: {area}（複数可）

## 目的

## 作業内容

-

## 結果・判断

-

## 対応したバックログ

- {バックログ ID}

## 作成したバックログ

- {バックログ ID}
```

### バックログ

```markdown
# {課題タイトル}

- origin: {作成元の作業記録 ID}
- closed_by: {解消した作業記録 ID}（done / drop 時に記入）

## 内容

## 完了条件

## メモ
```
