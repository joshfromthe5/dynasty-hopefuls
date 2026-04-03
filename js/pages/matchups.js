import { Api } from '../api.js';
import { getAvatarUrl, positionColor } from '../utils/format.js';
import { showLoading, showError } from '../utils/dom.js';

export const title = 'Matchups';

export async function render(container) {
  try {
    const [nflState, leagueChain] = await Promise.all([
      Api.getNflState(),
      Api.getLeagueChain(),
    ]);

    if (!leagueChain.length) {
      showError(container, 'No league data found');
      return;
    }

    let selectedSeasonIdx = 0; // index into leagueChain (0 = current)
    let selectedWeek = 1;
    let currentLeague = leagueChain[0].league;
    let currentRosterMap = null;

    function getTotalWeeks(league) {
      return league.settings?.playoff_week_start
        ? league.settings.playoff_week_start + (league.settings?.playoff_round_type === 2 ? 4 : 3) - 1
        : 17;
    }

    async function loadSeason() {
      const entry = leagueChain[selectedSeasonIdx];
      currentLeague = entry.league;
      currentRosterMap = await Api.getRosterMap(entry.leagueId);

      const totalWeeks = getTotalWeeks(currentLeague);
      if (selectedSeasonIdx === 0) {
        const currentWeek = Math.min(nflState.display_week || nflState.week || 1, totalWeeks);
        selectedWeek = currentWeek;
      } else {
        selectedWeek = 1;
      }
    }

    await loadSeason();

    function renderShell() {
      const totalWeeks = getTotalWeeks(currentLeague);

      container.innerHTML = `
        <div class="space-y-4">
          <!-- Season Selector -->
          ${leagueChain.length > 1 ? `
            <div class="flex gap-2 overflow-x-auto no-scrollbar">
              ${leagueChain.map((s, i) => `
                <button data-season="${i}" class="px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${i === selectedSeasonIdx ? 'bg-emerald-500 text-gray-950' : 'bg-surface border border-gray-800 text-gray-400 hover:text-gray-200'}">${s.season}</button>
              `).join('')}
            </div>
          ` : ''}

          <!-- Week Selector -->
          <div class="flex items-center gap-2">
            <button id="prev-week" class="p-2 rounded-lg bg-surface border border-gray-800 hover:bg-surface-light transition-colors disabled:opacity-30" ${selectedWeek <= 1 ? 'disabled' : ''}>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <div class="flex-1 overflow-x-auto no-scrollbar">
              <div class="flex gap-1 justify-center" id="week-pills">
                ${Array.from({ length: totalWeeks }, (_, i) => i + 1).map(w => `
                  <button data-week="${w}" class="px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${w === selectedWeek ? 'bg-emerald-500 text-gray-950' : 'bg-surface border border-gray-800 text-gray-400 hover:text-gray-200'}">${w}</button>
                `).join('')}
              </div>
            </div>
            <button id="next-week" class="p-2 rounded-lg bg-surface border border-gray-800 hover:bg-surface-light transition-colors disabled:opacity-30" ${selectedWeek >= totalWeeks ? 'disabled' : ''}>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>

          <div id="matchups-list"></div>
        </div>`;

      // Season buttons
      container.querySelectorAll('[data-season]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const idx = parseInt(btn.dataset.season);
          if (idx === selectedSeasonIdx) return;
          selectedSeasonIdx = idx;
          showLoading(container);
          await loadSeason();
          renderShell();
          drawMatchups();
        });
      });

      // Week buttons
      const totalW = totalWeeks;
      container.querySelectorAll('[data-week]').forEach(btn => {
        btn.addEventListener('click', () => setWeek(parseInt(btn.dataset.week), totalW));
      });
      document.getElementById('prev-week')?.addEventListener('click', () => { if (selectedWeek > 1) setWeek(selectedWeek - 1, totalW); });
      document.getElementById('next-week')?.addEventListener('click', () => { if (selectedWeek < totalW) setWeek(selectedWeek + 1, totalW); });
    }

    function setWeek(w, totalWeeks) {
      selectedWeek = w;
      container.querySelectorAll('[data-week]').forEach(btn => {
        const isActive = parseInt(btn.dataset.week) === w;
        btn.className = `px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${isActive ? 'bg-emerald-500 text-gray-950' : 'bg-surface border border-gray-800 text-gray-400 hover:text-gray-200'}`;
      });
      const prevBtn = document.getElementById('prev-week');
      const nextBtn = document.getElementById('next-week');
      if (prevBtn) prevBtn.disabled = w <= 1;
      if (nextBtn) nextBtn.disabled = w >= totalWeeks;
      drawMatchups();
    }

    async function drawMatchups() {
      const matchupsContainer = document.getElementById('matchups-list');
      if (!matchupsContainer) return;
      showLoading(matchupsContainer);

      const entry = leagueChain[selectedSeasonIdx];

      try {
        const matchups = await Api.getMatchups(selectedWeek, entry.leagueId);
        let players = null;
        try { players = await Api.getPlayers(); } catch {}

        const grouped = {};
        for (const m of matchups) {
          if (m.matchup_id == null) continue;
          if (!grouped[m.matchup_id]) grouped[m.matchup_id] = [];
          grouped[m.matchup_id].push(m);
        }

        const matchupCards = Object.entries(grouped).map(([mid, teams]) => {
          if (teams.length < 2) return '';
          const [t1, t2] = teams;
          const r1 = currentRosterMap[t1.roster_id];
          const r2 = currentRosterMap[t2.roster_id];
          const p1 = t1.points || 0;
          const p2 = t2.points || 0;
          const winner = p1 > p2 ? 1 : p2 > p1 ? 2 : 0;

          function teamHeader(team, roster, pts, isWinner) {
            const owner = roster?.owner || { name: `Team ${team.roster_id}` };
            return `
              <div class="flex items-center gap-2 ${isWinner ? '' : 'opacity-70'}">
                ${owner.avatar
                  ? `<img src="${getAvatarUrl(owner.avatar)}" class="w-8 h-8 rounded-full object-cover" alt="">`
                  : `<div class="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold">${owner.name[0]}</div>`
                }
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium truncate">${owner.name}</div>
                </div>
                <div class="text-lg font-bold ${isWinner ? 'text-emerald-400' : 'text-gray-400'}">${pts.toFixed(2)}</div>
              </div>`;
          }

          function startersList(team) {
            if (!team.starters?.length || !players) return '';
            return `
              <div class="mt-3 space-y-1 border-t border-gray-800/50 pt-2">
                ${team.starters.map(pid => {
                  const p = players[pid];
                  if (!p) return `<div class="text-xs text-gray-500">${pid}</div>`;
                  const injBadge = p.injury_status ? `<span class="text-xs px-1 py-0.5 rounded ${p.injury_status === 'Out' || p.injury_status === 'IR' ? 'bg-red-500/20 text-red-400' : p.injury_status === 'Questionable' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-500/20 text-gray-400'}">${p.injury_status}</span>` : '';
                  const pts = team.players_points?.[pid];
                  return `
                    <div class="flex items-center gap-2 text-xs">
                      <span class="w-6 font-semibold ${positionColor(p.position || p.fantasy_positions?.[0])}">${p.position || p.fantasy_positions?.[0] || '?'}</span>
                      <a href="#player/${pid}" class="flex-1 truncate text-gray-200 hover:text-emerald-400 transition-colors">${p.first_name} ${p.last_name}</a>
                      ${injBadge}
                      <span class="text-gray-400 font-mono w-12 text-right">${pts != null ? pts.toFixed(1) : '-'}</span>
                    </div>`;
                }).join('')}
              </div>`;
          }

          return `
            <div class="bg-surface rounded-xl border border-gray-800 overflow-hidden">
              <div class="p-4 space-y-2">
                ${teamHeader(t1, r1, p1, winner === 1 || winner === 0)}
                <div class="flex items-center gap-2">
                  <div class="flex-1 h-px bg-gray-800"></div>
                  <span class="text-xs text-gray-500 font-medium">VS</span>
                  <div class="flex-1 h-px bg-gray-800"></div>
                </div>
                ${teamHeader(t2, r2, p2, winner === 2 || winner === 0)}
              </div>
              <details class="group">
                <summary class="px-4 py-2 text-xs text-gray-500 hover:text-gray-300 cursor-pointer border-t border-gray-800/50 text-center transition-colors">
                  Show Starters
                </summary>
                <div class="px-4 pb-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>${startersList(t1)}</div>
                  <div>${startersList(t2)}</div>
                </div>
              </details>
            </div>`;
        });

        matchupsContainer.innerHTML = matchupCards.length
          ? `<div class="space-y-3">${matchupCards.join('')}</div>`
          : `<p class="text-center text-gray-500 py-8">No matchups for week ${selectedWeek}</p>`;
      } catch (err) {
        showError(matchupsContainer, err.message);
      }
    }

    renderShell();
    drawMatchups();
  } catch (err) {
    showError(container, err.message);
  }
}
