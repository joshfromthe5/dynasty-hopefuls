import { Api } from '../api.js';
import { formatRelativeTime, positionColor } from '../utils/format.js';
import { showLoading, showError } from '../utils/dom.js';

export const title = 'Transactions';

export async function render(container) {
  try {
    const [nflState, rosterMap] = await Promise.all([
      Api.getNflState(),
      Api.getRosterMap(),
    ]);

    const currentWeek = nflState.display_week || nflState.week || 1;
    let selectedWeek = currentWeek;

    let players = null;
    try { players = await Api.getPlayers(); } catch {}

    function playerName(pid) {
      const p = players?.[pid];
      return p ? `${p.first_name} ${p.last_name}` : pid;
    }

    function playerPos(pid) {
      const p = players?.[pid];
      return p?.position || p?.fantasy_positions?.[0] || '';
    }

    function ownerName(rosterId) {
      return rosterMap[rosterId]?.owner?.name || `Team ${rosterId}`;
    }

    async function drawTransactions() {
      const txContainer = document.getElementById('tx-list');
      if (!txContainer) return;
      showLoading(txContainer);

      try {
        const txs = await Api.getTransactions(selectedWeek);
        const sorted = [...txs].sort((a, b) => (b.status_updated || b.created || 0) - (a.status_updated || a.created || 0));

        if (!sorted.length) {
          txContainer.innerHTML = `<p class="text-center text-gray-500 py-8">No transactions for week ${selectedWeek}</p>`;
          return;
        }

        txContainer.innerHTML = `<div class="space-y-3">${sorted.map(tx => {
          const time = formatRelativeTime(tx.status_updated || tx.created);
          const typeColors = {
            trade: 'bg-blue-500/20 text-blue-400',
            free_agent: 'bg-green-500/20 text-green-400',
            waiver: 'bg-yellow-500/20 text-yellow-400',
          };
          const typeLabel = tx.type === 'free_agent' ? 'Free Agent' : tx.type === 'waiver' ? 'Waiver' : 'Trade';
          const typeClass = typeColors[tx.type] || 'bg-gray-500/20 text-gray-400';
          const failed = tx.status === 'failed';

          let details = '';

          if (tx.type === 'trade') {
            const sides = (tx.roster_ids || []).map(rid => {
              const adds = Object.entries(tx.adds || {}).filter(([, r]) => r === rid).map(([pid]) => pid);
              const drops = Object.entries(tx.drops || {}).filter(([, r]) => r === rid).map(([pid]) => pid);
              const picksReceived = (tx.draft_picks || []).filter(p => p.owner_id === rid);
              const picksSent = (tx.draft_picks || []).filter(p => p.previous_owner_id === rid && p.owner_id !== rid);
              return { rid, adds, drops, picksReceived, picksSent };
            });

            details = sides.map(side => `
              <div class="mt-2">
                <div class="text-xs font-semibold text-gray-300 mb-1">${ownerName(side.rid)}</div>
                ${side.adds.length ? `<div class="text-xs text-green-400 space-y-0.5">${side.adds.map(pid => `
                  <div class="flex items-center gap-1">
                    <span>+</span>
                    <span class="font-medium ${positionColor(playerPos(pid))}">${playerPos(pid)}</span>
                    <a href="#player/${pid}" class="hover:text-emerald-300 transition-colors">${playerName(pid)}</a>
                  </div>`).join('')}</div>` : ''}
                ${side.drops.length ? `<div class="text-xs text-red-400 space-y-0.5">${side.drops.map(pid => `
                  <div class="flex items-center gap-1">
                    <span>-</span>
                    <span class="font-medium ${positionColor(playerPos(pid))}">${playerPos(pid)}</span>
                    <a href="#player/${pid}" class="hover:text-red-300 transition-colors">${playerName(pid)}</a>
                  </div>`).join('')}</div>` : ''}
                ${side.picksReceived.length ? `<div class="text-xs text-green-400 space-y-0.5">${side.picksReceived.map(p => `
                  <div>+ ${p.season} Round ${p.round} pick</div>`).join('')}</div>` : ''}
              </div>`).join('');
          } else {
            const adds = Object.entries(tx.adds || {});
            const drops = Object.entries(tx.drops || {});
            details = `
              <div class="mt-2 space-y-0.5">
                ${adds.map(([pid]) => `
                  <div class="text-xs text-green-400 flex items-center gap-1">
                    <span>+</span>
                    <span class="font-medium ${positionColor(playerPos(pid))}">${playerPos(pid)}</span>
                    <a href="#player/${pid}" class="hover:text-emerald-300 transition-colors">${playerName(pid)}</a>
                  </div>`).join('')}
                ${drops.map(([pid]) => `
                  <div class="text-xs text-red-400 flex items-center gap-1">
                    <span>-</span>
                    <span class="font-medium ${positionColor(playerPos(pid))}">${playerPos(pid)}</span>
                    <a href="#player/${pid}" class="hover:text-red-300 transition-colors">${playerName(pid)}</a>
                  </div>`).join('')}
              </div>`;
          }

          const rosterNames = (tx.roster_ids || []).map(rid => ownerName(rid)).join(', ');

          return `
            <div class="bg-surface rounded-xl border border-gray-800 p-4 ${failed ? 'opacity-50' : ''}">
              <div class="flex items-center justify-between mb-1">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-semibold px-2 py-0.5 rounded-full ${typeClass}">${typeLabel}</span>
                  <span class="text-xs text-gray-500">${rosterNames}</span>
                </div>
                <span class="text-xs text-gray-500">${time}</span>
              </div>
              ${tx.settings?.waiver_bid != null ? `<div class="text-xs text-gray-400 mt-1">FAAB bid: $${tx.settings.waiver_bid}</div>` : ''}
              ${details}
              ${failed ? '<div class="text-xs text-red-400 mt-2">Failed</div>' : ''}
            </div>`;
        }).join('')}</div>`;
      } catch (err) {
        showError(txContainer, err.message);
      }
    }

    container.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center gap-2">
          <button id="tx-prev" class="p-2 rounded-lg bg-surface border border-gray-800 hover:bg-surface-light transition-colors disabled:opacity-30" ${selectedWeek <= 1 ? 'disabled' : ''}>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <div class="flex-1 text-center">
            <span class="text-sm font-semibold">Week <span id="tx-week-label">${selectedWeek}</span></span>
          </div>
          <button id="tx-next" class="p-2 rounded-lg bg-surface border border-gray-800 hover:bg-surface-light transition-colors disabled:opacity-30" ${selectedWeek >= 18 ? 'disabled' : ''}>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>
        <div id="tx-list"></div>
      </div>`;

    function setWeek(w) {
      selectedWeek = w;
      document.getElementById('tx-week-label').textContent = w;
      document.getElementById('tx-prev').disabled = w <= 1;
      document.getElementById('tx-next').disabled = w >= 18;
      drawTransactions();
    }

    document.getElementById('tx-prev').addEventListener('click', () => { if (selectedWeek > 1) setWeek(selectedWeek - 1); });
    document.getElementById('tx-next').addEventListener('click', () => { if (selectedWeek < 18) setWeek(selectedWeek + 1); });

    drawTransactions();
  } catch (err) {
    showError(container, err.message);
  }
}
