'use client';

import Link from 'next/link';

export default function HelpPage() {
    return (
        <main className="min-h-screen bg-gray-50 py-12 px-4">
            <div className="max-w-3xl mx-auto">
                {/* ヘッダー */}
                <div className="mb-8">
                    <Link
                        href="/"
                        className="text-blue-600 hover:text-blue-800 text-sm mb-4 inline-block"
                    >
                        ← トップページに戻る
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-800">使い方ガイド</h1>
                    <p className="text-gray-600 mt-2">初めての方向けの使い方説明です</p>
                </div>

                {/* 目次 */}
                <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">目次</h2>
                    <ul className="space-y-2 text-blue-600">
                        <li><a href="#what" className="hover:underline">1. このツールでできること</a></li>
                        <li><a href="#step1" className="hover:underline">2. ステップ1：キーワード検索</a></li>
                        <li><a href="#step2" className="hover:underline">3. ステップ2：件数を選んでスクレイピング</a></li>
                        <li><a href="#step3" className="hover:underline">4. ステップ3：CSVダウンロード</a></li>
                        <li><a href="#csv" className="hover:underline">5. CSVファイルの開き方</a></li>
                        <li><a href="#faq" className="hover:underline">6. よくある質問</a></li>
                    </ul>
                </div>

                {/* セクション1: できること */}
                <section id="what" className="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <span className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span>
                        このツールでできること
                    </h2>
                    <div className="text-gray-700 space-y-3">
                        <p>
                            HotPepper Beauty（ホットペッパービューティー）に掲載されている美容室・サロンの情報を、
                            キーワードで検索して一括で取得できます。
                        </p>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <p className="font-semibold text-green-800 mb-2">取得できる情報：</p>
                            <ul className="text-green-700 text-sm grid grid-cols-2 gap-1">
                                <li>・店舗名</li>
                                <li>・住所</li>
                                <li>・電話番号</li>
                                <li>・営業時間</li>
                                <li>・定休日</li>
                                <li>・アクセス</li>
                                <li>・カット価格</li>
                                <li>・支払い方法</li>
                                <li>・スタッフ数</li>
                                <li>・こだわり条件</li>
                            </ul>
                        </div>
                        <p className="text-sm text-gray-500">
                            ※ 取得したデータはCSV形式でダウンロードでき、Excelやスプレッドシートで開けます。
                        </p>
                    </div>
                </section>

                {/* セクション2: ステップ1 */}
                <section id="step1" className="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <span className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">2</span>
                        ステップ1：キーワード検索
                    </h2>
                    <div className="text-gray-700 space-y-4">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="font-semibold text-blue-800 mb-2">検索キーワードの例：</p>
                            <ul className="text-blue-700 space-y-1">
                                <li>・<code className="bg-blue-100 px-1 rounded">渋谷</code> → 渋谷エリアのサロン</li>
                                <li>・<code className="bg-blue-100 px-1 rounded">香草カラー</code> → 香草カラーを扱うサロン</li>
                                <li>・<code className="bg-blue-100 px-1 rounded">表参道 パーマ</code> → 表参道でパーマが得意なサロン</li>
                            </ul>
                        </div>
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <p className="font-semibold text-yellow-800 mb-1">ポイント</p>
                            <p className="text-yellow-700 text-sm">
                                スペースで区切ると複合検索ができます。より絞り込んだ検索が可能です。
                            </p>
                        </div>
                        <p>
                            キーワードを入力して「検索して総サロン数を確認」ボタンをクリックすると、
                            該当するサロンの総数が表示されます。
                        </p>
                    </div>
                </section>

                {/* セクション3: ステップ2 */}
                <section id="step2" className="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <span className="bg-green-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">3</span>
                        ステップ2：件数を選んでスクレイピング
                    </h2>
                    <div className="text-gray-700 space-y-4">
                        <p>
                            取得したい件数を選択します。3つの方法で選べます：
                        </p>
                        <ul className="space-y-2 ml-4">
                            <li className="flex items-start gap-2">
                                <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs mt-0.5">方法1</span>
                                <span><strong>スライダー</strong>をドラッグして選ぶ（キリの良い数字に自動でスナップします）</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs mt-0.5">方法2</span>
                                <span><strong>数字ボタン</strong>（50件、100件など）をクリック</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs mt-0.5">方法3</span>
                                <span><strong>数値入力欄</strong>に直接数字を入力</span>
                            </li>
                        </ul>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <p className="font-semibold text-gray-800 mb-2">処理時間の目安：</p>
                            <table className="text-sm w-full">
                                <tbody>
                                    <tr className="border-b">
                                        <td className="py-1">50件</td>
                                        <td className="py-1 text-gray-600">約12秒</td>
                                    </tr>
                                    <tr className="border-b">
                                        <td className="py-1">100件</td>
                                        <td className="py-1 text-gray-600">約24秒</td>
                                    </tr>
                                    <tr className="border-b">
                                        <td className="py-1">250件</td>
                                        <td className="py-1 text-gray-600">約1分</td>
                                    </tr>
                                    <tr>
                                        <td className="py-1">500件</td>
                                        <td className="py-1 text-gray-600">約2分</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p>
                            件数を決めたら「○○件をスクレイピング開始」ボタンをクリックします。
                            処理中は進捗バーと処理中の店舗名が表示されます。
                        </p>
                    </div>
                </section>

                {/* セクション4: ステップ3 */}
                <section id="step3" className="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <span className="bg-orange-500 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">4</span>
                        ステップ3：CSVダウンロード
                    </h2>
                    <div className="text-gray-700 space-y-3">
                        <p>
                            処理が完了すると、取得件数と処理時間が表示されます。
                        </p>
                        <p>
                            「CSVをダウンロード」ボタンをクリックすると、データがCSVファイルとして
                            ダウンロードされます。
                        </p>
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                            <p className="font-semibold text-orange-800 mb-1">ファイル名の例：</p>
                            <code className="text-orange-700 text-sm bg-orange-100 px-2 py-1 rounded block">
                                hotpepper_渋谷_2024-01-15T10-30-00.csv
                            </code>
                        </div>
                    </div>
                </section>

                {/* セクション5: CSVの開き方 */}
                <section id="csv" className="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <span className="bg-purple-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">5</span>
                        CSVファイルの開き方
                    </h2>
                    <div className="text-gray-700 space-y-4">
                        <div className="space-y-3">
                            <h3 className="font-semibold">Excelで開く場合：</h3>
                            <ol className="list-decimal list-inside space-y-1 text-sm ml-2">
                                <li>ダウンロードしたCSVファイルをダブルクリック</li>
                                <li>自動的にExcelで開きます</li>
                                <li>文字化けする場合は「データ」→「テキストから」でUTF-8を指定</li>
                            </ol>
                        </div>
                        <div className="space-y-3">
                            <h3 className="font-semibold">Googleスプレッドシートで開く場合：</h3>
                            <ol className="list-decimal list-inside space-y-1 text-sm ml-2">
                                <li>Googleドライブを開く</li>
                                <li>「新規」→「ファイルのアップロード」でCSVを選択</li>
                                <li>アップロードしたファイルをダブルクリック</li>
                                <li>「Googleスプレッドシートで開く」を選択</li>
                            </ol>
                        </div>
                    </div>
                </section>

                {/* セクション6: FAQ */}
                <section id="faq" className="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <span className="bg-gray-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">6</span>
                        よくある質問
                    </h2>
                    <div className="space-y-4">
                        <div className="border-b pb-4">
                            <p className="font-semibold text-gray-800">Q. 処理が途中で止まりました</p>
                            <p className="text-gray-600 text-sm mt-1">
                                A. ページを再読み込みして、もう一度最初からやり直してください。
                                ネットワーク環境が不安定な場合に発生することがあります。
                            </p>
                        </div>
                        <div className="border-b pb-4">
                            <p className="font-semibold text-gray-800">Q. 一度に何件まで取得できますか？</p>
                            <p className="text-gray-600 text-sm mt-1">
                                A. 検索結果の全件まで取得可能です。ただし、件数が多いと処理時間がかかります。
                                まずは100件程度から試すことをおすすめします。
                            </p>
                        </div>
                        <div className="border-b pb-4">
                            <p className="font-semibold text-gray-800">Q. 電話番号が取得できない店舗があります</p>
                            <p className="text-gray-600 text-sm mt-1">
                                A. 店舗によっては電話番号を公開していない場合があります。
                                その場合は空欄になります。
                            </p>
                        </div>
                        <div>
                            <p className="font-semibold text-gray-800">Q. データは最新ですか？</p>
                            <p className="text-gray-600 text-sm mt-1">
                                A. スクレイピング実行時点のHotPepper Beautyの情報を取得します。
                                リアルタイムで最新のデータを取得できます。
                            </p>
                        </div>
                    </div>
                </section>

                {/* フッター */}
                <div className="text-center mt-8">
                    <Link
                        href="/"
                        className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
                    >
                        ツールを使ってみる
                    </Link>
                </div>
            </div>
        </main>
    );
}
