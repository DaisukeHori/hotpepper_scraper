# HotPepper Beauty Scraper

HotPepper Beautyの美容室・サロン情報を検索キーワードから自動収集し、CSV形式でダウンロードできるWebサービスです。

![Next.js](https://img.shields.io/badge/Next.js-16.0.6-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![Vercel](https://img.shields.io/badge/Vercel-Hobby対応-blue)

## 機能

- キーワード検索（複合キーワード対応：スペース区切り）
- ページ数選択による取得範囲指定
- リアルタイム進捗表示（処理中店舗名、残り時間）
- CSV形式での一括ダウンロード
- Vercel Hobbyプラン対応（10秒制限回避のチャンク処理）

## 取得データ

以下の情報を自動で収集します：

| カラム | 説明 |
|--------|------|
| 店名 | サロン名 |
| URL | サロンページURL |
| 住所 | 所在地 |
| アクセス・道案内 | 最寄り駅等 |
| 営業時間 | 営業時間 |
| 定休日 | 定休日 |
| 支払い方法 | 支払い方法 |
| カット価格 | カット料金 |
| スタッフ数 | スタッフ数 |
| こだわり条件 | サロンの特徴 |
| 備考 | 備考 |
| その他 | その他情報 |
| 電話番号 | 実際の電話番号 |

## セットアップ

### 必要要件

- Node.js 18.x 以上
- npm

### インストール

```bash
git clone https://github.com/DaisukeHori/hotpepper_scraper.git
cd hotpepper_scraper
npm install
```

### 開発サーバーの起動

```bash
npm run dev
```

ブラウザで http://localhost:3000 を開いてください。

## 使い方

### ステップ1: キーワード検索
1. 検索キーワードを入力（例：「渋谷」「香草カラー 表参道」）
2. 「検索して総ページ数を確認」ボタンをクリック
3. 総件数・総ページ数・店舗プレビューが表示される

### ステップ2: ページ数選択・スクレイピング
1. 取得するページ数を選択（1ページ = 約20店舗）
2. 「スクレイピング開始」ボタンをクリック
3. リアルタイムで進捗が表示される
   - 処理完了した店舗名
   - 現在処理中の店舗名（アニメーション表示）
   - プログレスバー
   - 残り時間

### ステップ3: CSVダウンロード
1. 処理完了後、取得件数と処理時間が表示される
2. 「CSVをダウンロード」ボタンをクリック

## プロジェクト構造

```
hotpepper_scraper/
├── src/
│   └── app/
│       ├── api/
│       │   ├── scrape/
│       │   │   └── route.ts    # スクレイピングAPI（チャンク処理対応）
│       │   └── search/
│       │       └── route.ts    # 検索API（ページ数・件数取得）
│       ├── page.tsx            # メインUI
│       ├── layout.tsx          # メタデータ設定
│       ├── icon.svg            # ファビコン
│       ├── apple-icon.svg      # Apple Touch Icon
│       └── globals.css         # グローバルスタイル
├── package.json
└── tsconfig.json
```

## 技術スタック

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Scraping**: Cheerio
- **HTTP Client**: Fetch API

## API仕様

### `GET /api/search`

キーワードで検索し、ページ数・件数を取得します。

**クエリパラメータ:**
- `keyword` (required): 検索キーワード

**レスポンス:**
```json
{
  "keyword": "渋谷",
  "totalPages": 10,
  "totalCount": 195,
  "shopsOnPage": 20,
  "shopsPerPage": 20,
  "shopsPreview": [{"name": "店舗名", "url": "URL"}, ...]
}
```

### `POST /api/scrape`

店舗情報をスクレイピングします（チャンク処理対応）。

**Phase 1: collect**
```json
{
  "keyword": "渋谷",
  "maxPages": 5,
  "phase": "collect"
}
```

**Phase 2: process**
```json
{
  "phase": "process",
  "shops": [...],
  "startIndex": 0
}
```

## Vercel Hobbyプラン対応

Vercel Hobbyプランの10秒タイムアウト制限に対応するため、以下の実装を行っています：

1. **チャンク処理**: 15店舗ごとにAPIを分割呼び出し
2. **リレー式処理**: クライアントがチャンクごとにAPIを呼び出し
3. **3並列処理**: 各チャンク内で3店舗を並列処理

これにより、大量の店舗（100件以上）でも問題なく処理できます。

## デプロイ

### Vercel（推奨）

1. GitHubにリポジトリをプッシュ
2. [Vercel](https://vercel.com) でインポート
3. 自動デプロイ

または：

```bash
npm install -g vercel
vercel --prod
```

## 注意事項

- このツールはHotPepper Beautyの利用規約を遵守してご使用ください
- スクレイピングの頻度や量には十分注意してください
- 商用利用の際は、事前にホットペッパービューティーの許可を得ることを推奨します

## ライセンス

MIT License
