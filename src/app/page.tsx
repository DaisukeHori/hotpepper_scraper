'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

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
    currentShopNames?: string[];   // 現在処理中のチャンクの店舗名リスト
    processedCount?: number;       // 実際に処理した件数
    lastProcessedShops?: string[]; // 直前に処理完了した店舗名リスト
}

function formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}時間${minutes}分${secs}秒`;
    }
    if (minutes > 0) {
        return `${minutes}分${secs}秒`;
    }
    return `${secs}秒`;
}

function formatRemainingTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `約${hours}時間${minutes}分`;
    }
    if (minutes > 0) {
        return `約${minutes}分${secs}秒`;
    }
    return `約${secs}秒`;
}

// スライダー用のキリの良い数値を生成
function generateNiceNumbers(total: number): number[] {
    if (total <= 10) return [1, total];

    // 間隔を決定（総数に応じて調整）
    let step: number;
    if (total <= 50) step = 10;
    else if (total <= 100) step = 20;
    else if (total <= 300) step = 50;
    else if (total <= 1000) step = 100;
    else step = 250;

    const values: number[] = [];
    for (let i = step; i < total; i += step) {
        values.push(i);
    }
    // 最大値も追加（キリが良くない場合でも）
    values.push(total);

    return values;
}

// スナップ機能：近いキリの良い数値に吸い付く
function snapToNiceNumber(value: number, niceNumbers: number[], total: number): number {
    // スナップ閾値（総数の3%または8の小さい方）
    const threshold = Math.min(Math.ceil(total * 0.03), 8);

    for (const nice of niceNumbers) {
        if (Math.abs(value - nice) <= threshold) {
            return nice;
        }
    }
    return value;
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
    const [maxShops, setMaxShops] = useState(100);
    const [csvData, setCsvData] = useState('');
    const [scraping, setScraping] = useState(false);
    const [progress, setProgress] = useState<ProgressState>({ phase: 'idle', current: 0, total: 0, elapsedMs: 0 });
    const [displayShopIndex, setDisplayShopIndex] = useState(0);
    const isComposingRef = useRef(false);
    const startTimeRef = useRef(0);

    // 店舗名をころころ切り替えるアニメーション
    useEffect(() => {
        if (progress.phase !== 'processing' || !progress.currentShopNames || progress.currentShopNames.length === 0) {
            setDisplayShopIndex(0);
            return;
        }

        const interval = setInterval(() => {
            setDisplayShopIndex(prev => (prev + 1) % progress.currentShopNames!.length);
        }, 400); // 0.4秒ごとに切り替え

        return () => clearInterval(interval);
    }, [progress.phase, progress.currentShopNames]);

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
            // デフォルトは総件数か100件の小さい方
            setMaxShops(Math.min(data.totalCount, 100));
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

        // 件数から必要なページ数を計算
        const requiredPages = Math.ceil(maxShops / searchResult.shopsOnPage);
        setProgress({ phase: 'collecting', current: 0, total: requiredPages, elapsedMs: 0 });

        try {
            // Phase 1: ページを収集して店舗リストを取得
            const collectRes = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    keyword,
                    maxPages: requiredPages,
                    phase: 'collect'
                })
            });

            if (!collectRes.ok) {
                throw new Error(await collectRes.text());
            }

            const collectData = await collectRes.json();
            // 指定件数だけに切り詰める
            const allCollectedShops: ShopBase[] = collectData.shops || [];
            const shops = allCollectedShops.slice(0, maxShops);
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

            // 最初のチャンク処理前に店舗名リストを設定
            let currentShopNames = shops.slice(0, CHUNK_SIZE).map(s => s.name);
            let lastProcessedShops: string[] = [];

            while (currentIndex < totalShops) {
                setProgress({
                    phase: 'processing',
                    current: currentIndex,
                    total: totalShops,
                    chunkNumber,
                    totalChunks,
                    elapsedMs: Date.now() - startTimeRef.current,
                    currentShopNames,
                    processedCount: allResults.length,
                    lastProcessedShops
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

                // 処理完了した店舗名を記録
                lastProcessedShops = results.map(r => r.name);
                allResults.push(...results);

                // 次のチャンクの店舗名リストを取得
                if (processData.currentShopNames && processData.currentShopNames.length > 0) {
                    currentShopNames = processData.currentShopNames;
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
                        {loading ? '検索中...' : '検索して総サロン数を確認'}
                    </button>
                </div>

                {/* ステップ2: 件数選択とスクレイピング実行 */}
                {searchResult && (
                    <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md flex flex-col gap-6">
                        <div className="bg-green-50 border border-green-300 rounded-lg p-4">
                            <p className="text-green-800 font-semibold mb-2">
                                検索結果: 「{searchResult.keyword}」
                            </p>
                            <p className="text-green-700">
                                総サロン数: <span className="font-bold text-xl">{searchResult.totalCount.toLocaleString()} 件</span>
                            </p>
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
                            <label htmlFor="maxShops" className="font-semibold text-gray-700">
                                <span className="bg-green-600 text-white px-2 py-1 rounded mr-2">ステップ2</span>
                                取得する件数を選択
                            </label>
                            {(() => {
                                const niceNumbers = generateNiceNumbers(searchResult.totalCount);
                                return (
                                    <>
                                        <div className="flex items-center gap-3">
                                            <input
                                                id="maxShopsSlider"
                                                type="range"
                                                min="1"
                                                max={searchResult.totalCount}
                                                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                                                value={maxShops}
                                                onChange={(e) => {
                                                    const raw = Number(e.target.value);
                                                    const snapped = snapToNiceNumber(raw, niceNumbers, searchResult.totalCount);
                                                    setMaxShops(snapped);
                                                }}
                                            />
                                            <input
                                                id="maxShops"
                                                type="number"
                                                min="1"
                                                max={searchResult.totalCount}
                                                className="w-24 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition text-black text-center"
                                                value={maxShops}
                                                onChange={(e) => setMaxShops(Math.min(Math.max(1, Number(e.target.value)), searchResult.totalCount))}
                                            />
                                        </div>
                                        {/* キリの良い数値ボタン */}
                                        <div className="flex flex-wrap gap-2">
                                            {niceNumbers.slice(0, 6).map(n => (
                                                <button
                                                    key={n}
                                                    type="button"
                                                    onClick={() => setMaxShops(n)}
                                                    className={`px-3 py-1 text-xs rounded-full border transition ${
                                                        maxShops === n
                                                            ? 'bg-green-600 text-white border-green-600'
                                                            : 'bg-white text-gray-600 border-gray-300 hover:border-green-500'
                                                    }`}
                                                >
                                                    {n.toLocaleString()}件
                                                </button>
                                            ))}
                                            {niceNumbers.length > 6 && niceNumbers[niceNumbers.length - 1] !== niceNumbers[5] && (
                                                <button
                                                    type="button"
                                                    onClick={() => setMaxShops(searchResult.totalCount)}
                                                    className={`px-3 py-1 text-xs rounded-full border transition ${
                                                        maxShops === searchResult.totalCount
                                                            ? 'bg-green-600 text-white border-green-600'
                                                            : 'bg-white text-gray-600 border-gray-300 hover:border-green-500'
                                                    }`}
                                                >
                                                    全件({searchResult.totalCount.toLocaleString()})
                                                </button>
                                            )}
                                        </div>
                                    </>
                                );
                            })()}
                            <div className="text-xs text-gray-500">
                                <p>※ 処理目安: {formatRemainingTime(Math.ceil(maxShops / 250 * 60))}</p>
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
                                : `${maxShops.toLocaleString()}件をスクレイピング開始`
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

                                {/* 処理完了した店舗（直前のチャンク） */}
                                {progress.phase === 'processing' && progress.lastProcessedShops && progress.lastProcessedShops.length > 0 && (
                                    <div className="text-xs text-green-700 bg-green-100 rounded px-2 py-1 max-h-16 overflow-y-auto">
                                        <span className="font-semibold">✓ 取得完了:</span> {progress.lastProcessedShops.slice(-3).join(', ')}
                                        {progress.lastProcessedShops.length > 3 && ` 他${progress.lastProcessedShops.length - 3}件`}
                                    </div>
                                )}

                                {/* 現在処理中の店舗名（ころころ切り替わる） */}
                                {progress.phase === 'processing' && progress.currentShopNames && progress.currentShopNames.length > 0 && (
                                    <div className="text-xs text-yellow-700 truncate bg-yellow-100 rounded px-2 py-1">
                                        ⏳ 取得中: {progress.currentShopNames[displayShopIndex]} ({displayShopIndex + 1}/{progress.currentShopNames.length})
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
                                            formatRemainingTime(Math.ceil((progress.totalChunks - progress.chunkNumber) * 7))
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

            </div>
        </main>
    );
}
