import { Api } from '../api.js';
import { CONFIG } from '../config.js';
import { positionColor, getPlayerPhotoUrl } from '../utils/format.js';
import { showLoading, showError } from '../utils/dom.js';

export const title = 'Drafts';

export async function render(container) {
  showLoading(container);

  try {
    const leagueChain = await Api.getLeagueChain();

    const allDrafts = [];
    for (const season of leagueChain) {
      try {
        const drafts = await Api.getDrafts(season.leagueId);
        for (const d of drafts) {
          allDrafts.push({ ...d, _leagueId: season.leagueId, _season: season.season });
        }
      } catch {}
    }

    if (!allDrafts.length) {
      container.innerHTML = `<p class="text-center text-gray-500 py-8">No drafts found</p>`;
      return;
    }

    allDrafts.sort((a, b) => (b._season || 0) - (a._season || 0));

    let selectedIdx = 0;

    async function drawDraft() {
      const draftContainer = document.getElementById('draft-content');
      if (!draftContainer) return;
      showLoading(draftContainer);

      try {
        const draft = allDrafts[selectedIdx];
        const [picks, rosterMap] = await Promise.all([
          Api.getDraftPicks(draft.draft_id),
          Api.getRosterMap(draft._leagueId),
        ]);

        const grouped = {};
        for (const pick of picks) {
          if (!grouped[pick.round]) grouped[pick.round] = [];
          grouped[pick.round].push(pick);
        }

        const slotToRoster = draft.slot_to_roster_id || {};

        draftContainer.innerHTML = `
          <div class="space-y-4">
            <div class="bg-surface rounded-xl border border-gray-800 p-4">
              <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
                <span>Type: <span class="text-gray-200 font-medium">${draft.type || 'snake'}</span></span>
                <span>Rounds: <span class="text-gray-200 font-medium">${draft.settings?.rounds || '?'}</span></span>
                <span>Teams: <span class="text-gray-200 font-medium">${draft.settings?.teams || '?'}</span></span>
                <span>Season: <span class="text-gray-200 font-medium">${draft._season}</span></span>
                <span>Status: <span class="text-gray-200 font-medium">${draft.status}</span></span>
              </div>
            </div>

            ${picks.length === 0 ? `<p class="text-center text-gray-500 py-6">No picks recorded for this draft yet</p>` :
            Object.entries(grouped).map(([round, roundPicks]) => `
              <div>
                <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">Round ${round}</div>
                <div class="bg-surface rounded-xl border border-gray-800 divide-y divide-gray-800/50">
                  ${roundPicks.sort((a, b) => a.pick_no - b.pick_no).map((pick, idx) => {
                    const meta = pick.metadata || {};
                    const name = meta.first_name && meta.last_name ? `${meta.first_name} ${meta.last_name}` : pick.player_id;
                    const pos = meta.position || '';
                    const team = meta.team || '';
                    const rosterId = pick.roster_id || slotToRoster[pick.draft_slot];
                    const owner = rosterMap[rosterId]?.owner;
                    const ownerName = owner?.name || `Pick ${pick.draft_slot}`;
                    const pickLabel = `${pick.round}.${String(idx + 1).padStart(2, '0')}`;

                    return `
                      <div class="flex items-center gap-3 px-4 py-2.5">
                        <div class="shrink-0 w-12 text-center">
                          <div class="text-xs font-bold text-emerald-400">${pickLabel}</div>
                          <div class="text-[10px] text-gray-600">#${pick.pick_no}</div>
                        </div>
                        <img src="${getPlayerPhotoUrl(pick.player_id)}" class="w-8 h-8 rounded-full object-cover bg-gray-800 shrink-0" alt="" onerror="this.style.display='none'">
                        <div class="flex-1 min-w-0">
                          <a href="#player/${pick.player_id}" class="text-sm font-medium text-gray-200 hover:text-emerald-400 transition-colors truncate block">${name}</a>
                          <div class="text-xs text-gray-500">${ownerName}</div>
                        </div>
                        <span class="text-xs font-semibold ${positionColor(pos)}">${pos}</span>
                        <span class="text-xs text-gray-500 w-8 text-right">${team}</span>
                      </div>`;
                  }).join('')}
                </div>
              </div>
            `).join('')}
          </div>`;
      } catch (err) {
        showError(draftContainer, err.message);
      }
    }

    container.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="font-semibold text-sm text-gray-400">${allDrafts.length} draft${allDrafts.length !== 1 ? 's' : ''} found</h2>
          <select id="draft-select" class="bg-surface-light border border-gray-700 rounded-lg text-sm text-gray-200 px-3 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer">
            ${allDrafts.map((d, i) => `<option value="${i}" ${i === selectedIdx ? 'selected' : ''}>${d._season} — ${d.metadata?.name || d.type || 'Draft'}</option>`).join('')}
          </select>
        </div>
        <div id="draft-content"></div>
      </div>`;

    document.getElementById('draft-select').addEventListener('change', (e) => {
      selectedIdx = parseInt(e.target.value);
      drawDraft();
    });

    drawDraft();
  } catch (err) {
    showError(container, err.message);
  }
}
