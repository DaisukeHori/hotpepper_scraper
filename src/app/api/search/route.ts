import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

// --- Fetch: List Page ---

async function fetchListPage(keyword: string, page: number): Promise<string> {
    const encoded = encodeURIComponent(keyword);
    const url =
        `https://beauty.hotpepper.jp/CSP/bt/salonSearch/search/?freeword=` +
        `${encoded}&pn=${page}&searchGender=ALL&sortType=popular&fromSearchCondition=true`;

    const res = await fetch(url);
    return await res.text();
}

// --- Parse: Max Pages and Total Count ---
// PowerQuery: P.bottom0 から "1/34ページ" を取得
// PowerQuery: RowSelector = ".slnCassetteList > LI"

function parsePageInfo(html: string): { totalPages: number; totalCount: number; shopsOnPage: number } {
    const $ = cheerio.load(html);

    // 総ページ数を取得（例: "1/34ページ"）
    const pageText = $("p.bottom0").text();
    let totalPages = 1;
    const parts = pageText.split("/");
    if (parts.length >= 2) {
        const right = parts[1].replace("ページ", "").trim();
        const num = Number(right);
        if (!isNaN(num)) totalPages = num;
    }

    // 1ページ目の店舗数をカウント（PowerQueryと同じセレクタ）
    const shops = $(".slnCassetteList > li");
    const shopsOnPage = shops.length;

    // 推定総店舗数
    const totalCount = shopsOnPage * totalPages;

    return { totalPages, totalCount, shopsOnPage };
}

// --- Parse: Shop List from Page ---
// PowerQuery: RowSelector = ".slnCassetteList > LI"
//             店名 = ".slnName"
//             URL = ".slnImgList > :nth-child(1) > A:nth-child(1)" の href属性

interface ShopPreview {
    name: string;
    url: string;
}

function parseShopsFromListPage(html: string): ShopPreview[] {
    const $ = cheerio.load(html);
    const shops: ShopPreview[] = [];

    // PowerQueryと同じセレクタを使用
    $(".slnCassetteList > li").each((i, el) => {
        const $row = $(el);

        // 店名を取得
        const name = $row.find(".slnName").text().trim();

        // URLを取得（.slnImgList の最初の子要素の最初のaタグ）
        let href = $row
            .find(".slnImgList")
            .children()
            .first()
            .find("a")
            .first()
            .attr("href");

        if (!href) {
            // バックアップ: slnH を含む任意のリンク
            href = $row.find("a[href*='slnH']").first().attr("href");
        }

        if (!href) return;

        // クエリパラメータを削除
        let url = href.split("?")[0];

        // 絶対URL化
        if (!url.startsWith("http")) {
            url = "https://beauty.hotpepper.jp" + url;
        }

        if (name && url) {
            shops.push({ name, url });
        }
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
        const { totalPages, totalCount, shopsOnPage } = parsePageInfo(firstPage);

        // 1ページ目の店舗一覧も取得
        const shopsPreview = parseShopsFromListPage(firstPage);

        return NextResponse.json({
            keyword,
            totalPages,
            totalCount,
            shopsOnPage,
            shopsPerPage: shopsOnPage,
            estimatedTotal: shopsOnPage * totalPages,
            shopsPreview: shopsPreview.slice(0, 5) // 最初の5件をプレビュー
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
