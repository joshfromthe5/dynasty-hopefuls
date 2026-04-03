# Sleeper Dynasty League Site

A mobile-first static site for tracking your Sleeper dynasty fantasy football league. Displays standings, matchups, rosters, transactions, draft history, playoff brackets, league history, power rankings, and player news/injury intel.

## Stack

- **HTML** + **Tailwind CSS** (Play CDN) + **Vanilla JavaScript** (ES modules)
- **Netlify** for hosting + serverless functions (free tier)
- **Sleeper API** for all league data (read-only, no auth required)

## Setup

### 1. Configure your league

Open `js/config.js` and set your league ID:

```js
export const CONFIG = {
  LEAGUE_ID: '1318435163557867520', // Replace with your Sleeper league ID
  ...
};
```

You can find your league ID in the Sleeper app under **League Settings**, or from the URL when viewing your league on sleeper.com.

### 2. Local development

Since this is a static site with ES modules, you need a local server (not `file://`):

```bash
# Using Python
python3 -m http.server 8000

# Or using Node.js (npx)
npx serve .

# Or using VS Code Live Server extension
```

Then open `http://localhost:8000` in your browser.

### 3. Deploy to Netlify

1. Push this repo to GitHub
2. Go to [app.netlify.com](https://app.netlify.com) and click **"Add new site" > "Import an existing project"**
3. Connect your GitHub repo
4. Build settings:
   - **Build command**: *(leave blank)*
   - **Publish directory**: `.`
5. Click **Deploy**

Your site will be live at `https://your-site-name.netlify.app`.

## Features

| Page | Description |
|------|-------------|
| **Home** | League overview with standings snapshot and quick links |
| **Standings** | Full standings table with sortable W/L, PF, PA columns |
| **Matchups** | Week-by-week matchup scores with expandable starters |
| **Rosters** | All team rosters with player details and injury badges |
| **Players** | Search/browse all NFL players, filter by position and availability |
| **Player Detail** | Full player page with injury status, info, and filtered news |
| **Transactions** | Trades, waivers, and free agent activity feed |
| **Drafts** | Draft pick history with round-by-round breakdown |
| **Playoffs** | Winners and consolation bracket visualization |
| **History** | Past season champions and standings via league chain |
| **Power Rankings** | Analytics: all-play record, consistency, luck index |

## News Function

The Netlify Function at `netlify/functions/news.js` proxies RSS feeds from ESPN, CBS Sports, NBC Sports, and PFF to provide player news on the player detail pages. This avoids CORS issues and stays within Netlify's free tier (125K invocations/month).

## API

All data comes from the [Sleeper API](https://docs.sleeper.com/) which is free, read-only, and requires no authentication.
