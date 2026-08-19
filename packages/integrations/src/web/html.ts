/**
 * Tiny dependency-free HTML parser for page analysis (MVP crawler-lite).
 * Extracts only what the PageAnalysisProvider needs: title, canonical,
 * meta description, robots signal, headings, text excerpt, outbound links
 * and a page-type heuristic. Handles charset meta tags and unknown encodings
 * defensively; never throws on malformed markup.
 */

export interface ParsedPage {
  title: string | null;
  canonical: string | null;
  description: string | null;
  /** from <meta name="robots"> / X-Robots-Tag equivalents. */
  robots: 'INDEXED' | 'PARTIAL' | 'NOT_INDEXED' | 'UNKNOWN';
  headings: string[];
  text: string;
  wordCount: number;
  outboundLinks: { total: number; external: number };
}

const TAG_SKIP = new Set([
  'script',
  'style',
  'noscript',
  'template',
  'svg',
  'head',
  'iframe',
  'form',
  'nav',
  'footer',
  'header',
]);

export function parseHtmlDocument(html: string): ParsedPage {
  const charset = detectCharset(html);
  const text = decodeHtml(html, charset);

  const title = firstMeta(text, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const canonical = firstMeta(text, /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  const description = firstMeta(
    text,
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i,
  );
  const robotsMeta = firstMeta(text, /<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)["']/i);

  const headings = [...text.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)]
    .map((match) =>
      stripTags(match[2] ?? '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((heading) => heading !== '')
    .slice(0, 20);

  const body = bodyContent(text);
  const visible = stripTags(body).replace(/\s+/g, ' ').trim();
  const wordCount = visible === '' ? 0 : visible.split(' ').length;

  const outbound = countOutboundLinks(text);
  return {
    title: clean(title),
    canonical: clean(canonical),
    description: clean(description),
    robots: robotsFrom(robotsMeta),
    headings,
    text: visible.slice(0, 12_000),
    wordCount,
    outboundLinks: outbound,
  };
}

/** Content-type/robots header -> indexation signal (used by the provider). */
export function indexationFromHeaders(headers: Headers): 'INDEXED' | 'PARTIAL' | 'NOT_INDEXED' {
  const robots = headers.get('x-robots-tag');
  if (robots === null) return 'INDEXED';
  const value = robots.toLowerCase();
  if (value.includes('noindex') || value.includes('none')) return 'NOT_INDEXED';
  if (value.includes('noindex,follow') || value.includes('noarchive')) return 'PARTIAL';
  return 'INDEXED';
}

/** Heuristic page-type classification from parsed content (MVP). */
export function guessPageType(
  page: ParsedPage,
):
  | 'EDITORIAL'
  | 'RESOURCE'
  | 'BLOG'
  | 'PRODUCT'
  | 'PROFILE'
  | 'LISTING'
  | 'NEWS'
  | 'CATEGORY'
  | 'OTHER' {
  const url = page.canonical ?? '';
  if (/\b(katalog|каталог|catalog|directory|list|список)\b/.test(url) || page.wordCount < 250) {
    if (page.wordCount < 250 && page.wordCount > 0) return 'LISTING';
  }
  if (/\b(категори|category|catalog|каталог)\b/.test(url)) return 'CATEGORY';
  if (/\b(blog|блог|стать|article|magazine|журнал)\b/.test(url)) return 'BLOG';
  if (/\b(news|новост|новост)\b/.test(url)) return 'NEWS';
  if (/\b(profile|профиль|company|компани|about|о компании)\b/.test(url)) return 'PROFILE';
  if (/\b(product|товар|купить|buy|product)\b/.test(url)) return 'PRODUCT';
  if (page.wordCount >= 400) return 'EDITORIAL';
  if (page.wordCount > 0 && page.wordCount < 120) return 'PROFILE';
  return 'OTHER';
}

function bodyContent(html: string): string {
  const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  let body = bodyMatch === null ? html : (bodyMatch[1] ?? html);
  // Strip script/style/etc. blocks before text extraction.
  for (const tag of TAG_SKIP) {
    body = body.replace(new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi'), ' ');
  }
  return body;
}

function countOutboundLinks(html: string): { total: number; external: number } {
  const links = [...html.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => match[1] ?? '')
    .filter((href) => href !== '');
  let external = 0;
  const total = links.length;
  for (const href of links) {
    if (/^(https?:)?\/\//.test(href) || href.startsWith('www.')) external += 1;
  }
  return { total, external };
}

function robotsFrom(value: string | null): 'INDEXED' | 'PARTIAL' | 'NOT_INDEXED' | 'UNKNOWN' {
  if (value === null) return 'UNKNOWN';
  const lowered = value.toLowerCase();
  if (lowered.includes('noindex') || lowered.includes('none')) return 'NOT_INDEXED';
  if (lowered.includes('noindex,follow')) return 'PARTIAL';
  return 'INDEXED';
}

function firstMeta(html: string, pattern: RegExp): string | null {
  const match = pattern.exec(html);
  return match === null ? null : (match[1] ?? null);
}

function clean(value: string | null): string | null {
  if (value === null) return null;
  const cleaned = stripTags(value).replace(/\s+/g, ' ').trim();
  return cleaned === '' ? null : cleaned;
}

function detectCharset(html: string): string {
  const match = /<meta[^>]*charset=["']?([a-z0-9-]+)/i.exec(html);
  return match === null ? 'utf-8' : (match[1] ?? 'utf-8');
}

function decodeHtml(html: string, charset: string): string {
  let decoded: string;
  try {
    const normalized = charset.toLowerCase().replace(/[^a-z0-9-]/g, '');
    const label = normalized === '' ? 'utf-8' : normalized;
    decoded = new TextDecoder(label).decode(new TextEncoder().encode(html));
  } catch {
    decoded = html;
  }
  // ASCII entity decoding; high-codepoint entities would need a full table.
  return decoded
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
