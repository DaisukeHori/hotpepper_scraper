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

// --- Utility: Sleep ---

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Utility: Sequential Processing with Delay ---

async function processSequentially<T, R>(
  items: T[],
  processFn: (item: T, index: number) => Promise<R>,
  delayMs: number = 100
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i++) {
    try {
      const r = await processFn(items[i], i);
      results.push(r);
    } catch (e) {
      console.error(`Error processing item ${i}:`, e);
    }
    // 最後のアイテム以外は遅延を入れる
    if (i < items.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }
  return results;
}

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

// --- Extract salon URL from href ---
// URLからサロンID部分（/slnH[数字]）のみを抽出

function extractSalonUrl(href: string): string | null {
  // /slnH[数字] の部分を正規表現で抽出
  const match = href.match(/\/slnH\d+/);
  if (!match) return null;

  return "https://beauty.hotpepper.jp" + match[0];
}

// --- Parse: Shop List ---
// PowerQuery: RowSelector = ".slnCassetteList > LI"
//             店名 = ".slnName"
//             URL = ".slnImgList > :nth-child(1) > A:nth-child(1):nth-last-child(1)" の href属性

function parseShopsFromListPage(html: string): ShopBase[] {
  const $ = cheerio.load(html);

  const rows = $(".slnCassetteList > li");

  const shops: ShopBase[] = [];
  const seenUrls = new Set<string>(); // 重複チェック用

  rows.each((i, el) => {
    const $row = $(el);

    // 店名を取得（aタグのテキストのみ、spanのUPなどは除外）
    const $slnName = $row.find(".slnName");
    let name = $slnName.find("a").first().text().trim();

    // URLを取得
    // PowerQuery: .slnImgList > :nth-child(1) > A:nth-child(1):nth-last-child(1)
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

    shops.push({ name, url, page: 0 });
  });

  return shops;
}

// --- Fetch + Parse: Detail Page ---
// PowerQuery: RowSelector = "TABLE.slnDataTbl.bdCell.bgThNml.fgThNml.vaThT.pCellV10H12.mT20 > * > TR"

function parseShopDetail(html: string): ShopDetail {
  const $ = cheerio.load(html);

  // PowerQueryと同じセレクタを使用
  const rows = $("table.slnDataTbl.bdCell.bgThNml.fgThNml.vaThT.pCellV10H12.mT20")
    .find("tr");

  const out: ShopDetail = {};

  rows.each((i, el) => {
    const $row = $(el);
    const $ths = $row.find("th");
    const $tds = $row.find("td");

    // 各TH/TDペアを処理
    $ths.each((j, thEl) => {
      const th = $(thEl).text().trim();
      const $td = $tds.eq(j);
      if ($td.length) {
        const td = $td.text().trim();
        assignDetail(out, th, td);
      }
    });
  });

  return out;
}

function assignDetail(out: ShopDetail, th: string, td: string) {
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
}

// --- Fetch + Parse: Tel Page ---

function parseShopTel(html: string): { telReal?: string } {
  const $ = cheerio.load(html);
  let tel: string | undefined = undefined;

  // パターン1: table.wFull.bdCell.pCell10.mT15 内のTH/TD
  $("table.wFull.bdCell.pCell10.mT15").find("tr").each((i, el) => {
    const th = $(el).find("th").text().trim();
    const td = $(el).find("td").text().trim();
    if (th === "電話番号" && td) {
      tel = td;
    }
  });

  // パターン2: 電話番号を含むテーブル行を探す
  if (!tel) {
    $("th").each((i, el) => {
      const thText = $(el).text().trim();
      if (thText === "電話番号") {
        const tdText = $(el).next("td").text().trim();
        if (tdText) {
          tel = tdText;
        }
      }
    });
  }

  // パターン3: tel:リンクを探す
  if (!tel) {
    const telLink = $("a[href^='tel:']").first();
    if (telLink.length) {
      tel = telLink.attr("href")?.replace("tel:", "").trim();
    }
  }

  return { telReal: tel };
}

// --- Aggregation: Fetch Shop Full ---

async function fetchShopFull(shop: ShopBase): Promise<ShopFull> {
  try {
    const [detailHtml, telHtml] = await Promise.all([
      fetch(shop.url).then(r => r.text()).catch(() => ""),
      fetch(shop.url + "/tel/").then(r => r.text()).catch(() => "")
    ]);

    const detail = parseShopDetail(detailHtml);
    const tel = parseShopTel(telHtml);

    return {
      ...shop,
      ...detail,
      telReal: tel.telReal
    };
  } catch (e) {
    console.error(`Error fetching shop details for ${shop.url}:`, e);
    // エラー時は基本情報のみ返す
    return { ...shop };
  }
}

// --- CSV Generation ---

function shopsToCsv(rows: ShopFull[]): string {
  // ページと電話番号(マスク)カラムを削除
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

    // 2. Fetch all list pages sequentially with delay
    const pageNumbers = Array.from({ length: maxPages }, (_, i) => i + 1);

    const allShopsNested = await processSequentially(
      pageNumbers,
      async (page) => {
        try {
          const html = page === 1 ? firstPage : await fetchListPage(keyword, page);
          const shops = parseShopsFromListPage(html)
            .map(s => ({ ...s, page }));
          console.log(`Page ${page}: found ${shops.length} shops`);
          return shops;
        } catch (e) {
          console.error(`Error fetching page ${page}:`, e);
          return [] as ShopBase[];
        }
      },
      200 // 200ms delay between page fetches
    );

    const allShops = allShopsNested.flat();
    console.log(`Total shops to process: ${allShops.length}`);

    // 3. Fetch shop details sequentially with delay
    const fullShops = await processSequentially(
      allShops,
      async (shop, index) => {
        console.log(`Fetching details ${index + 1}/${allShops.length}: ${shop.name}`);
        return fetchShopFull(shop);
      },
      150 // 150ms delay between shop detail fetches
    );

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
