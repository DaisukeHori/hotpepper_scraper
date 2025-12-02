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
// PowerQuery: RowSelector = ".slnCassetteList > LI"
//             店名 = ".slnName"
//             URL = ".slnImgList > :nth-child(1) > A:nth-child(1)" の href属性

function parseShopsFromListPage(html: string): ShopBase[] {
  const $ = cheerio.load(html);

  const rows = $(".slnCassetteList > li");

  const shops: ShopBase[] = [];
  rows.each((i, el) => {
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

    shops.push({ name, url, page: 0 });
  });

  return shops;
}

// --- Fetch + Parse: Detail Page ---
// PowerQuery: RowSelector = "TABLE.slnDataTbl.bdCell.bgThNml.fgThNml.vaThT.pCellV10H12.mT20 > * > TR"
//             Column1 = TH, Column2 = TD

function parseShopDetail(html: string): ShopDetail {
  const $ = cheerio.load(html);

  // PowerQueryと同じセレクタを使用
  const rows = $("table.slnDataTbl.bdCell.bgThNml.fgThNml.vaThT.pCellV10H12.mT20")
    .find("tr");

  const out: ShopDetail = {};

  rows.each((i, el) => {
    const $row = $(el);
    const th = $row.find("th").first().text().trim();
    const td = $row.find("td").first().text().trim();

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
// 電話番号ページ (/tel/) から実際の電話番号を取得

function parseShopTel(html: string): { telReal?: string } {
  const $ = cheerio.load(html);

  // 複数のパターンを試す
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

  // パターン4: 電話番号形式のテキストを探す（03-XXXX-XXXX, 0120-XXX-XXX など）
  if (!tel) {
    const phonePattern = /0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4}/;
    $("*").each((i, el) => {
      const text = $(el).clone().children().remove().end().text().trim();
      const match = text.match(phonePattern);
      if (match && !tel) {
        tel = match[0];
      }
    });
  }

  return { telReal: tel };
}

// --- Aggregation: Fetch Shop Full ---

async function fetchShopFull(shop: ShopBase): Promise<ShopFull> {
  // 詳細ページと電話番号ページを並列で取得
  const [detailHtml, telHtml] = await Promise.all([
    fetch(shop.url).then(r => r.text()).catch(() => ""),
    fetch(shop.url.replace(/\/$/, "") + "/tel/").then(r => r.text()).catch(() => "")
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
    "電話番号", "住所", "アクセス・道案内",
    "営業時間", "定休日", "支払い方法",
    "カット価格", "スタッフ数", "こだわり条件",
    "備考", "その他", "電話番号(実際)"
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
