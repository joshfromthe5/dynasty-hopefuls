import { Api } from '../api.js';
import { CONFIG } from '../config.js';
import { formatRelativeTime, positionColor, getPlayerPhotoUrl, getAvatarUrl } from '../utils/format.js';
import { showLoading, showError } from '../utils/dom.js';

export const title = 'Trade Review';

export async function render(container) {
  showLoading(container);

  try {
    const [players, leagueChain] = await Promise.all([
      Api.getPlayers(),
      Api.getLeagueChain(),
    ]);

    if (!leagueChain.length) {
      showError(container, 'Could not load league data');
      return;
    }

    let selectedIdx = 0;

    function playerName(pid) {
      const p = players[pid];
      return p ? `${p.first_name} ${p.last_name}` : pid;
    }

    function playerRank(pid) {
      return players[pid]?.search_rank || null;
    }

    function sideValue(pids, picks) {
      let val = 0;
      for (const pid of pids) {
        const rank = playerRank(pid);
        if (rank && rank < 500) val += Math.max(1, 200 - rank);
      }
      for (const pick of picks) {
        const roundVal = { 1: 120, 2: 70, 3: 35, 4: 15 };
        val += roundVal[pick.round] || 10;
      }
      return val;
    }

    async function loadTrades(leagueId) {
      const trades = [];
      for (let w = 1; w <= 18; w++) {
        try {
          const txs = await Api.getTransactions(w, leagueId);
          const t = txs.filter(t => t.type === 'trade' && t.status === 'complete');
          trades.push(...t);
        } catch { break; }
      }
      trades.sort((a, b) => (b.status_updated || b.created || 0) - (a.status_updated || a.created || 0));
      return trades;
    }

    async function drawTrades() {
      const resultsEl = document.getElementById('tr-results');
      if (!resultsEl) return;
      showLoading(resultsEl);

      const season = leagueChain[selectedIdx];
      const rosterMap = await Api.getRosterMap(season.leagueId);

      function ownerInfo(rosterId) {
        const r = rosterMap[rosterId];
        return r?.owner || { name: `Team ${rosterId}`, avatar: null };
      }

      const allTrades = await loadTrades(season.leagueId);

      if (!allTrades.length) {
        resultsEl.innerHTML = `<p class="text-center text-gray-500 py-8">No trades found for ${season.season}</p>`;
        return;
      }

      resultsEl.innerHTML = `
        <div class="text-xs text-gray-500 mb-3">${allTrades.length} trade${allTrades.length !== 1 ? 's' : ''} in ${season.season}</div>
        ${allTrades.map(tx => {
          const time = formatRelativeTime(tx.status_updated || tx.created);
          const sides = (tx.roster_ids || []).map(rid => {
            const adds = Object.entries(tx.adds || {}).filter(([, r]) => r === rid).map(([pid]) => pid);
            const picksReceived = (tx.draft_picks || []).filter(p => p.owner_id === rid);
            return { rid, adds, picks: picksReceived, owner: ownerInfo(rid) };
          });

          const values = sides.map(s => sideValue(s.adds, s.picks));
          const maxVal = Math.max(...values, 1);

          return `
            <div class="bg-surface rounded-2xl border border-gray-800 p-5 mb-4">
              <div class="flex items-center justify-between mb-4">
                <span class="text-xs text-gray-500">${time}</span>
              </div>
              <div class="space-y-4">
                ${sides.map((side, i) => {
                  const isWinner = values.length === 2 && values[i] === maxVal && values[0] !== values[1];
                  return `
                    <div class="rounded-xl ${isWinner ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-gray-800/20 border border-gray-800/50'} p-3">
                      <div class="flex items-center gap-2 mb-2">
                        ${side.owner.avatar
                          ? `<img src="${getAvatarUrl(side.owner.avatar)}" class="w-6 h-6 rounded-full">`
                          : `<div class="w-6 h-6 rounded-full bg-gray-700 text-xs font-bold flex items-center justify-center">${side.owner.name[0]}</div>`}
                        <span class="text-sm font-semibold">${side.owner.name}</span>
                        ${isWinner ? '<span class="text-xs font-bold text-emerald-400 ml-auto">WINNER</span>' : ''}
                      </div>
                      <div class="text-xs text-gray-400 mb-1">Received:</div>
                      <div class="space-y-1">
                        ${side.adds.map(pid => {
                          const pos = players[pid]?.position || '?';
                          const rank = playerRank(pid);
                          return `
                            <a href="#player/${pid}" class="flex items-center gap-2 hover:bg-gray-800/40 rounded-lg p-1 transition-colors">
                              <img src="${getPlayerPhotoUrl(pid)}" class="w-6 h-6 rounded-full object-cover bg-gray-800 shrink-0" alt="" onerror="this.style.display='none'">
                              <span class="text-xs font-semibold ${positionColor(pos)}">${pos}</span>
                              <span class="text-sm flex-1 truncate">${playerName(pid)}</span>
                              ${rank && rank < 500 ? `<span class="text-xs text-gray-500">#${rank}</span>` : ''}
                            </a>`;
                        }).join('')}
                        ${side.picks.map(p => `
                          <div class="flex items-center gap-2 p-1">
                            <div class="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs">📋</div>
                            <span class="text-sm">${p.season} Round ${p.round} pick</span>
                          </div>
                        `).join('')}
                        ${!side.adds.length && !side.picks.length ? '<div class="text-xs text-gray-600 p-1">Nothing</div>' : ''}
                      </div>
                    </div>`;
                }).join('')}
              </div>
            </div>`;
        }).join('')}`;
    }

    container.innerHTML = `
      <div class="space-y-4">
        <div class="bg-surface rounded-2xl border border-gray-800 p-4">
          <div class="flex items-center justify-between">
            <p class="text-xs text-gray-400">Review past trades and see which side came out ahead based on current player values.</p>
            <select id="tr-season" class="bg-surface-light border border-gray-700 rounded-lg text-sm text-gray-200 px-3 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer">
              ${leagueChain.map((s, i) => `<option value="${i}" ${i === selectedIdx ? 'selected' : ''}>${s.season}</option>`).join('')}
            </select>
          </div>
        </div>
        <div id="tr-results"></div>
      </div>`;

    document.getElementById('tr-season').addEventListener('change', (e) => {
      selectedIdx = parseInt(e.target.value);
      drawTrades();
    });

    drawTrades();
  } catch (err) {
    showError(container, err.message);
  }
}
