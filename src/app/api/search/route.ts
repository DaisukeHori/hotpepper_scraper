import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

// --- Fetch: List Page ---

async function fetchListPage(keyword: string, page: number): Promise<string> {
    const encoded = encodeURIComponent(keyword);
    // 複合検索対応: searchTパラメータを追加
    const url =
        `https://beauty.hotpepper.jp/CSP/bt/salonSearch/search/?freeword=` +
        `${encoded}&pn=${page}&searchGender=ALL&sortType=popular&fromSearchCondition=true&searchT=${encodeURIComponent('検索')}`;

    const res = await fetch(url);
    return await res.text();
}

// --- Parse: Max Pages ---
// pタグから「X/Yページ」というパターンを探す

function parseMaxPages(html: string): number {
    const $ = cheerio.load(html);

    let totalPages = 1;

    // すべてのpタグをチェックして「X/Yページ」パターンを探す
    $("p").each((i, el) => {
        const text = $(el).text();
        const match = text.match(/(\d+)\/(\d+)ページ/);
        if (match) {
            const pages = parseInt(match[2], 10);
            if (!isNaN(pages) && pages > 0) {
                totalPages = pages;
                return false; // ループ終了
            }
        }
    });

    return totalPages;
}

// --- Parse: Total Count from numberOfResult ---

function parseTotalCount(html: string): number {
    const $ = cheerio.load(html);
    const countText = $("span.numberOfResult").first().text().trim();
    const count = parseInt(countText.replace(/,/g, ''), 10);
    return isNaN(count) ? 0 : count;
}

// --- Extract salon URL from href ---
// URLからサロンID部分（/slnH[数字]）のみを抽出

function extractSalonUrl(href: string): string | null {
    // /slnH[数字] の部分を正規表現で抽出
    const match = href.match(/\/slnH\d+/);
    if (!match) return null;

    return "https://beauty.hotpepper.jp" + match[0];
}

// --- Parse: Shop List from Page ---

interface ShopPreview {
    name: string;
    url: string;
}

function parseShopsFromListPage(html: string): ShopPreview[] {
    const $ = cheerio.load(html);
    const shops: ShopPreview[] = [];
    const seenUrls = new Set<string>(); // 重複チェック用

    // PowerQueryと同じセレクタを使用
    $(".slnCassetteList > li").each((i, el) => {
        const $row = $(el);

        // 店名を取得（aタグのテキストのみ、spanのUPなどは除外）
        const $slnName = $row.find(".slnName");
        let name = $slnName.find("a").first().text().trim();

        // URLを取得
        const $slnImgList = $row.find(".slnImgList");
        const $firstChild = $slnImgList.children().first();
        let href = $firstChild.find("a").first().attr("href");

        if (!href) {
            // バックアップ: slnH を含む任意のリンク
            href = $row.find("a[href*='/slnH']").first().attr("href");
        }

        if (!href) return;

        // URLからサロンID部分のみを抽出
        const url = extractSalonUrl(href);
        if (!url) return;

        // 重複チェック
        if (seenUrls.has(url)) return;
        seenUrls.add(url);

        // 店名が空の場合はスキップ
        if (!name) return;

        shops.push({ name, url });
    });

    return shops;
}

// --- Main Route Handler ---

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const keyword = searchParams.get("keyword") ?? "";

    if (!keyword) {
        return NextResponse.json({ error: "keyword is required" }, { status: 400 });
    }

    try {
        // 1ページ目を取得して総ページ数と店舗数を確認
        const firstPage = await fetchListPage(keyword, 1);
        const totalPages = parseMaxPages(firstPage);
        const totalCount = parseTotalCount(firstPage); // 正確な件数を取得
        const shopsPreview = parseShopsFromListPage(firstPage);
        const shopsOnPage = shopsPreview.length;

        return NextResponse.json({
            keyword,
            totalPages,
            totalCount, // 正確な件数
            shopsOnPage,
            shopsPerPage: shopsOnPage,
            shopsPreview: shopsPreview.slice(0, 5) // 最初の5件をプレビュー
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
