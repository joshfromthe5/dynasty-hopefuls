import { Api } from './api.js';
import { showLoading } from './utils/dom.js';

const pages = {};
const pageModules = {
  dashboard: () => import('./pages/dashboard.js'),
  standings: () => import('./pages/standings.js'),
  matchups: () => import('./pages/matchups.js'),
  rosters: () => import('./pages/rosters.js'),
  players: () => import('./pages/players.js'),
  player: () => import('./pages/player-detail.js'),
  transactions: () => import('./pages/transactions.js'),
  drafts: () => import('./pages/drafts.js'),
  playoffs: () => import('./pages/playoffs.js'),
  history: () => import('./pages/history.js'),
  'power-rankings': () => import('./pages/power-rankings.js'),
};

let currentPage = null;

function parseHash() {
  const hash = window.location.hash.slice(1) || 'dashboard';
  const parts = hash.split('/');
  return { page: parts[0], param: parts[1] || null };
}

function updateActiveNav(page) {
  document.querySelectorAll('[data-nav]').forEach((el) => {
    const isActive = el.dataset.nav === page;
    el.classList.toggle('text-emerald-400', isActive);
    el.classList.toggle('text-gray-500', !isActive);
  });
}

async function navigate() {
  const { page, param } = parseHash();
  const content = document.getElementById('content');
  const topTitle = document.getElementById('page-title');

  if (currentPage === `${page}/${param}`) return;
  currentPage = `${page}/${param}`;

  showLoading(content);
  updateActiveNav(page);

  const loader = pageModules[page];
  if (!loader) {
    content.innerHTML = `<div class="p-6 text-center text-gray-400">Page not found</div>`;
    return;
  }

  try {
    if (!pages[page]) {
      const mod = await loader();
      pages[page] = mod;
    }
    const mod = pages[page];
    if (topTitle && mod.title) {
      topTitle.textContent = typeof mod.title === 'function' ? mod.title(param) : mod.title;
    }
    await mod.render(content, param);
  } catch (err) {
    console.error(`Error loading page "${page}":`, err);
    content.innerHTML = `<div class="p-6 text-center text-red-400">Failed to load page: ${err.message}</div>`;
  }
}

async function init() {
  const topTitle = document.getElementById('page-title');
  const leagueName = document.getElementById('league-name');

  try {
    const league = await Api.getLeague();
    if (leagueName) leagueName.textContent = league.name || 'Dynasty League';
    document.title = league.name || 'Dynasty League';
  } catch {
    if (leagueName) leagueName.textContent = 'Dynasty League';
  }

  // Pre-fetch core data in background
  Api.getUsers().catch(() => {});
  Api.getRosters().catch(() => {});

  window.addEventListener('hashchange', navigate);
  navigate();
}

document.addEventListener('DOMContentLoaded', init);
