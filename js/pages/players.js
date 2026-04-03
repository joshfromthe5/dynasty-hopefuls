import { Api } from '../api.js';
import { positionColor, getPlayerPhotoUrl } from '../utils/format.js';
import { showLoading, showError } from '../utils/dom.js';

export const title = 'Players';

const PAGE_SIZE = 50;

export async function render(container) {
  showLoading(container);

  try {
    const [allPlayers, ownershipMap, rosterMap] = await Promise.all([
      Api.getPlayers(),
      Api.getPlayerOwnershipMap(),
      Api.getRosterMap(),
    ]);

    // Build searchable list of active NFL players
    const playerList = Object.entries(allPlayers)
      .map(([id, p]) => ({ id, ...p }))
      .filter(p => p.active && p.position && !['OL', 'OT', 'OG', 'C', 'LS', 'P'].includes(p.position));

    let searchQuery = '';
    let posFilter = 'ALL';
    let availFilter = 'ALL';
    let offset = 0;

    function getFiltered() {
      let list = playerList;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        list = list.filter(p =>
          (p.search_full_name || '').includes(q) ||
          (p.first_name || '').toLowerCase().includes(q) ||
          (p.last_name || '').toLowerCase().includes(q)
        );
      }

      if (posFilter !== 'ALL') {
        list = list.filter(p => p.position === posFilter || p.fantasy_positions?.includes(posFilter));
      }

      if (availFilter === 'FA') {
        list = list.filter(p => !ownershipMap[p.id]);
      } else if (availFilter === 'ROSTERED') {
        list = list.filter(p => ownershipMap[p.id]);
      }

      // Sort by search rank, then name
      list.sort((a, b) => (a.search_rank || 9999) - (b.search_rank || 9999));

      return list;
    }

    function draw() {
      const filtered = getFiltered();
      const page = filtered.slice(0, offset + PAGE_SIZE);
      const hasMore = filtered.length > page.length;

      const resultsEl = document.getElementById('player-results');
      if (!resultsEl) return;

      resultsEl.innerHTML = `
        <div class="text-xs text-gray-500 mb-2 px-1">${filtered.length} players</div>
        <div class="bg-surface rounded-xl border border-gray-800 divide-y divide-gray-800/50">
          ${page.length ? page.map(p => {
            const pos = p.position || p.fantasy_positions?.[0] || '?';
            const rosterId = ownershipMap[p.id];
            const ownerName = rosterId ? (rosterMap[rosterId]?.owner?.name || `Team ${rosterId}`) : null;
            const injury = p.injury_status;

            return `
              <a href="#player/${p.id}" class="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-light/50 transition-colors">
                <img src="${getPlayerPhotoUrl(p.id)}" class="w-8 h-8 rounded-full object-cover bg-gray-800 shrink-0" alt="" onerror="this.style.display='none'">
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium truncate">${p.first_name} ${p.last_name}</div>
                  <div class="text-xs text-gray-500">${p.team || 'FA'} · ${pos}${p.number ? ` #${p.number}` : ''}</div>
                </div>
                ${injury ? `<span class="text-xs font-semibold px-1.5 py-0.5 rounded ${injury === 'Out' || injury === 'IR' ? 'bg-red-500/20 text-red-400' : injury === 'Questionable' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-500/20 text-gray-400'}">${injury}</span>` : ''}
                <span class="text-xs ${ownerName ? 'text-blue-400' : 'text-green-400'} shrink-0">${ownerName || 'FA'}</span>
              </a>`;
          }).join('') : '<p class="text-center text-gray-500 py-6">No players found</p>'}
        </div>
        ${hasMore ? `<button id="load-more" class="w-full mt-3 py-2 text-sm font-medium text-emerald-400 bg-surface border border-gray-800 rounded-xl hover:bg-surface-light transition-colors">Load More (${filtered.length - page.length} remaining)</button>` : ''}`;

      document.getElementById('load-more')?.addEventListener('click', () => {
        offset += PAGE_SIZE;
        draw();
      });
    }

    const positions = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'DL', 'LB', 'DB'];

    container.innerHTML = `
      <div class="space-y-3">
        <!-- Search -->
        <div class="relative">
          <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input id="player-search" type="text" placeholder="Search players..." class="w-full bg-surface border border-gray-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors">
        </div>

        <!-- Filters -->
        <div class="flex gap-2 overflow-x-auto no-scrollbar">
          ${positions.map(p => `
            <button data-pos="${p}" class="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${p === posFilter ? 'bg-emerald-500 text-gray-950' : 'bg-surface border border-gray-800 text-gray-400 hover:text-gray-200'}">${p}</button>
          `).join('')}
        </div>
        <div class="flex gap-2">
          ${['ALL', 'FA', 'ROSTERED'].map(f => `
            <button data-avail="${f}" class="px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${f === availFilter ? 'bg-emerald-500 text-gray-950' : 'bg-surface border border-gray-800 text-gray-400 hover:text-gray-200'}">${f === 'FA' ? 'Free Agents' : f === 'ROSTERED' ? 'Rostered' : 'All'}</button>
          `).join('')}
        </div>

        <div id="player-results"></div>
      </div>`;

    // Bind events
    let debounce;
    document.getElementById('player-search').addEventListener('input', (e) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        searchQuery = e.target.value.trim();
        offset = 0;
        draw();
      }, 200);
    });

    container.querySelectorAll('[data-pos]').forEach(btn => {
      btn.addEventListener('click', () => {
        posFilter = btn.dataset.pos;
        offset = 0;
        container.querySelectorAll('[data-pos]').forEach(b => {
          b.className = `px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${b.dataset.pos === posFilter ? 'bg-emerald-500 text-gray-950' : 'bg-surface border border-gray-800 text-gray-400 hover:text-gray-200'}`;
        });
        draw();
      });
    });

    container.querySelectorAll('[data-avail]').forEach(btn => {
      btn.addEventListener('click', () => {
        availFilter = btn.dataset.avail;
        offset = 0;
        container.querySelectorAll('[data-avail]').forEach(b => {
          b.className = `px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${b.dataset.avail === availFilter ? 'bg-emerald-500 text-gray-950' : 'bg-surface border border-gray-800 text-gray-400 hover:text-gray-200'}`;
        });
        draw();
      });
    });

    draw();
  } catch (err) {
    showError(container, err.message);
  }
}
