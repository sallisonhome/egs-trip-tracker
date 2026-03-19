# EGS BD/AM Trip Tracker

Internal tool for Epic Games Store Business Development & Account Management — ingest and analyze trip reports, meeting notes, game discussions, and platform feedback.

---

## Running Locally (Recommended)

The easiest way to run everything — app + persistent Postgres database — with a single command.

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### Setup (one-time)

1. Get a free Anthropic API key from [console.anthropic.com](https://console.anthropic.com) (needed for AI trip report extraction)
2. Open the `.env` file in the project root and paste your key:

```
ANTHROPIC_API_KEY=sk-ant-...
```

### Start

```bash
git clone https://github.com/sallisonhome/egs-trip-tracker.git
cd egs-trip-tracker
# Edit .env and set your ANTHROPIC_API_KEY first (see above)
docker compose up --build
```

Open **http://localhost:3000** in your browser.

- The database is stored in a Docker volume (`egs_pgdata`) — data persists across restarts
- On first run, all tables are created and demo seed data is loaded automatically
- To stop: `Ctrl+C` or `docker compose down`
- To stop AND wipe all data: `docker compose down -v`

### Subsequent starts (after first build)

```bash
docker compose up
```

No `--build` needed unless you pull new code changes. After pulling updates:

```bash
git pull
docker compose up --build
```

---

## Running Without Docker (Dev Mode)

If you want hot-reload during development:

### Prerequisites

- Node.js 20+
- A running Postgres instance (local or remote)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.local .env
# Edit .env and set DATABASE_URL to your Postgres connection string

# 3. Start dev server (auto-reloads on file changes)
npm run dev
```

Open **http://localhost:5000**

---

## Environment Variables

| Variable | Description | Default (Docker) |
|---|---|---|
| `DATABASE_URL` | Postgres connection string | `postgresql://egs:egspassword@db:5432/egs_trip_tracker` |
| `NODE_ENV` | `development` or `production` | `production` |
| `PORT` | Port to listen on | `3000` |
| `ANTHROPIC_API_KEY` | Anthropic API key for AI extraction | _(required — get from console.anthropic.com)_ |

---

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Express + TypeScript
- **Database**: PostgreSQL via Drizzle ORM
- **Schema**: 16 normalized tables (events, meetings, companies, games, topics, and more)

---

## Ingesting Trip Reports

Reports can be submitted from:
1. **Sidebar** → "Upload Report" button (available on every page)
2. **Events & Trips page** → "Upload Report" button in the header
3. **Event Detail page** → "Ingest Report" button

Supported formats:
- Paste raw text / meeting notes
- Google Docs URL (shared as "Anyone with link can view")
- PDF file upload
- Word (.docx) file upload

After ingesting, the app automatically sends the text to Claude AI to extract:
- **Meetings** — one record per meeting block
- **Companies** — publisher/developer names
- **Contacts** — attendee names, titles, emails
- **Games** — titles, EGS status, deal status, sentiment
- **Platform Topics** — commercial terms, tools, discovery, etc.

All extracted records appear immediately in the Event Detail page. You can re-extract at any time using the **Re-extract** button on any source document.
