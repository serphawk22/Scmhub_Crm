# SERP Hawk CRM V2 — Feature Brief

> AI-Powered CRM for SEO Agencies | Next.js + FastAPI + PostgreSQL + OpenAI

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS 4, Framer Motion
- **Backend**: FastAPI (Python 3.13), SQLModel ORM, Uvicorn with WebSocket
- **Database**: PostgreSQL (Neon Serverless) — 29 tables
- **AI**: OpenAI GPT-4o-mini (emails, analysis, competitors), Google Gemini (OCR)
- **Integrations**: Outlook SMTP/IMAP, Webhooks (Zapier-ready), ReportLab PDFs

---

## Roles (4)

| Role | Access |
|------|--------|
| **Admin** | Full system access — clients, billing, employees, services, settings |
| **Employee** | Clients, projects, tasks, email agent, calls, messages |
| **Intern** | Dashboard, assigned projects and tasks only |
| **Client** | Own data — services, invoices, proposals, rankings, messages, files |

---

## Core Features (27)

### 1. Dashboard
Admin: stat cards, activity charts, quick nav, recent feed. Client: company info, services, invoices, milestones, files, timeline.

### 2. Client Management
Full CRUD, searchable list, status filters, client detail page with tabs, 360° X-Ray view, activity logging, internal remarks, keyword tracking, employee assignment.

### 3. Projects
List with status badges (Planning/Active/Completed/Hold), progress bar, team assignment, project remarks.

### 4. Tasks (Kanban Board)
Three columns (Todo/In Progress/Done), 4 priority levels, comments, assignment, due dates, project/client linking.

### 5. AI Email Agent
Enter company → AI scrapes website → analyzes business → discovers contacts → matches services → generates bilingual email (EN/ES) → send or save draft. Auto-creates client profile on send.

### 6. Call Logging
Log calls with duration, AI summaries, work tracking, follow-up flags, client linking.

### 7. Real-Time Messaging (WebSocket)
WebSocket chat at `/ws/chat/{thread_id}`, typing indicators (animated dots), read receipts (gray → blue double-check), thread-based, unread badges, search/filter, fallback polling.

### 8. Service Catalog & Store
Admin builds catalog (name, cost, descriptions). Clients browse store and request quotes.

### 9. Service Request Pipeline
`Pending → Quoted → Accepted → In Progress → Delivered`. Admin sends quotes, clients accept, auto-creates message threads.

### 10. Invoicing & Billing
Line items, tax calculation, auto-numbering (INV-2026-0001), 6 statuses (Draft/Sent/Paid/Overdue/Partial/Cancelled), due date tracking, PDF export, generate from quotes.

### 11. Proposals & Contracts
Rich content editor, 5 statuses (Draft/Sent/Accepted/Rejected/Demo Requested), validity dates, signature tracking, PDF export, client accept/reject actions.

### 12. Keyword Rankings
Manual position entry, history tracking over time, multi-engine (Google/Bing/Yahoo), client-facing view.

### 13. SEO Audit
Trigger audit by domain, health score (0-100), PageSpeed (desktop + mobile), Core Web Vitals, on-page/technical issues, PDF export.

### 14. Competitor Analysis (AI)
Scrapes both sites → GPT-4o-mini compares keyword gap, content, backlinks, threat level → 5 action items. Saved for historical tracking.

### 15. Milestones
Create deliverables with due dates, link to projects/clients, status tracking (Pending/In Progress/Achieved), client-visible.

### 16. Notifications
4 types (info/success/warning/error), clickable links, read tracking, per-user feed, unread badge counts.

### 17. NPS Surveys
Trigger survey to client, 0-10 score, optional feedback, public survey page, results tracking.

### 18. Document OCR
Upload business card/document → Google Gemini extracts name, email, phone, company → save as client.

### 19. File Management
Upload any file type, metadata tracking, client-scoped, download/delete, client self-service uploads.

### 20. Employee & Intern Management
Team list, create accounts with role selection, delete users, separate intern management.

### 21. Client Onboarding & Setup
Domain verification, sitemap detection, CMS identification, social media connection, progress bar.

### 22. Password Management
Change password UI with current/new/confirm fields, show/hide toggles, real-time match validation, success/error banners.

### 23. Webhook / Zapier Integration
Register webhook URLs, 15 event types (client/invoice/message/task/proposal/service events), HMAC-SHA256 signed payloads, async delivery.

### 24. Client Portal Configuration
Custom branding (logo, colors, favicon), feature toggles (show/hide pricing, store, rankings, etc.), portal domain config.

### 25. Interactive Page Tours
Step-by-step modal overlay on all 26 pages, Next/Back/Skip buttons, animated transitions, keyboard nav, auto-launch on first visit, floating `?` restart button.

### 26. Live Monitoring Dashboard
KPI cards, activity charts, keyword table, revenue tracking.

### 27. PDF Export
Professional PDFs for invoices, proposals, and SEO audits via ReportLab.

---

## AI Pipelines (5)

1. **Company Research** — Scrape → Analyze → Contact discovery → Service match → Email draft
2. **Bilingual Email Gen** — Personalized EN/ES outreach with ROI hooks
3. **Document OCR** — Image → Gemini Vision → Structured contact data
4. **Competitor Analysis** — Dual-site scrape → 4-dimension LLM comparison
5. **Call Summarization** — Notes → Concise summary + follow-ups

---

## API Overview (70+ Endpoints)

| Category | Endpoints | Key Operations |
|----------|:---------:|----------------|
| Auth & Users | 4 | Login, create user, delete, change password |
| Clients | 14 | CRUD, remarks, activities, timeline, files, keywords, X-Ray |
| Email Agent | 4 | Smart research, company mapping, send, history |
| Projects | 6 | CRUD + remarks |
| Services | 8 | Catalog CRUD, request, quote, accept, overview |
| Messages | 2 + WS | REST send + WebSocket real-time |
| Tasks | 6 | CRUD + comments |
| Invoices | 7 | CRUD, generate from quote, PDF |
| Proposals | 6 | CRUD + PDF |
| Calls | 4 | CRUD + AI summary |
| Rankings | 4 | CRUD + history |
| Notifications | 4 | CRUD + mark read |
| Milestones | 4 | CRUD |
| NPS | 3 | List, trigger, respond |
| Competitors | 3 | Analyze, list, delete |
| Webhooks | 3 | Register, list, delete |
| Portal | 2 | Get/update config |
| System | 6 | Health, search, dashboard, monitor, audit, OCR |

---

## Key Numbers

| Metric | Value |
|--------|-------|
| API Endpoints | 70+ |
| Database Tables | 29 |
| Frontend Pages | 40+ |
| User Roles | 4 |
| AI Models | 2 |
| PDF Exports | 3 |
| Webhook Events | 15 |
| Guided Tours | 26 pages |
| Service Pipeline Stages | 5 |
| Invoice Statuses | 6 |
| Proposal Statuses | 5 |
| Task Priorities | 4 |

---

*SERP Hawk CRM V2 — Built for SEO agencies to manage clients, automate outreach, and deliver results.*
