'use client';

import { useState } from 'react';

interface SearchResult {
    keyword: string;
    totalPages: number;
    totalCount: number;
    shopsOnPage: number;
    shopsPerPage: number;
    estimatedTotal: number;
    shopsPreview: { name: string; url: string }[];
}

export default function Home() {
    const [keyword, setKeyword] = useState('');
    const [loading, setLoading] = useState(false);
    const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
    const [maxPages, setMaxPages] = useState(5);
    const [csvPreview, setCsvPreview] = useState('');
    const [scraping, setScraping] = useState(false);

    // ステップ1: キーワード検索して総ページ数と店舗数を取得
    async function handleSearch() {
        if (!keyword) {
            alert('キーワードを入力してください');
            return;
        }

        setLoading(true);
        setSearchResult(null);
        setCsvPreview('');

        try {
            const res = await fetch(`/api/search?keyword=${encodeURIComponent(keyword)}`);

            if (!res.ok) {
                const errorText = await res.text();
                alert("エラー：" + errorText);
                return;
            }

            const data: SearchResult = await res.json();
            setSearchResult(data);
            setMaxPages(Math.min(data.totalPages, 5)); // デフォルトは5ページ
        } catch (error) {
            console.error('検索エラー:', error);
            alert('検索中にエラーが発生しました: ' + error);
        } finally {
            setLoading(false);
        }
    }

    // ステップ2: 実際のスクレイピングを実行
    async function handleScrape() {
        setScraping(true);
        setCsvPreview('');

        try {
            const res = await fetch(`/api/scrape?keyword=${encodeURIComponent(keyword)}&maxPages=${maxPages}`);

            if (!res.ok) {
                const errorText = await res.text();
                alert("エラー：" + errorText);
                setScraping(false);
                return;
            }

            // CSVテキストを直接取得
            const csvText = await res.text();

            // プレビュー表示
            setCsvPreview(csvText);

            // ファイル名をサニタイズ
            const sanitizedKeyword = keyword.replace(/[^a-zA-Z0-9ぁ-んァ-ヶ一-龯]/g, '_');
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            const filename = `hotpepper_${sanitizedKeyword}_${timestamp}.csv`;

            // BOM付きUTF-8でBlobを作成（Excel対応）
            const bom = '\uFEFF';
            const blob = new Blob([bom + csvText], { type: 'text/csv;charset=utf-8;' });

            // ダウンロードリンクを作成
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';

            document.body.appendChild(link);
            link.click();

            // クリーンアップ
            setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            }, 100);

            console.log(`CSVダウンロード成功: ${filename}`);
            alert(`ダウンロードしました: ${filename}`);
        } catch (error) {
            console.error('スクレイピングエラー:', error);
            alert('スクレイピング中にエラーが発生しました: ' + error);
        } finally {
            setScraping(false);
        }
    }

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50">
            <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex flex-col gap-8">
                <h1 className="text-4xl font-bold text-gray-800 mb-8">HotPepper Beauty Scraper</h1>

                {/* ステップ1: キーワード検索 */}
                <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                        <label htmlFor="keyword" className="font-semibold text-gray-700">
                            <span className="bg-blue-600 text-white px-2 py-1 rounded mr-2">ステップ1</span>
                            検索キーワード
                        </label>
                        <input
                            id="keyword"
                            type="text"
                            className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-black"
                            placeholder="例: 渋谷、香草カラー"
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                    </div>

                    <button
                        onClick={handleSearch}
                        disabled={loading}
                        className={`
                            w-full py-4 rounded-lg font-bold text-white text-lg shadow-md transition-all
                            ${loading
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg active:scale-95'
                            }
                        `}
                    >
                        {loading ? '検索中...' : '検索して総ページ数を確認'}
                    </button>
                </div>

                {/* ステップ2: ページ数選択とスクレイピング実行 */}
                {searchResult && (
                    <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md flex flex-col gap-6">
                        {/* 検索結果の詳細表示 */}
                        <div className="bg-green-50 border border-green-300 rounded-lg p-4">
                            <p className="text-green-800 font-semibold mb-2">
                                検索結果: 「{searchResult.keyword}」
                            </p>
                            <div className="grid grid-cols-2 gap-2 text-sm text-green-700">
                                <div>総ページ数:</div>
                                <div className="font-bold text-xl">{searchResult.totalPages} ページ</div>
                                <div>1ページあたり:</div>
                                <div className="font-bold">{searchResult.shopsOnPage} 店舗</div>
                                <div>推定総店舗数:</div>
                                <div className="font-bold">{searchResult.estimatedTotal} 店舗</div>
                            </div>
                        </div>

                        {/* 店舗プレビュー */}
                        {searchResult.shopsPreview && searchResult.shopsPreview.length > 0 && (
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                <p className="text-gray-700 font-semibold mb-2">
                                    店舗プレビュー（最初の{searchResult.shopsPreview.length}件）:
                                </p>
                                <ul className="text-sm text-gray-600 space-y-1">
                                    {searchResult.shopsPreview.map((shop, i) => (
                                        <li key={i} className="truncate">
                                            {i + 1}. {shop.name}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="flex flex-col gap-2">
                            <label htmlFor="maxPages" className="font-semibold text-gray-700">
                                <span className="bg-green-600 text-white px-2 py-1 rounded mr-2">ステップ2</span>
                                取得するページ数を選択
                            </label>
                            <input
                                id="maxPages"
                                type="number"
                                min="1"
                                max={searchResult.totalPages}
                                className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition text-black"
                                value={maxPages}
                                onChange={(e) => setMaxPages(Math.min(Number(e.target.value), searchResult.totalPages))}
                            />
                            <div className="text-xs text-gray-500 space-y-1">
                                <p>※ 1〜{searchResult.totalPages}ページまで指定可能</p>
                                <p>※ {maxPages}ページ = 約 {maxPages * searchResult.shopsOnPage} 店舗</p>
                            </div>
                        </div>

                        <button
                            onClick={handleScrape}
                            disabled={scraping}
                            className={`
                                w-full py-4 rounded-lg font-bold text-white text-lg shadow-md transition-all
                                ${scraping
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-green-600 hover:bg-green-700 hover:shadow-lg active:scale-95'
                                }
                            `}
                        >
                            {scraping
                                ? `スクレイピング中... (${maxPages}ページ / 約${maxPages * searchResult.shopsOnPage}店舗)`
                                : `${maxPages}ページ分をスクレイピング開始（約${maxPages * searchResult.shopsOnPage}店舗）`
                            }
                        </button>
                    </div>
                )}

                <div className="text-gray-500 text-xs mt-4">
                    ※ サーバーレス関数の制限により、処理に時間がかかる場合があります。
                </div>

                {csvPreview && (
                    <div className="bg-white p-4 rounded-xl shadow-lg w-full max-w-4xl mt-8">
                        <h2 className="text-xl font-bold text-gray-800 mb-4">CSVプレビュー</h2>
                        <textarea
                            className="w-full h-96 p-3 border border-gray-300 rounded-lg font-mono text-xs text-black"
                            value={csvPreview}
                            readOnly
                        />
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(csvPreview);
                                alert('CSVをクリップボードにコピーしました');
                            }}
                            className="mt-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                            クリップボードにコピー
                        </button>
                    </div>
                )}
            </div>
        </main>
    );
}
