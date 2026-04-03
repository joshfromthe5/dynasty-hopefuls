const RSS_FEEDS = [
  { url: 'https://www.espn.com/espn/rss/nfl/news', source: 'ESPN' },
  { url: 'https://www.cbssports.com/rss/headlines/nfl/', source: 'CBS Sports' },
  { url: 'https://profootballtalk.nbcsports.com/feed/', source: 'ProFootballTalk' },
  { url: 'https://sports.yahoo.com/nfl/rss.xml', source: 'Yahoo Sports' },
  { url: 'https://www.pff.com/feed', source: 'PFF' },
];

let cachedResult = null;
let cacheTimestamp = 0;
const CACHE_TTL = 10 * 60 * 1000;

function parseRSSItems(xmlText, source) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemXml = match[1];
    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link') || extractStandaloneLink(itemXml);
    const description = stripHtml(extractTag(itemXml, 'description'));
    const pubDate = extractTag(itemXml, 'pubDate');

    if (title) {
      items.push({ title, link, description, pubDate, source });
    }
  }

  return items;
}

function extractTag(xml, tag) {
  const cdataMatch = new RegExp(`<${tag}>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, 'i').exec(xml);
  if (cdataMatch) return cdataMatch[1].trim();
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(xml);
  return match ? match[1].trim() : '';
}

function extractStandaloneLink(xml) {
  const match = /<link[^>]*\/?\s*>\s*(https?:\/\/[^\s<]+)/i.exec(xml);
  return match ? match[1].trim() : '';
}

function stripHtml(html) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

export default async (req) => {
  if (cachedResult && Date.now() - cacheTimestamp < CACHE_TTL) {
    return new Response(JSON.stringify(cachedResult), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=600',
      },
    });
  }

  const allArticles = [];

  const results = await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(feed.url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'SleeperLeagueSite/1.0' },
        });
        clearTimeout(timeout);

        if (!res.ok) return [];
        const text = await res.text();
        return parseRSSItems(text, feed.source);
      } catch {
        return [];
      }
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      allArticles.push(...result.value);
    }
  }

  allArticles.sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return db - da;
  });

  const limited = allArticles.slice(0, 100);

  cachedResult = limited;
  cacheTimestamp = Date.now();

  return new Response(JSON.stringify(limited), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=600',
    },
  });
};

export const config = {
  path: '/.netlify/functions/news',
};
