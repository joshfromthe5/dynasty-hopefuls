import { Api } from '../api.js';
import { positionColor, getPlayerPhotoUrl } from '../utils/format.js';
import { showLoading, showError } from '../utils/dom.js';

export const title = 'Drafts';

export async function render(container) {
  try {
    const [drafts, rosterMap] = await Promise.all([
      Api.getDrafts(),
      Api.getRosterMap(),
    ]);

    if (!drafts.length) {
      container.innerHTML = `<p class="text-center text-gray-500 py-8">No drafts found</p>`;
      return;
    }

    // Show most recent draft by default
    let selectedIdx = 0;

    async function drawDraft() {
      const draftContainer = document.getElementById('draft-content');
      if (!draftContainer) return;
      showLoading(draftContainer);

      try {
        const draft = drafts[selectedIdx];
        const picks = await Api.getDraftPicks(draft.draft_id);

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
                <span>Season: <span class="text-gray-200 font-medium">${draft.season}</span></span>
                <span>Status: <span class="text-gray-200 font-medium">${draft.status}</span></span>
              </div>
            </div>

            ${Object.entries(grouped).map(([round, roundPicks]) => `
              <div>
                <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">Round ${round}</div>
                <div class="bg-surface rounded-xl border border-gray-800 divide-y divide-gray-800/50">
                  ${roundPicks.sort((a, b) => a.pick_no - b.pick_no).map(pick => {
                    const meta = pick.metadata || {};
                    const name = meta.first_name && meta.last_name ? `${meta.first_name} ${meta.last_name}` : pick.player_id;
                    const pos = meta.position || '';
                    const team = meta.team || '';
                    const rosterId = pick.roster_id || slotToRoster[pick.draft_slot];
                    const owner = rosterMap[rosterId]?.owner;
                    const ownerName = owner?.name || `Pick ${pick.draft_slot}`;

                    return `
                      <div class="flex items-center gap-3 px-4 py-2.5">
                        <span class="text-xs text-gray-500 font-mono w-8 shrink-0">${pick.pick_no}</span>
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
        ${drafts.length > 1 ? `
          <div class="flex gap-2 overflow-x-auto no-scrollbar">
            ${drafts.map((d, i) => `
              <button data-draft-idx="${i}" class="px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${i === selectedIdx ? 'bg-emerald-500 text-gray-950' : 'bg-surface border border-gray-800 text-gray-400 hover:text-gray-200'}">
                ${d.season} ${d.metadata?.name || `Draft ${i + 1}`}
              </button>
            `).join('')}
          </div>
        ` : ''}
        <div id="draft-content"></div>
      </div>`;

    container.querySelectorAll('[data-draft-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedIdx = parseInt(btn.dataset.draftIdx);
        container.querySelectorAll('[data-draft-idx]').forEach(b => {
          const isActive = parseInt(b.dataset.draftIdx) === selectedIdx;
          b.className = `px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${isActive ? 'bg-emerald-500 text-gray-950' : 'bg-surface border border-gray-800 text-gray-400 hover:text-gray-200'}`;
        });
        drawDraft();
      });
    });

    drawDraft();
  } catch (err) {
    showError(container, err.message);
  }
}
