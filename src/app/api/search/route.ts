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

// --- Parse: Max Pages ---

function parseMaxPages(html: string): number {
    const $ = cheerio.load(html);
    const text = $("p.bottom0").text(); // e.g. "1/34ページ"

    const parts = text.split("/");
    if (parts.length < 2) return 1;

    const right = parts[1].replace("ページ", "").trim();
    const num = Number(right);
    return isNaN(num) ? 1 : num;
}

// --- Main Route Handler ---

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const keyword = searchParams.get("keyword") ?? "";

    if (!keyword) {
        return NextResponse.json({ error: "keyword is required" }, { status: 400 });
    }

    try {
        // 1ページ目を取得して総ページ数を確認
        const firstPage = await fetchListPage(keyword, 1);
        const totalPages = parseMaxPages(firstPage);

        return NextResponse.json({
            keyword,
            totalPages
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
