# SERP Hawk CRM V2 — Complete Feature Documentation

> **AI-Powered CRM for SEO Agencies & Digital Marketing Firms**
> Built to manage the entire client lifecycle — from cold outreach to project delivery, billing, and SEO monitoring.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Architecture Overview](#architecture-overview)
3. [Role-Based Access Control](#role-based-access-control)
4. [Feature Breakdown](#feature-breakdown)
   - [Dashboard](#1-dashboard)
   - [Client Management](#2-client-management)
   - [Projects](#3-projects)
   - [Tasks (Kanban Board)](#4-tasks-kanban-board)
   - [AI Email Agent](#5-ai-email-agent)
   - [Call Logging](#6-call-logging)
   - [Real-Time Messaging](#7-real-time-messaging-websocket)
   - [Service Catalog & Store](#8-service-catalog--store)
   - [Service Request Pipeline](#9-service-request-pipeline)
   - [Invoicing & Billing](#10-invoicing--billing)
   - [Proposals & Contracts](#11-proposals--contracts)
   - [Keyword Rankings](#12-keyword-rankings)
   - [SEO Audit](#13-seo-audit)
   - [Competitor Analysis](#14-competitor-analysis)
   - [Milestones](#15-milestones)
   - [Notifications](#16-notifications)
   - [NPS Surveys](#17-nps-customer-satisfaction-surveys)
   - [Document OCR](#18-document-ocr)
   - [File Management](#19-file-management)
   - [Employee & Intern Management](#20-employee--intern-management)
   - [Client Onboarding & Setup](#21-client-onboarding--setup)
   - [Password Management](#22-password-management)
   - [Webhook / Zapier Integration](#23-webhook--zapier-integration)
   - [Client Portal Configuration](#24-client-portal-configuration)
   - [Interactive Page Tours](#25-interactive-page-tours)
   - [Live Monitoring Dashboard](#26-live-monitoring-dashboard)
   - [PDF Export](#27-pdf-export)
5. [Database Models](#database-models-24-tables)
6. [Full API Reference](#full-api-reference-70-endpoints)
7. [AI & ML Capabilities](#ai--ml-capabilities)
8. [Modules Breakdown](#modules-breakdown)
9. [Navigation Structure](#navigation-structure)
10. [Key Statistics](#key-statistics)

---

## Tech Stack

### Frontend
| Technology | Version | Why We Used It |
|------------|---------|----------------|
| **Next.js** | 16.1.6 | Server-side rendering + file-based routing = fast page loads and great SEO for the app itself |
| **React** | 19.2.3 | Component-based UI with hooks for clean state management |
| **TypeScript** | 5.x | Catches bugs at compile time, autocomplete for faster development |
| **Tailwind CSS** | 4.2.1 | Utility-first styling = consistent design system without writing custom CSS |
| **Framer Motion** | 12.34.3 | Smooth animations and page transitions that make the UI feel premium |
| **Lucide React** | 0.563.0 | 1000+ clean SVG icons, tree-shakeable (only ships icons you use) |

### Backend
| Technology | Version | Why We Used It |
|------------|---------|----------------|
| **FastAPI** | 0.115.0 | Modern Python framework — auto-generates API docs, async support, type validation |
| **Python** | 3.13 | Ecosystem for AI/ML, web scraping, and data processing |
| **SQLModel** | 0.0.22 | Combines SQLAlchemy (database) + Pydantic (validation) in one clean syntax |
| **Uvicorn** | 0.30.0 | ASGI server with WebSocket support for real-time features |
| **PostgreSQL** | Neon | Managed serverless Postgres — scales to zero, no server maintenance |

### AI/ML & Integrations
| Service | Why We Used It |
|---------|----------------|
| **OpenAI GPT-4o-mini** | Cheapest GPT-4 model — powers email generation, company analysis, competitor research |
| **Google Gemini** | Best-in-class OCR for extracting text from business card images |
| **Outlook/Office 365 SMTP** | Enterprise email sending with sent-folder sync via IMAP |
| **BeautifulSoup4** | Reliable HTML parsing for website scraping (no JS rendering needed) |
| **ReportLab** | Server-side PDF generation for invoices, proposals, and audit reports |
| **httpx** | Async HTTP client for firing webhooks without blocking |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    NEXT.JS FRONTEND                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐             │
│  │Admin     │  │Client    │  │Shared     │             │
│  │Sidebar   │  │Sidebar   │  │Components │             │
│  │(20 items)│  │(11 items)│  │(8 comps)  │             │
│  └──────────┘  └──────────┘  └───────────┘             │
│          Role-based routing via RoleContext              │
└───────────────────────┬─────────────────────────────────┘
                        │ REST API + WebSocket
┌───────────────────────┴─────────────────────────────────┐
│                   FASTAPI BACKEND                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │70+ REST  │  │WebSocket │  │Background│              │
│  │Endpoints │  │Chat Hub  │  │Tasks     │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│          SQLModel ORM + Session Management               │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────┴─────────────────────────────────┐
│              POSTGRESQL (NEON SERVERLESS)                 │
│              24 Tables, SSL, Connection Pool              │
└─────────────────────────────────────────────────────────┘
```

---

## Role-Based Access Control

### Why We Built This
Every CRM user has different needs. An admin needs full control, a client only needs their own data, and an intern shouldn't accidentally delete anything. We implemented 4 roles with granular access.

### Role Definitions

| Role | Who Uses It | What They See |
|------|-------------|---------------|
| **Admin** | Agency owner, operations lead | Everything — all clients, all data, user management, service catalog |
| **Employee** | Account managers, SEO specialists | Clients they handle, projects, tasks, email agent, calls, messages |
| **Intern** | Junior team members | Dashboard, assigned projects, and tasks only |
| **Client** | The agency's paying customers | Their own data — services, invoices, proposals, rankings, messages |

### Access Matrix

| Feature | Admin | Employee | Intern | Client |
|---------|:-----:|:--------:|:------:|:------:|
| Dashboard | ✅ Global | ✅ Global | ✅ Limited | ✅ Personal |
| Client Management | ✅ Full CRUD | ✅ Full CRUD | ❌ | ❌ |
| Projects | ✅ Full | ✅ Full | ✅ View | ❌ |
| Tasks | ✅ Full | ✅ Full | ✅ Assigned | ✅ Assigned |
| Email Agent (AI) | ✅ | ✅ | ❌ | ❌ |
| Calls | ✅ | ✅ | ❌ | ❌ |
| Messages | ✅ All threads | ✅ All threads | ❌ | ✅ Own threads |
| Service Catalog | ✅ Manage | ✅ View | ❌ | ✅ Browse & Request |
| Invoices | ✅ Full CRUD | ✅ Full CRUD | ❌ | ✅ View & Download |
| Proposals | ✅ Full CRUD | ✅ Full CRUD | ❌ | ✅ Accept/Reject |
| Rankings | ✅ Record | ✅ Record | ❌ | ✅ View |
| Employees | ✅ Only | ❌ | ❌ | ❌ |
| Interns | ✅ | ✅ | ❌ | ❌ |
| Services Admin | ✅ Only | ❌ | ❌ | ❌ |
| Notifications | ✅ | ✅ | ✅ | ✅ |
| SEO Audit | ✅ | ✅ | ❌ | ✅ Trigger |
| Milestones | ✅ | ✅ | ❌ | ✅ View |

### How It Works
- **Frontend**: `RoleContext` wraps the entire app — checks `localStorage` for the logged-in user's role
- **Routing**: `layout.tsx` renders `AdminSidebar` for admin/employee/intern, `ClientSidebar` for clients
- **Backend**: Endpoints filter data based on role (e.g., clients only see their own invoices)

---

## Feature Breakdown

### 1. Dashboard

**Why**: First thing every user sees. Needs to give instant situational awareness.

#### Admin Dashboard
- **Stat Cards**: Total clients, active projects, emails sent, calls logged, employees, interns
- **Activity Chart**: Visual trend of actions over time
- **Quick Navigation Cards**: One-click access to Clients, Projects, Email Agent, Rankings, Invoices
- **Recent Activity Feed**: Last 10 actions across the system

#### Client Dashboard (Dark Theme)
- **Company Info**: Name, project name, website URL, status indicator
- **Service Overview**: Active services with status badges
- **Invoice Summary**: Total billed, paid, pending, overdue amounts
- **Milestone Tracker**: Progress toward deliverables
- **File Uploads**: Quick access to uploaded documents
- **Activity Timeline**: What's happened on their account

**Endpoints Used**: `GET /dashboard-stats` (role-aware)

---

### 2. Client Management

**Why**: The core of any CRM. Every interaction, metric, and document is tied to a client profile.

#### Features
- **Client List**: Searchable, filterable by status (Active/Hold/Pending), with bulk actions
- **Client Cards**: Company name, assigned employee, status badge, quick-action menu
- **Client Detail Page**: Full profile with tabs for remarks, activities, services, keywords
- **Client X-Ray (Admin)**: Aggregated 360° view — all services, audits, analytics, communication history, billing
- **OCR Client Import**: Upload a business card → AI extracts name, email, phone, company → creates client profile
- **Activity Logging**: Track every touchpoint — email, phone call, in-person meeting, WhatsApp, website interaction
- **Internal Remarks**: Private notes visible only to team (not client)
- **Keyword Tracking**: Assign target keywords per client for ranking monitoring
- **Custom Fields**: JSON custom data for flexible data capture
- **Employee Assignment**: Assign a handler to each client

#### Data Model
```
ClientProfile: 30+ fields including companyName, phone, address, status,
gmbName, seoStrategy, tagline, websiteUrl, targetKeywords[], 
assignedEmployeeId, payment_status, recommended_services, customFields{}
```

**Endpoints**: 10+ endpoints for full CRUD, remarks, activities, keywords, file management

---

### 3. Projects

**Why**: SEO campaigns are projects. Track progress, assign teams, and monitor deliverables.

#### Features
- **Project Board**: List view with status badges (Planning / Active / Completed / Hold)
- **Progress Bar**: 0-100% visual indicator
- **Team Assignment**: Assign employees, interns, and clients to each project
- **Project Remarks**: Internal discussion threads per project
- **Status Workflow**: Planning → Active → Completed or Hold

**Endpoints**: `GET/POST /projects`, `GET/PUT/DELETE /projects/{id}`, `POST /projects/{id}/remarks`

---

### 4. Tasks (Kanban Board)

**Why**: Every project needs trackable work items. Kanban makes status visible at a glance.

#### Features
- **Three Columns**: Todo → In Progress → Done
- **Priority Levels**: Low (green), Medium (amber), High (orange), Urgent (red)
- **Comments**: Thread per task for discussion
- **Assignment**: Assign to any team member or client
- **Due Dates**: Date tracking with visual indicators
- **Project/Client Linking**: Associate tasks with specific projects or clients
- **Role-Aware**: Admins see all tasks, clients see only their assigned tasks

**Endpoints**: `GET/POST /tasks`, `GET/PUT/DELETE /tasks/{id}`, `POST /tasks/{id}/comments`

---

### 5. AI Email Agent

**Why**: Cold outreach is how agencies get new clients. AI researches companies, matches services, and writes personalized emails — saving hours per prospect.

#### How It Works
```
1. Enter company name or website URL
2. AI scrapes the website (BeautifulSoup)
3. GPT-4o-mini analyzes: industry, pain points, business model
4. AI discovers contact info (email, name, role)
5. AI matches company needs to your service catalog
6. AI generates bilingual email (English + Spanish)
7. Review, edit, and send — or save as draft
```

#### Features
- **Smart Research**: One-click company analysis with LLM
- **Service Matching**: Recommends 2-4 services with ROI justification
- **Bilingual Emails**: Toggle between English and Spanish preview
- **Email Sending**: Direct send via Outlook SMTP with CC support
- **Sent History**: Track all outreach with timestamps
- **Draft System**: Save email drafts for review before sending
- **Auto Client Creation**: Sending an email auto-creates a client profile

**Endpoints**: `POST /smart-research`, `POST /research-map-company`, `POST /send-manual`, `GET /sent-emails`

---

### 6. Call Logging

**Why**: Phone calls are a major touchpoint with clients. Without logging, conversations are lost.

#### Features
- **Log Calls**: Phone number, duration, timestamp
- **AI Summary**: GPT-4o-mini can summarize call recordings
- **Work Tracking**: Document what was done after the call
- **Follow-Up Management**: Flag calls needing follow-up with due date
- **Client Linking**: Associate calls with specific clients
- **Filter**: View unsummarized calls for batch processing

**Endpoints**: `GET/POST /calls`, `PUT /calls/{id}`, `POST /calls/{id}/summary`

---

### 7. Real-Time Messaging (WebSocket)

**Why**: Clients need to communicate with their account managers. Polling every 15 seconds feels sluggish — WebSocket makes it instant.

#### Features
- **WebSocket Chat**: True real-time messaging via `/ws/chat/{thread_id}`
- **Typing Indicators**: See "John is typing..." with animated dots
- **Read Receipts**: Single gray check (sent) → Double blue check (read)
- **Thread-Based**: Each conversation tied to a service request
- **Unread Badges**: Count of unread messages per thread
- **Search & Filter**: Find threads by name, filter by status (Running/Done/Hold)
- **Fallback Polling**: If WebSocket drops, falls back to 30-second polling
- **Keyboard Shortcuts**: Enter to send, Shift+Enter for newline

#### How Read Receipts Work
```
1. User A sends message → stored in DB, broadcast via WebSocket
2. User B opens thread → frontend sends read_receipt action
3. Backend marks messages as is_read=true, sets read_at timestamp
4. Backend broadcasts read_receipt to User A
5. User A sees checkmarks turn blue
```

**Endpoints**: `GET /messages/{user_id}`, `POST /messages/send`, `WS /ws/chat/{thread_id}`

---

### 8. Service Catalog & Store

**Why**: The agency sells services. The catalog is the product list. The store is the storefront for clients.

#### Admin — Service Catalog Builder
- Create services with name, cost, descriptions, handler role
- Rich descriptions (intro + full)
- Past results showcase
- Active/inactive toggle

#### Client — Service Store (Dark Theme)
- Browse available services with cards
- View pricing, descriptions, past results
- One-click "Request Quote" button
- Track request status

**Endpoints**: `GET/POST /services`, `POST /services/request`, `GET /services/my-requests`

---

### 9. Service Request Pipeline

**Why**: The money flow. From client request → admin quote → acceptance → delivery.

#### Pipeline Stages
```
Pending → Quoted → Accepted → In Progress → Delivered
```

#### Features
- **Request Board**: Admin sees all pending requests
- **Quote System**: Admin enters amount, message, team info, document URL
- **Quote Acceptance**: Client accepts or requests changes
- **Status Tracking**: Visual status badges at every stage
- **Services Overview**: Dashboard showing request counts by status
- **Auto Thread Creation**: A message thread is created for each service request

**Endpoints**: `POST /services/quote`, `POST /services/accept-quote/{id}`, `GET /services/requests`, `GET /admin/services-overview`

---

### 10. Invoicing & Billing

**Why**: Without invoicing, you can't get paid. This replaces spreadsheets and manual PDF creation.

#### Features
- **Create Invoices**: From scratch or auto-generate from accepted quotes
- **Line Items**: Multiple items per invoice with descriptions and amounts
- **Tax Calculation**: Separate tax field with auto-total
- **Auto Numbering**: Generates INV-2026-0001 format
- **6 Status Types**: Draft → Sent → Paid / Overdue / Partial / Cancelled
- **Due Date Tracking**: Visual overdue indicators
- **Payment Recording**: Mark as paid with timestamp
- **PDF Export**: Professional PDF download
- **Client View**: Clients see only their invoices with status and download

**Endpoints**: `GET/POST /invoices`, `GET/PUT/DELETE /invoices/{id}`, `POST /invoices/from-quote/{request_id}`, `GET /invoices/{id}/pdf`

---

### 11. Proposals & Contracts

**Why**: Before billing, you need signed proposals. This formalizes the agreement between agency and client.

#### Features
- **Rich Content Editor**: Full text proposal writing
- **5 Status Types**: Draft → Sent → Accepted / Rejected / Demo Requested
- **Validity Dates**: Set expiration on proposals
- **Total Value**: Track deal value for pipeline forecasting
- **Signature Tracking**: Record when client signed (signed_at timestamp)
- **PDF Export**: Professional proposal PDF download
- **Client Actions**: Clients can accept, reject, or request a demo
- **Service Linking**: Connect proposals to specific service requests

**Endpoints**: `GET/POST /proposals`, `GET/PUT/DELETE /proposals/{id}`, `GET /proposals/{id}/pdf`

---

### 12. Keyword Rankings

**Why**: SEO agencies need to prove results. Ranking tracking shows clients their keywords climbing Google.

#### Features
- **Manual Entry**: Record keyword position, URL, search engine
- **Position History**: Track how positions change over time per keyword
- **Multi-Engine**: Google, Bing, Yahoo support
- **Notes**: Add context to each ranking entry
- **Client View**: Clients see their keyword positions and trends
- **Recorded By**: Track which team member logged the data

**Endpoints**: `GET/POST /rankings`, `GET /rankings/history/{client_id}/{keyword}`, `DELETE /rankings/{id}`

---

### 13. SEO Audit

**Why**: Clients want to know the health of their website. Audits identify technical SEO issues to fix.

#### Features
- **Trigger Audit**: Enter domain, run analysis
- **Health Score**: Overall site health (0-100)
- **PageSpeed Scores**: Desktop and mobile separately
- **Core Web Vitals**: Pass/fail status
- **On-Page Issues**: AI-detected content problems
- **Technical Issues**: Crawl errors, broken links, schema problems
- **PDF Export**: Downloadable audit report

**Data Model**: `SEOAudit` — health_score, page_speed_desktop, page_speed_mobile, core_web_vitals_passed, on_page_issues, tech_seo_issues

---

### 14. Competitor Analysis

**Why**: Understanding what competitors do better lets you create targeted strategies. Real AI analysis, not just screenshots.

#### How It Works
```
1. Enter competitor domain + select client
2. Backend scrapes both competitor and client websites
3. GPT-4o-mini compares them across 4 dimensions:
   - Keyword Gap: What keywords competitor targets that client doesn't
   - Content Analysis: Competitor strengths, weaknesses, content opportunities
   - Backlink Estimate: Authority level, referring domain range, link building ideas
   - Threat Level: Low / Medium / High
4. Returns 5 specific action items
5. Saved to database for historical tracking
```

#### Features
- **Real Data**: Actual website scraping + AI analysis (not mock data)
- **Keyword Gap**: Shows which keywords the competitor owns
- **Content Benchmarks**: Identifies content opportunities
- **Backlink Comparison**: Estimates competitor authority
- **Action Items**: 5 specific recommendations per competitor
- **History**: Re-run analysis to track changes over time

**Endpoints**: `POST /competitors/analyze`, `GET /competitors/{client_id}`, `DELETE /competitors/{id}`

---

### 15. Milestones

**Why**: Large projects need visible deliverables. Milestones break work into trackable goals with deadlines.

#### Features
- **Create Milestones**: Title, description, due date
- **Link to Projects or Clients**: Flexible association
- **Status Tracking**: Pending → In Progress → Achieved
- **Ordering**: Drag to reorder milestones
- **Due Dates**: Visual deadline indicators
- **Client View**: Clients see their project milestones and progress

**Endpoints**: `GET/POST /milestones`, `PUT/DELETE /milestones/{id}`

---

### 16. Notifications

**Why**: Users need to know when something important happens — a new invoice, task assignment, or quote received.

#### Features
- **4 Types**: Info (blue), Success (green), Warning (amber), Error (red)
- **Clickable Links**: Each notification can link to the relevant page
- **Read Tracking**: Mark individual or mark all as read
- **Per-User Feed**: Each user gets their own notification stream
- **Badge Counts**: Unread count in sidebar

**Endpoints**: `GET /notifications/{user_id}`, `POST /notifications`, `PUT /notifications/{id}/read`, `PUT /notifications/mark-all-read/{user_id}`

---

### 17. NPS Customer Satisfaction Surveys

**Why**: Measuring client satisfaction identifies at-risk accounts before they churn.

#### Features
- **Trigger Survey**: Admin sends NPS survey to any client
- **Score**: 0-10 scale (Detractor/Passive/Promoter)
- **Feedback**: Optional text feedback from client
- **Survey Page**: Clean public-facing survey at `/survey/[id]`
- **Results Tracking**: View all responses with timestamps

**Endpoints**: `GET /nps`, `POST /nps/trigger/{client_id}`, `POST /nps/{id}/respond`

---

### 18. Document OCR

**Why**: Business cards, receipts, and documents contain data that needs to be in the CRM. AI extraction saves manual data entry.

#### How It Works
```
1. Upload image (business card, document, etc.)
2. Image compressed and sent to Google Gemini API
3. AI extracts: name, email, phone, company, address, role
4. Review extracted data in the UI
5. Save as new client profile
```

**Endpoints**: `POST /documents/ocr`

---

### 19. File Management

**Why**: Clients need to share files (logos, content, reports) with the agency. A dedicated file space keeps things organized.

#### Features
- **Upload Files**: Any file type with description
- **Metadata Tracking**: Filename, size, MIME type, uploader, timestamp
- **Client Scoped**: Files organized per client
- **Download**: Direct file access via URL
- **Delete**: Remove obsolete files
- **My Files (Client)**: Clients manage their own uploads

**Endpoints**: `GET/POST /clients/{id}/files`, `DELETE /files/{id}`

---

### 20. Employee & Intern Management

**Why**: The agency needs to manage its team — create accounts, assign roles, reset credentials.

#### Features
- **Employee List**: All team members with roles, email, creation date
- **Intern Portfolio**: Separate intern management with project assignments
- **Create Users**: Admin creates accounts with role selection
- **Delete Users**: Remove team members
- **Role Assignment**: Admin, Employee, Intern, Client

**Endpoints**: `GET /employees`, `GET /interns`, `POST /users`, `DELETE /users/{id}`

---

### 21. Client Onboarding & Setup

**Why**: New clients need to connect their assets (website, social media) before SEO work can begin.

#### Features
- **Domain Verification**: Enter website URL, backend validates
- **Sitemap Detection**: Auto-discover sitemap and CMS type
- **Social Media Connection**: Connect Facebook, LinkedIn, YouTube
- **Progress Tracking**: Visual completion bar on dashboard
- **One-Click SEO Audit**: Trigger initial audit after setup

---

### 22. Password Management

**Why**: Clients need to change their passwords without contacting support.

#### Features
- **Change Password**: Current password → New password → Confirm
- **Validation**: Minimum 6 characters, password match check
- **Show/Hide Toggle**: Eye icons on password fields
- **Real-Time Feedback**: Red/green border on confirm field for match status
- **Success/Error Banners**: Clear feedback after submission
- **Secure**: Password hashed with SHA-256 before storage
- **Immediate Effect**: New password works on next login

**Location**: Settings page → Password Change section

**Endpoint**: `POST /change-password`

---

### 23. Webhook / Zapier Integration

**Why**: Businesses use tools like Zapier, Make.com, or custom integrations. Webhooks let external apps react to CRM events in real-time.

#### Features
- **Register Webhooks**: Provide a URL and select events to listen to
- **15 Event Types**:
  - `client.created`, `client.updated`, `client.deleted`
  - `invoice.created`, `invoice.paid`, `invoice.overdue`
  - `message.sent`, `task.created`, `task.completed`
  - `proposal.sent`, `proposal.accepted`, `proposal.rejected`
  - `service.requested`, `service.quoted`, `service.accepted`
- **HMAC-SHA256 Signing**: Every webhook payload is signed with a secret for verification
- **Headers Sent**: `X-Webhook-Event`, `X-Webhook-Signature`, `Content-Type: application/json`
- **Management**: List all webhooks, delete unneeded ones
- **Best-Effort Delivery**: Non-blocking, async firing with 10s timeout

#### Example: Zapier Integration
```
1. Create a Zapier webhook trigger (get URL)
2. Register in CRM: POST /webhooks { url: "...", events: ["invoice.paid"] }
3. When an invoice is paid, Zapier receives the payload
4. Zapier triggers: send Slack notification, update Google Sheet, etc.
```

**Endpoints**: `POST /webhooks`, `GET /webhooks`, `DELETE /webhooks/{id}`

---

### 24. Client Portal Configuration

**Why**: Agencies want to white-label the client portal with their own branding.

#### Features
- **Custom Branding**: Company name, logo URL, primary/accent colors, favicon
- **Feature Toggles**: Show/hide pricing, store, rankings, milestones, proposals, file upload
- **Portal Domain**: Configure subdomain for client access

**Endpoints**: `GET /portal/config`, `PUT /portal/config`

---

### 25. Interactive Page Tours

**Why**: New users don't know what each page does. Instead of a manual, every page has a step-by-step guided tour.

#### Features
- **Full-Screen Tour Overlay**: Professional modal with progress bar
- **Step-by-Step Navigation**: Next / Back buttons with keyboard support (Arrow keys, Enter, Escape)
- **Clickable Progress Dots**: Jump to any step
- **Animated Transitions**: Smooth slide animations between steps
- **Auto-Launch**: Opens automatically on first visit to any page
- **Persistent Memory**: Remembers completion per page via localStorage
- **Restart Anytime**: Floating `?` button to replay the tour
- **26 Pages Covered**: Every single page has a customized guided tour

---

### 26. Live Monitoring Dashboard

**Why**: Agency owners need a real-time view of business health — keyword performance, revenue, and team activity.

#### Features
- **KPI Cards**: Key metrics at a glance
- **Activity Chart**: Team productivity over time
- **Keyword Table**: Live ranking positions
- **Revenue Tracking**: Monthly revenue and growth

**Endpoint**: `GET /monitor-stats`

---

### 27. PDF Export

**Why**: Clients need downloadable documents for their records and accounting.

#### Supported Exports
- **Invoices**: Professional invoice PDF with line items, tax calculation, branding
- **Proposals**: Full proposal document with content and terms
- **SEO Audits**: Technical audit report

**Technology**: ReportLab (server-side Python PDF generation)

---

## Database Models (24 Tables)

| # | Model | Table Name | Fields | Purpose |
|---|-------|-----------|--------|---------|
| 1 | **User** | users | id, email, password, name, role, createdAt, updatedAt | Authentication |
| 2 | **ClientProfile** | client_profiles | 30+ fields | Full client data |
| 3 | **ClientStatus** | client_statuses | id, name, color | Dynamic statuses |
| 4 | **Project** | projects | id, name, description, status, progress, employeeIds, internIds, clientIds | Project tracking |
| 5 | **ServiceCatalog** | service_catalog | id, name, cost, descriptions, handler_role, image_url, is_active | Service offerings |
| 6 | **ServiceRequest** | service_requests | id, service_id, client_id, status, quoted_amount, quote_message | Service pipeline |
| 7 | **MessageThread** | message_threads | id, service_request_id, client_id, employee_id, status | Chat containers |
| 8 | **ChatMessage** | chat_messages | id, thread_id, sender_id, content, is_system, is_read, read_at, timestamp | Messages |
| 9 | **CallLog** | call_logs | id, phone_number, duration, summary, work_done, followup_needed | Call records |
| 10 | **Remark** | remarks | id, content, authorId, clientId, projectId, isInternal | Notes |
| 11 | **ActivityLog** | activity_logs | id, userId, clientId, action, method, content, details | Audit trail |
| 12 | **Document** | documents | id, filename, fileUrl, ocrText, status, uploaderId | OCR docs |
| 13 | **ClientFileUpload** | client_file_uploads | id, client_id, filename, file_url, file_size, mime_type | File storage |
| 14 | **Invoice** | invoices | id, invoice_number, amount, tax, total, status, line_items, due_date | Billing |
| 15 | **Proposal** | proposals | id, title, content, status, valid_until, total_value, signed_at | Contracts |
| 16 | **Task** | tasks | id, title, status, priority, due_date, assigned_to, project_id | Kanban items |
| 17 | **TaskComment** | task_comments | id, task_id, author_id, content | Task discussions |
| 18 | **Milestone** | milestones | id, title, project_id, client_id, due_date, status, order | Deliverables |
| 19 | **Notification** | notifications | id, user_id, title, message, type, link, is_read | Alerts |
| 20 | **NPSSurvey** | nps_surveys | id, client_id, score, feedback | Satisfaction |
| 21 | **KeywordRankEntry** | keyword_rank_entries | id, client_id, keyword, position, url, search_engine | Rankings |
| 22 | **CompetitorAnalysis** | competitor_analyses | id, clientId, competitor_domain, keyword_gap_data, backlink_comparison | Competitors |
| 23 | **SEOAudit** | seo_audits | id, clientId, health_score, page_speed, core_web_vitals | Audits |
| 24 | **AnalyticsData** | analytics_data | id, clientId, sessions, pageviews, bounce_rate, gsc_data, ads_data | Analytics |
| 25 | **SentEmail** | sent_emails | id, to_email, subject, english_body, spanish_body | Outreach |
| 26 | **Company** | companies | id, company_name, website_url, primary_email | Prospects |
| 27 | **EmailLog** | email_logs | id, company_id, sender_email, subject | Rate limiting |
| 28 | **RankingTracker** | ranking_tracker | id, clientId, keyword, position, serp_features | SERP tracking |
| 29 | **SocialProfile** | social_profiles | id, clientId, platform, profile_url, is_connected | Social media |

---

## Full API Reference (70+ Endpoints)

### Authentication & Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/login` | Email/password login, returns user object |
| POST | `/users` | Create new user (any role) |
| DELETE | `/users/{id}` | Delete user |
| POST | `/change-password` | Update password (requires current password) |

### Clients
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/clients` | List all clients (filter by status) |
| POST | `/clients` | Create new client |
| GET | `/clients/{id}` | Get client details |
| PUT | `/clients/{id}` | Update client profile |
| DELETE | `/clients/{id}` | Delete client |
| POST | `/clients/{id}/assign-employee` | Assign handler |
| POST | `/clients/{id}/keywords` | Add target keyword |
| DELETE | `/clients/{id}/keywords` | Remove keyword |
| GET | `/client-statuses` | Get available status types |
| GET | `/admin/client-xray/{id}` | Full client 360° view |

### Client Details
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/clients/{id}/remarks` | Internal notes |
| POST | `/clients/{id}/remarks` | Add note |
| GET | `/clients/{id}/activities` | Activity timeline |
| POST | `/clients/{id}/activities` | Log activity |
| GET | `/clients/{id}/timeline` | Rich timeline view |
| GET | `/clients/{id}/emails` | Email history |
| GET | `/clients/{id}/files` | Client files |
| POST | `/clients/{id}/files` | Upload file |
| DELETE | `/files/{id}` | Delete file |

### AI Email Agent
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/smart-research` | Full AI pipeline: scrape → analyze → email |
| POST | `/research-map-company` | Scrape + map to services |
| POST | `/send-manual` | Send email + create client |
| GET | `/sent-emails` | Outreach history |

### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/projects` | List all projects |
| POST | `/projects` | Create project |
| GET | `/projects/{id}` | Get with remarks |
| PUT | `/projects/{id}` | Update project |
| DELETE | `/projects/{id}` | Delete project |
| POST | `/projects/{id}/remarks` | Add project note |

### Services
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/services` | Active service catalog |
| POST | `/services` | Create service (Admin) |
| POST | `/services/request` | Client requests service |
| GET | `/services/my-requests` | Client's requests |
| GET | `/services/requests` | All requests (Admin) |
| POST | `/services/quote` | Send quote |
| POST | `/services/accept-quote/{id}` | Accept quote |
| GET | `/admin/services-overview` | Status dashboard |

### Messages
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/messages/{user_id}` | Get all threads |
| POST | `/messages/send` | Send message (REST fallback) |
| WS | `/ws/chat/{thread_id}` | Real-time WebSocket chat |

### Tasks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tasks` | List (filter by client/status) |
| POST | `/tasks` | Create task |
| GET | `/tasks/{id}` | Get with comments |
| PUT | `/tasks/{id}` | Update task |
| DELETE | `/tasks/{id}` | Delete task |
| POST | `/tasks/{id}/comments` | Add comment |

### Invoices
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/invoices` | List (filter by client) |
| POST | `/invoices` | Create invoice |
| GET | `/invoices/{id}` | Get details |
| PUT | `/invoices/{id}` | Update invoice |
| DELETE | `/invoices/{id}` | Delete invoice |
| POST | `/invoices/from-quote/{id}` | Generate from service quote |
| GET | `/invoices/{id}/pdf` | Download PDF |

### Proposals
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/proposals` | List proposals |
| POST | `/proposals` | Create proposal |
| GET | `/proposals/{id}` | Get details |
| PUT | `/proposals/{id}` | Update proposal |
| DELETE | `/proposals/{id}` | Delete proposal |
| GET | `/proposals/{id}/pdf` | Download PDF |

### Calls
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/calls` | List calls |
| POST | `/calls` | Log call |
| PUT | `/calls/{id}` | Update call |
| POST | `/calls/{id}/summary` | Add summary |

### Rankings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/rankings` | List rankings |
| POST | `/rankings` | Record entry |
| GET | `/rankings/history/{client_id}/{keyword}` | Keyword history |
| DELETE | `/rankings/{id}` | Delete entry |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notifications/{user_id}` | User's notifications |
| POST | `/notifications` | Create notification |
| PUT | `/notifications/{id}/read` | Mark as read |
| PUT | `/notifications/mark-all-read/{user_id}` | Mark all read |

### Milestones
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/milestones` | List milestones |
| POST | `/milestones` | Create milestone |
| PUT | `/milestones/{id}` | Update milestone |
| DELETE | `/milestones/{id}` | Delete milestone |

### NPS Surveys
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/nps` | List responses |
| POST | `/nps/trigger/{client_id}` | Trigger survey |
| POST | `/nps/{id}/respond` | Submit response |

### Competitors
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/competitors/analyze` | AI competitor analysis |
| GET | `/competitors/{client_id}` | Get client's competitors |
| DELETE | `/competitors/{id}` | Remove analysis |

### Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhooks` | Register webhook |
| GET | `/webhooks` | List webhooks |
| DELETE | `/webhooks/{id}` | Delete webhook |

### Portal
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/portal/config` | Get portal branding |
| PUT | `/portal/config` | Update portal config |

### Dashboard & Monitoring
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard-stats` | Role-based dashboard data |
| GET | `/monitor-stats` | Live monitoring data |
| GET | `/search` | Global search |
| GET | `/activities` | Recent activity feed |

### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| GET | `/health` | Server status |
| POST | `/setup/verify-domain` | Domain verification |
| POST | `/audit/trigger` | Trigger SEO audit |
| GET | `/audit/export` | Export audit PDF |
| POST | `/documents/ocr` | OCR text extraction |

---

## AI & ML Capabilities

### 1. Company Research Pipeline
- **Input**: Company name or website URL
- **Process**: Web scraping → LLM analysis → Contact discovery → Service matching → Email generation
- **Output**: Full company profile + recommended services + bilingual email draft
- **Model**: GPT-4o-mini

### 2. Bilingual Email Generation
- **Languages**: English + Spanish
- **Personalization**: Company-specific pain points, recommended services, ROI hooks
- **Model**: GPT-4o-mini

### 3. Document OCR
- **Input**: Business card or document image
- **Process**: Image compression → Gemini Vision API → Structured data extraction
- **Output**: Name, email, phone, company, role
- **Model**: Google Gemini

### 4. Competitor Analysis
- **Input**: Two websites (client + competitor)
- **Process**: Dual-site scraping → LLM comparison across 4 dimensions
- **Output**: Keyword gap, content benchmarks, backlink estimate, action items
- **Model**: GPT-4o-mini

### 5. Call Summarization
- **Input**: Call description/notes
- **Process**: LLM summary generation
- **Output**: Concise summary + follow-up items

---

## Modules Breakdown

| Module | Key Functions | Purpose |
|--------|---------------|---------|
| `email_sender.py` | `send_email_outlook()` | SMTP email sending with HTML, CC, IMAP sent-folder sync |
| `scraper.py` | `scrape_website()`, `research_and_map_company()` | Website scraping, company research pipeline |
| `llm_engine.py` | `analyze_content()`, `generate_email()`, `analyze_document()` | All OpenAI LLM interactions |
| `market_analyzer.py` | `analyze_market()`, `match_services()` | Market analysis + service recommendation |
| `fallback_analyzer.py` | `analyze_company_name_fallback()` | Fallback when scraping fails |
| `service_extractor.py` | `extract_services()` | Service extraction from text |
| `image_generator.py` | `generate_email_image()` | Visual asset generation |
| `serp_hawk_email.py` | `generate_serp_hawk_email()` | Specialized SEO outreach emails |

---

## Navigation Structure

### Admin/Employee Sidebar (5 Sections, 20 Items)

```
CORE
├── Dashboard
├── Clients
├── Projects
└── Tasks [NEW]

GROWTH ENGINE
├── Email Agent [AI]
├── Calls
├── Messages
└── Notifications

REVENUE
├── Invoices [NEW]
└── Proposals [NEW]

ORGANIZATION
├── Services Overview
├── Request Board
├── Employees (Admin only)
├── Interns
└── Services (Admin only)

TOOLS
├── Rankings [NEW]
├── Audit
└── Pricing
```

### Client Sidebar (11 Items, Dark Theme)

```
├── Dashboard
├── Services (Store)
├── Tasks
├── Invoices
├── Proposals
├── Rankings
├── Messages
├── Milestones
├── My Files
├── Notifications
└── Settings
```

---

## Key Statistics

| Metric | Value |
|--------|-------|
| Total API Endpoints | 70+ |
| Database Tables | 29 |
| Frontend Pages | 40+ |
| Components | 8 shared + page-specific |
| Admin Nav Items | 20 |
| Client Nav Items | 11 |
| Roles Supported | 4 |
| AI Models | 2 (GPT-4o-mini, Gemini) |
| PDF Exports | 3 (Invoice, Proposal, Audit) |
| Real-Time Features | WebSocket chat with typing + read receipts |
| Webhook Events | 15 event types |
| Service Pipeline Stages | 5 |
| Invoice Statuses | 6 |
| Proposal Statuses | 5 |
| Task Priority Levels | 4 |

---

*Built with Next.js + FastAPI + PostgreSQL + OpenAI — SERP Hawk CRM V2*
