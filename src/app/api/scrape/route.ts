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

// チャンク処理のレスポンス型
interface ChunkResponse {
  phase: 'collecting' | 'processing' | 'complete';
  shops?: ShopBase[];           // collecting完了時に返す
  results?: ShopFull[];         // processing時に返す
  nextIndex?: number;           // 次のチャンク開始位置
  totalShops?: number;          // 総店舗数
  csv?: string;                 // complete時に返す
  elapsedMs: number;
}

// --- Utility: Sleep ---

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Fetch: List Page ---

async function fetchListPage(keyword: string, page: number): Promise<string> {
  const encoded = encodeURIComponent(keyword);
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

// --- Parallel batch processing ---

const WORKER_COUNT = 3;
const BATCH_DELAY_MS = 30;
const CHUNK_SIZE = 15; // 1チャンクあたり15店舗（約7秒で処理）

async function processShopsBatch(shops: ShopBase[]): Promise<ShopFull[]> {
  const results: ShopFull[] = [];

  for (let i = 0; i < shops.length; i += WORKER_COUNT) {
    const batch = shops.slice(i, i + WORKER_COUNT);
    const batchResults = await Promise.all(batch.map(fetchShopFull));
    results.push(...batchResults);

    if (i + WORKER_COUNT < shops.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return results;
}

// --- Main Route Handler (チャンク対応) ---

export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    const body = await req.json();
    const { keyword, maxPages, phase, shops, startIndex } = body;

    // Phase 1: ページを取得して店舗リストを収集
    if (phase === 'collect' || !phase) {
      if (!keyword) {
        return Response.json({ error: "keyword is required" }, { status: 400 });
      }

      const firstPage = await fetchListPage(keyword, 1);
      const totalPages = parseMaxPages(firstPage);
      const pagesToFetch = Math.min(totalPages, maxPages || 5);

      const allShops: ShopBase[] = [];

      // 3並列でページを取得
      for (let i = 0; i < pagesToFetch; i += WORKER_COUNT) {
        const batch = Array.from(
          { length: Math.min(WORKER_COUNT, pagesToFetch - i) },
          (_, j) => i + j + 1
        );

        const pageResults = await Promise.all(
          batch.map(async (page) => {
            const html = page === 1 ? firstPage : await fetchListPage(keyword, page);
            return parseShopsFromListPage(html).map(s => ({ ...s, page }));
          })
        );

        for (const shops of pageResults) {
          allShops.push(...shops);
        }

        if (i + WORKER_COUNT < pagesToFetch) {
          await sleep(BATCH_DELAY_MS);
        }
      }

      const response: ChunkResponse = {
        phase: 'collecting',
        shops: allShops,
        totalShops: allShops.length,
        nextIndex: 0,
        elapsedMs: Date.now() - startTime
      };

      return Response.json(response);
    }

    // Phase 2: 店舗詳細を取得（チャンク単位）
    if (phase === 'process') {
      const shopsToProcess: ShopBase[] = shops || [];
      const idx = startIndex || 0;

      // 残りの店舗からチャンク分を処理
      const chunk = shopsToProcess.slice(idx, idx + CHUNK_SIZE);
      const results = await processShopsBatch(chunk);

      const nextIdx = idx + CHUNK_SIZE;
      const isComplete = nextIdx >= shopsToProcess.length;

      const response: ChunkResponse = {
        phase: isComplete ? 'complete' : 'processing',
        results,
        nextIndex: isComplete ? undefined : nextIdx,
        totalShops: shopsToProcess.length,
        elapsedMs: Date.now() - startTime
      };

      return Response.json(response);
    }

    return Response.json({ error: "Invalid phase" }, { status: 400 });

  } catch (error) {
    console.error(error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GETは引き続きSSEストリーミングをサポート（小規模用）
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const keyword = searchParams.get("keyword") ?? "";
  const maxPagesParam = Number(searchParams.get("maxPages") ?? "5");

  if (!keyword) {
    return new Response("keyword is required", { status: 400 });
  }

  // 小規模（2ページ以下）はそのまま処理
  const encoder = new TextEncoder();
  const startTime = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const firstPage = await fetchListPage(keyword, 1);
        const totalPages = parseMaxPages(firstPage);
        const maxPages = Math.min(totalPages, maxPagesParam);

        // ページ収集
        const allShops: ShopBase[] = [];
        for (let i = 0; i < maxPages; i += WORKER_COUNT) {
          const batch = Array.from(
            { length: Math.min(WORKER_COUNT, maxPages - i) },
            (_, j) => i + j + 1
          );

          const results = await Promise.all(
            batch.map(async (page) => {
              const html = page === 1 ? firstPage : await fetchListPage(keyword, page);
              return parseShopsFromListPage(html).map(s => ({ ...s, page }));
            })
          );

          for (const shops of results) {
            allShops.push(...shops);
          }

          send({ type: 'progress', phase: 'pages', current: Math.min(i + WORKER_COUNT, maxPages), total: maxPages, elapsedMs: Date.now() - startTime });

          if (i + WORKER_COUNT < maxPages) await sleep(BATCH_DELAY_MS);
        }

        // 詳細取得
        const fullShops: ShopFull[] = [];
        for (let i = 0; i < allShops.length; i += WORKER_COUNT) {
          const batch = allShops.slice(i, i + WORKER_COUNT);
          const results = await Promise.all(batch.map(fetchShopFull));
          fullShops.push(...results);

          send({ type: 'progress', phase: 'details', current: Math.min(i + WORKER_COUNT, allShops.length), total: allShops.length, elapsedMs: Date.now() - startTime });

          if (i + WORKER_COUNT < allShops.length) await sleep(BATCH_DELAY_MS);
        }

        const csv = shopsToCsv(fullShops);
        send({ type: 'complete', csv, totalShops: fullShops.length, elapsedMs: Date.now() - startTime });

      } catch (error) {
        send({ type: 'error', message: error instanceof Error ? error.message : 'Unknown error' });
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
