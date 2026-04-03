import { Api } from '../api.js';
import { CONFIG } from '../config.js';
import { formatRecord, formatPoints, getAvatarUrl, positionColor, getPlayerPhotoUrl } from '../utils/format.js';
import { showLoading, showError } from '../utils/dom.js';

export const title = (param) => 'Manager Profile';

export async function render(container, userId) {
  if (!userId) {
    container.innerHTML = `<p class="text-center text-gray-500 py-8">No manager selected</p>`;
    return;
  }

  showLoading(container);

  try {
    const seasonData = [];
    let leagueId = CONFIG.LEAGUE_ID;
    let managerName = 'Unknown';
    let managerAvatar = null;

    while (leagueId) {
      try {
        const league = await Api.getLeague(leagueId);
        const [rosters, userMap, winners] = await Promise.all([
          Api.getRosters(leagueId),
          Api.getUserMap(leagueId),
          Api.getWinnersBracket(leagueId).catch(() => []),
        ]);

        const roster = rosters.find(r => r.owner_id === userId);
        if (!roster) { leagueId = league.previous_league_id; continue; }

        const user = userMap[userId];
        if (user) {
          managerName = user.name;
          if (user.avatar) managerAvatar = user.avatar;
        }

        let isChampion = false;
        if (winners.length) {
          const finals = winners.filter(m => m.p === 1);
          if (finals.length && finals[0].w === roster.roster_id) isChampion = true;
        }

        const sorted = [...rosters].sort((a, b) =>
          (b.settings?.wins || 0) - (a.settings?.wins || 0) || (b.settings?.fpts || 0) - (a.settings?.fpts || 0)
        );
        const finish = sorted.findIndex(r => r.roster_id === roster.roster_id) + 1;

        seasonData.push({
          season: league.season,
          wins: roster.settings?.wins || 0,
          losses: roster.settings?.losses || 0,
          ties: roster.settings?.ties || 0,
          fpts: roster.settings?.fpts || 0,
          fpts_decimal: roster.settings?.fpts_decimal || 0,
          fpts_against: roster.settings?.fpts_against || 0,
          fpts_against_decimal: roster.settings?.fpts_against_decimal || 0,
          isChampion,
          finish,
          totalTeams: rosters.length,
          rosterId: roster.roster_id,
          leagueId: league.league_id,
        });

        leagueId = league.previous_league_id;
      } catch { break; }
    }

    const totalWins = seasonData.reduce((s, d) => s + d.wins, 0);
    const totalLosses = seasonData.reduce((s, d) => s + d.losses, 0);
    const totalTies = seasonData.reduce((s, d) => s + d.ties, 0);
    const totalPF = seasonData.reduce((s, d) => s + d.fpts + (d.fpts_decimal || 0) / 100, 0);
    const championships = seasonData.filter(d => d.isChampion).length;
    const bestFinish = seasonData.length ? Math.min(...seasonData.map(d => d.finish)) : null;

    const [currentRosters, players] = await Promise.all([
      Api.getRosters(),
      Api.getPlayers(),
    ]);
    const currentRoster = currentRosters.find(r => r.owner_id === userId);
    const rosterPlayers = currentRoster
      ? (currentRoster.players || [])
          .map(pid => ({ id: pid, ...players[pid] }))
          .filter(p => p.position && !['OL', 'OT', 'OG', 'C', 'LS', 'P'].includes(p.position))
          .sort((a, b) => (a.search_rank || 9999) - (b.search_rank || 9999))
      : [];

    let trades = [];
    try {
      const nflState = await Api.getNflState();
      const maxWeek = nflState.display_week || 18;
      for (let w = 1; w <= maxWeek; w++) {
        const txs = await Api.getTransactions(w);
        const mgrTrades = txs.filter(t =>
          t.type === 'trade' && t.status === 'complete' &&
          currentRoster && t.roster_ids?.includes(currentRoster.roster_id)
        );
        trades.push(...mgrTrades);
      }
    } catch {}

    function ordinal(n) {
      const s = ['th', 'st', 'nd', 'rd'];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }

    container.innerHTML = `
      <div class="space-y-4">
        <button onclick="history.back()" class="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          Back
        </button>

        <!-- Manager Header -->
        <div class="bg-surface rounded-2xl border border-gray-800 p-5">
          <div class="flex items-center gap-4">
            ${managerAvatar
              ? `<img src="${getAvatarUrl(managerAvatar, false)}" class="w-16 h-16 rounded-xl object-cover">`
              : `<div class="w-16 h-16 rounded-xl bg-gray-700 flex items-center justify-center text-2xl font-bold">${managerName[0]}</div>`}
            <div>
              <h1 class="text-xl font-bold">${managerName}</h1>
              <div class="text-sm text-gray-400 mt-1">${seasonData.length} season${seasonData.length !== 1 ? 's' : ''} · ${formatRecord(totalWins, totalLosses, totalTies)}</div>
              <div class="flex gap-2 mt-2">
                ${championships ? `<span class="text-xs font-bold px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400">${championships}x Champion</span>` : ''}
                ${bestFinish ? `<span class="text-xs px-2 py-1 rounded-full bg-gray-800 text-gray-300">Best: ${ordinal(bestFinish)}</span>` : ''}
              </div>
            </div>
          </div>
        </div>

        <!-- All-Time Stats -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="bg-surface rounded-xl border border-gray-800 p-4 text-center">
            <div class="text-xs text-gray-500">Record</div>
            <div class="text-lg font-bold mt-1">${formatRecord(totalWins, totalLosses, totalTies)}</div>
          </div>
          <div class="bg-surface rounded-xl border border-gray-800 p-4 text-center">
            <div class="text-xs text-gray-500">Win %</div>
            <div class="text-lg font-bold mt-1">${totalWins + totalLosses ? ((totalWins / (totalWins + totalLosses)) * 100).toFixed(1) : 0}%</div>
          </div>
          <div class="bg-surface rounded-xl border border-gray-800 p-4 text-center">
            <div class="text-xs text-gray-500">Total PF</div>
            <div class="text-lg font-bold mt-1">${totalPF.toFixed(1)}</div>
          </div>
          <div class="bg-surface rounded-xl border border-gray-800 p-4 text-center">
            <div class="text-xs text-gray-500">Trades</div>
            <div class="text-lg font-bold mt-1">${trades.length}</div>
          </div>
        </div>

        <!-- Season History -->
        <div class="bg-surface rounded-2xl border border-gray-800 p-5">
          <h2 class="font-semibold mb-3">Season History</h2>
          <div class="divide-y divide-gray-800/50">
            ${seasonData.map(s => `
              <div class="flex items-center gap-3 py-2.5">
                <span class="text-sm font-bold text-emerald-400 w-12">${s.season}</span>
                <span class="text-sm font-medium w-16">${formatRecord(s.wins, s.losses, s.ties)}</span>
                <span class="text-xs text-gray-400 flex-1">${formatPoints(s.fpts, s.fpts_decimal)} PF</span>
                <span class="text-xs text-gray-500">${ordinal(s.finish)}</span>
                ${s.isChampion ? '<span class="text-yellow-400">🏆</span>' : ''}
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Current Roster -->
        ${rosterPlayers.length ? `
        <div class="bg-surface rounded-2xl border border-gray-800 p-5">
          <h2 class="font-semibold mb-3">Current Roster</h2>
          <div class="divide-y divide-gray-800/30">
            ${rosterPlayers.slice(0, 20).map(p => {
              const pos = p.position || '?';
              return `
                <a href="#player/${p.id}" class="flex items-center gap-2.5 py-2 hover:bg-gray-800/30 transition-colors rounded-lg px-1">
                  <img src="${getPlayerPhotoUrl(p.id)}" class="w-7 h-7 rounded-full object-cover bg-gray-800 shrink-0" alt="" onerror="this.style.display='none'">
                  <span class="text-xs font-semibold ${positionColor(pos)} w-6">${pos}</span>
                  <span class="text-sm flex-1 truncate">${p.first_name} ${p.last_name}</span>
                  <span class="text-xs text-gray-500">${p.team || 'FA'}</span>
                </a>`;
            }).join('')}
            ${rosterPlayers.length > 20 ? `<p class="text-xs text-gray-500 py-2 text-center">+${rosterPlayers.length - 20} more</p>` : ''}
          </div>
        </div>
        ` : ''}
      </div>`;
  } catch (err) {
    showError(container, err.message);
  }
}
