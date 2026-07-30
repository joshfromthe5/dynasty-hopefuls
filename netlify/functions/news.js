import { getStore } from '@netlify/blobs';

const RSS_FEEDS = [
  { url: 'https://www.espn.com/espn/rss/nfl/news', source: 'ESPN' },
  { url: 'https://www.cbssports.com/rss/headlines/nfl/', source: 'CBS Sports' },
  { url: 'https://profootballtalk.nbcsports.com/feed/', source: 'ProFootballTalk' },
  { url: 'https://sports.yahoo.com/nfl/rss.xml', source: 'Yahoo Sports' },
  { url: 'https://www.pff.com/feed', source: 'PFF' },
];

const ARCHIVE_KEY = 'nfl-news-archive';
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const FETCH_CACHE_TTL = 10 * 60 * 1000; // don't refetch RSS more than every 10 min

let memoryCache = null;
let memoryCacheTimestamp = 0;

function parseRSSItems(xmlText, source) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemXml = match[1];
    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link') || extractStandaloneLink(itemXml);
    const description = stripHtml(extractTag(itemXml, 'description')).slice(0, 300);
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

function articleKey(article) {
  return (article.link || article.title || '').trim().toLowerCase();
}

function articleAge(article) {
  if (!article.pubDate) return 0;
  const t = new Date(article.pubDate).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function pruneAndMerge(existing, fresh) {
  const cutoff = Date.now() - RETENTION_MS;
  const map = new Map();

  for (const article of [...existing, ...fresh]) {
    const key = articleKey(article);
    if (!key) continue;
    const age = articleAge(article);
    // Keep articles without dates if they just arrived; drop undated ones older than archive merge
    if (age && age < cutoff) continue;
    if (!map.has(key) || articleAge(article) > articleAge(map.get(key))) {
      map.set(key, article);
    }
  }

  return [...map.values()].sort((a, b) => articleAge(b) - articleAge(a));
}

async function loadArchive() {
  try {
    const store = getStore('news');
    const data = await store.get(ARCHIVE_KEY, { type: 'json' });
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function saveArchive(articles) {
  try {
    const store = getStore('news');
    await store.setJSON(ARCHIVE_KEY, articles);
  } catch {
    // Blobs unavailable (e.g. local without netlify dev) — skip persist
  }
}

async function fetchFreshArticles() {
  const allArticles = [];
  const results = await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(feed.url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'HopefulsDynasty/1.0' },
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
  return allArticles;
}

export default async () => {
  if (memoryCache && Date.now() - memoryCacheTimestamp < FETCH_CACHE_TTL) {
    return new Response(JSON.stringify(memoryCache), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=600',
      },
    });
  }

  const [archive, fresh] = await Promise.all([
    loadArchive(),
    fetchFreshArticles(),
  ]);

  const merged = pruneAndMerge(archive, fresh);

  // Persist whenever we got new articles (or pruning changed the set)
  if (fresh.length || merged.length !== archive.length) {
    await saveArchive(merged);
  }

  memoryCache = merged;
  memoryCacheTimestamp = Date.now();

  return new Response(JSON.stringify(merged), {
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
