import { Api } from '../api.js';
import { CONFIG } from '../config.js';
import { getAvatarUrl } from '../utils/format.js';
import { showLoading, showError } from '../utils/dom.js';

export const title = 'Head-to-Head';

export async function render(container) {
  showLoading(container);

  try {
    const seasons = [];
    let leagueId = CONFIG.LEAGUE_ID;

    while (leagueId) {
      try {
        const league = await Api.getLeague(leagueId);
        const [rosters, userMap] = await Promise.all([
          Api.getRosters(leagueId),
          Api.getUserMap(leagueId),
        ]);

        const maxWeek = league.settings?.playoff_week_start
          ? league.settings.playoff_week_start - 1
          : 14;

        const weekMatchups = [];
        for (let w = 1; w <= maxWeek; w++) {
          try {
            const matchups = await Api.getMatchups(w, leagueId);
            if (!matchups.length || matchups.every(m => !m.points)) break;
            weekMatchups.push(matchups);
          } catch { break; }
        }

        const rosterOwnerMap = {};
        for (const r of rosters) {
          rosterOwnerMap[r.roster_id] = {
            userId: r.owner_id,
            name: userMap[r.owner_id]?.name || `Team ${r.roster_id}`,
            avatar: userMap[r.owner_id]?.avatar || null,
          };
        }

        seasons.push({ league, weekMatchups, rosterOwnerMap });
        leagueId = league.previous_league_id;
      } catch { break; }
    }

    const allManagers = {};
    for (const s of seasons) {
      for (const [, owner] of Object.entries(s.rosterOwnerMap)) {
        if (!allManagers[owner.userId]) {
          allManagers[owner.userId] = { name: owner.name, avatar: owner.avatar };
        }
      }
    }

    const h2h = {};
    const managerIds = Object.keys(allManagers);
    for (const a of managerIds) {
      h2h[a] = {};
      for (const b of managerIds) {
        if (a !== b) h2h[a][b] = { wins: 0, losses: 0, ties: 0 };
      }
    }

    for (const s of seasons) {
      for (const weekData of s.weekMatchups) {
        const pairs = {};
        for (const m of weekData) {
          if (m.matchup_id == null) continue;
          if (!pairs[m.matchup_id]) pairs[m.matchup_id] = [];
          pairs[m.matchup_id].push(m);
        }

        for (const pair of Object.values(pairs)) {
          if (pair.length !== 2) continue;
          const [a, b] = pair;
          const ownerA = s.rosterOwnerMap[a.roster_id]?.userId;
          const ownerB = s.rosterOwnerMap[b.roster_id]?.userId;
          if (!ownerA || !ownerB || ownerA === ownerB) continue;
          if (!h2h[ownerA]?.[ownerB]) continue;

          const ptsA = a.points || 0;
          const ptsB = b.points || 0;

          if (ptsA > ptsB) {
            h2h[ownerA][ownerB].wins++;
            h2h[ownerB][ownerA].losses++;
          } else if (ptsB > ptsA) {
            h2h[ownerB][ownerA].wins++;
            h2h[ownerA][ownerB].losses++;
          } else {
            h2h[ownerA][ownerB].ties++;
            h2h[ownerB][ownerA].ties++;
          }
        }
      }
    }

    const currentManagers = Object.keys(allManagers).filter(uid => {
      const record = h2h[uid];
      return record && Object.values(record).some(r => r.wins + r.losses + r.ties > 0);
    });

    container.innerHTML = `
      <div class="space-y-4">
        <div class="bg-surface rounded-2xl border border-gray-800 p-4">
          <p class="text-xs text-gray-400">All-time regular season head-to-head records across ${seasons.length} season${seasons.length !== 1 ? 's' : ''}. Select a manager to see their rivalry breakdown.</p>
        </div>

        ${currentManagers.map(uid => {
          const mgr = allManagers[uid];
          const rivals = currentManagers
            .filter(r => r !== uid)
            .map(r => ({ uid: r, ...allManagers[r], ...h2h[uid][r] }))
            .filter(r => r.wins + r.losses + r.ties > 0)
            .sort((a, b) => (b.wins + b.losses + b.ties) - (a.wins + a.losses + a.ties));

          const totalW = rivals.reduce((s, r) => s + r.wins, 0);
          const totalL = rivals.reduce((s, r) => s + r.losses, 0);

          return `
            <details class="bg-surface rounded-2xl border border-gray-800 group">
              <summary class="px-5 py-3 cursor-pointer hover:bg-surface-light/50 transition-colors flex items-center gap-3">
                ${mgr.avatar
                  ? `<img src="${getAvatarUrl(mgr.avatar)}" class="w-8 h-8 rounded-full">`
                  : `<div class="w-8 h-8 rounded-full bg-gray-700 text-xs font-bold flex items-center justify-center">${mgr.name[0]}</div>`}
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-semibold">${mgr.name}</div>
                  <div class="text-xs text-gray-500">All-time: ${totalW}-${totalL}</div>
                </div>
                <svg class="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
              </summary>
              <div class="px-5 pb-4 border-t border-gray-800/50 divide-y divide-gray-800/30">
                ${rivals.map(r => {
                  const total = r.wins + r.losses + r.ties;
                  const winPct = total ? ((r.wins / total) * 100).toFixed(0) : 0;
                  return `
                    <div class="flex items-center gap-3 py-2.5">
                      <span class="text-sm w-14 font-mono font-bold ${r.wins > r.losses ? 'text-emerald-400' : r.wins < r.losses ? 'text-red-400' : 'text-gray-400'}">${r.wins}-${r.losses}${r.ties ? `-${r.ties}` : ''}</span>
                      <div class="flex-1 min-w-0">
                        <div class="text-sm truncate">${r.name}</div>
                      </div>
                      <div class="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div class="h-full rounded-full ${r.wins > r.losses ? 'bg-emerald-500' : r.wins < r.losses ? 'bg-red-500' : 'bg-gray-500'}" style="width: ${winPct}%"></div>
                      </div>
                      <span class="text-xs text-gray-500 w-8 text-right">${winPct}%</span>
                    </div>`;
                }).join('')}
              </div>
            </details>`;
        }).join('')}
      </div>`;
  } catch (err) {
    showError(container, err.message);
  }
}
