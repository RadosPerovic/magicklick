import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const args = process.argv.slice(2);
const option = name => args.find(value => value.startsWith(`${name}=`))?.slice(name.length + 1);
const base = new URL(option("--url") ?? "http://127.0.0.1:5173");
const origin = "https://magic-klick.rs";
const pages = ["/", "/drzaci-za-auto", "/drzaci-za-motor", "/hooks", "/korpa"];
const snapshotPath = new URL("../outputs/seo-before.json", import.meta.url);

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
}

function visibleMarkup(html) {
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1];
  assert.ok(body, "The response must contain server-rendered body content");
  return body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<(?:meta|link)\b[^>]*>/gi, "")
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    // React useId values may shift when an invisible script sibling is added.
    .replace(/_R_[\w-]+_/g, "REACT_ID")
    .replace(/:R[\w-]+:/g, "REACT_ID");
}

async function get(path) {
  const response = await fetch(new URL(path, base));
  const html = await response.text();
  return { response, html };
}

const loaded = {};
for (const path of pages) {
  const result = await get(path);
  assert.equal(result.response.status, 200, path);
  loaded[path] = result.html;
}

if (args.includes("--capture-baseline")) {
  await mkdir(new URL("../outputs/", import.meta.url), { recursive: true });
  await writeFile(snapshotPath, JSON.stringify(Object.fromEntries(pages.map(path => [path, visibleMarkup(loaded[path])]))));
  console.log("Captured server-rendered visible markup for all five pages.");
  process.exit(0);
}

if (args.includes("--compare-baseline")) {
  const before = JSON.parse(await readFile(snapshotPath, "utf8"));
  for (const path of pages) {
    const after = visibleMarkup(loaded[path]);
    if (after !== before[path]) {
      // Keep failures readable; HTML includes the entire application tree.
      let index = 0;
      while (index < Math.min(after.length, before[path].length) && after[index] === before[path][index]) index++;
      throw new Error(`Visible markup changed on ${path} near character ${index}`);
    }
  }
  console.log("Visible markup matches the baseline on all five pages.");
}

const expectedTitles = ["Držači za tablice bez rama", "Držači za tablice bez rama", "Držač za tablicu motora bez rama", "Kukice za auto sedišta", "Korpa"];
const titles = new Set();
const descriptions = new Set();
const assets = new Set();

for (const [index, path] of pages.entries()) {
  const html = loaded[path];
  const titleTags = [...html.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)];
  assert.equal(titleTags.length, 1, `${path}: one title`);
  const title = titleTags[0][1];
  assert.ok(title.includes(expectedTitles[index]), `${path}: descriptive SEO title`);
  assert.ok(!titles.has(title), `${path}: unique title`);
  titles.add(title);
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map(([tag]) => attributes(tag));
  const meta = name => metas.find(tag => tag.name === name || tag.property === name)?.content;
  const descriptionsOnPage = metas.filter(tag => tag.name === "description");
  assert.equal(descriptionsOnPage.length, 1, `${path}: one description`);
  assert.ok(meta("description")?.length > 50, `${path}: meaningful description`);
  assert.ok(!descriptions.has(meta("description")), `${path}: unique description`);
  descriptions.add(meta("description"));
  const canonicals = [...html.matchAll(/<link\b[^>]*>/gi)].map(([tag]) => attributes(tag)).filter(tag => tag.rel === "canonical");
  assert.equal(canonicals.length, 1, `${path}: one canonical`);
  assert.equal(new URL(canonicals[0].href).href, `${origin}${path}`, `${path}: canonical URL`);
  assert.equal(new URL(meta("og:url")).href, `${origin}${path}`, `${path}: matching Open Graph URL`);
  assert.equal(meta("og:title"), title, `${path}: matching social title`);
  assert.equal(meta("twitter:card"), "summary_large_image", `${path}: social card`);
  assets.add(new URL(meta("og:image")).pathname);
  assert.match(html, /<html\b[^>]*lang="sr-Latn"/, `${path}: language`);

  if (path === "/korpa") {
    assert.match(meta("robots"), /\bnoindex\b/, "Cart is not indexable");
    assert.doesNotMatch(meta("robots"), /\bnofollow\b/, "Cart links remain crawlable");
    assert.doesNotMatch(meta("googlebot") ?? "", /(?:^|,\s*)index(?:,|$)/, "No conflicting cart Googlebot index directive");
    continue;
  }
  assert.doesNotMatch(meta("robots") ?? "", /noindex|nofollow/, `${path}: public page is indexable`);
  assert.equal((html.match(/<h1\b/gi) ?? []).length, 1, `${path}: original main heading remains present`);
  const graphs = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap(([, json]) => {
      const data = JSON.parse(json);
      assert.equal(data["@context"], "https://schema.org");
      return data["@graph"] ?? [data];
    });
  assert.equal(graphs.filter(item => item["@type"] === "Organization").length, 1);
  assert.equal(graphs.filter(item => item["@type"] === "WebSite").length, 1);
  const webpage = graphs.find(item => item["@type"] === (path === "/" ? "WebPage" : "ItemPage"));
  assert.equal(webpage?.url, `${origin}${path}`, `${path}: schema page URL`);
  if (path !== "/") {
    const product = graphs.find(item => item["@type"] === "Product");
    assert.ok(product, `${path}: server-rendered Product schema`);
    assert.equal(product.offers.priceCurrency, "RSD");
    assert.equal(product.offers.url, `${origin}${path}`);
    assert.ok(Number(product.offers.price) > 0);
    const price = new Intl.NumberFormat("sr-RS").format(Number(product.offers.price));
    assert.ok(visibleMarkup(html).includes(price), `${path}: structured price is also visible`);
    assert.ok(visibleMarkup(html).includes(product.name), `${path}: structured product name is visible`);
    assert.ok(!product.aggregateRating && !product.review, "No invented ratings");
    product.image.forEach(url => assets.add(new URL(url).pathname));
    const breadcrumbs = graphs.find(item => item["@type"] === "BreadcrumbList");
    assert.equal(breadcrumbs?.itemListElement.at(-1).item, `${origin}${path}`);
  }
}

const { response: sitemapResponse, html: sitemap } = await get("/sitemap.xml");
assert.equal(sitemapResponse.status, 200);
assert.match(sitemapResponse.headers.get("content-type"), /xml/);
const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(([, url]) => url);
assert.deepEqual(locations.sort(), pages.filter(path => path !== "/korpa").map(path => `${origin}${path}`).sort());
assert.ok((sitemap.match(/<image:loc>/g) ?? []).length >= 3, "Sitemap includes product images");
assert.doesNotMatch(sitemap, /<lastmod>/, "No fabricated update dates");

const { response: robotsResponse, html: robots } = await get("/robots.txt");
assert.equal(robotsResponse.status, 200);
assert.match(robots, /User-Agent:\s*\*/i);
assert.match(robots, /Allow:\s*\/\s*\n/i);
assert.match(robots, /Disallow:\s*\/api\//i);
assert.match(robots, /Sitemap:\s*https:\/\/magic-klick\.rs\/sitemap\.xml/i);
assert.doesNotMatch(robots, /Disallow:\s*\/korpa/i, "Crawlers must be able to read cart noindex");

const missing = await get("/seo-provera-nepostojeca-stranica");
assert.equal(missing.response.status, 404, "Missing pages return HTTP 404");
assert.match(missing.html, /name="robots"\s+content="[^"]*noindex/, "Missing pages are not indexable");

const assetResults = await Promise.allSettled([...assets].map(async path => {
  const response = await fetch(new URL(path, base), { method: "HEAD" });
  assert.equal(response.status, 200, `SEO image exists: ${path}`);
  assert.match(response.headers.get("content-type"), /^image\//, path);
}));
for (const result of assetResults) if (result.status === "rejected") throw result.reason;
console.log(`SEO checks passed: five pages, canonical/social metadata, JSON-LD, prices, sitemap, robots, 404 and ${assets.size} images.`);
