import { CONFIG } from './config.js';

const cache = {};

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error ${res.status}: ${url}`);
  return res.json();
}

function getCachedPlayers() {
  try {
    const raw = localStorage.getItem('sleeper_players');
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CONFIG.PLAYER_CACHE_TTL) return null;
    return data;
  } catch {
    return null;
  }
}

function setCachedPlayers(data) {
  try {
    localStorage.setItem('sleeper_players', JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    // localStorage full or unavailable
  }
}

export const Api = {

  async getLeague(leagueId) {
    const id = leagueId || CONFIG.LEAGUE_ID;
    const key = `league_${id}`;
    if (cache[key]) return cache[key];
    const data = await fetchJSON(`${CONFIG.BASE_URL}/league/${id}`);
    cache[key] = data;
    return data;
  },

  async getRosters(leagueId) {
    const id = leagueId || CONFIG.LEAGUE_ID;
    const key = `rosters_${id}`;
    if (cache[key]) return cache[key];
    const data = await fetchJSON(`${CONFIG.BASE_URL}/league/${id}/rosters`);
    cache[key] = data;
    return data;
  },

  async getUsers(leagueId) {
    const id = leagueId || CONFIG.LEAGUE_ID;
    const key = `users_${id}`;
    if (cache[key]) return cache[key];
    const data = await fetchJSON(`${CONFIG.BASE_URL}/league/${id}/users`);
    cache[key] = data;
    return data;
  },

  async getMatchups(week, leagueId) {
    const id = leagueId || CONFIG.LEAGUE_ID;
    const key = `matchups_${id}_${week}`;
    if (cache[key]) return cache[key];
    const data = await fetchJSON(`${CONFIG.BASE_URL}/league/${id}/matchups/${week}`);
    cache[key] = data;
    return data;
  },

  async getTransactions(week, leagueId) {
    const id = leagueId || CONFIG.LEAGUE_ID;
    const key = `transactions_${id}_${week}`;
    if (cache[key]) return cache[key];
    const data = await fetchJSON(`${CONFIG.BASE_URL}/league/${id}/transactions/${week}`);
    cache[key] = data;
    return data;
  },

  async getWinnersBracket(leagueId) {
    const id = leagueId || CONFIG.LEAGUE_ID;
    const key = `winners_${id}`;
    if (cache[key]) return cache[key];
    const data = await fetchJSON(`${CONFIG.BASE_URL}/league/${id}/winners_bracket`);
    cache[key] = data;
    return data;
  },

  async getLosersBracket(leagueId) {
    const id = leagueId || CONFIG.LEAGUE_ID;
    const key = `losers_${id}`;
    if (cache[key]) return cache[key];
    const data = await fetchJSON(`${CONFIG.BASE_URL}/league/${id}/losers_bracket`);
    cache[key] = data;
    return data;
  },

  async getTradedPicks(leagueId) {
    const id = leagueId || CONFIG.LEAGUE_ID;
    const key = `traded_picks_${id}`;
    if (cache[key]) return cache[key];
    const data = await fetchJSON(`${CONFIG.BASE_URL}/league/${id}/traded_picks`);
    cache[key] = data;
    return data;
  },

  async getDrafts(leagueId) {
    const id = leagueId || CONFIG.LEAGUE_ID;
    const key = `drafts_${id}`;
    if (cache[key]) return cache[key];
    const data = await fetchJSON(`${CONFIG.BASE_URL}/league/${id}/drafts`);
    cache[key] = data;
    return data;
  },

  async getDraftPicks(draftId) {
    const key = `draft_picks_${draftId}`;
    if (cache[key]) return cache[key];
    const data = await fetchJSON(`${CONFIG.BASE_URL}/draft/${draftId}/picks`);
    cache[key] = data;
    return data;
  },

  async getNflState() {
    if (cache.nflState) return cache.nflState;
    const data = await fetchJSON(`${CONFIG.BASE_URL}/state/nfl`);
    cache.nflState = data;
    return data;
  },

  async getPlayers() {
    const cached = getCachedPlayers();
    if (cached) return cached;
    if (cache.players) return cache.players;
    const data = await fetchJSON(`${CONFIG.BASE_URL}/players/nfl`);
    cache.players = data;
    setCachedPlayers(data);
    return data;
  },

  async getNews() {
    const key = 'news';
    if (cache[key] && cache[key].timestamp && Date.now() - cache[key].timestamp < CONFIG.NEWS_CACHE_TTL) {
      return cache[key].data;
    }

    // Try Netlify function first (works in production)
    try {
      const data = await fetchJSON('/.netlify/functions/news');
      cache[key] = { data, timestamp: Date.now() };
      return data;
    } catch {
      // Netlify function unavailable (local dev) -- fall back to rss2json.com
    }

    try {
      const feeds = [
        'https://www.espn.com/espn/rss/nfl/news',
        'https://www.cbssports.com/rss/headlines/nfl/',
        'https://profootballtalk.nbcsports.com/feed/',
        'https://www.pff.com/feed',
      ];
      const sourceNames = ['ESPN', 'CBS Sports', 'ProFootballTalk', 'PFF'];
      const results = await Promise.allSettled(
        feeds.map(async (url, i) => {
          const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`);
          if (!res.ok) return [];
          const json = await res.json();
          if (json.status !== 'ok') return [];
          return (json.items || []).map(item => ({
            title: item.title,
            link: item.link,
            description: (item.description || '').replace(/<[^>]*>/g, '').slice(0, 200),
            pubDate: item.pubDate,
            source: sourceNames[i],
          }));
        })
      );

      const articles = [];
      for (const r of results) {
        if (r.status === 'fulfilled') articles.push(...r.value);
      }
      articles.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));
      const limited = articles.slice(0, 100);
      cache[key] = { data: limited, timestamp: Date.now() };
      return limited;
    } catch {
      return [];
    }
  },

  // Walk the previous_league_id chain to build season list
  async getLeagueChain() {
    const key = 'leagueChain';
    if (cache[key]) return cache[key];

    const seasons = [];
    let leagueId = CONFIG.LEAGUE_ID;

    while (leagueId) {
      try {
        const league = await this.getLeague(leagueId);
        seasons.push({ leagueId, season: league.season, name: league.name, status: league.status, league });
        leagueId = league.previous_league_id;
      } catch {
        break;
      }
    }

    cache[key] = seasons;
    return seasons;
  },

  // Build a lookup of owner_id -> user display info
  async getUserMap(leagueId) {
    const users = await this.getUsers(leagueId);
    const map = {};
    for (const u of users) {
      map[u.user_id] = {
        name: u.metadata?.team_name || u.display_name || u.username,
        avatar: u.avatar,
        userId: u.user_id,
      };
    }
    return map;
  },

  // Build roster_id -> { owner info, roster data } map
  async getRosterMap(leagueId) {
    const [rosters, userMap] = await Promise.all([
      this.getRosters(leagueId),
      this.getUserMap(leagueId),
    ]);
    const map = {};
    for (const r of rosters) {
      map[r.roster_id] = {
        ...r,
        owner: userMap[r.owner_id] || { name: `Team ${r.roster_id}`, avatar: null },
      };
    }
    return map;
  },

  // Build player_id -> roster_id lookup
  async getPlayerOwnershipMap(leagueId) {
    const rosters = await this.getRosters(leagueId);
    const map = {};
    for (const r of rosters) {
      for (const pid of (r.players || [])) {
        map[pid] = r.roster_id;
      }
    }
    return map;
  },

  async getRookieProfiles() {
    if (cache.rookieProfiles) return cache.rookieProfiles;
    const data = await fetchJSON('/data/rookies.json');
    cache.rookieProfiles = data;
    return data;
  },

  clearCache() {
    Object.keys(cache).forEach(k => delete cache[k]);
  },
};
