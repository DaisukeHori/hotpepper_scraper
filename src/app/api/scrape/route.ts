import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

// --- Types ---

interface ShopBase {
  name: string;
  url: string;
  page: number;
}

interface ShopDetail {
  telMask?: string;
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
}

interface ShopFull extends ShopBase, ShopDetail {
  telReal?: string;
}

// --- Utility: Parallel Workers ---

async function runInWorkers<T, R>(
  items: T[],
  workerCount: number,
  workerFn: (item: T) => Promise<R>
): Promise<R[]> {
  const n = Math.min(workerCount, items.length || 1);
  const buckets: T[][] = Array.from({ length: n }, () => []);

  items.forEach((item, index) => {
    buckets[index % n].push(item);
  });

  const results = await Promise.all(
    buckets.map(async (bucket) => {
      const out: R[] = [];
      for (const item of bucket) {
        const r = await workerFn(item);
        out.push(r);
      }
      return out;
    })
  );

  return results.flat();
}

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

// --- Parse: Shop List ---

function parseShopsFromListPage(html: string): ShopBase[] {
  const $ = cheerio.load(html);

  const rows = $(".slnCassetteList > li");

  const shops: ShopBase[] = [];
  rows.each((i, el) => {
    const name = $(el).find(".slnName").text().trim();
    const href = $(el)
      .find(".slnImgList")
      .children()
      .first()
      .find("a")
      .attr("href");

    if (!href) return;

    // Make absolute URL
    const url = href.startsWith("http")
      ? href
      : "https://beauty.hotpepper.jp" + href;

    shops.push({ name, url, page: 0 });
  });

  return shops;
}

// --- Fetch + Parse: Detail Page ---

function parseShopDetail(html: string): ShopDetail {
  const $ = cheerio.load(html);

  const rows = $("table.slnDataTbl.bdCell.bgThNml.fgThNml.vaThT.pCellV10H12.mT20")
    .find("tr");

  const out: ShopDetail = {};

  rows.each((i, el) => {
    const th = $(el).find("th").text().trim();
    const td = $(el).find("td").text().trim();

    switch (th) {
      case "電話番号":
        out.telMask = td;
        break;
      case "住所":
        out.address = td;
        break;
      case "アクセス・道案内":
        out.access = td;
        break;
      case "営業時間":
        out.businessHours = td;
        break;
      case "定休日":
        out.holiday = td;
        break;
      case "支払い方法":
        out.payment = td;
        break;
      case "カット価格":
        out.cutPrice = td;
        break;
      case "スタッフ数":
        out.staffCount = td;
        break;
      case "こだわり条件":
        out.features = td;
        break;
      case "備考":
        out.remark = td;
        break;
      case "その他":
        out.others = td;
        break;
    }
  });

  return out;
}

// --- Fetch + Parse: Tel Page ---

function parseShopTel(html: string): { telReal?: string } {
  const $ = cheerio.load(html);
  const rows = $("table.wFull.bdCell.pCell10.mT15").find("tr");

  let tel = undefined;

  rows.each((i, el) => {
    const th = $(el).find("th").text().trim();
    const td = $(el).find("td").text().trim();
    if (th === "電話番号") {
      tel = td;
    }
  });

  return { telReal: tel };
}

// --- Aggregation: Fetch Shop Full ---

async function fetchShopFull(shop: ShopBase): Promise<ShopFull> {
  const [detailHtml, telHtml] = await Promise.all([
    fetch(shop.url).then(r => r.text()),
    fetch(shop.url + "/tel/").then(r => r.text()).catch(() => "")
  ]);

  const detail = parseShopDetail(detailHtml);
  const tel = parseShopTel(telHtml);

  return {
    ...shop,
    ...detail,
    telReal: tel.telReal
  };
}

// --- CSV Generation ---

function shopsToCsv(rows: ShopFull[]): string {
  const headers = [
    "店名", "URL", "ページ",
    "telMask", "address", "access",
    "businessHours", "holiday", "payment",
    "cutPrice", "staffCount", "features",
    "remark", "others", "telReal"
  ];

  const escape = (v: any) => {
    if (v == null) return "";
    const s = String(v).replace(/"/g, '""');
    return `"${s}"`;
  };

  const lines = [
    headers.join(","),
    ...rows.map(r => [
      escape(r.name),
      escape(r.url),
      escape(r.page),
      escape(r.telMask),
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

// --- Main Route Handler ---

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const keyword = searchParams.get("keyword") ?? "";
  const maxPagesParam = Number(searchParams.get("maxPages") ?? "5");

  if (!keyword) {
    return new Response("keyword is required", { status: 400 });
  }

  try {
    // 1. Fetch 1st page to get total pages
    const firstPage = await fetchListPage(keyword, 1);
    const totalPages = parseMaxPages(firstPage);
    const maxPages = Math.min(totalPages, maxPagesParam);

    // 2. Fetch all list pages in parallel
    const pageNumbers = Array.from({ length: maxPages }, (_, i) => i + 1);

    const allShopsNested = await runInWorkers(
      pageNumbers,
      10,
      async (page) => {
        const html = page === 1 ? firstPage : await fetchListPage(keyword, page);
        const shops = parseShopsFromListPage(html)
          .map(s => ({ ...s, page }));
        return shops;
      }
    );

    const allShops = allShopsNested.flat();

    // 3. Fetch shop details in parallel
    const fullShops = await runInWorkers(allShops, 10, fetchShopFull);

    // 4. Generate CSV
    const csv = shopsToCsv(fullShops);

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="hotpepper_${encodeURIComponent(keyword)}.csv"`
      }
    });
  } catch (error) {
    console.error(error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
