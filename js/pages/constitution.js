import { showLoading, showError } from '../utils/dom.js';

export const title = 'Constitution';

export async function render(container) {
  showLoading(container);

  try {
    const res = await fetch('/data/constitution.json');
    if (!res.ok) throw new Error('Could not load constitution');
    const data = await res.json();

    container.innerHTML = `
      <div class="space-y-4">
        <div class="bg-surface rounded-2xl border border-gray-800 p-5">
          <h2 class="font-bold text-lg">${data.title || 'League Constitution'}</h2>
          ${data.lastUpdated ? `<p class="text-xs text-gray-500 mt-1">Last updated: ${data.lastUpdated}</p>` : ''}
        </div>

        ${data.sections.map((section, i) => `
          <div class="bg-surface rounded-2xl border border-gray-800 p-5">
            <div class="flex items-center gap-2 mb-3">
              <span class="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center">${i + 1}</span>
              <h3 class="font-semibold">${section.heading}</h3>
            </div>
            <ul class="space-y-2">
              ${section.rules.map(rule => `
                <li class="flex items-start gap-2 text-sm text-gray-300">
                  <span class="text-emerald-500 mt-0.5 shrink-0">•</span>
                  <span>${rule}</span>
                </li>
              `).join('')}
            </ul>
          </div>
        `).join('')}

        <p class="text-xs text-gray-600 text-center">Edit <code class="text-gray-500">data/constitution.json</code> to update rules</p>
      </div>`;
  } catch (err) {
    showError(container, err.message);
  }
}
