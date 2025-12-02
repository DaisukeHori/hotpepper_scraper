'use client';

import { useState, useCallback, useRef } from 'react';

interface SearchResult {
    keyword: string;
    totalPages: number;
    totalCount: number;
    shopsOnPage: number;
    shopsPerPage: number;
    shopsPreview: { name: string; url: string }[];
}

interface ProgressState {
    phase: 'pages' | 'details' | 'idle';
    current: number;
    total: number;
    shopName?: string;
    elapsedMs: number;
}

function formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes > 0) {
        return `${minutes}分${secs}秒`;
    }
    return `${secs}秒`;
}

function estimateRemaining(current: number, total: number, elapsedMs: number): string {
    if (current === 0) return '計算中...';
    const msPerItem = elapsedMs / current;
    const remaining = (total - current) * msPerItem;
    return formatTime(remaining);
}

export default function Home() {
    const [keyword, setKeyword] = useState('');
    const [loading, setLoading] = useState(false);
    const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
    const [maxPages, setMaxPages] = useState(5);
    const [csvData, setCsvData] = useState('');
    const [scraping, setScraping] = useState(false);
    const [progress, setProgress] = useState<ProgressState>({ phase: 'idle', current: 0, total: 0, elapsedMs: 0 });
    const isComposingRef = useRef(false);

    // ステップ1: キーワード検索
    async function handleSearch() {
        if (!keyword) {
            alert('キーワードを入力してください');
            return;
        }

        setLoading(true);
        setSearchResult(null);
        setCsvData('');
        setProgress({ phase: 'idle', current: 0, total: 0, elapsedMs: 0 });

        try {
            const res = await fetch(`/api/search?keyword=${encodeURIComponent(keyword)}`);

            if (!res.ok) {
                const errorText = await res.text();
                alert("エラー：" + errorText);
                return;
            }

            const data: SearchResult = await res.json();
            setSearchResult(data);
            setMaxPages(Math.min(data.totalPages, 5));
        } catch (error) {
            console.error('検索エラー:', error);
            alert('検索中にエラーが発生しました: ' + error);
        } finally {
            setLoading(false);
        }
    }

    // IME対応のキーダウンハンドラ
    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        // IME変換中はEnterを無視
        if (e.key === 'Enter' && !isComposingRef.current) {
            handleSearch();
        }
    }

    // ステップ2: SSEでスクレイピング実行
    async function handleScrape() {
        if (!searchResult) return;

        setScraping(true);
        setCsvData('');
        setProgress({ phase: 'pages', current: 0, total: maxPages, elapsedMs: 0 });

        try {
            const res = await fetch(`/api/scrape?keyword=${encodeURIComponent(keyword)}&maxPages=${maxPages}`);

            if (!res.ok) {
                const errorText = await res.text();
                alert("エラー：" + errorText);
                setScraping(false);
                return;
            }

            const reader = res.body?.getReader();
            if (!reader) {
                throw new Error('Stream not available');
            }

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // SSEイベントをパース
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const event = JSON.parse(line.slice(6));

                            if (event.type === 'progress') {
                                setProgress({
                                    phase: event.phase,
                                    current: event.current,
                                    total: event.total,
                                    shopName: event.shopName,
                                    elapsedMs: event.elapsedMs
                                });
                            } else if (event.type === 'complete') {
                                setCsvData(event.csv);
                                setProgress({
                                    phase: 'idle',
                                    current: event.totalShops,
                                    total: event.totalShops,
                                    elapsedMs: event.elapsedMs
                                });
                            } else if (event.type === 'error') {
                                alert('エラー: ' + event.message);
                            }
                        } catch (e) {
                            console.error('Failed to parse SSE event:', e);
                        }
                    }
                }
            }

        } catch (error) {
            console.error('スクレイピングエラー:', error);
            alert('スクレイピング中にエラーが発生しました: ' + error);
        } finally {
            setScraping(false);
        }
    }

    // CSVダウンロード
    const handleDownload = useCallback(() => {
        if (!csvData) return;

        const sanitizedKeyword = keyword.replace(/[^a-zA-Z0-9ぁ-んァ-ヶ一-龯]/g, '_');
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = `hotpepper_${sanitizedKeyword}_${timestamp}.csv`;

        const bom = '\uFEFF';
        const blob = new Blob([bom + csvData], { type: 'text/csv;charset=utf-8;' });

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        }, 100);
    }, [csvData, keyword]);

    // CSVの行数を取得
    const csvRowCount = csvData ? csvData.split('\n').length - 1 : 0;

    // 進捗バーの計算
    const progressPercent = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

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
                            placeholder="例: 渋谷、香草カラー、良草 パーマ"
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onCompositionStart={() => { isComposingRef.current = true; }}
                            onCompositionEnd={() => { isComposingRef.current = false; }}
                        />
                        <p className="text-xs text-gray-500">※ スペース区切りで複合検索可能</p>
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
                                <div>総件数:</div>
                                <div className="font-bold text-xl">{searchResult.totalCount.toLocaleString()} 件</div>
                                <div>総ページ数:</div>
                                <div className="font-bold">{searchResult.totalPages} ページ</div>
                                <div>1ページあたり:</div>
                                <div className="font-bold">{searchResult.shopsOnPage} 店舗</div>
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
                                ? 'スクレイピング中...'
                                : `${maxPages}ページ分をスクレイピング開始（約${maxPages * searchResult.shopsOnPage}店舗）`
                            }
                        </button>

                        {/* リアルタイム進捗表示 */}
                        {scraping && progress.phase !== 'idle' && (
                            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 space-y-3">
                                <div className="flex justify-between items-center text-sm text-yellow-800">
                                    <span className="font-semibold">
                                        {progress.phase === 'pages' ? 'ページ取得中' : '店舗詳細取得中'}
                                    </span>
                                    <span>
                                        {progress.current} / {progress.total}
                                    </span>
                                </div>

                                {/* プログレスバー */}
                                <div className="w-full bg-yellow-200 rounded-full h-4 overflow-hidden">
                                    <div
                                        className="bg-yellow-500 h-4 rounded-full transition-all duration-300"
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                </div>

                                <div className="flex justify-between text-xs text-yellow-700">
                                    <span>経過: {formatTime(progress.elapsedMs)}</span>
                                    <span>残り: 約{estimateRemaining(progress.current, progress.total, progress.elapsedMs)}</span>
                                </div>

                                {progress.shopName && (
                                    <div className="text-xs text-yellow-700 truncate">
                                        処理中: {progress.shopName}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* CSVダウンロードセクション */}
                {csvData && (
                    <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md flex flex-col gap-6">
                        <div className="bg-blue-50 border border-blue-300 rounded-lg p-4">
                            <p className="text-blue-800 font-semibold mb-2">
                                <span className="bg-blue-600 text-white px-2 py-1 rounded mr-2">ステップ3</span>
                                データ取得完了
                            </p>
                            <div className="text-blue-700 space-y-1">
                                <p><strong>{csvRowCount}件</strong>のデータを取得しました</p>
                                <p className="text-sm">処理時間: {formatTime(progress.elapsedMs)}</p>
                            </div>
                        </div>

                        <button
                            onClick={handleDownload}
                            className="w-full py-4 rounded-lg font-bold text-white text-lg shadow-md transition-all bg-orange-500 hover:bg-orange-600 hover:shadow-lg active:scale-95"
                        >
                            CSVをダウンロード
                        </button>
                    </div>
                )}

                <div className="text-gray-500 text-xs mt-4">
                    ※ サーバーレス関数の制限により、処理に時間がかかる場合があります。
                </div>

                {csvData && (
                    <div className="bg-white p-4 rounded-xl shadow-lg w-full max-w-4xl mt-8">
                        <h2 className="text-xl font-bold text-gray-800 mb-4">CSVプレビュー ({csvRowCount}件)</h2>
                        <textarea
                            className="w-full h-96 p-3 border border-gray-300 rounded-lg font-mono text-xs text-black"
                            value={csvData}
                            readOnly
                        />
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(csvData);
                                alert('CSVをクリップボードにコピーしました');
                            }}
                            className="mt-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                        >
                            クリップボードにコピー
                        </button>
                    </div>
                )}
            </div>
        </main>
    );
}
