# Quickcheck

Checklist management tool for engineering teams. Create, share, and track
deployment checklists, incident response procedures, and release gates.

Built as a static web app — no build step, no framework, no runtime
dependencies. Just HTML, CSS, and vanilla JavaScript served over a CDN.

---

## What it Does

- Create checklists with sections and items
- Track progress with check/uncheck
- Organise work into workspaces (team collaboration)
- Share checklists with team members in a workspace
- Import checklists from Markdown files
- Download checklists as Markdown
- View team activity feed per workspace
- Dashboard with stats and recent checklist history (cross-workspace)

## Hosting & Domain

| Service     | Purpose                         |
|-------------|---------------------------------|
| Vercel      | Static site hosting + CDN       |
| Namecheap   | Domain registrar                |
| Cloudflare  | DNS, SSL, security              |

Deployed at [quickcheck-web.vercel.app](https://quickcheck-web.vercel.app).

## Backend & Storage

| Service       | Purpose                                    |
|---------------|--------------------------------------------|
| Supabase      | Database (PostgreSQL), Auth, Realtime      |
| Supabase RPC  | Stored procedures for workspaces, invites  |
| localStorage  | Session persistence for workspace ID        |

Supabase handles all user accounts, checklist CRUD, workspace
membership, sharing, and activity feeds. The client SDK
(`@supabase/supabase-js` v2) talks to the API via anonymous
key authentication with row-level security.

## Authentication

- Email & password (built-in Supabase)
- OAuth: Google, GitHub
- Magic link (passwordless)
- PKCE flow with session persistence

## Frontend Stack

Zero dependencies. No React, no Vue, no bundler, no transpiler.

| Language        | Usage                                    |
|-----------------|------------------------------------------|
| HTML5           | Semantic markup, meta tags, CSP headers  |
| CSS3            | Custom properties, flexbox, grid, media queries |
| JavaScript (ES6)| All application logic, DOM, Supabase SDK |

### CSS Architecture

- Global design tokens via custom properties (`--bg`, `--accent`,
  `--radius-lg`, etc.)
- Dark theme by default
- Component-based naming (`.dash-cl-item`, `.sidebar`, `.checklist-view`)
- Desktop-first responsive breakpoints at 1100px, 900px, 800px, 600px

### JavaScript

- Modular file structure (auth, checklist, workspace, db, modal, state, etc.)
- Supabase JS SDK for all database and auth operations
- Custom Markdown parser and serializer (no external library)
- Debounced canvas rendering for the landing page hero

## Features

### Landing Page (Marketing Site)

- Static hero with canvas-drawn ribbon waves
- Dashboard visual preview with responsive mobile view
- Features, capabilities, workflow, pricing, and FAQ sections
- Strict CSP (`script-src 'self'`)
- OG meta tags, JSON-LD structured data, sitemap

### Auth App (Dashboard)

- Sidebar with personal / workspace checklist switching
- Full CRUD for checklists (create, read, update, delete)
- Inline editing of titles, sections, and items
- Progress tracking with visual progress bar
- Recent checklists panel (shows last visited across all workspaces)
- Dashboard stats (active, completed, member count, success rate)
- Workspace management (create, rename, delete, invite members)
- Account settings (profile, email, password, notification preferences)
- Activity feed per workspace

### Workspace System

- Personal mode (private checklists)
- Team workspaces with shared checklists
- Role-based access: owner, admin, member
- Invite system with pending / accepted states
- Free / Pro / Team plan limits

## File Structure

```
/
├── index.html              Landing page
├── style.css               Global styles
├── hero-bg.js              Canvas ribbon background
├── vercel.json             Deployment config
├── robots.txt
├── sitemap.xml
├── assets/                 Logos, favicon, social images
├── pages/                  Static sub-pages
│   ├── docs.html
│   ├── changelog.html
│   └── legal/              Privacy, Terms, Security
└── auth/                   Dashboard application
    ├── index.html
    ├── style.css
    ├── config.js            Supabase keys
    └── js/
        ├── auth.js
        ├── account.js
        ├── checklist.js
        ├── workspace.js
        ├── db.js
        ├── modal.js
        ├── state.js
        ├── parse.js
        ├── utils.js
        ├── upgrade.js
        └── sync.js
```

## Running Locally

This is a static site. No build step needed.

```bash
git clone <repo-url>
cd quickcheck-web
python3 -m http.server 8000
# or: npx serve .
```

Open `http://localhost:8000` in a browser.

To use the dashboard, create a Supabase project and update
`auth/config.js` with your project URL and anonymous key.
The database schema is derived from the RPC calls in `workspace.js`
and `db.js`.

---

*Project documentation written after the first year.*
