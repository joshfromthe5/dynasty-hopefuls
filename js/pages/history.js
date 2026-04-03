import { Api } from '../api.js';
import { CONFIG } from '../config.js';
import { formatRecord, formatPoints, getAvatarUrl } from '../utils/format.js';
import { showLoading, showError } from '../utils/dom.js';

export const title = 'League History';

async function fetchLeagueChain() {
  const seasons = [];
  let leagueId = CONFIG.LEAGUE_ID;

  while (leagueId) {
    try {
      const league = await Api.getLeague(leagueId);
      const [rosters, users, winners] = await Promise.all([
        Api.getRosters(leagueId),
        Api.getUserMap(leagueId),
        Api.getWinnersBracket(leagueId).catch(() => []),
      ]);

      const sorted = [...rosters].sort((a, b) =>
        (b.settings?.wins || 0) - (a.settings?.wins || 0) || (b.settings?.fpts || 0) - (a.settings?.fpts || 0)
      );

      let championRosterId = null;
      if (league.status === 'complete' && winners.length) {
        const finals = winners.filter(m => m.p === 1);
        if (finals.length && finals[0].w) {
          championRosterId = finals[0].w;
        }
      }

      // Most points in a week (need matchup data for completed seasons)
      let highScore = null;
      if (league.status === 'complete' || league.status === 'in_season') {
        const maxWeek = league.settings?.playoff_week_start || 14;
        for (let w = 1; w <= Math.min(maxWeek, 18); w++) {
          try {
            const matchups = await Api.getMatchups(w, leagueId);
            for (const m of matchups) {
              if (m.points && (!highScore || m.points > highScore.points)) {
                highScore = { points: m.points, rosterId: m.roster_id, week: w };
              }
            }
          } catch { break; }
        }
      }

      seasons.push({
        league,
        rosters: sorted,
        users,
        championRosterId,
        highScore,
      });

      leagueId = league.previous_league_id;
    } catch {
      break;
    }
  }

  return seasons;
}

export async function render(container) {
  showLoading(container);

  try {
    const seasons = await fetchLeagueChain();

    if (!seasons.length) {
      container.innerHTML = `<p class="text-center text-gray-500 py-8">No league history found</p>`;
      return;
    }

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Champions Timeline -->
        <div class="bg-surface rounded-2xl border border-gray-800 p-5">
          <h2 class="font-bold text-lg mb-4">Champions</h2>
          <div class="space-y-4">
            ${seasons.filter(s => s.championRosterId).length
              ? seasons.filter(s => s.championRosterId).map(s => {
                const champ = s.rosters.find(r => r.roster_id === s.championRosterId);
                const champOwner = champ ? s.users[champ.owner_id] : null;
                const champName = champOwner?.name || 'Unknown';

                return `
                  <div class="flex items-center gap-4">
                    <div class="w-16 text-center">
                      <div class="text-lg font-extrabold text-emerald-400">${s.league.season}</div>
                      <div class="text-xs text-gray-500">Final</div>
                    </div>
                    <div class="w-px h-12 bg-gray-800"></div>
                    <div class="flex items-center gap-3 flex-1">
                      ${champOwner?.avatar
                        ? `<img src="${getAvatarUrl(champOwner.avatar)}" class="w-10 h-10 rounded-full object-cover" alt="">`
                        : `<div class="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold">${champName[0]}</div>`
                      }
                      <div>
                        <div class="font-semibold">${champName}</div>
                        ${champ ? `<div class="text-xs text-gray-400">${formatRecord(champ.settings?.wins || 0, champ.settings?.losses || 0, champ.settings?.ties || 0)} · ${formatPoints(champ.settings?.fpts || 0, champ.settings?.fpts_decimal)} PF</div>` : ''}
                      </div>
                    </div>
                    <svg class="w-6 h-6 text-yellow-400 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6.4-4.8-6.4 4.8 2.4-7.2-6-4.8h7.6z"/></svg>
                  </div>`;
              }).join('')
              : '<p class="text-sm text-gray-500">No completed seasons yet</p>'}
          </div>
        </div>

        <!-- Season Details -->
        ${seasons.map(s => `
          <details class="bg-surface rounded-2xl border border-gray-800 group">
            <summary class="px-5 py-3 cursor-pointer hover:bg-surface-light/50 transition-colors flex items-center justify-between">
              <div class="flex items-center gap-3">
                <span class="text-lg font-bold text-emerald-400">${s.league.season}</span>
                <span class="text-sm text-gray-400">${s.league.name}</span>
              </div>
              <svg class="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            </summary>
            <div class="px-5 pb-4 border-t border-gray-800/50">
              ${s.highScore ? `
                <div class="mt-3 mb-3 bg-gray-800/30 rounded-lg p-3 text-sm">
                  <span class="text-gray-400">High Score:</span>
                  <span class="font-semibold text-emerald-400">${s.highScore.points.toFixed(2)}</span>
                  <span class="text-gray-400">by ${s.users[s.rosters.find(r => r.roster_id === s.highScore.rosterId)?.owner_id]?.name || 'Unknown'} (Week ${s.highScore.week})</span>
                </div>
              ` : ''}
              <div class="divide-y divide-gray-800/50">
                ${s.rosters.map((r, i) => {
                  const owner = s.users[r.owner_id] || { name: `Team ${r.roster_id}` };
                  return `
                    <div class="flex items-center gap-3 py-2">
                      <span class="w-6 text-center text-sm font-bold ${i < 3 ? 'text-emerald-400' : 'text-gray-500'}">${i + 1}</span>
                      <span class="text-sm flex-1 truncate">${owner.name}</span>
                      <span class="text-sm font-medium">${formatRecord(r.settings?.wins || 0, r.settings?.losses || 0, r.settings?.ties || 0)}</span>
                      <span class="text-sm text-gray-400 w-16 text-right">${formatPoints(r.settings?.fpts || 0, r.settings?.fpts_decimal)} PF</span>
                    </div>`;
                }).join('')}
              </div>
            </div>
          </details>
        `).join('')}
      </div>`;
  } catch (err) {
    showError(container, err.message);
  }
}
