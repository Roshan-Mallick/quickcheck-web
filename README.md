# Quickcheck

Checklist management for engineering teams. Create, share, and track
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
- AI-powered checklist generation from natural language (Quick-AI)
- Workspace activity feed and cross-workspace dashboard
- Inline editing of titles, sections, and items

## Hosting & Domain

| Service     | Purpose                    |
|-------------|----------------------------|
| Vercel      | Static site hosting + CDN  |
| Cloudflare  | DNS, SSL, CDN security     |

## Backend & Storage

| Service       | Purpose                                    |
|---------------|--------------------------------------------|
| Supabase      | Database (PostgreSQL), Auth, Realtime      |
| Supabase RPC  | Stored procedures for workspaces, invites  |
| localStorage  | Session persistence for workspace ID       |

Supabase handles all user accounts, checklist CRUD, workspace
membership, sharing, and activity feeds. Database access is secured
through row-level security policies enforced server-side.

## Authentication

- Email & password
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

- Global design tokens via custom properties
- Dark theme by default
- Component-based naming
- Responsive breakpoints

### JavaScript

- Modular file structure (auth, checklist, workspace, db, modal, state, parser, etc.)
- Supabase JS SDK for all database and auth operations
- Custom Markdown parser and serializer (no external library)
- Debounced canvas rendering for the landing page hero
- AI chat interface for checklist generation

## Features

### Landing Page (Marketing Site)

- Static hero with canvas-drawn ribbon animation
- Dashboard visual preview with responsive mobile view
- Features, capabilities, workflow, pricing, FAQ, testimonial sections
- Strict CSP headers (`script-src 'self'`)
- OG meta tags, JSON-LD structured data, sitemap

### Auth App (Dashboard)

- Sidebar with personal / workspace checklist switching
- Full CRUD for checklists (create, read, update, delete)
- Inline editing of titles, sections, and items
- Progress tracking with visual progress bar
- Recent checklists panel (cross-workspace)
- Dashboard stats (active, completed, member count, success rate)
- Workspace management (create, rename, delete, invite members)
- Account settings (profile, email, password, notification preferences)
- Activity feed per workspace
- AI-powered checklist generation via Quick-AI chat

### Workspace System

- Personal mode (private checklists)
- Team workspaces with shared checklists
- Role-based access: owner, admin, member
- Invite system with pending / accepted states
- Free / Pro / Team plan limits

### Admin Panel

- Template management console
- QR code generation
- OTP-based admin login

## File Structure

```
/
├── index.html              Landing page
├── style.css               Global styles
├── hero-bg.js              Canvas ribbon background
├── script.js               Landing page interactivity
├── vercel.json             Deployment config
├── robots.txt
├── sitemap.xml
├── LICENSE                 MIT License
├── assets/                 Logos, favicon, social images
├── js/vendor/              Third-party libraries
├── pages/                  Static sub-pages
│   ├── docs.html
│   ├── changelog.html
│   ├── template.html
│   └── ai-checklist-generator.html
├── legal/                  Privacy, Terms, Security
├── admin/                  Admin dashboard
└── auth/                   Main dashboard application
    ├── index.html
    ├── style.css
    ├── config.js            Supabase client config
    └── js/
        ├── auth.js
        ├── account.js
        ├── checklist.js
        ├── workspace.js
        ├── db.js
        ├── modal.js
        ├── state.js
        ├── parser.js
        ├── utils.js
        ├── upgrade.js
        ├── ai-chat.js
        └── invite.js
```


*Checklist management for engineering teams.*
