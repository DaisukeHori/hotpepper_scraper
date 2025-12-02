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

interface ProgressEvent {
  type: 'progress';
  phase: 'pages' | 'details';
  current: number;
  total: number;
  shopName?: string;
  elapsedMs: number;
}

interface CompleteEvent {
  type: 'complete';
  csv: string;
  totalShops: number;
  elapsedMs: number;
}

interface ErrorEvent {
  type: 'error';
  message: string;
}

type SSEEvent = ProgressEvent | CompleteEvent | ErrorEvent;

// --- Utility: Sleep ---

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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

function parseMaxPages(html: string): number {
  const $ = cheerio.load(html);

  let totalPages = 1;

  $("p").each((i, el) => {
    const text = $(el).text();
    const match = text.match(/(\d+)\/(\d+)ページ/);
    if (match) {
      const pages = parseInt(match[2], 10);
      if (!isNaN(pages) && pages > 0) {
        totalPages = pages;
        return false;
      }
    }
  });

  return totalPages;
}

// --- Extract salon URL from href ---

function extractSalonUrl(href: string): string | null {
  const match = href.match(/\/slnH\d+/);
  if (!match) return null;
  return "https://beauty.hotpepper.jp" + match[0];
}

// --- Parse: Shop List ---

function parseShopsFromListPage(html: string): ShopBase[] {
  const $ = cheerio.load(html);
  const rows = $(".slnCassetteList > li");
  const shops: ShopBase[] = [];
  const seenUrls = new Set<string>();

  rows.each((i, el) => {
    const $row = $(el);
    const $slnName = $row.find(".slnName");
    let name = $slnName.find("a").first().text().trim();

    const $slnImgList = $row.find(".slnImgList");
    const $firstChild = $slnImgList.children().first();
    let href = $firstChild.find("a").first().attr("href");

    if (!href) {
      href = $row.find("a[href*='/slnH']").first().attr("href");
    }

    if (!href) return;

    const url = extractSalonUrl(href);
    if (!url) return;

    if (seenUrls.has(url)) return;
    seenUrls.add(url);

    if (!name) return;

    shops.push({ name, url, page: 0 });
  });

  return shops;
}

// --- Parse: Detail Page ---

function parseShopDetail(html: string): ShopDetail {
  const $ = cheerio.load(html);
  const rows = $("table.slnDataTbl.bdCell.bgThNml.fgThNml.vaThT.pCellV10H12.mT20").find("tr");
  const out: ShopDetail = {};

  rows.each((i, el) => {
    const $row = $(el);
    const $ths = $row.find("th");
    const $tds = $row.find("td");

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
    case "電話番号": out.telMask = td; break;
    case "住所": out.address = td; break;
    case "アクセス・道案内": out.access = td; break;
    case "営業時間": out.businessHours = td; break;
    case "定休日": out.holiday = td; break;
    case "支払い方法": out.payment = td; break;
    case "カット価格": out.cutPrice = td; break;
    case "スタッフ数": out.staffCount = td; break;
    case "こだわり条件": out.features = td; break;
    case "備考": out.remark = td; break;
    case "その他": out.others = td; break;
  }
}

// --- Parse: Tel Page ---

function parseShopTel(html: string): { telReal?: string } {
  const $ = cheerio.load(html);
  let tel: string | undefined = undefined;

  $("table.wFull.bdCell.pCell10.mT15").find("tr").each((i, el) => {
    const th = $(el).find("th").text().trim();
    const td = $(el).find("td").text().trim();
    if (th === "電話番号" && td) {
      tel = td;
    }
  });

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

  if (!tel) {
    const telLink = $("a[href^='tel:']").first();
    if (telLink.length) {
      tel = telLink.attr("href")?.replace("tel:", "").trim();
    }
  }

  return { telReal: tel };
}

// --- Fetch Shop Full ---

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
    return { ...shop };
  }
}

// --- CSV Generation ---

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

// --- SSE Helper ---

function formatSSE(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

// --- Main Route Handler with SSE ---

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const keyword = searchParams.get("keyword") ?? "";
  const maxPagesParam = Number(searchParams.get("maxPages") ?? "5");

  if (!keyword) {
    return new Response("keyword is required", { status: 400 });
  }

  const encoder = new TextEncoder();
  const startTime = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SSEEvent) => {
        controller.enqueue(encoder.encode(formatSSE(event)));
      };

      try {
        // 1. Fetch 1st page to get total pages
        const firstPage = await fetchListPage(keyword, 1);
        const totalPages = parseMaxPages(firstPage);
        const maxPages = Math.min(totalPages, maxPagesParam);

        // 2. Fetch all list pages sequentially with progress
        const pageNumbers = Array.from({ length: maxPages }, (_, i) => i + 1);
        const allShops: ShopBase[] = [];

        for (let i = 0; i < pageNumbers.length; i++) {
          const page = pageNumbers[i];

          send({
            type: 'progress',
            phase: 'pages',
            current: i + 1,
            total: maxPages,
            elapsedMs: Date.now() - startTime
          });

          try {
            const html = page === 1 ? firstPage : await fetchListPage(keyword, page);
            const shops = parseShopsFromListPage(html).map(s => ({ ...s, page }));
            allShops.push(...shops);
          } catch (e) {
            console.error(`Error fetching page ${page}:`, e);
          }

          if (i < pageNumbers.length - 1) {
            await sleep(200);
          }
        }

        // 3. Fetch shop details sequentially with progress
        const fullShops: ShopFull[] = [];

        for (let i = 0; i < allShops.length; i++) {
          const shop = allShops[i];

          send({
            type: 'progress',
            phase: 'details',
            current: i + 1,
            total: allShops.length,
            shopName: shop.name,
            elapsedMs: Date.now() - startTime
          });

          try {
            const fullShop = await fetchShopFull(shop);
            fullShops.push(fullShop);
          } catch (e) {
            console.error(`Error fetching shop ${shop.name}:`, e);
            fullShops.push(shop); // 基本情報のみ追加
          }

          if (i < allShops.length - 1) {
            await sleep(150);
          }
        }

        // 4. Generate CSV and send complete event
        const csv = shopsToCsv(fullShops);

        send({
          type: 'complete',
          csv,
          totalShops: fullShops.length,
          elapsedMs: Date.now() - startTime
        });

      } catch (error) {
        console.error(error);
        send({
          type: 'error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  });
}
