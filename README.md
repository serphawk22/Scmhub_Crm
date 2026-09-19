# SERP Hawk CRM V2 Setup Guide

Welcome to the **SERP Hawk CRM V2** repository. This is an AI-powered CRM for SEO agencies, featuring a FastAPI backend and a Next.js frontend.

---

## 🛠️ Prerequisites

Before getting started, make sure you have the following installed on your machine:
- **Python 3.10+** (recommended: Python 3.13)
- **Node.js 18+** & **npm**
- A running PostgreSQL database (e.g., Neon serverless PostgreSQL, as configured in the `.env` file)

---

## 🚀 Backend Setup

The backend is built with FastAPI, SQLModel (SQLAlchemy), and Uvicorn.

### 1. Install Dependencies
Open your terminal at the project root directory (`serphawk_crm_seo-main`) and run:
```bash
pip install -r requirements.txt
```

### 2. Configure Environment Variables
Verify or create a `.env` file at the root of the project with the following configuration:
```env
# Database Configuration (Neon PostgreSQL)
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require

# OpenAI API Key for AI features
OPENAI_API_KEY=sk-proj-...

# Email Configuration (SMTP / serphawk.in)
OUTLOOK_EMAIL=crm@serphawk.in
OUTLOOK_PASSWORD=your-email-password
EMAIL_SENDER=crm@serphawk.in
EMAIL_PASSWORD=your-email-password

# SMTP Server Details (serphawk.in Postfix)
SMTP_SERVER=mail.serphawk.in
SMTP_PORT=587
IMAP_SERVER=mail.serphawk.in
USE_SSL=True

# Hourly email outreach limits
HOURLY_EMAIL_LIMIT=50
```

> [!IMPORTANT]
> **Gmail SMTP Authentication**: If you are using Gmail, standard account passwords will be rejected. You must:
> 1. Go to your **Google Account Settings -> Security**.
> 2. Enable **2-Step Verification**.
> 3. Search for **App Passwords** and generate a new 16-letter app password.
> 4. Use this 16-letter code as your `EMAIL_PASSWORD` / `OUTLOOK_PASSWORD` in `.env`.

### 3. Initialize & Seed Database
Initialize the database tables and seed the initial admin account:
```bash
# Create all tables in PostgreSQL
python create_tables.py

# Seed default admin user (admin@example.com / Admin@123)
python seed_db.py
```

### 4. Run the Backend Server
Start the Uvicorn development server:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```
The backend API will be available at [http://localhost:8000](http://localhost:8000). You can access interactive API documentation at [http://localhost:8000/docs](http://localhost:8000/docs).

---

## 🎨 Frontend Setup

The frontend is a React 19 / Next.js 16 application configured with Tailwind CSS.

### 1. Install Node Dependencies
Navigate into the `frontend` directory and install all node packages:
```bash
cd frontend
npm install
```

### 2. Run the Development Server
Launch the Next.js development server:
```bash
npm run dev
```
The frontend application will be running locally at [http://localhost:3000](http://localhost:3000).

---

## 📁 Repository Overview & Key Files

*   **`main.py`**: The primary FastAPI application containing all 70+ REST endpoints and WebSocket configurations.
*   **`database.py`**: Defines SQLModel schemas (29 tables) and manages PostgreSQL engine connections.
*   **`modules/`**: Contains core engines:
    *   `scraper.py`: Website scraping and contact information discovery.
    *   `llm_engine.py`: OpenAI GPT interface for email copy and content analysis.
    *   `fallback_analyzer.py`: Rules-based company categorization when scraping fails.
*   **`frontend/`**: The complete Next.js source code (pages, components, assets).
*   **`showcase/`**: A standalone static HTML/CSS/Vanilla JS showcase landing page.
