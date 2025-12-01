# 🔥 HotPepper Beauty Scraper

HotPepper Beautyのサロン情報を検索キーワードから自動収集し、CSV形式でダウンロードできるWebサービスです。

![Next.js](https://img.shields.io/badge/Next.js-16.0.6-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 📋 機能

- ✅ キーワード検索によるサロン情報の自動収集
- ✅ 並列処理（10ワーカー）による高速スクレイピング
- ✅ サロン詳細情報・電話番号の取得
- ✅ CSV形式での一括エクスポート
- ✅ レスポンシブ対応のモダンUI

## 📊 取得データ

以下の情報を自動で収集します：

| カラム | 説明 |
|--------|------|
| 店名 | サロン名 |
| URL | サロンページURL |
| ページ | 検索結果ページ番号 |
| telMask | マスク済み電話番号 |
| address | 住所 |
| access | アクセス・道案内 |
| businessHours | 営業時間 |
| holiday | 定休日 |
| payment | 支払い方法 |
| cutPrice | カット価格 |
| staffCount | スタッフ数 |
| features | こだわり条件 |
| remark | 備考 |
| others | その他 |
| telReal | 実際の電話番号 |

## 🚀 セットアップ

### 必要要件

- Node.js 18.x 以上
- npm または yarn

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/DaisukeHori/hotpepper_scraper.git
cd hotpepper_scraper

# 依存関係をインストール
npm install
```

### 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

## 💻 使い方

1. **キーワード入力**: スクレイピングしたいキーワード（例：「渋谷」「表参道」）を入力
2. **最大ページ数設定**: 取得するページ数を1〜10の範囲で指定
3. **ダウンロード**: 「CSVをダウンロード」ボタンをクリック
4. **完了**: CSV形式のファイルが自動的にダウンロードされます

## 🏗️ プロジェクト構造

```
hotpepper_scraper/
├── src/
│   └── app/
│       ├── api/
│       │   └── scrape/
│       │       └── route.ts        # スクレイピングAPI
│       ├── page.tsx                # メインUI
│       ├── layout.tsx              # ルートレイアウト
│       └── globals.css             # グローバルスタイル
├── public/                         # 静的ファイル
├── package.json
└── tsconfig.json
```

## 🛠️ 技術スタック

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Scraping**: Cheerio
- **HTTP Client**: Fetch API

## 🔧 API仕様

### `GET /api/scrape`

サロン情報をスクレイピングしてCSVを返します。

**クエリパラメータ:**
- `keyword` (required): 検索キーワード
- `maxPages` (optional): 最大ページ数（デフォルト: 5、最大: 10）

**レスポンス:**
- Content-Type: `text/csv; charset=utf-8`
- ファイル名: `hotpepper_{keyword}.csv`

**例:**
```
GET /api/scrape?keyword=渋谷&maxPages=3
```

## ⚡ パフォーマンス

- **並列処理**: 10ワーカーによる並列スクレイピング
- **効率的**: ページ単位とサロン単位の2段階並列処理
- **高速**: Round-robinアルゴリズムによる負荷分散

## 📝 ライセンス

MIT License

## ⚠️ 注意事項

- このツールはHotPepper Beautyの利用規約を遵守してご使用ください
- スクレイピングの頻度や量には十分注意してください
- 商用利用の際は、事前にホットペッパービューティーの許可を得ることを推奨します

## 🤝 コントリビューション

プルリクエストやIssueの投稿を歓迎します！

## 📧 お問い合わせ

質問や提案がある場合は、Issueをオープンしてください。

---

Made with ❤️ by [DaisukeHori](https://github.com/DaisukeHori)
