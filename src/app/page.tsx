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

interface ShopBase {
    name: string;
    url: string;
    page: number;
}

interface ShopFull extends ShopBase {
    address?: string;
    access?: string;
    businessHours?: string;
    holiday?: string;
    payment?: string;
    cutPrice?: string;
    staffCount?: string;
    features?: string;
    remark?: string;
    others?: string;
    telReal?: string;
}

interface ProgressState {
    phase: 'idle' | 'collecting' | 'processing' | 'complete';
    current: number;
    total: number;
    chunkNumber?: number;
    totalChunks?: number;
    elapsedMs: number;
    currentShopName?: string;      // 現在処理中の店舗名
    processedCount?: number;       // 実際に処理した件数
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

function shopsToCsv(rows: ShopFull[]): string {
    const headers = [
        "店名", "URL",
        "住所", "アクセス・道案内",
        "営業時間", "定休日", "支払い方法",
        "カット価格", "スタッフ数", "こだわり条件",
        "備考", "その他", "電話番号"
    ];

    const escape = (v: unknown) => {
        if (v == null) return "";
        const s = String(v).replace(/"/g, '""');
        return `"${s}"`;
    };

    const lines = [
        headers.join(","),
        ...rows.map(r => [
            escape(r.name),
            escape(r.url),
            escape(r.address),
            escape(r.access),
            escape(r.businessHours),
            escape(r.holiday),
            escape(r.payment),
            escape(r.cutPrice),
            escape(r.staffCount),
            escape(r.features),
            escape(r.remark),
            escape(r.others),
            escape(r.telReal)
        ].join(","))
    ];

    return lines.join("\n");
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
    const startTimeRef = useRef(0);

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
        if (e.key === 'Enter' && !isComposingRef.current) {
            handleSearch();
        }
    }

    // ステップ2: チャンク処理でスクレイピング
    async function handleScrape() {
        if (!searchResult) return;

        setScraping(true);
        setCsvData('');
        startTimeRef.current = Date.now();
        setProgress({ phase: 'collecting', current: 0, total: maxPages, elapsedMs: 0 });

        try {
            // Phase 1: ページを収集して店舗リストを取得
            const collectRes = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    keyword,
                    maxPages,
                    phase: 'collect'
                })
            });

            if (!collectRes.ok) {
                throw new Error(await collectRes.text());
            }

            const collectData = await collectRes.json();
            const shops: ShopBase[] = collectData.shops || [];
            const totalShops = shops.length;

            if (totalShops === 0) {
                alert('店舗が見つかりませんでした');
                setScraping(false);
                return;
            }

            // Phase 2: チャンク単位で店舗詳細を取得（リレー式）
            const CHUNK_SIZE = 15;
            const totalChunks = Math.ceil(totalShops / CHUNK_SIZE);
            const allResults: ShopFull[] = [];
            let currentIndex = 0;
            let chunkNumber = 1;

            // 最初のチャンク処理前に店舗名を設定
            let currentShopName = shops.length > 0 ? shops[0].name : '';

            while (currentIndex < totalShops) {
                setProgress({
                    phase: 'processing',
                    current: currentIndex,
                    total: totalShops,
                    chunkNumber,
                    totalChunks,
                    elapsedMs: Date.now() - startTimeRef.current,
                    currentShopName,
                    processedCount: allResults.length
                });

                const processRes = await fetch('/api/scrape', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        phase: 'process',
                        shops,
                        startIndex: currentIndex
                    })
                });

                if (!processRes.ok) {
                    throw new Error(await processRes.text());
                }

                const processData = await processRes.json();
                const results: ShopFull[] = processData.results || [];
                allResults.push(...results);

                // 次のチャンクの最初の店舗名を取得
                if (processData.currentShopNames && processData.currentShopNames.length > 0) {
                    currentShopName = processData.currentShopNames[0];
                }

                if (processData.phase === 'complete' || processData.nextIndex === undefined) {
                    break;
                }

                currentIndex = processData.nextIndex;
                chunkNumber++;
            }

            // CSV生成
            const csv = shopsToCsv(allResults);
            setCsvData(csv);
            setProgress({
                phase: 'complete',
                current: allResults.length,
                total: totalShops,
                elapsedMs: Date.now() - startTimeRef.current,
                processedCount: allResults.length  // 実際に処理した件数
            });

        } catch (error) {
            console.error('スクレイピングエラー:', error);
            alert('スクレイピング中にエラーが発生しました: ' + error);
            setProgress({ phase: 'idle', current: 0, total: 0, elapsedMs: 0 });
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
                                <p>※ {maxPages}ページ = {
                                    maxPages >= searchResult.totalPages
                                        ? `${searchResult.totalCount.toLocaleString()} 店舗`
                                        : `約 ${(maxPages * searchResult.shopsOnPage).toLocaleString()} 店舗`
                                }</p>
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
                                : `${maxPages}ページ分をスクレイピング開始（${
                                    maxPages >= searchResult.totalPages
                                        ? `${searchResult.totalCount.toLocaleString()}店舗`
                                        : `約${(maxPages * searchResult.shopsOnPage).toLocaleString()}店舗`
                                }）`
                            }
                        </button>

                        {/* リアルタイム進捗表示 */}
                        {scraping && progress.phase !== 'idle' && (
                            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 space-y-3">
                                <div className="flex justify-between items-center text-sm text-yellow-800">
                                    <span className="font-semibold">
                                        {progress.phase === 'collecting' ? 'ページ収集中' : '店舗詳細取得中'}
                                        {progress.chunkNumber && ` (チャンク ${progress.chunkNumber}/${progress.totalChunks})`}
                                    </span>
                                    <span>
                                        {progress.current} / {progress.total} 件
                                    </span>
                                </div>

                                {/* 現在処理中の店舗名 */}
                                {progress.phase === 'processing' && progress.currentShopName && (
                                    <div className="text-xs text-yellow-700 truncate">
                                        📍 {progress.currentShopName}
                                    </div>
                                )}

                                <div className="w-full bg-yellow-200 rounded-full h-4 overflow-hidden">
                                    <div
                                        className="bg-yellow-500 h-4 rounded-full transition-all duration-300"
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                </div>

                                <div className="flex justify-between text-xs text-yellow-700">
                                    <span>経過: {formatTime(progress.elapsedMs)}</span>
                                    <span>
                                        {progress.phase === 'processing' && progress.chunkNumber && progress.totalChunks && (
                                            `残り約${Math.ceil((progress.totalChunks - progress.chunkNumber) * 7)}秒`
                                        )}
                                    </span>
                                </div>
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
                                <p><strong>{progress.processedCount ?? progress.current}件</strong>のデータを取得しました</p>
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

                <div className="text-gray-500 text-xs mt-4 text-center">
                    ※ Vercel Hobby対応：チャンク処理で10秒制限を回避
                </div>

                {csvData && (
                    <div className="bg-white p-4 rounded-xl shadow-lg w-full max-w-4xl mt-8">
                        <h2 className="text-xl font-bold text-gray-800 mb-4">CSVプレビュー ({progress.processedCount ?? progress.current}件)</h2>
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
