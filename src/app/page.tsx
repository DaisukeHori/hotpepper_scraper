'use client';

import { useState } from 'react';

export default function Home() {
    const [keyword, setKeyword] = useState('');
    const [maxPages, setMaxPages] = useState(5);
    const [loading, setLoading] = useState(false);

    async function handleDownload() {
        if (!keyword) {
            alert('キーワードを入力してください');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`/api/scrape?keyword=${encodeURIComponent(keyword)}&maxPages=${maxPages}`);

            if (!res.ok) {
                alert("エラー：" + await res.text());
                return;
            }

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = `hotpepper_${keyword}.csv`;
            a.click();

            URL.revokeObjectURL(url);
        } catch (error) {
            console.error(error);
            alert('ダウンロード中にエラーが発生しました');
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50">
            <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex flex-col gap-8">
                <h1 className="text-4xl font-bold text-gray-800 mb-8">HotPepper Beauty Scraper</h1>

                <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                        <label htmlFor="keyword" className="font-semibold text-gray-700">検索キーワード</label>
                        <input
                            id="keyword"
                            type="text"
                            className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-black"
                            placeholder="例: 表参道"
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label htmlFor="maxPages" className="font-semibold text-gray-700">最大ページ数 (1-10)</label>
                        <input
                            id="maxPages"
                            type="number"
                            min="1"
                            max="10"
                            className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-black"
                            value={maxPages}
                            onChange={(e) => setMaxPages(Number(e.target.value))}
                        />
                    </div>

                    <button
                        onClick={handleDownload}
                        disabled={loading}
                        className={`
              w-full py-4 rounded-lg font-bold text-white text-lg shadow-md transition-all
              ${loading
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg active:scale-95'
                            }
            `}
                    >
                        {loading ? '処理中...' : 'CSVをダウンロード'}
                    </button>
                </div>

                <div className="text-gray-500 text-xs mt-4">
                    ※ サーバーレス関数の制限により、処理に時間がかかる場合があります。<br />
                    ※ 最大10ページまで指定可能です。
                </div>
            </div>
        </main>
    );
}
