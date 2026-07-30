import { Api } from '../api.js';
import { formatRelativeTime, positionColor, getPlayerPhotoUrl, getAvatarUrl } from '../utils/format.js';
import { showLoading, showError } from '../utils/dom.js';

export const title = 'Trade Review';

function formatValue(n) {
  return Math.round(n).toLocaleString();
}

function pickValue(pick, dynastyValues) {
  const season = String(pick.season);
  const round = String(pick.round);

  // Prefer Mid for unknown slot (typical traded future pick)
  const candidates = [
    `pick_${season}_${round}_mid`,
    `pick_${season}_${round}_early`,
    `pick_${season}_${round}_late`,
  ];

  for (const id of candidates) {
    const match = dynastyValues.find(v => v.sleeper_id === id);
    if (match) return match.current_value || 0;
  }

  const byName = dynastyValues.find(v =>
    v.position === 'PICK' &&
    v.name?.includes(season) &&
    (v.name.includes(`Round ${round}`) || v.name.includes(` ${round}.`))
  );
  return byName?.current_value || 0;
}

export async function render(container) {
  showLoading(container);

  try {
    const [players, leagueChain, dynastyValues] = await Promise.all([
      Api.getPlayers(),
      Api.getLeagueChain(),
      Api.getDynastyValues().catch(() => []),
    ]);

    if (!leagueChain.length) {
      showError(container, 'Could not load league data');
      return;
    }

    const valueById = {};
    for (const v of dynastyValues) {
      if (v.sleeper_id) valueById[v.sleeper_id] = v.current_value || 0;
    }

    let selectedIdx = 0;

    function playerName(pid) {
      const p = players[pid];
      return p ? `${p.first_name} ${p.last_name}` : pid;
    }

    function playerValue(pid) {
      return valueById[pid] || 0;
    }

    function sideValue(pids, picks) {
      let val = 0;
      for (const pid of pids) val += playerValue(pid);
      for (const pick of picks) val += pickValue(pick, dynastyValues);
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
        <div class="text-xs text-gray-500 mb-3">${allTrades.length} trade${allTrades.length !== 1 ? 's' : ''} in ${season.season} · valued with current Dynasty Dealer numbers</div>
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
                ${values.length === 2 ? `<span class="text-xs text-gray-600">${formatValue(values[0])} vs ${formatValue(values[1])}</span>` : ''}
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
                        <span class="text-xs text-gray-500 ml-auto">${formatValue(values[i])}</span>
                        ${isWinner ? '<span class="text-xs font-bold text-emerald-400">WINNER</span>' : ''}
                      </div>
                      <div class="text-xs text-gray-400 mb-1">Received:</div>
                      <div class="space-y-1">
                        ${side.adds.map(pid => {
                          const pos = players[pid]?.position || '?';
                          const val = playerValue(pid);
                          return `
                            <a href="#player/${pid}" class="flex items-center gap-2 hover:bg-gray-800/40 rounded-lg p-1 transition-colors">
                              <img src="${getPlayerPhotoUrl(pid)}" class="w-6 h-6 rounded-full object-cover bg-gray-800 shrink-0" alt="" onerror="this.style.display='none'">
                              <span class="text-xs font-semibold ${positionColor(pos)}">${pos}</span>
                              <span class="text-sm flex-1 truncate">${playerName(pid)}</span>
                              ${val ? `<span class="text-xs text-emerald-400">${formatValue(val)}</span>` : '<span class="text-xs text-gray-600">—</span>'}
                            </a>`;
                        }).join('')}
                        ${side.picks.map(p => {
                          const val = pickValue(p, dynastyValues);
                          return `
                          <div class="flex items-center gap-2 p-1">
                            <div class="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs">📋</div>
                            <span class="text-sm flex-1">${p.season} Round ${p.round} pick</span>
                            ${val ? `<span class="text-xs text-emerald-400">${formatValue(val)}</span>` : ''}
                          </div>`;
                        }).join('')}
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
          <div class="flex items-center justify-between gap-3">
            <p class="text-xs text-gray-400">Past trades graded with live <a href="https://www.dynastydealer.com" target="_blank" rel="noopener" class="text-emerald-400 hover:underline">Dynasty Dealer</a> values (current market, not at the time of the trade).</p>
            <select id="tr-season" class="bg-surface-light border border-gray-700 rounded-lg text-sm text-gray-200 px-3 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer shrink-0">
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
