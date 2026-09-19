
from __future__ import annotations

"""
CRM V2 – SerpHawk  |  FastAPI Backend
"""

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.websockets import WebSocket, WebSocketDisconnect
from sqlmodel import Session
from modules.scraper import research_and_map_company
from pydantic import BaseModel

from database import engine, SentEmail
from sqlmodel import select

def register_sent_emails_endpoint(app, get_session):
    from fastapi import Depends
    from sqlmodel import Session
    from sqlalchemy import func
    @app.get("/sent-emails")
    def get_sent_emails(client_id: int = None, limit: int = 50, session: Session = Depends(get_session)):
        query = select(SentEmail).order_by(SentEmail.sent_at.desc())
        total_query = select(func.count(SentEmail.id))
        manual_query = select(func.count(SentEmail.id)).where(SentEmail.manual == True)
        if client_id:
            query = query.where(SentEmail.client_id == client_id)
            total_query = total_query.where(SentEmail.client_id == client_id)
            manual_query = manual_query.where(SentEmail.client_id == client_id)
        
        total_count = session.exec(total_query).first() or 0
        manual_count = session.exec(manual_query).first() or 0
        auto_count = total_count - manual_count
        
        emails = session.exec(query.limit(limit)).all()
        return {
            "totalSent": total_count,
            "manualCount": manual_count,
            "autoCount": auto_count,
            "emails": [
                {
                    "id": e.id,
                    "client_id": e.client_id,
                    "to_email": e.to_email,
                    "subject": e.subject,
                    "english_body": e.english_body,
                    "spanish_body": e.spanish_body,
                    "recommended_services": e.recommended_services,
                    "manual": e.manual,
                    "draft_json": e.draft_json,
                    "status": e.status,
                    "sent_at": e.sent_at.isoformat() if e.sent_at else None
                }
                for e in emails
            ]
        }

import hashlib
import re
from datetime import datetime, timedelta, date
from typing import Any, Dict, List, Optional, Union

from fastapi import Depends, FastAPI, HTTPException, Query, Form, UploadFile, File, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import func, or_
from sqlmodel import Session, select

from database import (
    Account,
    ActivityLog,

    ChatMessage,

    ClientFileUpload,
    ClientNote,
    ClientProfile,
    ClientResearch,
    ClientStatus,
    ClientTicket,
    CompetitorAnalysis,
    CompetitorRelationship,
    Contact,
    ConversationLog,
    ConversationReply,

    Document,
    EmailIntegration,

    ExtractedEmail,

    Lead,
    LeadNote,
    MessageThread,

    Notification,

    RadarAnalysis,

    Remark,

    ServiceRequest,

    Task,
    TaskComment,
    Tenant,
    PageVisitTelemetry,
    User,
    create_db_and_tables,
    engine,

    EmailSettings,
)


# ─────────────────────────────────────────────────────────────────────────────
# App + CORS
# ─────────────────────────────────────────────────────────────────────────────


from sqlalchemy import event
from sqlalchemy.orm import Session as SASession
from sqlalchemy.sql.selectable import Select

from modules.api_tracker import (
    current_client_id,
    current_endpoint,
    current_salesperson_id,
    current_tenant_id,
)

@event.listens_for(SASession, "do_orm_execute")
def _add_tenant_filter(execute_state):
    tenant_id = current_tenant_id.get()
    if tenant_id is None:
        return
        
    if execute_state.execution_options.get("skip_tenant"):
        return
        
    # Global tables that don't have tenant_id, or where we must never add a tenant filter
    global_tables = [
        "tenants", "client_statuses", "service_catalog",
        "audit_logs",      # telemetry must always be cross-tenant for admin view
        "users",           # users table is queried cross-tenant (e.g. login, notifications)
        "notifications",   # user-scoped not tenant-scoped
    ]
    
    if execute_state.is_select or execute_state.is_update or execute_state.is_delete:
        # We need to add a filter to the statement if it hits a table with tenant_id
        stmt = execute_state.statement
        
        # A simple check: if it's a Select, we can filter. 
        # For simplicity and safety without breaking complex joins, we can traverse the entities
        if execute_state.is_select:
            for entity in execute_state.statement.column_descriptions:
                model = entity.get("type") or entity.get("entity")
                if hasattr(model, "__tablename__") and model.__tablename__ not in global_tables:
                    if hasattr(model, "tenant_id"):
                        stmt = stmt.where(model.tenant_id == tenant_id)
            execute_state.statement = stmt


@event.listens_for(SASession, "before_flush")
def _auto_assign_tenant_id(session, flush_context, instances):
    tenant_id = current_tenant_id.get()
    if tenant_id is None:
        return
        
    global_tables = [
        "tenants", "client_statuses", "service_catalog",
        "audit_logs", "users", "notifications",
    ]
    
    for obj in session.new:
        if hasattr(obj, "tenant_id") and getattr(obj, "tenant_id") is None:
            if hasattr(obj, "__tablename__") and obj.__tablename__ not in global_tables:
                setattr(obj, "tenant_id", tenant_id)


@event.listens_for(SASession, "after_flush")
def _audit_log_changes(session, flush_context):
    from database import AuditLog
    from sqlalchemy import inspect
    # Prevent recursive audit logging
    if getattr(session, "_is_auditing", False):
        return
        
    user_id = None
    try:
        user_id = current_salesperson_id.get()
    except Exception:
        pass
        
    tenant_id = current_tenant_id.get()
    audit_entries = []
    
    # helper to get dirty attributes safely
    def get_changes(obj):
        changes = {}
        for attr in inspect(obj).attrs:
            if attr.history.has_changes():
                changes[attr.key] = {
                    "old": attr.history.deleted[0] if attr.history.deleted else None,
                    "new": attr.history.added[0] if attr.history.added else None
                }
        import json
        try:
            return json.dumps(changes, default=str)
        except:
            return str(changes)
            
    def get_pk(obj):
        mapper = inspect(obj.__class__)
        pk = mapper.primary_key[0].name
        return getattr(obj, pk, None)
        
    # Tables that are root/global objects — never audit them with a tenant_id FK
    _skip_audit_tables = {"audit_logs", "tenants"}

    for obj in session.new:
        if hasattr(obj, "__tablename__") and obj.__tablename__ not in _skip_audit_tables:
            obj_tid = getattr(obj, "tenant_id", None) or tenant_id
            # Skip if tenant_id is invalid (e.g. -1 sentinel or None — no FK to point to)
            if not obj_tid or obj_tid < 1:
                continue
            audit_entries.append(AuditLog(
                tenant_id=obj_tid,
                user_id=user_id,
                table_name=obj.__tablename__,
                record_id=get_pk(obj),
                action="CREATE",
                changes=get_changes(obj)
            ))
            
    for obj in session.dirty:
        if hasattr(obj, "__tablename__") and obj.__tablename__ not in _skip_audit_tables:
            if session.is_modified(obj, include_collections=False):
                obj_tid = getattr(obj, "tenant_id", None) or tenant_id
                if not obj_tid or obj_tid < 1:
                    continue
                audit_entries.append(AuditLog(
                    tenant_id=obj_tid,
                    user_id=user_id,
                    table_name=obj.__tablename__,
                    record_id=get_pk(obj),
                    action="UPDATE",
                    changes=get_changes(obj)
                ))
                
    for obj in session.deleted:
        if hasattr(obj, "__tablename__") and obj.__tablename__ not in _skip_audit_tables:
            obj_tid = getattr(obj, "tenant_id", None) or tenant_id
            if not obj_tid or obj_tid < 1:
                continue
            audit_entries.append(AuditLog(
                tenant_id=obj_tid,
                user_id=user_id,
                table_name=obj.__tablename__,
                record_id=get_pk(obj),
                action="DELETE"
            ))
            
    if audit_entries:
        from sqlalchemy import insert
        from database import AuditLog
        
        # We cannot use session.add() + session.flush() inside after_flush 
        # because the session is already flushing. Instead, we execute raw inserts.
        audit_dicts = []
        for entry in audit_entries:
            audit_dicts.append({
                "tenant_id": entry.tenant_id,
                "user_id": entry.user_id,
                "table_name": entry.table_name,
                "record_id": entry.record_id,
                "action": entry.action,
                "changes": entry.changes,
                "timestamp": entry.timestamp
            })
            
        session.execute(insert(AuditLog).values(audit_dicts))
def check_tenant_limit(session: Session, limit_type: str):
    # This must be called inside the endpoint, it reads current_tenant_id
    t_id = current_tenant_id.get()
    u_id = current_salesperson_id.get()
    
    if not t_id or not u_id:
        return
        
    user = session.get(User, u_id)
    if not user or user.role != "Demo":
        return
        
    tenant = session.exec(select(Tenant).where(Tenant.id == t_id)).first()
    if not tenant or not tenant.is_trial:
        return
        
    if limit_type == "clients":
        if tenant.usage_clients >= tenant.limit_clients:
            raise HTTPException(status_code=403, detail={"error": "LIMIT_REACHED", "limit_type": "clients", "message": f"Trial limit reached. You can only add up to {tenant.limit_clients} clients."})
        tenant.usage_clients += 1
    elif limit_type == "emails":
        if tenant.usage_emails >= tenant.limit_emails:
            raise HTTPException(status_code=403, detail={"error": "LIMIT_REACHED", "limit_type": "emails", "message": f"Trial limit reached. You can only generate {tenant.limit_emails} AI emails."})
        tenant.usage_emails += 1
    elif limit_type == "searches":
        if tenant.usage_searches >= tenant.limit_searches:
            raise HTTPException(status_code=403, detail={"error": "LIMIT_REACHED", "limit_type": "searches", "message": f"Trial limit reached. You can only perform {tenant.limit_searches} AI searches."})
        tenant.usage_searches += 1
    elif limit_type == "projects":
        if tenant.usage_projects >= tenant.limit_projects:
            raise HTTPException(status_code=403, detail={"error": "LIMIT_REACHED", "limit_type": "projects", "message": f"Trial limit reached. You can only add up to {tenant.limit_projects} websites."})
        tenant.usage_projects += 1
        
    session.add(tenant)
    session.commit()

def get_session():
    with Session(engine) as session:
        yield session

def _require_roles(session: Session, allowed_roles):
    """Enforce role access for sensitive endpoints.

    Returns the current User. Raises 401 if unauthenticated and 403 if the
    caller's role is not allowed. SuperAdmin and the legacy UI superadmin
    (admin@serphawk.com) are always permitted.
    """
    uid = current_salesperson_id.get()
    if not uid:
        raise HTTPException(status_code=401, detail="Unauthorized")
    user = session.get(User, uid)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    role = _normalize_role(user.role)
    if role == "SuperAdmin" or (user.email or "").lower() == "admin@serphawk.com" or role in allowed_roles:
        return user
    raise HTTPException(status_code=403, detail="Forbidden")

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

class APIIntelligenceMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Reset context for this request
        current_client_id.set(None)
        current_salesperson_id.set(None)
        current_tenant_id.set(None)
        current_endpoint.set(request.url.path)
        # Try to infer user from X-User-ID header, query parameter, or JWT token
        user_header = request.headers.get("X-User-ID")
        if user_header and user_header.isdigit():
            current_salesperson_id.set(int(user_header))
        elif request.query_params.get("user_id") and request.query_params.get("user_id").isdigit():
            current_salesperson_id.set(int(request.query_params.get("user_id")))
        else:
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
                try:
                    import jwt
                    from config import SECRET_KEY, ALGORITHM
                    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                    user_id = payload.get("sub")
                    if user_id:
                        current_salesperson_id.set(int(user_id))
                except:
                    pass
                    
        # Now securely resolve tenant_id based on the authenticated user.
        # This prevents malicious spoofing of X-Tenant-ID and fixes legacy missing headers.
        user_id_val = current_salesperson_id.get()
        tenant_header = request.headers.get("X-Tenant-ID")
        
        if user_id_val:
            with Session(engine) as session:
                user_obj = session.get(User, user_id_val)
                if user_obj and user_obj.role != "SuperAdmin":
                    # Force tenant_id to be the user's actual tenant in the DB
                    current_tenant_id.set(user_obj.tenant_id)
                elif user_obj and user_obj.role == "SuperAdmin":
                    # SuperAdmins can optionally impersonate a tenant via header
                    if tenant_header and tenant_header.isdigit():
                        current_tenant_id.set(int(tenant_header))
                    else:
                        current_tenant_id.set(None)
                else:
                    current_tenant_id.set(None)
        else:
            # Unauthenticated requests CANNOT be given SuperAdmin access (None).
            # Force to an invalid tenant ID so they see nothing instead of everything.
            if tenant_header and tenant_header.isdigit():
                current_tenant_id.set(int(tenant_header))
            else:
                current_tenant_id.set(-1)
        
        # Try to infer client_id from path parameters
        # Example paths: /clients/123/something or /projects/456 where we might need to lookup client
        path_parts = request.url.path.strip("/").split("/")
        if len(path_parts) >= 2 and path_parts[0] == "clients" and path_parts[1].isdigit():
            current_client_id.set(int(path_parts[1]))
            
        response = await call_next(request)
        return response

app = FastAPI(title="SerpHawk CRM", version="2.0.0")

from fastapi.responses import JSONResponse
from fastapi import Request
import traceback

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print("Unhandled Exception:", exc)
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"message": "Internal Server Error", "details": str(exc)},
        headers={"Access-Control-Allow-Origin": "*"}
    )

app.add_middleware(APIIntelligenceMiddleware)


from routers.email_tracking import router as email_tracking_router
app.include_router(email_tracking_router)

from routers.leaderboard import router as leaderboard_router
app.include_router(leaderboard_router)

@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    
    # Ensure SuperAdmin exists
    try:
        from sqlmodel import Session, select
        from database import engine, User
        with Session(engine) as session:
            users = session.exec(select(User).where(User.role == 'SuperAdmin')).all()
            if not users:
                su = User(name='Super Admin', email='superadmin@serphawk.in', password='password123', role='SuperAdmin', tenant_id=None)
                session.add(su)
                session.commit()
                print("Provisioned default SuperAdmin user.")
    except Exception as e:
        print("Error provisioning SuperAdmin:", e)
    
    # Auto-migrate: Add missing columns if they don't exist
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            conn.execute(text('ALTER TABLE projects ADD COLUMN IF NOT EXISTS "projectMemberIds" JSON;'))
            
            # Radar & Competitor Relationship Leads Migration
            try:
                conn.execute(text('ALTER TABLE radar_analyses ADD COLUMN IF NOT EXISTS lead_id INTEGER REFERENCES leads(id);'))
                conn.execute(text('ALTER TABLE competitor_relationships ADD COLUMN IF NOT EXISTS source_lead_id INTEGER REFERENCES leads(id);'))
                conn.execute(text('ALTER TABLE competitor_relationships ADD COLUMN IF NOT EXISTS discovered_lead_id INTEGER REFERENCES leads(id);'))
                conn.execute(text('ALTER TABLE competitor_relationships ALTER COLUMN source_client_id DROP NOT NULL;'))
            except Exception as e:
                print("Radar leads migration error (already applied or unsupported):", e)
                
            conn.commit()
    except Exception as e:
        print("Migration error for projects:", e)

    # Auto-migrate tenant limits
    tenant_migrations = [
        "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS limit_projects INTEGER DEFAULT 5;",
        "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS usage_projects INTEGER DEFAULT 0;"
    ]
    for sql in tenant_migrations:
        try:
            with engine.connect() as conn:
                conn.execute(text(sql))
                conn.commit()
        except Exception as e:
            pass

    # Auto-migrate proposals new columns
    proposal_migrations = [
        "ALTER TABLE proposals ADD COLUMN IF NOT EXISTS lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL;",
        "ALTER TABLE proposals ADD COLUMN IF NOT EXISTS recipient_type VARCHAR(20) DEFAULT 'client';",
        "ALTER TABLE proposals ADD COLUMN IF NOT EXISTS line_items JSON DEFAULT '[]'::json;",
        "ALTER TABLE proposals ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'MXN';",
        "ALTER TABLE proposals ADD COLUMN IF NOT EXISTS signed_by_ip VARCHAR(255);",
        "ALTER TABLE proposals ADD COLUMN IF NOT EXISTS signature_data TEXT;"
    ]
    for sql in proposal_migrations:
        try:
            with engine.connect() as conn:
                conn.execute(text(sql))
                conn.commit()
        except Exception as e:
            print(f"Migration proposals: {e}")
        
    # Tenant ID Migrations (Dynamic reflection to catch all models)
    from sqlmodel import SQLModel
    tables_with_tenant = [
        name for name, table in SQLModel.metadata.tables.items() 
        if "tenant_id" in table.columns
    ]
    
    for table in tables_with_tenant:
        try:
            with engine.connect() as conn:
                conn.execute(text(f'ALTER TABLE {table} ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;'))
                conn.execute(text(f'CREATE INDEX IF NOT EXISTS ix_{table}_tenant_id ON {table} (tenant_id);'))
                
                # Fix for existing records that have NULL tenant_id after migration
                conn.execute(text(f'UPDATE {table} SET tenant_id = 1 WHERE tenant_id IS NULL;'))
                
                conn.commit()
        except Exception as e:
            print(f"Migration error for {table}: {e}")
            
    print(f"Finished checking and adding tenant_id columns to {len(tables_with_tenant)} tables.")
        
    try:
        # Ensure varshithh@gmail.com is an Admin and reset admin@serphawk.com password
        session = Session(engine)
        harshith = session.exec(select(User).where(User.email == "varshithh@gmail.com")).first()
        if harshith:
            harshith.role = "Admin"
            session.add(harshith)
            
        admin = session.exec(select(User).where(User.email == "admin@serphawk.com")).first()
        if admin:
            admin.password = _hash_password("Admin123!")
            session.add(admin)
            
        sm = session.exec(select(User).where(User.email == "varsh@gmail.com")).first()
        if sm:
            sm.password = _hash_password("Admin123!")
            session.add(sm)
            
        emp = session.exec(select(User).where(User.email == "varshit@gmail.com")).first()
        if emp:
            emp.password = _hash_password("Admin123!")
            session.add(emp)

        # Dedicated Demo-role account used by the frontend demo login button.
        # Reset its password on startup so the demo always works.
        demo = session.exec(select(User).where(User.email == "demo@serphawk.com")).first()
        if demo:
            demo.password = _hash_password("DemoPass123!")
            session.add(demo)

        session.commit()
        session.close()
    except Exception as e:
        print("Admin user init error:", e)

    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN sidebar_preferences JSON;"))
            conn.commit()
            print("Successfully added sidebar_preferences to users table.")
    except Exception as e:
        print("sidebar_preferences column already exists or error:", e)

    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);"))
            conn.commit()
            print("Successfully added phone to users table.")
    except Exception as e:
        print("phone column already exists or error:", e)
        
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS call_pitch_done BOOLEAN DEFAULT FALSE;"))
            conn.execute(text("ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS call_pitch_text TEXT;"))
            conn.commit()
            print("Successfully added call_pitch columns to client_profiles table.")
    except Exception as e:
        print("call_pitch columns already exist or error:", e)
        
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS limit_calls INTEGER DEFAULT 5;"))
            conn.execute(text("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS usage_calls INTEGER DEFAULT 0;"))
            conn.commit()
            print("Successfully added call limit/usage columns to tenants table.")
    except Exception as e:
        print("tenant call limit/usage columns already exist or error:", e)
        
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE leads ADD COLUMN ai_analysis_results JSON;"))
            conn.commit()
            print("Successfully added ai_analysis_results to leads table.")
    except Exception as e:
        print("ai_analysis_results column already exists or error:", e)
        
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS swot_analysis TEXT;"))
            conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS swot_analysis TEXT;"))
            conn.commit()
            print("Successfully added swot_analysis to client_profiles and leads tables.")
    except Exception as e:
        print("swot_analysis column already exists or error:", e)
        
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE projects ADD COLUMN project_type VARCHAR DEFAULT 'Development';"))
            conn.commit()
            print("Successfully added project_type to projects table.")
    except Exception as e:
        print("project_type column already exists or error:", e)
        
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE projects ADD COLUMN \"clientId\" INTEGER;"))
            conn.commit()
            print("Successfully added clientId to projects table.")
    except Exception as e:
        print("clientId column already exists or error:", e)
        
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE projects ADD COLUMN \"leadId\" INTEGER;"))
            conn.commit()
            print("Successfully added leadId to projects table.")
    except Exception as e:
        print("leadId column already exists or error:", e)

    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN phone VARCHAR(50);"))
            conn.commit()
            print("Successfully added phone to users table.")
    except Exception as e:
        print("phone column already exists or error:", e)

    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE tenants ADD COLUMN limit_calls INTEGER DEFAULT 5;"))
            conn.execute(text("ALTER TABLE tenants ADD COLUMN usage_calls INTEGER DEFAULT 0;"))
            conn.commit()
            print("Successfully added call limits to tenants table.")
    except Exception as e:
        print("tenant call limits already exist or error:", e)

# Keep the Neon serverless DB awake + pool warm. Without this, the first
    # requests after ~5min of idle trigger a slow cold-start (~5-7s each).
    try:
        import threading as _threading
        from database import engine as _keepalive_engine

        def _db_keepalive_loop():
            import time as _time
            from sqlalchemy import text as _text
            while True:
                _time.sleep(60)
                try:
                    with _keepalive_engine.connect() as _conn:
                        _conn.execute(_text("SELECT 1"))
                except Exception as _e:
                    print("Keepalive ping failed:", _e)

        _threading.Thread(target=_db_keepalive_loop, daemon=True, name="db-keepalive").start()
        print("DB keepalive started (pings every 60s).")
    except Exception as e:
        print("Could not start DB keepalive:", e)

    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE cases ADD COLUMN IF NOT EXISTS url VARCHAR(1000);"))
            conn.execute(text("ALTER TABLE cases ADD COLUMN IF NOT EXISTS case_type VARCHAR(100) DEFAULT 'Bug';"))
            conn.commit()
            print("Successfully added url and case_type columns to cases table.")
    except Exception as e:
        print("cases url/case_type columns already exist or error:", e)

allowed_origins = [
    "https://stable-crm.vercel.app",
    "https://scmhub-crm.vercel.app",
    "https://www.scmhub-crm.vercel.app",
    "https://web-production-565b6.up.railway.app",
    "https://web-production-5e474.up.railway.app",
    "https://serphawk-crm-seo.vercel.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://web-production-6cd72.up.railway.app",
    "https://web-production-80e20.up.railway.app",
    "https://web-production-d6daf.up.railway.app",
    "https://crm-seo.allytechcourses.com",
    "https://crm-seo.serphawk.in",
    "https://crm.serphawk.in",
    "https://dapros-crm.serphawk.in",
    "https://crm.dapros.serphawk.in",
    "https://dapros.serphawk.in",
    "https://crm-seo.allytechcourses.com",
    "http://dapros.serphawk.in"
]


from fastapi.responses import JSONResponse
from fastapi import Request
import traceback

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print("Unhandled Exception:", exc)
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"message": "Internal Server Error", "details": str(exc)},
        headers={"Access-Control-Allow-Origin": "*"}
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://([a-z0-9-]+\.)*serphawk\.in",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files
from fastapi.staticfiles import StaticFiles
import os
os.makedirs("static/uploads", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")


# ─────────────────────────────────────────────────────────────────────────────
# Email Notification Helper
# ─────────────────────────────────────────────────────────────────────────────
def _send_notification_email(to_email: str, subject: str, body_html: str):
    """Best-effort email notification. Fails silently so it never blocks API responses."""
    def _send():
        try:
            from modules.email_sender import send_email_outlook
            import os
            sender = os.environ.get("EMAIL_SENDER") or os.environ.get("OUTLOOK_EMAIL") or ""
            password = os.environ.get("EMAIL_PASSWORD") or os.environ.get("OUTLOOK_PASSWORD") or ""
            smtp_server = os.environ.get("EMAIL_HOST") or os.environ.get("SMTP_SERVER", "smtp.gmail.com")
            smtp_port = int(os.environ.get("EMAIL_PORT") or os.environ.get("SMTP_PORT", 587))
            if sender and password:
                send_email_outlook(to_email, subject, body_html, sender, password,
                                   smtp_server=smtp_server, smtp_port=smtp_port)
        except Exception as e:
            print(f"[Notification email failed] {e}")
            
    import threading
    threading.Thread(target=_send).start()





# Register /sent-emails endpoint after app and get_session are defined
register_sent_emails_endpoint(app, get_session)

# --- Simple In-Memory Cache for Company Analysis ---
company_analysis_cache = {}

# --- Research and Service Mapping Endpoint ---
class ResearchMapRequest(BaseModel):
    company_url: str

@app.post("/research-map-company")
async def research_map_company_endpoint(body: ResearchMapRequest, background_tasks: BackgroundTasks = None):
    try:
        result = await research_and_map_company(body.company_url)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Smart Research: company name → full analysis + draft + contact email ---
class SmartResearchRequest(BaseModel):
    company_name: str
    company_url: Optional[str] = None
    client_id: Optional[int] = None  # If set, link extracted services to this CRM client
    owner_name: Optional[str] = "Varshith"


# ─── Background Auto-Research Helper ────────────────────────────────────────
def _trigger_background_research(entity_id: int, entity_type: str, company_name: str, website: str, session_factory=None):
    """
    Fire-and-forget background task: runs the full scraper+LLM pipeline for a
    lead or client and stores results in ClientResearch.
    entity_type: 'lead' or 'client'
    """
    import threading
    import asyncio

    def _run():
        try:
            from modules.llm_engine import deep_investigate_company
            from modules.scraper import research_and_map_company
            import json, re, asyncio as _asyncio

            url = website or ""
            if not url and company_name:
                slug = company_name.lower().replace(" ", "").replace(",","").replace(".","")
                url = f"https://www.{slug}.com"
            if not url:
                return

            # Step 1: Scrape the website for raw text context
            raw_text = ""
            try:
                loop = _asyncio.new_event_loop()
                scrape_result = loop.run_until_complete(research_and_map_company(url))
                loop.close()
                raw_text = scrape_result.get("raw_text", "") or ""
            except Exception as scrape_err:
                print(f"[AutoResearch] Scrape failed (using GPT knowledge only): {scrape_err}")

            # Step 2: Run the deep investigation with GPT-4o
            print(f"[AutoResearch] Running deep investigation for {company_name} ({url})")
            data = deep_investigate_company(
                company_name=company_name,
                website=url,
                scraped_text=raw_text
            )

            # Step 3: Extract key contact info to also update the lead/client record
            contacts = data.get("contacts", []) or []
            contact = contacts[0] if contacts else {}
            email_addr = contact.get("email") or ""
            phone_num = contact.get("phone_number") or ""
            company_info = data.get("company_info", {}) or {}
            if not email_addr:
                extracted = company_info.get("extracted_emails", "") or ""
                email_addr = extracted.split(",")[0].strip() if extracted else ""
            if not phone_num:
                extracted_ph = company_info.get("extracted_phone_numbers", "") or ""
                phone_num = extracted_ph.split(",")[0].strip() if extracted_ph else ""

            from sqlmodel import Session as _Session, select as _select
            from database import ClientResearch, Lead, ClientProfile, engine as _engine
            with _Session(_engine) as sess:
                if entity_type == "lead":
                    cr = sess.exec(_select(ClientResearch).where(ClientResearch.lead_id == entity_id)).first()
                    if not cr:
                        cr = ClientResearch(lead_id=entity_id)
                    # Also update lead email/phone if discovered
                    lead_obj = sess.get(Lead, entity_id)
                    if lead_obj:
                        if not lead_obj.email and email_addr: lead_obj.email = email_addr
                        if not lead_obj.phone and phone_num: lead_obj.phone = phone_num
                        sess.add(lead_obj)
                else:
                    cr = sess.exec(_select(ClientResearch).where(ClientResearch.client_id == entity_id)).first()
                    if not cr:
                        cr = ClientResearch(client_id=entity_id)
                cr.email_agent_data = json.dumps(data)
                cr.company_overview = data.get("company_overview", "") or data.get("executive_verdict", "")
                cr.key_decision_makers = json.dumps(contacts)
                # Store additional rich fields
                icps = data.get("ideal_customer_profiles", [])
                cr.pain_points = json.dumps(icps) if icps else None
                cr.business_goals = json.dumps(data.get("gtm_recommendations", {})) if data.get("gtm_recommendations") else None
                cr.competitors = json.dumps(data.get("competitive_landscape", {})) if data.get("competitive_landscape") else None
                sess.add(cr)
                sess.commit()
            print(f"[AutoResearch] Done for {entity_type} id={entity_id}")
        except Exception as ex:
            import traceback
            print(f"[AutoResearch] Error for {entity_type} id={entity_id}: {ex}")
            traceback.print_exc()

    t = threading.Thread(target=_run, daemon=True)
    t.start()


# --- Send Manual: create client + record email + activity ---
class SendManualRequest(BaseModel):
    to_email: str
    company_name: str
    subject: str
    english_body: str
    spanish_body: Optional[str] = None
    whatsapp_body: Optional[str] = None
    recommended_services: Optional[str] = None
    contact_name: Optional[str] = None
    contact_role: Optional[str] = None
    website_url: Optional[str] = None
    phone_number: Optional[str] = None
    manual: Optional[bool] = True
    email_agent_data: Optional[str] = None
    skip_send: Optional[bool] = False
    action_type: Optional[str] = "System"



# --- Delete client endpoint ---



# ─────────────────────────────────────────────────────────────────────────────
# Pydantic request/response models
# ─────────────────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str
    password: str

class ChatbotRequest(BaseModel):
    message: str
    client_id: Optional[int] = None
    current_route: Optional[str] = None
    chat_history: Optional[str] = None
    session_id: Optional[str] = None
    user_role: Optional[str] = None  # Admin, SalesManager, Employee, ProjectMember, Supplier, Demo


class CreateUserRequest(BaseModel):
    email: str
    password: str
    name: Optional[str] = None
    role: str = "Client"


class ClientCreateRequest(BaseModel):
    companyName: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    status: str = "Active"
    email: Optional[str] = None
    name: Optional[str] = None
    password: Optional[str] = None
    projectName: Optional[str] = None
    gmbName: Optional[str] = None
    seoStrategy: Optional[str] = None
    tagline: Optional[str] = None
    websiteUrl: Optional[str] = None
    targetKeywords: Optional[list[str]] = None
    assigned_employee_id: Optional[int] = None


class ClientUpdateRequest(BaseModel):
    companyName: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    status: Optional[str] = None
    gmbName: Optional[str] = None
    seoStrategy: Optional[str] = None
    tagline: Optional[str] = None
    websiteUrl: Optional[str] = None
    nextMilestone: Optional[str] = None
    nextMilestoneDate: Optional[str] = None
    lastActivity: Optional[str] = None
    lastActivityDate: Optional[str] = None
    assignedEmployeeId: Optional[int] = None
    customFields: Optional[dict] = None
    lead_score: Optional[int] = None
    lead_source: Optional[str] = None
    deal_value: Optional[float] = None
    industry: Optional[str] = None
    employee_count: Optional[str] = None
    revenue_range: Optional[str] = None
    linkedin_url: Optional[str] = None
    contact_person: Optional[str] = None
    last_contact_date: Optional[str] = None
    next_followup_date: Optional[str] = None


class DealCreateRequest(BaseModel):
    title: str
    value: float = 0.0
    client_id: int
    assigned_to: Optional[int] = None
    stage: str = "Lead"
    expected_close_date: Optional[str] = None


class DealUpdateRequest(BaseModel):
    title: Optional[str] = None
    value: Optional[float] = None
    assigned_to: Optional[int] = None
    stage: Optional[str] = None
    expected_close_date: Optional[str] = None


class AssignEmployeeRequest(BaseModel):
    employee_id: int


class KeywordRequest(BaseModel):
    keyword: str


class RemarkCreateRequest(BaseModel):
    content: str
    authorId: Optional[int] = None
    isInternal: bool = True


class ActivityCreateRequest(BaseModel):
    action: str
    method: Optional[str] = None
    content: Optional[str] = None
    details: Optional[str] = None
    authorId: Optional[int] = None


class ClientFollowUpRequest(BaseModel):
    content: str
    authorId: Optional[int] = None
    isInternal: bool = True
    task_title: Optional[str] = None
    task_description: Optional[str] = None
    assigned_to: Optional[int] = None
    due_date: Optional[str] = None
    email_agent_data: Optional[str] = None


class ProjectTeamRequest(BaseModel):
    emails: list[str]
    roles: list[str]

class ProjectTicketRequest(BaseModel):
    competitor: str | None = None
    category: str | None = None
    task: str
    github_link: str | None = None
    production_url: str | None = None
    current_state: str = "Planning"
    requested_date: str | None = None
    requested_by: str | None = None
    current_owner_role: str | None = None
    current_owner: str | None = None
    date_dev_start: str | None = None
    date_dev_complete: str | None = None
    date_qa_start: str | None = None
    date_qa_complete: str | None = None
    date_release_prod: str | None = None
    user_name: str | None = None


class ProjectCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    status: str = "Planning"
    progress: int = 0
    employeeIds: List[int] = []
    internIds: List[int] = []
    clientIds: List[int] = []
    projectMemberIds: List[int] = []
    project_type: str = "Development"
    clientId: Optional[int] = None
    leadId: Optional[int] = None


class ProjectUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    progress: Optional[int] = None
    project_type: Optional[str] = None
    clientId: Optional[int] = None
    leadId: Optional[int] = None
    employeeIds: Optional[List[int]] = None
    internIds: Optional[List[int]] = None
    clientIds: Optional[List[int]] = None
    projectMemberIds: Optional[List[int]] = None


class ServiceCreateRequest(BaseModel):
    name: str
    cost: float = 0.0
    intro_description: str = ""
    full_description: Optional[str] = None
    handler_role: str = "Employee"
    image_url: Optional[str] = None
    past_results: Optional[str] = None
    is_active: bool = True


class ServiceRequestCreate(BaseModel):
    service_id: int
    client_email: str


class QuoteRequest(BaseModel):
    requestId: int
    quoted_amount: float
    quote_message: str
    team_info: Optional[str] = None
    quote_doc_url: Optional[str] = None
    assigned_employee_id: Optional[int] = None


class SendMessageRequest(BaseModel):
    thread_id: int
    sender_id: int
    content: str


class CallCreateRequest(BaseModel):
    phone_number: str
    duration_seconds: Optional[int] = None
    summary: Optional[str] = None


class CallSummaryRequest(BaseModel):
    summary: str


class SetupDomainRequest(BaseModel):
    domain: str


class GenerateEmailRequest(BaseModel):
    company_url: Optional[str] = None
    company_name: Optional[str] = None
    contact_name: Optional[str] = None
    contact_role: Optional[str] = None
    sender_email: Optional[str] = None
    to_email: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    manual: Optional[bool] = False
    english_body: Optional[str] = None
    spanish_body: Optional[str] = None
    recommended_services: Optional[str] = None
    client_id: Optional[int] = None


class SendLeadRequest(BaseModel):
    to_email: str
    subject: str
    body: str
    sender_email: Optional[str] = None
    english_body: Optional[str] = None
    spanish_body: Optional[str] = None
    recommended_services: Optional[str] = None
    manual: Optional[bool] = False
    draft_json: Optional[str] = None
    client_id: Optional[int] = None


# ── New Feature Pydantic Models ───────────────────────────────────────────────

# Normalize frontend status strings -> PostgreSQL enum values
# The DB enum 'taskstatus' was created with lowercase values.
# Frontend sends 'Todo', 'InProgress', 'Done' — map them correctly.
_TASK_STATUS_MAP: dict = {
    "todo": "todo",
    "Todo": "todo",
    "TODO": "todo",
    "inprogress": "inprogress",
    "InProgress": "inprogress",
    "INPROGRESS": "inprogress",
    "in_progress": "inprogress",
    "In Progress": "inprogress",
    "done": "done",
    "Done": "done",
    "DONE": "done",
}

def _normalize_task_status(s: Optional[str]) -> Optional[str]:
    if not s:
        return s
    return _TASK_STATUS_MAP.get(s, s.lower())


class TaskCreateRequest(BaseModel):
    title: str
    description: Optional[str] = None
    status: str = "todo"
    priority: str = "Medium"
    due_date: Optional[str] = None
    client_id: Optional[int] = None
    lead_id: Optional[int] = None
    project_id: Optional[int] = None
    assigned_to: Optional[int] = None
    created_by: Optional[int] = None

class TaskUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[str] = None
    assigned_to: Optional[int] = None
    lead_id: Optional[int] = None


class TaskCommentCreateRequest(BaseModel):
    content: str
    author_id: Optional[int] = None


class InvoiceCreateRequest(BaseModel):
    client_id: int
    service_request_id: Optional[int] = None
    amount: float
    currency: Optional[str] = "MXN"
    tax: float = 0.0
    due_date: Optional[str] = None
    notes: Optional[str] = None
    line_items: Optional[List[dict]] = []


class InvoiceUpdateRequest(BaseModel):
    status: Optional[str] = None
    amount: Optional[float] = None
    tax: Optional[float] = None
    due_date: Optional[str] = None
    notes: Optional[str] = None
    line_items: Optional[List[dict]] = None


class NotificationCreateRequest(BaseModel):
    user_id: int
    title: str
    message: str
    type: str = "info"
    link: Optional[str] = None


class MilestoneCreateRequest(BaseModel):
    title: str
    description: Optional[str] = None
    project_id: Optional[int] = None
    client_id: Optional[int] = None
    due_date: Optional[str] = None
    status: str = "Pending"
    order: int = 0


class MilestoneUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[str] = None
    order: Optional[int] = None


class NPSRespondRequest(BaseModel):
    score: int
    feedback: Optional[str] = None


class ProposalLineItem(BaseModel):
    product_id: Optional[int] = None
    product_name: str
    description: Optional[str] = None
    quantity: float = 1
    unit_price: float = 0
    unit: Optional[str] = None
    currency: str = "MXN"


class ProposalCreateRequest(BaseModel):
    title: str
    client_id: Optional[int] = None
    lead_id: Optional[int] = None
    recipient_type: str = "client"
    service_request_id: Optional[int] = None
    content: Optional[str] = None
    status: str = "Draft"
    valid_until: Optional[str] = None
    total_value: Optional[float] = None
    created_by: Optional[int] = None
    line_items: Optional[List[dict]] = None
    currency: str = "MXN"


class ProposalUpdateRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    status: Optional[str] = None
    valid_until: Optional[str] = None
    total_value: Optional[float] = None
    line_items: Optional[List[dict]] = None
    currency: Optional[str] = None


class FileUploadRequest(BaseModel):
    client_id: int
    uploaded_by: Optional[int] = None
    filename: str
    file_url: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    description: Optional[str] = None


class KeywordRankRequest(BaseModel):
    client_id: int
    keyword: str
    position: Optional[int] = None
    url: Optional[str] = None
    search_engine: str = "Google"
    notes: Optional[str] = None
    recorded_by: Optional[int] = None


class ClientNoteCreateRequest(BaseModel):
    content: str
    tags: Optional[List[str]] = []
    is_pinned: bool = False
    author_id: Optional[int] = None
    author_name: Optional[str] = None


class ClientNoteUpdateRequest(BaseModel):
    content: Optional[str] = None
    tags: Optional[List[str]] = None
    is_pinned: Optional[bool] = None


class ConversationLogCreateRequest(BaseModel):
    title: str
    type: str = "call"
    description: Optional[str] = None
    author_id: Optional[int] = None
    author_name: Optional[str] = None
    attachment_urls: Optional[List[str]] = []


class ConversationReplyCreateRequest(BaseModel):
    content: str
    author_id: Optional[int] = None
    author_name: Optional[str] = None


class ClientResearchUpdateRequest(BaseModel):
    company_overview: Optional[str] = None
    competitors: Optional[str] = None
    tech_stack: Optional[str] = None
    recent_news: Optional[str] = None
    pain_points: Optional[str] = None
    business_goals: Optional[str] = None
    key_decision_makers: Optional[str] = None

class ClientTicketCreateRequest(BaseModel):
    title: str
    description: Optional[str] = None
    author_id: Optional[int] = None
    status: str = "Pending"

class ClientTicketUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────
def _hash_password(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


def _generate_unique_password(length: int = 10) -> str:
    """Generate a cryptographically-random, unique password for a supplier login.

    Guarantees at least one lowercase letter, one uppercase letter, one digit,
    and one special character so it passes common password-strength rules.
    """
    import secrets
    import string as _string
    lower = _string.ascii_lowercase
    upper = _string.ascii_uppercase
    digits = _string.digits
    special = "!@#$%&*"
    pool = lower + upper + digits + special
    chars = [
        secrets.choice(lower),
        secrets.choice(upper),
        secrets.choice(digits),
        secrets.choice(special),
    ]
    chars += [secrets.choice(pool) for _ in range(max(0, length - 4))]
    secrets.SystemRandom().shuffle(chars)
    return "".join(chars)


def _check_password(plain: str, hashed: str) -> bool:
    return hashlib.sha256(plain.encode()).hexdigest() == hashed


def _normalize_role(role: Optional[str]) -> str:
    if not role:
        return "Client"
    mapping = {
        "admin": "Admin",
        "employee": "Employee",
        "client": "Client",
        "intern": "Intern",
    }
    return mapping.get(role.lower(), role)


def _verify_password(plain: str, user: User) -> bool:
    """Support SHA256 (password column) and bcrypt (hashed_password column)."""
    if user.password:
        if _check_password(plain, user.password) or plain == user.password:
            return True
    stored = (user.hashed_password or "").strip()
    if not stored:
        return False
    if stored.startswith("$2"):
        try:
            import bcrypt
            return bcrypt.checkpw(plain.encode("utf-8"), stored.encode("utf-8"))
        except Exception:
            return False
    return _check_password(plain, stored) or plain == stored


def _user_dict(u: User) -> dict:
    return {"id": u.id, "email": u.email, "name": u.name, "phone": getattr(u, "phone", None), "role": _normalize_role(u.role), "tenant_id": u.tenant_id}




# ─────────────────────────────────────────────────────────────────────────────
# Auth
# ─────────────────────────────────────────────────────────────────────────────
from pydantic import BaseModel

class SignupRequest(BaseModel):
    name: str
    business_name: str
    email: str
    phone: str
    password: str

@app.post("/signup")
def signup(body: SignupRequest, session: Session = Depends(get_session)):
    # 1. Check if user already exists
    existing_user = session.exec(select(User).where(User.email == body.email)).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already exists")
        
    # 2. Create new Tenant (Trial)
    tenant = Tenant(
        name=f"{body.business_name} - {body.name}",
        business_name=body.business_name,
        email=body.email,
        phone=body.phone,
        is_trial=True,
        limit_clients=15,
        limit_emails=5,
        limit_searches=2
    )
    session.add(tenant)
    session.commit()
    session.refresh(tenant)
    
    # 3. Create Admin User for this Tenant
    hashed = _hash_password(body.password)
    new_user = User(
        email=body.email,
        password=hashed,
        name=body.name,
        role="Admin",
        tenant_id=tenant.id
    )
    session.add(new_user)
    
    # 4. Create Lead in Master Admin CRM
    master = session.exec(select(Tenant).where(Tenant.name == "Master Admin")).first()
    if master:
        lead = Lead(
            name=body.name,
            email=body.email,
            phone=body.phone,
            company=body.business_name,
            source="Trial Signup",
            status="New",
            tenant_id=master.id
        )
        session.add(lead)
        
    session.commit()
    
    return {"message": "Trial account created successfully", "tenant_id": tenant.id}


@app.get("/activities/global")
def global_activities(session: Session = Depends(get_session)):
    tenant_id = current_tenant_id.get()
    if not tenant_id:
        return {"activities": []}
    
    from database import ActivityLog
    from sqlalchemy import select
    
    activities = session.exec(select(ActivityLog).where(ActivityLog.tenant_id == tenant_id).order_by(ActivityLog.createdAt.desc()).limit(30)).all()
    return {"activities": activities}

@app.get("/superadmin/tenants")
def get_all_tenants(session: Session = Depends(get_session)):
    _require_roles(session, ["SuperAdmin"])
    # Bypassing tenant filter for super admin
    # We temporarily clear the tenant filter context for this query
    import contextvars
    from database import Tenant, User, ClientProfile
    from sqlalchemy import select, func
    
    # We don't have to clear contextvars because the do_orm_execute filter 
    # only filters if current_tenant_id is set. Wait, it IS set by the middleware!
    # So we must query directly using SQLAlchemy core or raw SQL to bypass the ORM event, 
    # OR we can just reset current_tenant_id for the duration of this function.
    
    old_tenant = current_tenant_id.get()
    current_tenant_id.set(None)
    
    try:
        tenants = session.exec(select(Tenant)).all()
        result = []
        for t_row in tenants:
            t = t_row[0] if isinstance(t_row, tuple) or type(t_row).__name__ in ("Row", "BaseRow") else t_row
            
            # Count users
            user_count = session.exec(select(func.count(User.id)).where(User.tenant_id == t.id)).first()
            # Count clients
            client_count = session.exec(select(func.count(ClientProfile.id)).where(ClientProfile.tenant_id == t.id)).first()
            
            # Since func.count might return a tuple/row in older SQLModel versions, unwrap it too
            user_count = user_count[0] if isinstance(user_count, tuple) or type(user_count).__name__ in ("Row", "BaseRow") else user_count
            client_count = client_count[0] if isinstance(client_count, tuple) or type(client_count).__name__ in ("Row", "BaseRow") else client_count
            
            result.append({
                "id": t.id,
                "name": t.name,
                "business_name": t.business_name,
                "email": t.email,
                "phone": t.phone,
                "is_trial": t.is_trial,
                "created_at": t.created_at,
                "users": user_count or 0,
                "clients": client_count or 0,
                "limit_clients": t.limit_clients,
                "limit_emails": t.limit_emails,
                "limit_searches": t.limit_searches,
                "usage_clients": t.usage_clients,
                "usage_emails": t.usage_emails,
                "usage_searches": t.usage_searches,
            })
        return result
    finally:
        current_tenant_id.set(old_tenant)

class RequestUpgradeRequest(BaseModel):
    limit_type: str

@app.post("/tenant/request-upgrade")
def request_upgrade(body: RequestUpgradeRequest, session: Session = Depends(get_session)):
    """User hits a limit and requests a plan upgrade."""
    tenant_id = current_tenant_id.get()
    user_id = current_salesperson_id.get()
    if not tenant_id or not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
        
    from database import ActivityLog, Notification, User
    
    # 1. Telemetry / ActivityLog
    log = ActivityLog(
        tenant_id=tenant_id,
        userId=user_id,
        action="Upgrade Requested",
        method="System",
        details=f"User requested account upgrade after hitting trial limit for: {body.limit_type}"
    )
    session.add(log)
    
    # 2. Notification to Admin(s) of this tenant
    # Find admins for this tenant
    admins = session.exec(select(User).where(User.tenant_id == tenant_id, User.role == "Admin")).all()
    for admin in admins:
        notif = Notification(
            tenant_id=tenant_id,
            user_id=admin.id,
            title="Upgrade Requested",
            message=f"A user has hit the {body.limit_type} limit and requested an account upgrade.",
            type="warning"
        )
        session.add(notif)
        
    session.commit()
    return {"success": True}

class TenantLimitUpdateRequest(BaseModel):
    limit_clients: Optional[int] = None
    limit_emails: Optional[int] = None
    limit_searches: Optional[int] = None
    limit_projects: Optional[int] = None
    reset_usage: Optional[bool] = False
    is_trial: Optional[bool] = None

@app.patch("/superadmin/tenants/{tenant_id}/limits")
def update_tenant_limits(tenant_id: int, body: TenantLimitUpdateRequest, session: Session = Depends(get_session)):
    """Superadmin: update limits and optionally reset usage for a tenant."""
    _require_roles(session, ["SuperAdmin"])
    old_tenant = current_tenant_id.get()
    current_tenant_id.set(None)
    try:
        tenant = session.exec(select(Tenant).where(Tenant.id == tenant_id)).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        if body.limit_clients is not None:
            tenant.limit_clients = body.limit_clients
        if body.limit_emails is not None:
            tenant.limit_emails = body.limit_emails
        if body.limit_searches is not None:
            tenant.limit_searches = body.limit_searches
        if body.limit_projects is not None:
            tenant.limit_projects = body.limit_projects
        if body.is_trial is not None:
            tenant.is_trial = body.is_trial
        if body.reset_usage:
            tenant.usage_clients = 0
            tenant.usage_emails = 0
            tenant.usage_searches = 0
            tenant.usage_projects = 0
        session.add(tenant)
        session.commit()
        session.refresh(tenant)
        return {"success": True, "tenant_id": tenant_id, "limit_searches": tenant.limit_searches, "usage_searches": tenant.usage_searches}
    finally:
        current_tenant_id.set(old_tenant)


class PageVisitRequest(BaseModel):
    page_path: str
    time_spent_seconds: int

@app.post("/telemetry/page-visit")
def log_page_visit(body: PageVisitRequest, session: Session = Depends(get_session)):
    tenant_id = current_tenant_id.get()
    user_id = current_salesperson_id.get()
    if not tenant_id or not user_id:
        return {"status": "skipped", "reason": "unauthenticated"}
    
    from database import PageVisitTelemetry
    visit = PageVisitTelemetry(
        tenant_id=tenant_id,
        user_id=user_id,
        page_path=body.page_path,
        time_spent_seconds=body.time_spent_seconds
    )
    session.add(visit)
    session.commit()
    return {"status": "ok"}


@app.get("/superadmin/telemetry/global")
def get_global_telemetry(session: Session = Depends(get_session)):
    _require_roles(session, ["SuperAdmin"])
    # Bypassing tenant filter for super admin
    import contextvars
    from database import Tenant, User, ClientProfile, PageVisitTelemetry
    from sqlalchemy import select, func
    
    old_tenant = current_tenant_id.get()
    current_tenant_id.set(None)
    
    try:
        # Aggregated Tenant Stats
        tenants = session.exec(select(Tenant)).all()
        
        def is_tenant_trial(t):
            obj = t[0] if isinstance(t, tuple) or type(t).__name__ in ("Row", "BaseRow") else t
            return getattr(obj, "is_trial", False)
            
        demo_accounts = sum(1 for t in tenants if is_tenant_trial(t))
        active_accounts = sum(1 for t in tenants if not is_tenant_trial(t))
        
        # Aggregated Usage Stats
        total_users_result = session.exec(select(func.count(User.id))).first()
        total_users = total_users_result[0] if isinstance(total_users_result, tuple) or type(total_users_result).__name__ in ("Row", "BaseRow") else (total_users_result or 0)

        def get_tenant_attr(t, attr, default=0):
            obj = t[0] if isinstance(t, tuple) or type(t).__name__ in ("Row", "BaseRow") else t
            return getattr(obj, attr, default)

        total_clients = sum(get_tenant_attr(t, "usage_clients") for t in tenants)
        total_emails = sum(get_tenant_attr(t, "usage_emails") for t in tenants)
        total_searches = sum(get_tenant_attr(t, "usage_searches") for t in tenants)
        
        # Global Page Utilization
        visits = session.exec(
            select(
                PageVisitTelemetry.page_path,
                func.sum(PageVisitTelemetry.time_spent_seconds).label("total_time"),
                func.count(PageVisitTelemetry.id).label("visit_count")
            ).group_by(PageVisitTelemetry.page_path).order_by(func.sum(PageVisitTelemetry.time_spent_seconds).desc()).limit(10)
        ).all()
        
        top_pages = []
        for v in visits:
            path = v[0] if isinstance(v, tuple) or type(v).__name__ in ("Row", "BaseRow") else getattr(v, "page_path", "")
            time_spent = v[1] if isinstance(v, tuple) or type(v).__name__ in ("Row", "BaseRow") else getattr(v, "total_time", 0)
            visit_count = v[2] if isinstance(v, tuple) or type(v).__name__ in ("Row", "BaseRow") else getattr(v, "visit_count", 0)
            
            top_pages.append({
                "path": path,
                "time_spent": int(time_spent or 0),
                "visits": int(visit_count or 0)
            })
            
        return {
            "demo_accounts": demo_accounts,
            "active_accounts": active_accounts,
            "total_users": total_users,
            "total_clients_managed": total_clients,
            "total_emails_generated": total_emails,
            "total_searches_performed": total_searches,
            "top_pages": top_pages
        }
    finally:
        current_tenant_id.set(old_tenant)


@app.get("/dashboard-call-pitch")
def get_dashboard_call_pitch(session: Session = Depends(get_session)):
    tenant_id = current_tenant_id.get()
    q = select(ClientProfile).where(ClientProfile.call_pitch_done == False)
    if tenant_id:
        q = q.where(ClientProfile.tenant_id == tenant_id)
    client = session.exec(q.order_by(ClientProfile.id.desc())).first()
    
    if not client:
        return {"client": None, "pitch_text": None}
        
    if not client.call_pitch_text:
        # Check limit for Demo users
        if tenant_id:
            tenant = session.get(Tenant, tenant_id)
            if tenant:
                user = session.exec(select(User).where(User.tenant_id == tenant_id)).first()
                if user and user.role == "Demo":
                    if tenant.usage_calls >= tenant.limit_calls:
                        return {"client": _client_dict(client, session), "pitch_text": "Demo limit reached. You can only generate up to 5 pitches."}
                    tenant.usage_calls += 1
                    session.add(tenant)
                    session.commit()

        # Generate pitch using OpenAI
        try:
            import openai
            import os
            api_key = os.getenv("OPENAI_API_KEY", "dummy")
            client_ai = openai.OpenAI(api_key=api_key)
            prompt = f"Write a short, punchy 3-sentence sales call pitch for {client.companyName or 'a new client'} in the {client.industry or 'general'} industry. Target keywords: {client.targetKeywords}. Services offered: {client.services_offered}."
            response = client_ai.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are a top-tier B2B sales expert."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=150
            )
            pitch = response.choices[0].message.content.strip()
            client.call_pitch_text = pitch
            session.add(client)
            session.commit()
            session.refresh(client)
        except Exception as e:
            print(f"Error generating call pitch: {e}")
            client.call_pitch_text = "Hi! I noticed your company might need some help with SEO and growth. I'd love to chat about how we can help you scale."
            session.add(client)
            session.commit()
            
    research_entry = session.exec(select(ClientResearch).where(ClientResearch.client_id == client.id)).first()
    return {
        "client": _client_dict(client, session), 
        "pitch_text": client.call_pitch_text,
        "agent_data": research_entry.email_agent_data if research_entry else None,
        "deep_research": research_entry.company_overview if research_entry else None
    }

class CallPitchDoneRequest(BaseModel):
    feedback: str = ""

@app.post("/dashboard-call-pitch/{client_id}/done")
def mark_call_pitch_done(client_id: int, body: Optional[CallPitchDoneRequest] = None, session: Session = Depends(get_session)):
    client = session.exec(select(ClientProfile).where(ClientProfile.id == client_id)).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    client.call_pitch_done = True
    session.add(client)
    
    if body and body.feedback:
        act = ActivityLog(
            clientId=client.id,
            action="Sales Call Outcome",
            method="Phone",
            content=f"AI Call Pitch Outcome: {body.feedback}"
        )
        session.add(act)
        
    session.commit()
    return {"status": "ok"}


@app.post("/superadmin/tenants/{tenant_id}/analyze")
def analyze_tenant_usage(tenant_id: int, session: Session = Depends(get_session)):
    # AI summary of tenant usage and full breakdown
    _require_roles(session, ["SuperAdmin"])
    old_tenant = current_tenant_id.get()
    current_tenant_id.set(None)
    
    try:
        from database import PageVisitTelemetry
        from sqlalchemy import func
        tenant = session.exec(select(Tenant).where(Tenant.id == tenant_id)).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        
        # Aggregate page visits
        visits = session.exec(
            select(
                PageVisitTelemetry.page_path,
                func.sum(PageVisitTelemetry.time_spent_seconds).label("total_time"),
                func.count(PageVisitTelemetry.id).label("visit_count")
            ).where(PageVisitTelemetry.tenant_id == tenant.id).group_by(PageVisitTelemetry.page_path)
        ).all()
        
        page_stats = []
        for v in visits:
            # v could be a Row tuple (path, total_time, count)
            # Support both Row tuple and getattr approaches depending on SQLAlchemy version
            path = v[0] if isinstance(v, tuple) or type(v).__name__ in ("Row", "BaseRow") else getattr(v, "page_path", "")
            time_spent = v[1] if isinstance(v, tuple) or type(v).__name__ in ("Row", "BaseRow") else getattr(v, "total_time", 0)
            visit_count = v[2] if isinstance(v, tuple) or type(v).__name__ in ("Row", "BaseRow") else getattr(v, "visit_count", 0)
            
            page_stats.append({
                "path": path,
                "time_spent": int(time_spent or 0),
                "visits": int(visit_count or 0)
            })
            
        page_stats.sort(key=lambda x: x["time_spent"], reverse=True)
        
        # OpenAI integration
        from modules.llm_engine import get_openai_client
        client = get_openai_client()
        
        prompt = f"Analyze this SaaS trial account usage telemetry. They are an agency CRM user.\n"
        prompt += f"Limits: {tenant.usage_clients}/{tenant.limit_clients} clients, {tenant.usage_emails}/{tenant.limit_emails} AI emails.\n"
        prompt += "Page Utilization (seconds spent):\n"
        for p in page_stats:
            prompt += f"- {p['path']}: {p['time_spent']} seconds across {p['visits']} visits\n"
        prompt += "\nProvide a concise 3-sentence strategy for the sales team on how to convert this lead. What features are they stuck on? What features do they love? Give a conversion score (0-100) on the last line like 'SCORE: 85'."
        
        try:
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=250
            )
            insight = response.choices[0].message.content.strip()
            # Extract score
            import re
            score_match = re.search(r"SCORE:\s*(\d+)", insight)
            score = int(score_match.group(1)) if score_match else 50
            insight = re.sub(r"SCORE:\s*\d+", "", insight).strip()
        except Exception as e:
            insight = "Insufficient data or AI error."
            score = 0
            
        return {
            "insight": insight,
            "conversion_score": score,
            "page_stats": page_stats
        }
    finally:
        current_tenant_id.set(old_tenant)



@app.post("/login")
def login(body: LoginRequest, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == body.email)).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not _verify_password(body.password, user):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    result = _user_dict(user)
    if user.role == "Client":
        cp = session.exec(select(ClientProfile).where(ClientProfile.userId == user.id)).first()
        if cp:
            result["client_id"] = cp.id
    return {"user": result}

class ForgotPasswordRequest(BaseModel):
    email: str
    redirect_url: Optional[str] = None  # e.g. https://crm.serphawk.in/reset-password

class ResetPasswordRequest(BaseModel):
    email: str
    token: str
    new_password: str

@app.post("/auth/forgot-password")
def forgot_password(body: ForgotPasswordRequest, session: Session = Depends(get_session)):
    """Send a one-time password reset link. Always returns 200 to avoid user enumeration."""
    import secrets
    from database import PasswordResetToken

    user = session.exec(select(User).where(User.email == body.email)).first()

    # Generate + persist a token even for unknown emails so timing doesn't leak existence
    token = secrets.token_urlsafe(48)
    frontend_base = "https://crm.serphawk.in"
    if body.redirect_url:
        from urllib.parse import urlsplit
        p = urlsplit(body.redirect_url)
        if p.scheme in ("http", "https") and p.netloc:
            frontend_base = f"{p.scheme}://{p.netloc}"

    if user:
        # Invalidate previous outstanding tokens for this user (single-use)
        old = session.exec(select(PasswordResetToken).where(PasswordResetToken.user_id == user.id)).all()
        for o in old:
            o.used = True
        session.add(PasswordResetToken(
            user_id=user.id,
            token=token,
            expires_at=datetime.utcnow() + timedelta(hours=1),
        ))
        session.commit()

    reset_url = f"{frontend_base}/reset-password?email={user.email if user else ''}&token={token}"
    from modules.email_sender import send_password_reset_email
    sent = send_password_reset_email(body.email, reset_url)

    result = {"message": "If that email is registered, a password reset link has been sent.", "delivered": sent if user else False}
    if user:
        print(f"[Password reset] link for {user.email}: {reset_url}")
        # Demo/test accounts have fake inboxes: always surface the link so QA and
        # demo users can still complete the reset, even when SMTP reports success.
        is_demo_email = (
            user.email.lower().endswith("@serphawk.in")
            or user.email in ("admin@serphawk.com", "varsh@gmail.com", "varshit@gmail.com", "demo@serphawk.com", "test.user@serphawk.in")
            or "test" in user.email.lower() or "demo" in user.email.lower()
        )
        if not sent or is_demo_email:
            result["debug_reset_link"] = reset_url
    return result

@app.post("/auth/reset-password")
def reset_password(body: ResetPasswordRequest, session: Session = Depends(get_session)):
    """Validate the one-time token and set a new password."""
    from datetime import datetime as _dt
    from database import PasswordResetToken

    user = session.exec(select(User).where(User.email == body.email)).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    rec = session.exec(
        select(PasswordResetToken).where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.token == body.token,
        )
    ).first()
    if not rec or rec.used or rec.expires_at < _dt.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    if not body.new_password or len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    user.password = _hash_password(body.new_password)
    user.hashed_password = ""

    # Invalidate all remaining tokens for this user
    for t in session.exec(select(PasswordResetToken).where(PasswordResetToken.user_id == user.id)).all():
        t.used = True
    session.commit()

    return {"message": "Password updated successfully. You can now sign in."}

class GoogleAuthRequest(BaseModel):
    access_token: str

@app.post("/auth/google")
def auth_google(body: GoogleAuthRequest, session: Session = Depends(get_session)):
    import requests
    resp = requests.get("https://www.googleapis.com/oauth2/v3/userinfo", headers={"Authorization": f"Bearer {body.access_token}"})
    if resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Invalid Google token")
    
    user_info = resp.json()
    email = user_info.get("email")
    name = user_info.get("name")
    
    if not email:
        raise HTTPException(status_code=400, detail="No email found from Google")
        
    user = session.exec(select(User).where(User.email == email)).first()
    is_new_user = False
    
    if not user:
        is_new_user = True
        tenant = Tenant(
            name=f"Demo Tenant {email}",
            is_trial=True,
            limit_clients=15,
            limit_emails=5,
            limit_searches=5,
            limit_projects=5
        )
        session.add(tenant)
        session.commit()
        session.refresh(tenant)

        import os
        user = User(
            email=email,
            password=_hash_password(os.urandom(16).hex()),
            name=name,
            role="Demo",
            tenant_id=tenant.id
        )
        session.add(user)
        session.commit()
        session.refresh(user)

    result = _user_dict(user)
    if user.role == "Client":
        cp = session.exec(select(ClientProfile).where(ClientProfile.userId == user.id)).first()
        if cp:
            result["client_id"] = cp.id

    return {
        "success": True,
        "user": result,
        "is_new_user": is_new_user
    }


# ─────────────────────────────────────────────────────────────────────────────
# Users
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/users")
def create_user(body: CreateUserRequest, session: Session = Depends(get_session)):
    existing = session.exec(select(User).where(User.email == body.email)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    caller_tenant_id = current_tenant_id.get()
    user = User(
        email=body.email,
        password=_hash_password(body.password),
        name=body.name,
        role=body.role,
        # Assign to same tenant as the caller so team members are visible in demo accounts
        tenant_id=caller_tenant_id,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    if body.role == "Client":
        cp = ClientProfile(userId=user.id, tenant_id=caller_tenant_id)
        session.add(cp)
        session.commit()
    return {"user": _user_dict(user)}

@app.get("/users/me")
def get_current_user_profile(session: Session = Depends(get_session)):
    user_id = current_salesperson_id.get()
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": _user_dict(user)}

class UserUpdateMe(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None

@app.put("/users/me")
def update_current_user(body: UserUpdateMe, session: Session = Depends(get_session)):
    user_id = current_salesperson_id.get()
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
        
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if body.name is not None:
        user.name = body.name
    if body.phone is not None:
        user.phone = body.phone
        
    session.commit()
    session.refresh(user)
    return {"user": _user_dict(user)}


@app.get("/users")
def list_users(role: Optional[str] = None, session: Session = Depends(get_session)):
    query = select(User)
    tenant_id = current_tenant_id.get()
    if tenant_id:
        query = query.where(User.tenant_id == tenant_id)
        
    if role:
        roles = [r.strip() for r in role.split(",") if r.strip()]
        if roles:
            query = query.where(User.role.in_(roles))
    users = session.exec(query).all()
    return {"users": [_user_dict(u) for u in users]}





@app.delete("/users/{user_id}")
def delete_user(user_id: int, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    session.delete(user)
    session.commit()
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────────
# Employees & Interns
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/employees")
def list_employees(session: Session = Depends(get_session)):
    query = select(User).where(User.role.in_(["Employee", "Admin", "SalesManager"]))
    tenant_id = current_tenant_id.get()
    if tenant_id:
        query = query.where(User.tenant_id == tenant_id)
    employees = session.exec(query).all()
    return {"employees": [_user_dict(u) for u in employees]}


@app.get("/employees/workload")
def get_employees_workload(session: Session = Depends(get_session)):
    """Return each sales team member with their active client and active lead counts."""
    query = select(User).where(User.role.in_(["Employee", "Admin", "SalesManager"]))
    tenant_id = current_tenant_id.get()
    if tenant_id:
        query = query.where(User.tenant_id == tenant_id)
    employees = session.exec(query).all()

    result = []
    for emp in employees:
        # Count active clients assigned to this employee
        client_count = len(session.exec(
            select(ClientProfile).where(
                ClientProfile.assignedEmployeeId == emp.id,
                ClientProfile.status != "Inactive"
            )
        ).all())
        # Count active (non-converted) leads owned by this employee
        lead_count = len(session.exec(
            select(Lead).where(
                Lead.owner_id == emp.id,
                Lead.is_converted == False,
                Lead.status != "Lost"
            )
        ).all())

        d = _user_dict(emp)
        d["active_clients"] = client_count
        d["active_leads"] = lead_count
        d["total_active"] = client_count + lead_count
        result.append(d)

    # Sort by total workload ascending (least busy first)
    result.sort(key=lambda x: x["total_active"])
    return {"employees": result}


@app.get("/interns")
def list_interns(session: Session = Depends(get_session)):
    query = select(User).where(User.role == "Intern")
    tenant_id = current_tenant_id.get()
    if tenant_id:
        query = query.where(User.tenant_id == tenant_id)
    interns = session.exec(query).all()
    return {"interns": [_user_dict(u) for u in interns]}


# ─────────────────────────────────────────────────────────────────────────────
# Client Statuses
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/client-statuses")
def list_client_statuses(session: Session = Depends(get_session)):
    statuses = session.exec(select(ClientStatus)).all()
    if not statuses:
        # Return sensible defaults if table is empty
        statuses = [
            {"id": 1, "name": "Active", "color": "bg-emerald-500"},
            {"id": 2, "name": "Hold", "color": "bg-amber-500"},
            {"id": 3, "name": "Pending", "color": "bg-slate-400"},
        ]
        return {"statuses": statuses}
    return {"statuses": [{"id": s.id, "name": s.name, "color": s.color} for s in statuses]}


# ─────────────────────────────────────────────────────────────────────────────
# Clients
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/clients")
def list_clients(
    status: Optional[str] = None,
    query: Optional[str] = None,
    assigned_employee_id: Optional[int] = None,
    page: int = 1,
    per_page: int = 18,
    session: Session = Depends(get_session),
):
    q = select(ClientProfile)
    if status and status != "All":
        q = q.where(ClientProfile.status == status)
    if query:
        search_term = f"%{query}%"
        q = q.where(
            or_(
                ClientProfile.companyName.ilike(search_term),
                ClientProfile.projectName.ilike(search_term),
                ClientProfile.websiteUrl.ilike(search_term),
                ClientProfile.gmbName.ilike(search_term),
            )
        )
    if assigned_employee_id is not None:
        q = q.where(ClientProfile.assignedEmployeeId == assigned_employee_id)

    tenant_id = current_tenant_id.get()
    count_q = select(func.count()).select_from(ClientProfile)
    if tenant_id and tenant_id != 1:
        q = q.where(ClientProfile.tenant_id == tenant_id)
        count_q = count_q.where(ClientProfile.tenant_id == tenant_id)
        
    if status and status != "All":
        count_q = count_q.where(ClientProfile.status == status)
    if query:
        search_term = f"%{query}%"
        cond = or_(
            ClientProfile.companyName.ilike(search_term),
            ClientProfile.projectName.ilike(search_term),
            ClientProfile.websiteUrl.ilike(search_term),
            ClientProfile.gmbName.ilike(search_term),
        )
        count_q = count_q.where(cond)
    if assigned_employee_id is not None:
        count_q = count_q.where(ClientProfile.assignedEmployeeId == assigned_employee_id)

    total = session.exec(count_q).one()
    clients = session.exec(q.order_by(ClientProfile.id.desc()).offset((page - 1) * per_page).limit(per_page)).all()
    return {
        "clients": [_client_dict(c, session) for c in clients],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@app.post("/clients")
def create_client(body: ClientCreateRequest, session: Session = Depends(get_session)):
    tenant_id = current_tenant_id.get()
    if tenant_id and tenant_id != 1:
        tenant = session.get(Tenant, tenant_id)
        if tenant:
            current_count = session.exec(select(func.count(ClientProfile.id)).where(ClientProfile.tenant_id == tenant_id)).one()
            if current_count >= tenant.limit_clients:
                raise HTTPException(status_code=403, detail=f"Client limit reached. Maximum allowed: {tenant.limit_clients}")
    check_tenant_limit(session, "clients")
    user = None
    if body.email:
        user = session.exec(select(User).where(User.email == body.email)).first()
        if not user:
            try:
                user = User(
                    email=body.email,
                    password=_hash_password(body.password or "changeme"),
                    name=body.name or body.companyName or "Client",
                    role="Client",
                )
                session.add(user)
                session.commit()
                session.refresh(user)
            except Exception:
                # Email already exists (race condition) — roll back and fetch existing user
                session.rollback()
                user = session.exec(select(User).where(User.email == body.email)).first()

    cp = ClientProfile(
        tenant_id=current_tenant_id.get(),
        userId=user.id if user else None,
        companyName=body.companyName,
        phone=body.phone,
        address=body.address,
        status=body.status,
        projectName=body.projectName,
        gmbName=body.gmbName,
        seoStrategy=body.seoStrategy,
        tagline=body.tagline,
        websiteUrl=body.websiteUrl,
        targetKeywords=body.targetKeywords,
        assignedEmployeeId=body.assigned_employee_id,
    )
    session.add(cp)
    session.commit()
    session.refresh(cp)
    
    try:
        _notify_admins(
            session, current_tenant_id.get(),
            title=f"🏢 New Client: {cp.companyName}",
            message=f"Status: {cp.status} | Website: {cp.websiteUrl or 'N/A'}",
            notif_type="success",
            link=f"/admin/clients/{cp.id}"
        )
    except Exception:
        pass
    
    # ── WHATSAPP NOTIFICATION ──
    try:
        from modules.whatsapp import send_ai_polished_whatsapp_message
        base_url = "https://crm-seo.allytechcourses.com"
        send_ai_polished_whatsapp_message("New Client Onboarded", cp.dict(), f"{base_url}/clients/{cp.id}")
    except Exception as e:
        print("WhatsApp Error:", e)

    # ── AUTO-RESEARCH ──
    try:
        _trigger_background_research(
            entity_id=cp.id,
            entity_type="client",
            company_name=cp.companyName or "",
            website=cp.websiteUrl or ""
        )
    except Exception as e:
        print(f"AutoResearch trigger error for client {cp.id}: {e}")
        
    return {"client": _client_dict(cp, session)}



# ─── CSV/Sheet Import ────────────────────────────────────────────────────────
from pydantic import BaseModel as _BM
from typing import Optional as _Opt
import csv as _csv
import io as _io

class SheetImportRequest(_BM):
    csv_url: _Opt[str] = None
    csv_text: _Opt[str] = None
    assigned_employee_id: _Opt[int] = None

@app.get("/dev/reset-clients")
def dev_reset_clients(session: Session = Depends(get_session)):
    _require_roles(session, ["SuperAdmin"])
    from sqlalchemy import text
    from sqlmodel import delete
    
    # 1. Delete Client Research
    session.exec(delete(ClientResearch))
    
    # 2. Reset Client Profiles
    is_postgres = engine.url.drivername.startswith("postgres")
    if is_postgres:
        session.exec(text("TRUNCATE TABLE client_profiles RESTART IDENTITY CASCADE"))
    else:
        session.exec(delete(ClientProfile))
        try:
            session.exec(text("UPDATE sqlite_sequence SET seq = 0 WHERE name = 'client_profiles'"))
        except Exception:
            pass
            
    # 3. Clear Users with role 'Client'
    session.exec(delete(User).where(User.role == 'Client'))
    
    session.commit()
    return {"message": "Client database has been completely reset to 0."}

@app.get("/dev/patch-invoices")
def dev_patch_invoices(session: Session = Depends(get_session)):
    _require_roles(session, ["SuperAdmin"])
    from sqlalchemy import text
    try:
        session.exec(text("ALTER TABLE invoices ADD COLUMN currency VARCHAR(10) DEFAULT 'MXN';"))
        session.commit()
        return {"success": True, "message": "Invoices table successfully patched with currency column."}
    except Exception as e:
        return {"success": False, "error": str(e)}





# ─── CSV Export ────────────────────────────────────────────────────────────────


# ─── PDF Export ────────────────────────────────────────────────────────────────
@app.get("/clients/export-pdf")
def export_clients_pdf(session: Session = Depends(get_session)):
    from fastapi.responses import StreamingResponse
    import io
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet

    clients_list = session.exec(select(ClientProfile).order_by(ClientProfile.id.asc())).all()
    
    output = io.BytesIO()
    doc = SimpleDocTemplate(output, pagesize=landscape(A4), rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)
    elements = []
    
    styles = getSampleStyleSheet()
    title = Paragraph("<b>Clients & Leads List</b>", styles['Title'])
    elements.append(title)
    elements.append(Spacer(1, 12))
    
    data = [["S.No", "Client Name", "Email", "Phone"]]
    
    style_normal = styles["Normal"]
    style_normal.wordWrap = 'CJK'
    
    def truncate(text, max_len=40):
        if not text: return ""
        text = str(text).strip()
        return text if len(text) <= max_len else text[:max_len-3] + "..."

    for i, c in enumerate(clients_list, 1):
        user = session.get(User, c.userId) if c.userId else None
        emp = session.get(User, c.assignedEmployeeId) if c.assignedEmployeeId else None
        
        name = Paragraph(truncate(c.companyName, 50), style_normal)
        client_email = c.email if hasattr(c, 'email') and c.email else (user.email if user else "")
        email = Paragraph(truncate(client_email, 40), style_normal)
        phone = Paragraph(truncate(c.phone, 30), style_normal)
        
        data.append([str(i), name, email, phone])
        
    # Col widths (total A4 landscape width is ~842, minus margins (60) = 782)
    col_widths = [40, 300, 242, 200]
    
    table = Table(data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor("#334155")),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    
    elements.append(table)
    doc.build(elements)
    
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=serphawk_clients.pdf"}
    )

@app.get("/clients/export-custom-pdf")
def export_custom_clients_pdf(cols: str = "name,email,phone,description", session: Session = Depends(get_session)):
    from fastapi.responses import StreamingResponse
    import io
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet

    selected_cols = [c.strip().lower() for c in cols.split(",") if c.strip()]
    if not selected_cols:
        selected_cols = ["name", "email", "phone", "description"]
        
    col_definitions = {
        "sno": {"header": "S.No", "weight": 0.5},
        "name": {"header": "Client Name", "weight": 2.0},
        "website": {"header": "Website URL", "weight": 2.0},
        "email": {"header": "Email", "weight": 2.0},
        "phone": {"header": "Phone", "weight": 1.5},
        "status": {"header": "Status", "weight": 1.0},
        "assigned": {"header": "Assigned To", "weight": 1.5},
        "description": {"header": "Brief / Description", "weight": 4.0},
    }
    
    if "sno" not in selected_cols:
        selected_cols.insert(0, "sno")
        
    valid_cols = [c for c in selected_cols if c in col_definitions]
    
    clients_list = session.exec(select(ClientProfile).order_by(ClientProfile.id.asc())).all()
    
    output = io.BytesIO()
    doc = SimpleDocTemplate(output, pagesize=landscape(A4), rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30)
    elements = []
    
    styles = getSampleStyleSheet()
    title = Paragraph("<b>Custom Clients & Leads List</b>", styles['Title'])
    elements.append(title)
    elements.append(Spacer(1, 12))
    
    headers = [col_definitions[c]["header"] for c in valid_cols]
    data = [headers]
    
    style_normal = styles["Normal"]
    style_normal.wordWrap = 'CJK'
    
    def truncate(text, max_len=200):
        if not text: return ""
        text = str(text).strip()
        return text if len(text) <= max_len else text[:max_len-3] + "..."

    for i, c in enumerate(clients_list, 1):
        user = session.get(User, c.userId) if c.userId else None
        emp = session.get(User, c.assignedEmployeeId) if c.assignedEmployeeId else None
        
        row = []
        for col in valid_cols:
            if col == "sno":
                row.append(str(i))
            elif col == "name":
                row.append(Paragraph(truncate(c.companyName, 100), style_normal))
            elif col == "website":
                row.append(Paragraph(truncate(c.websiteUrl, 100), style_normal))
            elif col == "email":
                row.append(Paragraph(truncate(user.email if user else "", 100), style_normal))
            elif col == "phone":
                row.append(Paragraph(truncate(c.phone, 50), style_normal))
            elif col == "status":
                row.append(Paragraph(truncate(c.status or "Active", 50), style_normal))
            elif col == "assigned":
                row.append(Paragraph(truncate(emp.name if emp else "Unassigned", 50), style_normal))
            elif col == "description":
                cf = c.customFields or {}
                cf_dict = cf if isinstance(cf, dict) else {}
                desc = cf_dict.get("description", "")
                row.append(Paragraph(truncate(desc, 300), style_normal))
        data.append(row)
        
    total_weight = sum([col_definitions[c]["weight"] for c in valid_cols])
    printable_width = 782
    col_widths = [(col_definitions[c]["weight"] / total_weight) * printable_width for c in valid_cols]
    
    table = Table(data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor("#334155")),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    
    elements.append(table)
    doc.build(elements)
    
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=serphawk_custom_clients.pdf"}
    )


@app.get("/clients/{client_id}")
def get_client(client_id: int, session: Session = Depends(get_session)):
    cp = session.get(ClientProfile, client_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Client not found")
    return {"client": _client_dict(cp, session)}

class SimulateCallRequest(BaseModel):
    context: Optional[str] = None





@app.put("/clients/{client_id}")
def update_client(
    client_id: int, body: ClientUpdateRequest, session: Session = Depends(get_session)
):
    cp = session.get(ClientProfile, client_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Client not found")
    updates = body.model_dump(exclude_unset=True)
    for field, val in updates.items():
        if field == "customFields" and val is not None:
            cp.customFields = {**(cp.customFields or {}), **val}
        else:
            setattr(cp, field, val)
    session.add(cp)
    session.commit()
    session.refresh(cp)
    return {"client": _client_dict(cp, session)}


@app.post("/clients/{client_id}/swot")
async def generate_client_swot(client_id: int, session: Session = Depends(get_session)):
    cp = session.get(ClientProfile, client_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Client not found")
    if not cp.websiteUrl:
        raise HTTPException(status_code=400, detail="Client has no website URL configured")
        
    from modules.llm_engine import generate_swot_analysis
    import json
    
    swot_data = await generate_swot_analysis(cp.websiteUrl, cp.companyName or "Client")
    cp.swot_analysis = json.dumps(swot_data)
    session.add(cp)
    session.commit()
    session.refresh(cp)
    return {"ok": True, "swot_analysis": swot_data}



@app.post("/leads/{lead_id}/assign-employee")
def assign_employee_lead(
    lead_id: int, body: AssignEmployeeRequest, session: Session = Depends(get_session)
):
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    lead.owner_id = body.employee_id
    session.add(lead)
    session.commit()
    return {"ok": True}


@app.post("/clients/{client_id}/assign-employee")
def assign_employee(
    client_id: int, body: AssignEmployeeRequest, session: Session = Depends(get_session)
):
    cp = session.get(ClientProfile, client_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Client not found")
    cp.assignedEmployeeId = body.employee_id
    session.add(cp)
    session.commit()
    return {"ok": True}


@app.post("/clients/{client_id}/keywords")
def add_keyword(
    client_id: int, body: KeywordRequest, session: Session = Depends(get_session)
):
    cp = session.get(ClientProfile, client_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Client not found")
    kws = list(cp.targetKeywords or [])
    if body.keyword not in kws:
        kws.append(body.keyword)
    cp.targetKeywords = kws
    session.add(cp)
    session.commit()
    return {"keywords": cp.targetKeywords}


@app.delete("/clients/{client_id}/keywords")
def remove_keyword(
    client_id: int, keyword: str = Query(...), session: Session = Depends(get_session)
):
    cp = session.get(ClientProfile, client_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Client not found")
    cp.targetKeywords = [k for k in (cp.targetKeywords or []) if k != keyword]
    session.add(cp)
    session.commit()
    return {"keywords": cp.targetKeywords}


@app.get("/clients/{client_id}/remarks")
def get_client_remarks(client_id: int, session: Session = Depends(get_session)):
    remarks = session.exec(
        select(Remark).where(Remark.clientId == client_id).order_by(Remark.createdAt.desc())
    ).all()
    return {
        "remarks": [
            {
                "id": r.id,
                "content": r.content,
                "authorId": r.authorId,
                "isInternal": r.isInternal,
                "createdAt": r.createdAt.isoformat(),
            }
            for r in remarks
        ]
    }


@app.post("/clients/{client_id}/remarks")
def add_client_remark(
    client_id: int, body: RemarkCreateRequest, session: Session = Depends(get_session)
):
    r = Remark(
        content=body.content,
        authorId=body.authorId,
        clientId=client_id,
        isInternal=body.isInternal,
    )
    session.add(r)
    session.commit()
    session.refresh(r)
    return {
        "id": r.id,
        "content": r.content,
        "authorId": r.authorId,
        "isInternal": r.isInternal,
        "createdAt": r.createdAt.isoformat(),
    }


@app.get("/clients/{client_id}/activities")
def get_client_activities(client_id: int, session: Session = Depends(get_session)):
    logs = session.exec(
        select(ActivityLog)
        .where(ActivityLog.clientId == client_id)
        .order_by(ActivityLog.createdAt.desc())
    ).all()
    return {
        "activities": [
            {
                "id": a.id,
                "action": a.action,
                "method": a.method,
                "content": a.content,
                "details": a.details,
                "createdAt": a.createdAt.isoformat(),
            }
            for a in logs
        ]
    }


@app.post("/clients/{client_id}/activities")
def add_client_activity(
    client_id: int, body: ActivityCreateRequest, session: Session = Depends(get_session)
):
    log = ActivityLog(
        clientId=client_id,
        userId=body.authorId,
        action=body.action,
        method=body.method,
        content=body.content,
        details=body.details,
    )
    session.add(log)
    session.commit()
    session.refresh(log)
    return {"id": log.id, "action": log.action, "createdAt": log.createdAt.isoformat()}


@app.post("/clients/{client_id}/followup")
def add_client_followup(client_id: int, body: ClientFollowUpRequest, session: Session = Depends(get_session)):
    cp = session.get(ClientProfile, client_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Client not found")

    remark = Remark(
        content=body.content,
        authorId=body.authorId,
        clientId=client_id,
        isInternal=body.isInternal,
    )
    session.add(remark)
    session.commit()
    session.refresh(remark)

    if body.email_agent_data:
        client_research = session.exec(
            select(ClientResearch).where(ClientResearch.client_id == client_id)
        ).first()
        if not client_research:
            client_research = ClientResearch(
                client_id=client_id,
                email_agent_data=body.email_agent_data
            )
            session.add(client_research)
        else:
            client_research.email_agent_data = body.email_agent_data
            session.add(client_research)
        session.commit()

    task_response = None
    if body.task_title:
        task = Task(
            title=body.task_title,
            description=body.task_description or body.content,
            status="Todo",
            priority="Medium",
            due_date=body.due_date,
            client_id=client_id,
            assigned_to=body.assigned_to,
            created_by=body.authorId,
        )
        session.add(task)
        session.commit()
        session.refresh(task)

        if task.assigned_to:
            notif = Notification(
                user_id=task.assigned_to,
                title="New Follow-up Task Assigned",
                message=f"A follow-up task has been created for {cp.companyName or 'the client'}.",
                type="info",
                link="/tasks",
            )
            session.add(notif)
            session.commit()

        task_response = _task_dict(task, session)

    return {
        "remark": {
            "id": remark.id,
            "content": remark.content,
            "authorId": remark.authorId,
            "isInternal": remark.isInternal,
            "createdAt": remark.createdAt.isoformat(),
        },
        "task": task_response,
    }


@app.get("/clients/{client_id}/emails")
def get_client_emails(client_id: int, session: Session = Depends(get_session)):
    cp = session.get(ClientProfile, client_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Client not found")
    emails = session.exec(select(SentEmail).where(SentEmail.client_id == client_id).order_by(SentEmail.sent_at.desc())).all()
    return {"emails": emails}

# ─── Client Notes ──────────────────────────────────────────────────────────────

@app.get("/clients/{client_id}/notes")
def get_client_notes(client_id: int, session: Session = Depends(get_session)):
    notes = session.exec(
        select(ClientNote).where(ClientNote.client_id == client_id)
        .order_by(ClientNote.is_pinned.desc(), ClientNote.created_at.desc())
    ).all()
    return {"notes": [
        {
            "id": n.id, "content": n.content, "tags": n.tags or [],
            "is_pinned": n.is_pinned, "author_id": n.author_id,
            "author_name": n.author_name, "created_at": n.created_at.isoformat(),
            "updated_at": n.updated_at.isoformat(),
        } for n in notes
    ]}


@app.post("/clients/{client_id}/notes")
def create_client_note(client_id: int, body: ClientNoteCreateRequest, session: Session = Depends(get_session)):
    note = ClientNote(
        client_id=client_id, content=body.content, tags=body.tags or [],
        is_pinned=body.is_pinned, author_id=body.author_id, author_name=body.author_name,
    )
    session.add(note)
    
    cp = session.get(ClientProfile, client_id)
    client_name = cp.companyName if cp and cp.companyName else f"Client #{client_id}"
    author = body.author_name or "Someone"
    log = ActivityLog(
        clientId=client_id,
        userId=body.author_id,
        action="Added Note",
        method="Notes",
        content=f"{author} added a note for {client_name}",
        details=body.content[:200]
    )
    session.add(log)
    
    session.commit()
    session.refresh(note)
    
    # ── WHATSAPP NOTIFICATION ──
    try:
        from modules.whatsapp import send_ai_polished_whatsapp_message
        base_url = "https://crm-seo.allytechcourses.com"
        send_ai_polished_whatsapp_message("New Note Added", {"client": client_name, "content": note.content, "author": author}, f"{base_url}/clients/{client_id}")
    except Exception as e:
        print("WhatsApp Error:", e)
        
    return {"id": note.id, "content": note.content, "tags": note.tags, "is_pinned": note.is_pinned,
            "author_name": note.author_name, "created_at": note.created_at.isoformat()}

@app.put("/clients/{client_id}/notes/{note_id}")
def update_client_note(client_id: int, note_id: int, body: ClientNoteUpdateRequest, session: Session = Depends(get_session)):
    note = session.get(ClientNote, note_id)
    if not note or note.client_id != client_id:
        raise HTTPException(status_code=404, detail="Note not found")
    if body.content is not None:
        note.content = body.content
    if body.tags is not None:
        note.tags = body.tags
    if body.is_pinned is not None:
        note.is_pinned = body.is_pinned
    note.updated_at = datetime.utcnow()
    session.add(note)
    session.commit()
    
    # ── WHATSAPP NOTIFICATION ──
    try:
        from modules.whatsapp import send_ai_polished_whatsapp_message
        base_url = "https://crm-seo.allytechcourses.com"
        send_ai_polished_whatsapp_message("Note Updated", {"content": note.content, "tags": note.tags, "is_pinned": note.is_pinned}, f"{base_url}/clients/{client_id}")
    except Exception as e:
        print("WhatsApp Error:", e)
        
    return {"ok": True}


@app.delete("/clients/{client_id}/notes/{note_id}")
def delete_client_note(client_id: int, note_id: int, session: Session = Depends(get_session)):
    note = session.get(ClientNote, note_id)
    if not note or note.client_id != client_id:
        raise HTTPException(status_code=404, detail="Note not found")
    session.delete(note)
    session.commit()
    return {"ok": True}


@app.post("/clients/{client_id}/notes/{note_id}/extract-tasks")
def extract_tasks_from_client_note(client_id: int, note_id: int, session: Session = Depends(get_session)):
    note = session.get(ClientNote, note_id)
    if not note or note.client_id != client_id:
        raise HTTPException(status_code=404, detail="Note not found")
        
    from modules.llm_engine import extract_tasks_from_note
    tasks_extracted = extract_tasks_from_note(note.content)
    
    created_tasks = []
    for t in tasks_extracted:
        new_task = Task(
            title=t.get("title", "Extracted Task"),
            description=t.get("description", "") + f"\n\n(Extracted from Note #{note_id})",
            client_id=client_id,
            status="Todo",
            priority="Medium"
        )
        session.add(new_task)
        created_tasks.append(new_task)
        
    session.commit()
    return {"ok": True, "extracted_count": len(created_tasks)}


# ─── Conversation Logs ────────────────────────────────────────────────────────

@app.get("/clients/{client_id}/conversations")
def get_client_conversations(client_id: int, session: Session = Depends(get_session)):
    convs = session.exec(
        select(ConversationLog).where(ConversationLog.client_id == client_id)
        .order_by(ConversationLog.created_at.desc())
    ).all()
    result = []
    for c in convs:
        replies = session.exec(
            select(ConversationReply).where(ConversationReply.conversation_id == c.id)
            .order_by(ConversationReply.created_at.asc())
        ).all()
        result.append({
            "id": c.id, "title": c.title, "type": c.type,
            "description": c.description, "author_id": c.author_id,
            "author_name": c.author_name, "attachment_urls": c.attachment_urls or [],
            "created_at": c.created_at.isoformat(),
            "replies": [{"id": r.id, "content": r.content, "author_name": r.author_name,
                         "created_at": r.created_at.isoformat()} for r in replies],
        })
    return {"conversations": result}


@app.post("/clients/{client_id}/conversations")
def create_client_conversation(client_id: int, body: ConversationLogCreateRequest, session: Session = Depends(get_session)):
    conv = ConversationLog(
        client_id=client_id, title=body.title, type=body.type,
        description=body.description, author_id=body.author_id,
        author_name=body.author_name, attachment_urls=body.attachment_urls or [],
    )
    session.add(conv)

    cp = session.get(ClientProfile, client_id)
    client_name = cp.companyName if cp and cp.companyName else f"Client #{client_id}"
    author = body.author_name or "Someone"
    log = ActivityLog(
        clientId=client_id,
        userId=body.author_id,
        action=f"Logged {body.type.capitalize()}",
        method=body.type.capitalize(),
        content=f"{author} logged a {body.type} for {client_name}",
        details=body.title
    )
    session.add(log)

    session.commit()
    session.refresh(conv)
    
    # ── WHATSAPP NOTIFICATION ──
    try:
        from modules.whatsapp import send_ai_polished_whatsapp_message
        base_url = "https://crm-seo.allytechcourses.com"
        event_data = {"client_name": client_name, "type": body.type, "description": body.description}
        send_ai_polished_whatsapp_message("New Client Chat Message", event_data, f"{base_url}/clients/{client_id}")
    except Exception as e:
        print("WhatsApp Error:", e)
        
    return {"id": conv.id, "title": conv.title, "type": conv.type, "created_at": conv.created_at.isoformat()}


@app.post("/clients/{client_id}/conversations/{conv_id}/replies")
def add_conversation_reply(client_id: int, conv_id: int, body: ConversationReplyCreateRequest, session: Session = Depends(get_session)):
    conv = session.get(ConversationLog, conv_id)
    if not conv or conv.client_id != client_id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    reply = ConversationReply(
        conversation_id=conv_id, content=body.content,
        author_id=body.author_id, author_name=body.author_name,
    )
    session.add(reply)
    session.commit()
    session.refresh(reply)
    
    # ── WHATSAPP NOTIFICATION ──
    try:
        from modules.whatsapp import send_ai_polished_whatsapp_message
        base_url = "https://crm-seo.allytechcourses.com"
        cp = session.get(ClientProfile, client_id)
        client_name = cp.companyName if cp and cp.companyName else f"Client #{client_id}"
        event_data = {"author": body.author_name or client_name, "content": body.content}
        send_ai_polished_whatsapp_message("New Conversation Reply", event_data, f"{base_url}/clients/{client_id}")
    except Exception as e:
        print("WhatsApp Error:", e)
        
    return {"id": reply.id, "content": reply.content, "author_name": reply.author_name,
            "created_at": reply.created_at.isoformat()}


# ─── Client Research ──────────────────────────────────────────────────────────

@app.get("/clients/{client_id}/research")
def get_client_research(client_id: int, session: Session = Depends(get_session)):
    research = session.exec(select(ClientResearch).where(ClientResearch.client_id == client_id)).first()
    if not research:
        return {"research": None}
    return {"research": {
        "id": research.id, "company_overview": research.company_overview,
        "competitors": research.competitors, "tech_stack": research.tech_stack,
        "recent_news": research.recent_news, "pain_points": research.pain_points,
        "business_goals": research.business_goals, "key_decision_makers": research.key_decision_makers,
        "email_agent_data": research.email_agent_data,
        "updated_at": research.updated_at.isoformat(),
    }}


@app.put("/clients/{client_id}/research")
def upsert_client_research(client_id: int, body: ClientResearchUpdateRequest, session: Session = Depends(get_session)):
    research = session.exec(select(ClientResearch).where(ClientResearch.client_id == client_id)).first()
    if not research:
        research = ClientResearch(client_id=client_id)
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(research, field, val)
    research.updated_at = datetime.utcnow()
    session.add(research)
    session.commit()
    return {"ok": True}


@app.post("/clients/{client_id}/auto-research")
def auto_research_client(client_id: int, session: Session = Depends(get_session)):
    check_tenant_limit(session, "searches")
    cp = session.get(ClientProfile, client_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Client not found")
        
    try:
        # Trigger the same deep background research we use on creation
        _trigger_background_research(
            entity_id=client_id,
            entity_type="client",
            company_name=cp.companyName or "",
            website=cp.websiteUrl or ""
        )
        return {"ok": True, "message": "Research started in background"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to auto-research: {str(e)}")








# ─── Extract Client Services from Website ─────────────────────────────────────




# ─── AI Copilot Insights ──────────────────────────────────────────────────────


@app.post("/clients/{client_id}/ai-insights")
def get_ai_insights(client_id: int, session: Session = Depends(get_session)):
    cp = session.get(ClientProfile, client_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Client not found")

    # Gather context
    notes = session.exec(select(ClientNote).where(ClientNote.client_id == client_id).order_by(ClientNote.created_at.desc()).limit(10)).all()
    convs = session.exec(select(ConversationLog).where(ConversationLog.client_id == client_id).order_by(ConversationLog.created_at.desc()).limit(10)).all()
    activities = session.exec(select(ActivityLog).where(ActivityLog.clientId == client_id).order_by(ActivityLog.createdAt.desc()).limit(10)).all()
    research = session.exec(select(ClientResearch).where(ClientResearch.client_id == client_id)).first()

    notes_text = "\n".join([f"- {n.content[:200]}" for n in notes]) if notes else "No notes recorded."
    convs_text = "\n".join([f"- [{c.type.upper()}] {c.title}: {(c.description or '')[:200]}" for c in convs]) if convs else "No conversations recorded."
    activities_text = "\n".join([f"- {a.action}" for a in activities]) if activities else "No activities."
    research_text = ""
    if research:
        research_text = f"Pain Points: {research.pain_points or 'unknown'}\nBusiness Goals: {research.business_goals or 'unknown'}\nCompetitors: {research.competitors or 'unknown'}"

    last_contact = None
    if convs:
        last_contact = convs[0].created_at
    elif activities:
        last_contact = activities[0].createdAt

    days_since_contact = None
    if last_contact:
        days_since_contact = (datetime.utcnow() - last_contact).days

    prompt = f"""You are an AI Sales Copilot analyzing a CRM client record. Provide actionable insights.

CLIENT: {cp.companyName or 'Unknown'}
STATUS: {cp.status}
DEAL VALUE: {cp.deal_value or 'Not set'}
LEAD SCORE: {cp.lead_score or 'Not set'}/100
DAYS SINCE LAST CONTACT: {days_since_contact if days_since_contact is not None else 'Unknown'}

RESEARCH:\n{research_text}
NOTES:\n{notes_text}
CONVERSATIONS:\n{convs_text}
ACTIVITIES:\n{activities_text}

Provide a JSON response with exactly these keys:
{{
  "client_summary": "2-3 sentence overview of client relationship and status",
  "deal_health_score": <integer 0-100>,
  "risks": ["risk 1", "risk 2"],
  "next_best_action": "Single most important action to take right now",
  "follow_up_recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"],
  "deal_health_label": "Hot|Warm|Cold|At Risk"
}}"""

    try:
        from modules.llm_engine import get_openai_client
        import json as _json
        import concurrent.futures as _cf
        def _call_openai():
            client_ai = get_openai_client()
            resp = client_ai.chat.completions.create(
                model="gpt-4o-mini",
                temperature=0.0,
                messages=[
                    {"role": "system", "content": "You are an expert CRM sales analyst. Always respond with valid JSON only."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"}
            )
            return _json.loads(resp.choices[0].message.content)
        with _cf.ThreadPoolExecutor(max_workers=1) as _executor:
            _future = _executor.submit(_call_openai)
            try:
                insights = _future.result(timeout=25)
            except (_cf.TimeoutError, Exception):
                raise ValueError("OpenAI timed out or failed")
    except Exception as e:
        # Fallback insights if AI fails
        score = 75 if days_since_contact and days_since_contact < 7 else (50 if days_since_contact and days_since_contact < 14 else 30)
        insights = {
            "client_summary": f"{cp.companyName or 'This client'} is currently {cp.status}. Review recent activity to determine next steps.",
            "deal_health_score": score,
            "risks": [
                f"No contact in {days_since_contact} days" if days_since_contact and days_since_contact > 7 else "Monitor engagement levels",
                "Ensure proposal is aligned with client goals"
            ],
            "next_best_action": "Schedule a follow-up call to reaffirm value proposition",
            "follow_up_recommendations": [
                "Send a personalized follow-up email",
                "Schedule a discovery call this week",
                "Share a relevant case study"
            ],
            "deal_health_label": "Warm" if score > 60 else "Cold"
        }

    return {"insights": insights}


# ─────────────────────────────────────────────────────────────────────────────
# Lead AI Sales Copilot
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/leads/{lead_id}/ai-insights")
def get_lead_ai_insights(lead_id: int, session: Session = Depends(get_session)):
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    notes = session.exec(select(LeadNote).where(LeadNote.lead_id == lead_id).order_by(LeadNote.created_at.desc()).limit(10)).all()
    convs = session.exec(select(ConversationLog).where(ConversationLog.lead_id == lead_id).order_by(ConversationLog.created_at.desc()).limit(10)).all()
    activities = session.exec(select(ActivityLog).where(ActivityLog.lead_id == lead_id).order_by(ActivityLog.createdAt.desc()).limit(10)).all()
    research = session.exec(select(ClientResearch).where(ClientResearch.lead_id == lead_id)).first()

    notes_text = "\n".join(f"- {n.content[:200]}" for n in notes) if notes else "No notes recorded."
    convs_text = "\n".join(f"- [{c.type.upper()}] {c.title}: {(c.description or '')[:200]}" for c in convs) if convs else "No conversations recorded."
    activities_text = "\n".join(f"- {a.action}" for a in activities) if activities else "No activities."
    research_text = ""
    if research:
        research_text = f"Pain Points: {research.pain_points or 'unknown'}\nBusiness Goals: {research.business_goals or 'unknown'}\nCompetitors: {research.competitors or 'unknown'}"

    last_contact = None
    if convs:
        last_contact = convs[0].created_at
    elif activities:
        last_contact = activities[0].createdAt

    days_since_contact = None
    if last_contact:
        days_since_contact = (datetime.utcnow() - last_contact).days

    prompt = f"""You are an AI Sales Copilot analyzing a CRM lead. Provide actionable insights.

LEAD: {lead.company_name or 'Unknown'}
STATUS: {lead.status}
INDUSTRY: {lead.industry or 'Unknown'}
DEAL VALUE: {getattr(lead, 'deal_value', None) or 'Not set'}
DAYS SINCE LAST CONTACT: {days_since_contact if days_since_contact is not None else 'Unknown'}

RESEARCH:\n{research_text}
NOTES:\n{notes_text}
CONVERSATIONS:\n{convs_text}
ACTIVITIES:\n{activities_text}

Provide a JSON response with exactly these keys:
{{
  "client_summary": "2-3 sentence overview of lead status",
  "deal_health_score": <integer 0-100>,
  "risks": ["risk 1", "risk 2"],
  "next_best_action": "one action",
  "follow_up_recommendations": ["recommendation"],
  "deal_health_label": "Hot|Warm|Cold|At Risk"
}}"""
    try:
        from modules.llm_engine import get_openai_client
        import json as _json
        import concurrent.futures as _cf
        def _call_openai_lead():
            resp = get_openai_client().chat.completions.create(
                model="gpt-4o-mini", temperature=0,
                messages=[
                    {"role": "system", "content": "You are an expert CRM sales analyst. Always respond with valid JSON only."},
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
            )
            return _json.loads(resp.choices[0].message.content)
        with _cf.ThreadPoolExecutor(max_workers=1) as _executor:
            _future = _executor.submit(_call_openai_lead)
            try:
                insights = _future.result(timeout=25)
            except (_cf.TimeoutError, Exception):
                raise ValueError("OpenAI timed out or failed")
    except Exception:
        insights = {
            "client_summary": f"{lead.company_name or 'This lead'} is currently {lead.status}.",
            "deal_health_score": 50,
            "risks": ["Review recent engagement and qualification data"],
            "next_best_action": "Schedule a qualification follow-up",
            "follow_up_recommendations": ["Confirm decision maker", "Validate business need"],
            "deal_health_label": "Warm",
        }
    return {"insights": insights}


# ─────────────────────────────────────────────────────────────────────────────
# Client Tickets
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/clients/{client_id}/tickets")
def get_client_tickets(client_id: int, session: Session = Depends(get_session)):
    tickets = session.exec(
        select(ClientTicket)
        .where(ClientTicket.client_id == client_id)
        .order_by(ClientTicket.created_at.desc())
    ).all()
    return {"tickets": [
        {
            "id": t.id,
            "title": t.title,
            "description": t.description,
            "status": t.status,
            "author_id": t.author_id,
            "created_at": t.created_at.isoformat()
        } for t in tickets
    ]}

@app.post("/clients/{client_id}/tickets")
def create_client_ticket(client_id: int, body: ClientTicketCreateRequest, session: Session = Depends(get_session)):
    ticket = ClientTicket(
        client_id=client_id,
        title=body.title,
        description=body.description,
        status=body.status,
        author_id=body.author_id
    )
    session.add(ticket)
    session.commit()
    session.refresh(ticket)
    return {"ticket": {
        "id": ticket.id,
        "title": ticket.title,
        "description": ticket.description,
        "status": ticket.status,
        "author_id": ticket.author_id,
        "created_at": ticket.created_at.isoformat()
    }}

@app.put("/clients/{client_id}/tickets/{ticket_id}")
def update_client_ticket(client_id: int, ticket_id: int, body: ClientTicketUpdateRequest, session: Session = Depends(get_session)):
    ticket = session.get(ClientTicket, ticket_id)
    if not ticket or ticket.client_id != client_id:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    if body.title is not None:
        ticket.title = body.title
    if body.description is not None:
        ticket.description = body.description
    if body.status is not None:
        ticket.status = body.status
        
    session.add(ticket)
    session.commit()
    return {"ok": True}

# ─────────────────────────────────────────────────────────────────────────────
# Admin – Client X-Ray
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/admin/client-xray/{client_id}")
def admin_client_xray(client_id: int, session: Session = Depends(get_session)):
    cp = session.get(ClientProfile, client_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Client not found")
    remarks = session.exec(select(Remark).where(Remark.clientId == client_id)).all()
    activities = session.exec(
        select(ActivityLog).where(ActivityLog.clientId == client_id)
    ).all()
    service_reqs = session.exec(
        select(ServiceRequest).where(ServiceRequest.client_id == client_id)
    ).all()
    return {
        "client": _client_dict(cp, session),
        "remarks": [
            {"id": r.id, "content": r.content, "createdAt": r.createdAt.isoformat()}
            for r in remarks
        ],
        "activities": [
            {"id": a.id, "action": a.action, "createdAt": a.createdAt.isoformat()}
            for a in activities
        ],
        "service_requests": [
            {"id": sr.id, "status": sr.status, "service_id": sr.service_id}
            for sr in service_reqs
        ],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Projects
# ─────────────────────────────────────────────────────────────────────────────












@app.post("/projects/{project_id}/remarks")
def add_project_remark(
    project_id: int, body: RemarkCreateRequest, session: Session = Depends(get_session)
):
    r = Remark(
        content=body.content,
        authorId=body.authorId,
        projectId=project_id,
        isInternal=body.isInternal,
    )
    session.add(r)
    session.commit()
    session.refresh(r)
    return {"id": r.id, "content": r.content, "createdAt": r.createdAt.isoformat()}




# ─────────────────────────────────────────────────────────────────────────────
# Services (Catalog + Requests)
# ─────────────────────────────────────────────────────────────────────────────




@app.post("/services/request")
def request_service(body: ServiceRequestCreate, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == body.client_email)).first()
    if not user:
        raise HTTPException(status_code=404, detail="Client user not found")
    cp = session.exec(select(ClientProfile).where(ClientProfile.userId == user.id)).first()
    if not cp:
        raise HTTPException(status_code=404, detail="Client profile not found")

    sr = ServiceRequest(service_id=body.service_id, client_id=cp.id)
    session.add(sr)
    session.commit()
    session.refresh(sr)

    # Create a message thread for this request
    thread = MessageThread(
        service_request_id=sr.id,
        client_id=cp.id,
    )
    session.add(thread)
    session.commit()

    return {"request": {"id": sr.id, "status": sr.status}}


@app.get("/services/my-requests")
def my_requests(client_email: str = Query(...), session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == client_email)).first()
    if not user:
        return {"requests": []}
    cp = session.exec(select(ClientProfile).where(ClientProfile.userId == user.id)).first()
    if not cp:
        return {"requests": []}
    reqs = session.exec(select(ServiceRequest).where(ServiceRequest.client_id == cp.id)).all()
    return {
        "requests": [
            {
                "id": r.id,
                "status": r.status,
                "service_id": r.service_id,
                "service_name": r.service.name if r.service else None,
                "quoted_amount": r.quoted_amount,
                "quote_message": r.quote_message,
                "quote_doc_url": r.quote_doc_url,
                "team_info": r.team_info,
                "requested_at": r.requested_at.isoformat(),
            }
            for r in reqs
        ]
    }




@app.post("/services/quote")
def send_quote(body: QuoteRequest, session: Session = Depends(get_session)):
    sr = session.get(ServiceRequest, body.requestId)
    if not sr:
        raise HTTPException(status_code=404, detail="Request not found")
    sr.quoted_amount = body.quoted_amount
    sr.quote_message = body.quote_message
    sr.team_info = body.team_info
    sr.quote_doc_url = body.quote_doc_url
    sr.status = "Quoted"
    sr.quote_sent_at = datetime.utcnow()
    if body.assigned_employee_id:
        sr.assigned_employee_id = body.assigned_employee_id
    session.add(sr)
    session.commit()
    return {"ok": True}


@app.post("/services/accept-quote/{request_id}")
def accept_quote(request_id: int, session: Session = Depends(get_session)):
    sr = session.get(ServiceRequest, request_id)
    if not sr:
        raise HTTPException(status_code=404, detail="Request not found")
    sr.status = "Accepted"
    sr.client_accepted_quote = True
    sr.accepted_at = datetime.utcnow()
    session.add(sr)
    session.commit()
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────────
# Admin – Services Overview
# ─────────────────────────────────────────────────────────────────────────────


# ─────────────────────────────────────────────────────────────────────────────
# Messages
# ─────────────────────────────────────────────────────────────────────────────


@app.post("/messages/send")
def send_message(body: SendMessageRequest, session: Session = Depends(get_session)):
    thread = session.get(MessageThread, body.thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    msg = ChatMessage(
        thread_id=body.thread_id,
        sender_id=body.sender_id,
        content=body.content,
    )
    session.add(msg)
    session.commit()
    session.refresh(msg)
    return {
        "id": msg.id,
        "sender": _get_sender_name(msg.sender_id, session),
        "content": msg.content,
        "timestamp": msg.timestamp.isoformat(),
    }


def _get_sender_name(sender_id: int, session: Session) -> str:
    u = session.get(User, sender_id)
    return u.name or u.email if u else "Unknown"


def _get_sender_name_from_map(sender_id: int, users_map: dict) -> str:
    u = users_map.get(sender_id)
    return (u.name or u.email) if u else "Unknown"


# ─────────────────────────────────────────────────────────────────────────────
# Calls
# ─────────────────────────────────────────────────────────────────────────────










# ─────────────────────────────────────────────────────────────────────────────
# Scheduled Calls
# ─────────────────────────────────────────────────────────────────────────────

class ScheduledCallCreateRequest(BaseModel):
    title: str
    scheduled_at: Optional[str] = None
    entity_type: str = "client"
    entity_id: Optional[int] = None
    entity_name: Optional[str] = None
    entity_email: Optional[str] = None
    pitch: Optional[str] = None
    notes: Optional[str] = None
    assigned_to: Optional[str] = None







# ─────────────────────────────────────────────────────────────────────────────
# Documents / OCR
# ─────────────────────────────────────────────────────────────────────────────
from fastapi import UploadFile, File
from modules.llm_engine import analyze_document

@app.post("/documents/ocr")
async def ocr_document(file: UploadFile = File(...)):
    try:
        image_bytes = await file.read()
        result = analyze_document(image_bytes)
        if "error" in result:
            return {"error": result["error"]}
        return result
    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────────────────────────────────────────────────────────
# Activities (global)
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/activities")
def list_activities(user_id: Optional[int] = None, session: Session = Depends(get_session)):
    q = select(ActivityLog).order_by(ActivityLog.createdAt.desc())
    if user_id:
        q = q.where(ActivityLog.userId == user_id)
    logs = session.exec(q.limit(100)).all()
    return {
        "activities": [
            {
                "id": a.id,
                "action": a.action,
                "method": a.method,
                "content": a.content,
                "details": a.details,
                "clientId": a.clientId,
                "lead_id": a.lead_id,
                "createdAt": a.createdAt.isoformat(),
            }
            for a in logs
        ]
    }


# ─────────────────────────────────────────────────────────────────────────────
# Email Agent
# ─────────────────────────────────────────────────────────────────────────────

# Background task to update SentEmail with LLM-generated draft
def generate_llm_draft_task(sent_email_id, body_dict):
    import time
    import json
    from modules.llm_engine import analyze_content, generate_email as llm_generate_email
    from modules.scraper import scrape_website
    from database import Session, SentEmail, engine
    session = Session(engine)
    try:
        # Scrape and analyze
        text = scrape_website(body_dict.get("company_url", "")) if body_dict.get("company_url") else ""
        analysis = analyze_content(text) if text else {}
        llm_result = llm_generate_email(analysis, None)
        # Update SentEmail record
        sent_email = session.get(SentEmail, sent_email_id)
        if sent_email:
            sent_email.subject = llm_result.get("subject", sent_email.subject)
            sent_email.english_body = llm_result.get("english_body", sent_email.english_body)
            sent_email.spanish_body = llm_result.get("spanish_body", sent_email.spanish_body)
            sent_email.draft_json = json.dumps(llm_result)
            session.add(sent_email)
            session.commit()
    except Exception as e:
        print(f"LLM draft background task failed: {e}")
    finally:
        session.close()


# ─────────────────────────────────────────────────────────────────────────────
# Dashboard Stats
# ─────────────────────────────────────────────────────────────────────────────


# ─────────────────────────────────────────────────────────────────────────────
# Client Timeline (unified)
# ─────────────────────────────────────────────────────────────────────────────


# ─────────────────────────────────────────────────────────────────────────────
# Global Search
# ─────────────────────────────────────────────────────────────────────────────


# ─────────────────────────────────────────────────────────────────────────────
# Monitor Stats (real data)
# ─────────────────────────────────────────────────────────────────────────────


# ─────────────────────────────────────────────────────────────────────────────
# Setup / Audit
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/setup/verify-domain")
def verify_domain(body: SetupDomainRequest):
    domain = re.sub(r"https?://", "", body.domain).strip("/")
    return {"domain": domain, "verified": True, "message": "Domain looks good"}


@app.post("/audit/trigger")
def trigger_audit(body: dict = {}, session: Session = Depends(get_session)):
    """Real SEO audit: fetches the domain, analyzes HTML for common SEO issues."""
    import httpx
    from bs4 import BeautifulSoup
    import time

    domain = body.get("domain") or body.get("email", "")
    # Try to resolve a client domain from email
    if "@" in domain:
        user = session.exec(select(User).where(User.email == domain)).first()
        if user:
            cp = session.exec(select(ClientProfile).where(ClientProfile.userId == user.id)).first()
            if cp and cp.websiteUrl:
                domain = cp.websiteUrl
    if not domain:
        return {"success": False, "message": "No domain to audit"}

    url = domain if domain.startswith("http") else f"https://{domain}"
    url = url.rstrip("/")

    issues = {}
    health = 100
    page_speed = 0
    issues_count = 0

    try:
        start = time.time()
        r = httpx.get(url, follow_redirects=True, timeout=15, headers={"User-Agent": "SerpHawk-Audit/1.0"})
        load_time = round(time.time() - start, 2)
        page_speed = max(10, min(100, int(100 - load_time * 15)))
        html = r.text
        soup = BeautifulSoup(html, "html.parser")

        # Title
        title_tag = soup.find("title")
        title_text = title_tag.get_text(strip=True) if title_tag else ""
        if not title_text:
            issues["title_tag"] = "Missing — add a unique <title> tag"
            health -= 15
            issues_count += 1
        elif len(title_text) > 70:
            issues["title_tag"] = f"Too long ({len(title_text)} chars) — keep under 60-70"
            health -= 5
            issues_count += 1
        else:
            issues["title_tag"] = f"Pass — '{title_text[:50]}..." if len(title_text) > 50 else f"Pass — '{title_text}'"

        # Meta description
        meta_desc = soup.find("meta", attrs={"name": "description"})
        desc_content = meta_desc["content"] if meta_desc and meta_desc.get("content") else ""
        if not desc_content:
            issues["meta_description"] = "Missing — add a 150-160 char meta description"
            health -= 10
            issues_count += 1
        elif len(desc_content) > 160:
            issues["meta_description"] = f"Too long ({len(desc_content)} chars)"
            health -= 3
            issues_count += 1
        else:
            issues["meta_description"] = "Pass"

        # H1
        h1s = soup.find_all("h1")
        if len(h1s) == 0:
            issues["h1_tag"] = "Missing — every page needs one H1"
            health -= 10
            issues_count += 1
        elif len(h1s) > 1:
            issues["h1_tag"] = f"Multiple H1s found ({len(h1s)}) — use only one"
            health -= 5
            issues_count += 1
        else:
            issues["h1_tag"] = f"Pass — '{h1s[0].get_text(strip=True)[:50]}'"

        # Images without alt
        imgs = soup.find_all("img")
        no_alt = [i for i in imgs if not i.get("alt")]
        if no_alt:
            issues["image_alt_tags"] = f"{len(no_alt)} of {len(imgs)} images missing alt text"
            health -= min(10, len(no_alt) * 2)
            issues_count += len(no_alt)
        else:
            issues["image_alt_tags"] = f"Pass — all {len(imgs)} images have alt text" if imgs else "No images found"

        # HTTPS
        if not url.startswith("https"):
            issues["https"] = "Not using HTTPS — critical security issue"
            health -= 15
            issues_count += 1
        else:
            issues["https"] = "Pass — HTTPS enabled"

        # Canonical
        canonical = soup.find("link", attrs={"rel": "canonical"})
        if not canonical:
            issues["canonical_tag"] = "Missing — add a canonical URL"
            health -= 5
            issues_count += 1
        else:
            issues["canonical_tag"] = "Pass"

        # Viewport
        viewport = soup.find("meta", attrs={"name": "viewport"})
        if not viewport:
            issues["mobile_viewport"] = "Missing — not mobile-friendly"
            health -= 10
            issues_count += 1
        else:
            issues["mobile_viewport"] = "Pass — viewport meta present"

        # Open Graph
        og = soup.find("meta", attrs={"property": "og:title"})
        if not og:
            issues["open_graph"] = "Missing OG tags — poor social sharing"
            health -= 3
            issues_count += 1
        else:
            issues["open_graph"] = "Pass"

        # Internal links count
        links = soup.find_all("a", href=True)
        internal = [l for l in links if l["href"].startswith("/") or domain.replace("https://", "").replace("http://", "") in l["href"]]
        issues["internal_links"] = f"{len(internal)} internal links found" if internal else "No internal links — poor for SEO"
        if not internal:
            health -= 5
            issues_count += 1

        health = max(0, min(100, health))

    except Exception as e:
        return {"success": True, "audit": {
            "health_score": 0, "page_speed_desktop": 0, "issues_count": 1,
            "tech_seo_issues": {"connection": f"Could not reach {url}: {str(e)}"},
            "domain": url, "load_time": 0,
        }}

    return {
        "success": True,
        "audit": {
            "health_score": health,
            "page_speed_desktop": page_speed,
            "issues_count": issues_count,
            "tech_seo_issues": issues,
            "domain": url,
            "load_time": load_time,
        },
    }


@app.get("/audit/export")
def export_audit_pdf(email: str = Query(""), domain: str = Query(""), session: Session = Depends(get_session)):
    """Generate PDF audit report."""
    from fastapi.responses import StreamingResponse
    import io
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    # Run a quick audit to get fresh data
    audit_result = trigger_audit({"domain": domain or email}, session)
    audit = audit_result.get("audit", {})

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=50, bottomMargin=40)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("AuditTitle", parent=styles["Title"], fontSize=22, textColor=colors.HexColor("#1e293b"))
    heading = ParagraphStyle("AuditH2", parent=styles["Heading2"], fontSize=14, textColor=colors.HexColor("#334155"), spaceBefore=20)
    normal = styles["Normal"]

    elements = []
    elements.append(Paragraph("SERP Hawk — SEO Audit Report", title_style))
    elements.append(Spacer(1, 8))
    elements.append(Paragraph(f"Domain: {audit.get('domain', domain or 'N/A')}", normal))
    elements.append(Paragraph(f"Generated: {datetime.utcnow().strftime('%B %d, %Y')}", normal))
    elements.append(Spacer(1, 20))

    # Summary table
    summary_data = [
        ["Health Score", f"{audit.get('health_score', 0)}/100"],
        ["Page Speed", f"{audit.get('page_speed_desktop', 0)}/100"],
        ["Issues Found", str(audit.get('issues_count', 0))],
        ["Load Time", f"{audit.get('load_time', 0)}s"],
    ]
    t = Table(summary_data, colWidths=[200, 250])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f1f5f9")),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 11),
        ("PADDING", (0, 0), (-1, -1), 10),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 20))

    # Technical findings
    elements.append(Paragraph("Technical SEO Findings", heading))
    for key, val in audit.get("tech_seo_issues", {}).items():
        label = key.replace("_", " ").title()
        status = "PASS" if "Pass" in str(val) else "ISSUE"
        color = "#059669" if status == "PASS" else "#dc2626"
        elements.append(Paragraph(f'<font color="{color}"><b>[{status}]</b></font> {label}: {val}', normal))
        elements.append(Spacer(1, 4))

    elements.append(Spacer(1, 30))
    elements.append(Paragraph("— Generated by SERP Hawk | Team DaPros", ParagraphStyle("Footer", parent=normal, fontSize=9, textColor=colors.grey)))

    doc.build(elements)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="serphawk-audit-{(domain or "report").replace("https://","").replace("/","_")}.pdf"'
    })


# ─────────────────────────────────────────────────────────────────────────────
# Health
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "ok", "app": "SerpHawk CRM API", "docs": "/docs"}

@app.get("/health")
def health():
    return {"status": "ok"}


# ─────────────────────────────────────────────────────────────────────────────
# Tasks & Kanban Board
# ─────────────────────────────────────────────────────────────────────────────
def _task_dict(t: Task, session: Session) -> dict:
    assignee = session.get(User, t.assigned_to) if t.assigned_to else None
    creator = session.get(User, t.created_by) if t.created_by else None
    client = session.get(ClientProfile, t.client_id) if t.client_id else None
    client_user = session.get(User, client.userId) if client and client.userId else None
    return {
        "id": t.id,
        "title": t.title,
        "description": t.description,
        "status": t.status,
        "priority": t.priority,
        "due_date": t.due_date,
        "client_id": t.client_id,
        "lead_id": t.lead_id,
        "client_name": client_user.name if client_user else (client.companyName if client else None),
        "project_id": t.project_id,
        "assigned_to": t.assigned_to,
        "assignee_name": assignee.name if assignee else None,
        "created_by": t.created_by,
        "creator_name": creator.name if creator else None,
        "created_at": t.created_at.isoformat(),
        "updated_at": t.updated_at.isoformat(),
    }


@app.get("/tasks")
def list_tasks(
    status: Optional[str] = None,
    assigned_to: Optional[int] = None,
    client_id: Optional[int] = None,
    lead_id: Optional[int] = None,
    project_id: Optional[int] = None,
    session: Session = Depends(get_session),
):
    from sqlalchemy import cast, String as SAString
    q = select(Task).order_by(Task.created_at.desc())
    if status:
        # Cast the enum column to String for comparison to avoid
        # PostgreSQL "invalid input value for enum taskstatus" errors
        # when the stored enum casing differs from what the client passes.
        q = q.where(cast(Task.status, SAString).ilike(status))
    if assigned_to:
        q = q.where(Task.assigned_to == assigned_to)
    if client_id:
        q = q.where(Task.client_id == client_id)
    if lead_id:
        q = q.where(Task.lead_id == lead_id)
    if project_id:
        q = q.where(Task.project_id == project_id)
    tasks = session.exec(q).all()
    return {"tasks": [_task_dict(t, session) for t in tasks]}


@app.post("/tasks")
def create_task(body: TaskCreateRequest, session: Session = Depends(get_session)):
    data = body.model_dump()
    data["status"] = _normalize_task_status(data.get("status"))
    t = Task(**data)
    session.add(t)
    session.commit()
    session.refresh(t)
    # Notify assigned user
    if t.assigned_to:
        notif = Notification(
            user_id=t.assigned_to,
            title="New Task Assigned",
            message=f"You have been assigned: {t.title}",
            type="info",
            link="/tasks",
        )
        session.add(notif)
        session.commit()
        
    # ── WHATSAPP NOTIFICATION ──
    try:
        from modules.whatsapp import send_ai_polished_whatsapp_message
        base_url = "https://crm-seo.allytechcourses.com"
        send_ai_polished_whatsapp_message("New Task Created", _task_dict(t, session), f"{base_url}/tasks")
    except Exception as e:
        print("WhatsApp Error:", e)
        
    return {"task": _task_dict(t, session)}


@app.get("/tasks/{task_id}")
def get_task(task_id: int, session: Session = Depends(get_session)):
    t = session.get(Task, task_id)
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    comments = session.exec(
        select(TaskComment).where(TaskComment.task_id == task_id).order_by(TaskComment.created_at)
    ).all()
    result = _task_dict(t, session)
    result["comments"] = [
        {
            "id": c.id,
            "content": c.content,
            "author_id": c.author_id,
            "author_name": (lambda u: u.name if u else "Unknown")(session.get(User, c.author_id)),
            "created_at": c.created_at.isoformat(),
        }
        for c in comments
    ]
    return {"task": result}


@app.put("/tasks/{task_id}")
def update_task(task_id: int, body: TaskUpdateRequest, session: Session = Depends(get_session)):
    t = session.get(Task, task_id)
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    updates = body.model_dump(exclude_unset=True)
    if "status" in updates:
        updates["status"] = _normalize_task_status(updates["status"])
    for field, val in updates.items():
        setattr(t, field, val)
    t.updated_at = datetime.utcnow()
    session.add(t)
    session.commit()
    session.refresh(t)
    
    # ── WHATSAPP NOTIFICATION ──
    try:
        from modules.whatsapp import send_ai_polished_whatsapp_message
        base_url = "https://crm-seo.allytechcourses.com"
        send_ai_polished_whatsapp_message("Task Updated", _task_dict(t, session), f"{base_url}/tasks")
    except Exception as e:
        print("WhatsApp Error:", e)
        
    return {"task": _task_dict(t, session)}


@app.delete("/tasks/{task_id}")
def delete_task(task_id: int, session: Session = Depends(get_session)):
    t = session.get(Task, task_id)
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    session.delete(t)
    session.commit()
    return {"ok": True}


@app.delete("/notifications/clear-all/{user_id}")
def clear_all_notifications(user_id: int, session: Session = Depends(get_session)):
    notifs = session.exec(
        select(Notification).where(Notification.user_id == user_id)
    ).all()
    for n in notifs:
        session.delete(n)
    session.commit()
    return {"ok": True, "cleared": len(notifs)}


@app.delete("/notifications/{notification_id}")
def delete_notification(notification_id: int, session: Session = Depends(get_session)):
    n = session.get(Notification, notification_id)
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    session.delete(n)
    session.commit()
    return {"ok": True}


@app.post("/tasks/{task_id}/comments")
def add_task_comment(
    task_id: int, body: TaskCommentCreateRequest, session: Session = Depends(get_session)
):
    t = session.get(Task, task_id)
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    c = TaskComment(task_id=task_id, author_id=body.author_id, content=body.content)
    session.add(c)
    session.commit()
    session.refresh(c)
    author = session.get(User, c.author_id) if c.author_id else None
    return {
        "id": c.id,
        "content": c.content,
        "author_id": c.author_id,
        "author_name": author.name if author else "Unknown",
        "created_at": c.created_at.isoformat(),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Invoices & Payments
# ─────────────────────────────────────────────────────────────────────────────
















# ─────────────────────────────────────────────────────────────────────────────
# Notifications
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/notifications/{user_id}")
def get_notifications(
    user_id: int,
    unread_only: bool = False,
    session: Session = Depends(get_session),
):
    q = select(Notification).where(Notification.user_id == user_id).order_by(
        Notification.created_at.desc()
    )
    if unread_only:
        q = q.where(Notification.is_read == False)
    
    try:
        notifs = session.exec(q).all()
    except Exception as e:
        print(f"Warning: Failed to fetch notifications: {e}")
        notifs = []
        session.rollback()
    
    return {
        "notifications": [
            {
                "id": n.id,
                "title": n.title,
                "message": n.message,
                "type": n.type,
                "link": n.link,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in notifs
        ],
        "unread_count": sum(1 for n in notifs if not n.is_read),
    }


@app.post("/notifications")
def create_notification(body: NotificationCreateRequest, session: Session = Depends(get_session)):
    n = Notification(**body.model_dump())
    session.add(n)
    session.commit()
    session.refresh(n)
    return {"id": n.id, "title": n.title}


@app.put("/notifications/{notification_id}/read")
def mark_notification_read(notification_id: int, session: Session = Depends(get_session)):
    n = session.get(Notification, notification_id)
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.is_read = True
    session.add(n)
    session.commit()
    return {"ok": True}


@app.put("/notifications/mark-all-read/{user_id}")
def mark_all_read(user_id: int, session: Session = Depends(get_session)):
    notifs = session.exec(
        select(Notification).where(Notification.user_id == user_id, Notification.is_read == False)
    ).all()
    for n in notifs:
        n.is_read = True
        session.add(n)
    session.commit()
    return {"ok": True, "marked": len(notifs)}


# ─────────────────────────────────────────────────────────────────────────────
# Milestones
# ─────────────────────────────────────────────────────────────────────────────







class NoteRequest(BaseModel):
    user_name: str
    note: str













# ─────────────────────────────────────────────────────────────────────────────
# NPS Surveys
# ─────────────────────────────────────────────────────────────────────────────






# ────────────────────────────────────────────────────────


# ─────────────────────────────────────────────────────────────────────────────
# Proposals & Contracts
# ─────────────────────────────────────────────────────────────────────────────


















# ─────────────────────────────────────────────────────────────────────────────
# Client File Uploads
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/clients/{client_id}/files")
def list_client_files(client_id: int, session: Session = Depends(get_session)):
    files = session.exec(
        select(ClientFileUpload)
        .where(ClientFileUpload.client_id == client_id)
        .order_by(ClientFileUpload.created_at.desc())
    ).all()
    return {
        "files": [
            {
                "id": f.id,
                "filename": f.filename,
                "file_url": f.file_url,
                "file_size": f.file_size,
                "mime_type": f.mime_type,
                "description": f.description,
                "uploaded_by": f.uploaded_by,
                "created_at": f.created_at.isoformat(),
            }
            for f in files
        ]
    }


import uuid as _uuid

@app.post("/upload-file")
async def upload_file_to_server(
    file: UploadFile = File(...),
    client_id: int = Form(...),
    uploaded_by: Optional[int] = Form(None),
    description: Optional[str] = Form(None),
    session: Session = Depends(get_session),
):
    """Upload a real file from device, save to static/uploads/, create DB record."""
    cp = session.get(ClientProfile, client_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Client not found")

    # Sanitize filename and make unique
    safe_name = re.sub(r'[^\w.\-]', '_', file.filename or "file")
    unique_name = f"{_uuid.uuid4().hex[:8]}_{safe_name}"
    upload_dir = os.path.join("static", "uploads")
    file_path = os.path.join(upload_dir, unique_name)

    # Stream chunks to disk in a worker thread (never block the event loop,
    # never buffer the whole file in RAM), enforcing a 10 MB cap mid-stream.
    import asyncio, shutil
    _MAX_UPLOAD_BYTES = 10 * 1024 * 1024

    def _write():
        file.file.seek(0)
        total = 0
        with open(file_path, "wb") as fh:
            while True:
                chunk = file.file.read(1024 * 256)
                if not chunk:
                    break
                total += len(chunk)
                if total > _MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail="Image must be under 10 MB")
                fh.write(chunk)
        return total

    file_size = await asyncio.to_thread(_write)

    file_url = f"/static/uploads/{unique_name}"

    record = ClientFileUpload(
        client_id=client_id,
        uploaded_by=uploaded_by,
        filename=file.filename or safe_name,
        file_url=file_url,
        file_size=file_size,
        mime_type=file.content_type,
        description=description,
    )
    session.add(record)
    session.commit()
    session.refresh(record)

    return {
        "id": record.id,
        "filename": record.filename,
        "file_url": file_url,
        "file_size": file_size,
        "mime_type": record.mime_type,
        "created_at": record.created_at.isoformat(),
    }


@app.post("/upload-image")
async def upload_image(file: UploadFile = File(...)):
    """Upload an image (e.g. inventory photo) to static/uploads/ and return its public URL."""
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")

    safe_name = re.sub(r'[^\w.\-]', '_', file.filename or "image")
    unique_name = f"{_uuid.uuid4().hex[:8]}_{safe_name}"
    upload_dir = os.path.join("static", "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, unique_name)

    # Stream chunks to disk in a worker thread (never block the event loop),
    # enforcing a 10 MB cap mid-stream.
    import asyncio
    _MAX_UPLOAD_BYTES = 10 * 1024 * 1024

    def _write_sync():
        file.file.seek(0)
        total = 0
        with open(file_path, "wb") as fh:
            while True:
                chunk = file.file.read(1024 * 256)
                if not chunk:
                    break
                total += len(chunk)
                if total > _MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail="Image must be under 10 MB")
                fh.write(chunk)
        return total

    await asyncio.to_thread(_write_sync)

    return {"file_url": f"/static/uploads/{unique_name}"}
def upload_client_file(
    client_id: int, body: FileUploadRequest, session: Session = Depends(get_session)
):
    cp = session.get(ClientProfile, client_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Client not found")
    f = ClientFileUpload(
        client_id=client_id,
        uploaded_by=body.uploaded_by,
        filename=body.filename,
        file_url=body.file_url,
        file_size=body.file_size,
        mime_type=body.mime_type,
        description=body.description,
    )
    session.add(f)
    session.commit()
    session.refresh(f)
    return {
        "id": f.id,
        "filename": f.filename,
        "file_url": f.file_url,
        "created_at": f.created_at.isoformat(),
    }


@app.delete("/files/{file_id}")
def delete_file(file_id: int, session: Session = Depends(get_session)):
    f = session.get(ClientFileUpload, file_id)
    if not f:
        raise HTTPException(status_code=404, detail="File not found")
    session.delete(f)
    session.commit()
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────────
# Keyword Rank Tracker
# ─────────────────────────────────────────────────────────────────────────────








# ─────────────────────────────────────────────────────────────────────────────
# PDF Generation — Invoices & Proposals
# ─────────────────────────────────────────────────────────────────────────────




# ─────────────────────────────────────────────────────────────────────────────
# WebSocket Real-Time Chat
# ─────────────────────────────────────────────────────────────────────────────
import json as _json

class ConnectionManager:
    """Keeps track of active WebSocket connections per thread."""
    def __init__(self):
        self.active: Dict[int, List[WebSocket]] = {}  # thread_id -> list of ws

    async def connect(self, thread_id: int, ws: WebSocket):
        await ws.accept()
        self.active.setdefault(thread_id, []).append(ws)

    def disconnect(self, thread_id: int, ws: WebSocket):
        conns = self.active.get(thread_id, [])
        if ws in conns:
            conns.remove(ws)

    async def broadcast(self, thread_id: int, data: dict, exclude: WebSocket | None = None):
        for ws in self.active.get(thread_id, []):
            if ws is not exclude:
                try:
                    await ws.send_json(data)
                except Exception:
                    pass

ws_manager = ConnectionManager()

@app.websocket("/ws/chat/{thread_id}")
async def ws_chat(websocket: WebSocket, thread_id: int):
    await ws_manager.connect(thread_id, websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            data = _json.loads(raw)
            action = data.get("action")

            if action == "message":
                # Save message to DB
                with Session(engine) as session:
                    msg = ChatMessage(
                        thread_id=thread_id,
                        sender_id=data["sender_id"],
                        content=data["content"],
                    )
                    session.add(msg)
                    session.commit()
                    session.refresh(msg)
                    sender = session.get(User, msg.sender_id)
                    payload = {
                        "type": "new_message",
                        "message": {
                            "id": msg.id,
                            "sender": (sender.name or sender.email) if sender else "Unknown",
                            "sender_id": msg.sender_id,
                            "content": msg.content,
                            "timestamp": msg.timestamp.isoformat(),
                            "is_read": False,
                        },
                    }
                await ws_manager.broadcast(thread_id, payload)

            elif action == "typing":
                await ws_manager.broadcast(
                    thread_id,
                    {"type": "typing", "user_id": data.get("user_id"), "user_name": data.get("user_name")},
                    exclude=websocket,
                )

            elif action == "stop_typing":
                await ws_manager.broadcast(
                    thread_id,
                    {"type": "stop_typing", "user_id": data.get("user_id")},
                    exclude=websocket,
                )

            elif action == "read_receipt":
                msg_ids = data.get("message_ids", [])
                if msg_ids:
                    with Session(engine) as session:
                        for mid in msg_ids:
                            m = session.get(ChatMessage, mid)
                            if m and not m.is_read and m.sender_id != data.get("user_id"):
                                m.is_read = True
                                m.read_at = datetime.utcnow()
                                session.add(m)
                        session.commit()
                    await ws_manager.broadcast(
                        thread_id,
                        {"type": "read_receipt", "message_ids": msg_ids, "read_by": data.get("user_id")},
                        exclude=websocket,
                    )

    except WebSocketDisconnect:
        ws_manager.disconnect(thread_id, websocket)
    except Exception:
        ws_manager.disconnect(thread_id, websocket)


# ─────────────────────────────────────────────────────────────────────────────
# Password Change
# ─────────────────────────────────────────────────────────────────────────────
class PasswordChangeRequest(BaseModel):
    user_id: int
    current_password: str
    new_password: str

@app.post("/change-password")
def change_password(body: PasswordChangeRequest, session: Session = Depends(get_session)):
    user = session.get(User, body.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not _verify_password(body.current_password, user):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    user.password = _hash_password(body.new_password)
    user.updatedAt = datetime.utcnow()
    session.add(user)
    session.commit()
    return {"ok": True, "message": "Password updated successfully"}


# ─────────────────────────────────────────────────────────────────────────────
# Webhooks / Zapier Integration
# ─────────────────────────────────────────────────────────────────────────────
import secrets as _secrets

# In-memory webhook store (in production, use a DB table)
_webhooks: Dict[str, dict] = {}  # id -> {url, events, secret, created_at, name}

class WebhookRegisterRequest(BaseModel):
    url: str
    events: List[str]   # e.g. ["client.created", "invoice.paid", "message.sent"]
    name: Optional[str] = None

@app.post("/webhooks")
def register_webhook(body: WebhookRegisterRequest):
    valid_events = [
        "client.created", "client.updated", "client.deleted",
        "invoice.created", "invoice.paid", "invoice.overdue",
        "message.sent", "task.created", "task.completed",
        "proposal.sent", "proposal.accepted", "proposal.rejected",
        "service.requested", "service.quoted", "service.accepted",
    ]
    for ev in body.events:
        if ev not in valid_events:
            raise HTTPException(status_code=400, detail=f"Invalid event: {ev}. Valid events: {valid_events}")
    wh_id = _secrets.token_urlsafe(16)
    wh_secret = _secrets.token_urlsafe(32)
    _webhooks[wh_id] = {
        "id": wh_id,
        "url": str(body.url),
        "events": body.events,
        "secret": wh_secret,
        "name": body.name or "Unnamed Webhook",
        "created_at": datetime.utcnow().isoformat(),
    }
    return {"webhook_id": wh_id, "secret": wh_secret, "events": body.events}

@app.get("/webhooks")
def list_webhooks():
    return {"webhooks": [
        {k: v for k, v in wh.items() if k != "secret"}
        for wh in _webhooks.values()
    ]}

@app.delete("/webhooks/{webhook_id}")
def delete_webhook(webhook_id: str):
    if webhook_id not in _webhooks:
        raise HTTPException(status_code=404, detail="Webhook not found")
    del _webhooks[webhook_id]
    return {"ok": True}

import httpx as _httpx
import hmac as _hmac
import hashlib as _hashlib_hmac

async def _fire_webhooks(event: str, payload: dict):
    """Fire all registered webhooks for an event. Non-blocking, best-effort."""
    body_str = _json.dumps(payload)
    for wh in _webhooks.values():
        if event in wh["events"]:
            sig = _hmac.new(wh["secret"].encode(), body_str.encode(), _hashlib_hmac.sha256).hexdigest()
            try:
                async with _httpx.AsyncClient(timeout=10) as client:
                    await client.post(
                        wh["url"],
                        content=body_str,
                        headers={
                            "Content-Type": "application/json",
                            "X-Webhook-Event": event,
                            "X-Webhook-Signature": f"sha256={sig}",
                        },
                    )
            except Exception as e:
                print(f"[Webhook fire failed] {event} -> {wh['url']}: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Competitor Analysis (Real Data)
# ─────────────────────────────────────────────────────────────────────────────
class CompetitorAddRequest(BaseModel):
    client_id: int
    competitor_domain: str

@app.post("/competitors/analyze")
async def analyze_competitor(body: CompetitorAddRequest, background_tasks: BackgroundTasks, session: Session = Depends(get_session)):
    client = session.get(ClientProfile, body.client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # Get client keywords for gap analysis
    client_keywords = client.targetKeywords or []
    client_website = client.websiteUrl or ""

    # Scrape competitor site
    from modules.scraper import scrape_website
    competitor_content = await scrape_website(body.competitor_domain)
    if competitor_content.startswith("ERROR"):
        competitor_content = f"Could not scrape {body.competitor_domain}"

    # Scrape client site for comparison
    client_content = ""
    if client_website:
        client_content = await scrape_website(client_website)
        if client_content.startswith("ERROR"):
            client_content = ""

    # Use LLM to analyze competitor vs client
    from modules.llm_engine import get_openai_client
    prompt = f"""Analyze the competitive landscape between a client and their competitor.

CLIENT INFO:
- Website: {client_website}
- Target Keywords: {', '.join(client_keywords) if client_keywords else 'Not specified'}
- Site Content Summary: {client_content[:3000] if client_content else 'Not available'}

COMPETITOR INFO:
- Domain: {body.competitor_domain}
- Site Content Summary: {competitor_content[:3000]}

Return a JSON object with these exact keys:
{{
  "keyword_gap": {{
    "competitor_keywords": ["list of keywords competitor targets that client doesn't"],
    "shared_keywords": ["keywords both target"],
    "client_unique": ["keywords only client targets"],
    "opportunity_score": 1-100
  }},
  "content_analysis": {{
    "competitor_strengths": ["3-5 content strengths"],
    "competitor_weaknesses": ["2-3 content gaps"],
    "content_gap_opportunities": ["3-5 specific content ideas client should create"]
  }},
  "backlink_estimate": {{
    "competitor_authority": "Low/Medium/High",
    "estimated_referring_domains": "rough range like 50-200",
    "link_building_opportunities": ["3-5 ideas"]
  }},
  "overall_threat_level": "Low/Medium/High",
  "action_items": ["5 specific actionable recommendations"]
}}
Return ONLY valid JSON, no markdown."""

    try:
        oai = get_openai_client()
        resp = oai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
        )
        analysis_raw = resp.choices[0].message.content or ""
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Analysis Failed: {str(e)}")

    # Parse LLM response
    try:
        import json as json_mod
        cleaned = analysis_raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0]
        analysis = json_mod.loads(cleaned)
    except Exception:
        analysis = {
            "keyword_gap": {"competitor_keywords": [], "shared_keywords": [], "client_unique": client_keywords, "opportunity_score": 50},
            "content_analysis": {"competitor_strengths": ["Could not analyze"], "competitor_weaknesses": [], "content_gap_opportunities": []},
            "backlink_estimate": {"competitor_authority": "Unknown", "estimated_referring_domains": "Unknown", "link_building_opportunities": []},
            "overall_threat_level": "Unknown",
            "action_items": ["Manual analysis recommended"],
        }

    # Save to database
    existing = session.exec(
        select(CompetitorAnalysis)
        .where(CompetitorAnalysis.clientId == body.client_id)
        .where(CompetitorAnalysis.competitor_domain == body.competitor_domain)
    ).first()

    if existing:
        existing.keyword_gap_data = analysis.get("keyword_gap", {})
        existing.backlink_comparison = analysis.get("backlink_estimate", {})
        existing.content_benchmarks = analysis.get("content_analysis", {})
        existing.last_updated = datetime.utcnow()
        session.add(existing)
    else:
        ca = CompetitorAnalysis(
            clientId=body.client_id,
            competitor_domain=body.competitor_domain,
            keyword_gap_data=analysis.get("keyword_gap", {}),
            backlink_comparison=analysis.get("backlink_estimate", {}),
            content_benchmarks=analysis.get("content_analysis", {}),
            tenant_id=current_tenant_id.get(),
        )
        session.add(ca)

    session.commit()

    return {
        "competitor_domain": body.competitor_domain,
        "analysis": analysis,
    }

@app.get("/competitors/{client_id}")
def get_competitors(client_id: int, session: Session = Depends(get_session)):
    analyses = session.exec(
        select(CompetitorAnalysis).where(CompetitorAnalysis.clientId == client_id)
    ).all()
    return {"competitors": [
        {
            "id": a.id,
            "competitor_domain": a.competitor_domain,
            "keyword_gap": a.keyword_gap_data or {},
            "backlink_comparison": a.backlink_comparison or {},
            "content_benchmarks": a.content_benchmarks or {},
            "overall_threat_level": (a.keyword_gap_data or {}).get("opportunity_score", "N/A"),
            "last_updated": a.last_updated.isoformat() if a.last_updated else None,
        }
        for a in analyses
    ]}

@app.delete("/competitors/{analysis_id}")
def delete_competitor(analysis_id: int, session: Session = Depends(get_session)):
    ca = session.get(CompetitorAnalysis, analysis_id)
    if not ca:
        raise HTTPException(status_code=404, detail="Analysis not found")
    session.delete(ca)
    session.commit()
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────────
# Deals (Visual Sales Pipeline)
# ─────────────────────────────────────────────────────────────────────────────







# ────────────────────────────────────────────────────────
# Client Portal Domain Configuration
# ────────────────────────────────────────────────────────
_portal_config: Dict[str, Any] = {
    "portal_subdomain": "portal",
    "portal_domain": "",
    "branding": {
        "company_name": "SERP Hawk",
        "logo_url": "",
        "primary_color": "#d97706",
        "accent_color": "#7c3aed",
        "favicon_url": "",
    },
    "features": {
        "show_pricing": True,
        "show_store": True,
        "show_rankings": True,
        "show_milestones": True,
        "show_proposals": True,
        "allow_file_upload": True,
    },
}

@app.get("/portal/config")
def get_portal_config():
    return _portal_config

@app.put("/portal/config")
def update_portal_config(body: Dict[str, Any]):
    for key, val in body.items():
        if key in _portal_config:
            if isinstance(_portal_config[key], dict) and isinstance(val, dict):
                _portal_config[key].update(val)
            else:
                _portal_config[key] = val
# ─── Sidebar Preferences Endpoint ──────────────────────────────────────────────
class SidebarPrefsRequest(BaseModel):
    sidebar_preferences: dict

@app.get("/users/me/sidebar-preferences")
async def get_sidebar_preferences(user_id: Optional[int] = Query(None), session: Session = Depends(get_session)):
    uid = user_id or current_salesperson_id.get()
    if not uid:
        return {"ok": False, "sidebar_preferences": {}}
    from database import User
    user = session.get(User, uid)
    if user and user.sidebar_preferences:
        return {"ok": True, "sidebar_preferences": user.sidebar_preferences}
    return {"ok": True, "sidebar_preferences": {}}

@app.post("/users/me/sidebar-preferences")
async def update_sidebar_preferences(req: SidebarPrefsRequest, user_id: Optional[int] = Query(None), session: Session = Depends(get_session)):
    uid = user_id or current_salesperson_id.get()
    if not uid:
        raise HTTPException(status_code=401, detail="Unauthorized")
    from database import User
    user = session.get(User, uid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.sidebar_preferences = req.sidebar_preferences
    session.add(user)
    session.commit()
    return {"ok": True, "message": "Sidebar preferences updated."}

# ─── Auto-fill Client Endpoint ───────────────────────────────────────────────
class AutoFillRequest(BaseModel):
    website: str

@app.post("/clients/auto-fill")
async def auto_fill_client(request: AutoFillRequest):
    from modules.scraper import scrape_website
    from modules.llm_engine import extract_client_profile_from_website
    
    try:
        raw_text = await scrape_website(request.website)
        if not raw_text:
            return {"ok": False, "error": "Could not extract content from the website."}
            
        profile_data = extract_client_profile_from_website(raw_text, request.website)
        return {"ok": True, "data": profile_data}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ─── Chatbot endpoint ────────────────────────────────────────────────────────

class LiveChatSendRequest(BaseModel):
    message: str





# ─────────────────────────────────────────────────────────────────────────────
# Marketplace Catalog
# ─────────────────────────────────────────────────────────────────────────────

class MarketplaceServiceCreate(BaseModel):
    service_name: str
    category: Optional[str] = None
    description: Optional[str] = None
    estimated_cost: float = 0.0
    provider_client_id: Optional[int] = None
    provider_name: Optional[str] = None

class MarketplaceServiceUpdate(BaseModel):
    service_name: Optional[str] = None
    normalized_name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    estimated_cost: Optional[float] = None
    cost_is_estimated: Optional[bool] = None
    provider_name: Optional[str] = None
    is_active: Optional[bool] = None















# ─────────────────────────────────────────────────────────────────────────────
# RADAR ANALYSIS ENGINE — Google Maps Competitor Intelligence
# ─────────────────────────────────────────────────────────────────────────────
from modules.radar_engine import (
    find_place, find_nearby_competitors, calculate_market_density,
    sort_nearest, sort_largest_market, sort_largest_team, sort_most_similar,
    score_market_size, estimate_team_size
)
from database import RadarAnalysis, CompetitorRelationship

class RadarSearchRequest(BaseModel):
    query: str
    location_hint: Optional[str] = None
    place_id: Optional[str] = None
    company_name: Optional[str] = None
    website: Optional[str] = None

class RadarAnalyzeRequest(BaseModel):
    place_id: str
    target_name: str
    target_lat: float
    target_lng: float
    target_address: Optional[str] = None
    target_phone: Optional[str] = None
    target_website: Optional[str] = None
    target_rating: Optional[float] = None
    target_reviews: Optional[int] = None
    target_category: str = "digital marketing agency"
    target_types: Optional[list] = []
    radius_km: int = 5
    client_id: Optional[int] = None
    lead_id: Optional[int] = None

class RadarAddClientRequest(BaseModel):
    competitor: dict
    source_client_id: Optional[int] = None
    source_lead_id: Optional[int] = None
    source_client_name: str
    radar_id: Optional[int] = None


@app.post("/radar/analyze")
async def radar_analyze(body: RadarAnalyzeRequest, session: Session = Depends(get_session)):
    """Run full competitor discovery around target business."""
    check_tenant_limit(session, "searches")
    try:
        radius_m = body.radius_km * 1000
        competitors = await find_nearby_competitors(
            lat=body.target_lat,
            lng=body.target_lng,
            radius_m=radius_m,
            keyword=body.target_category,
            target_name=body.target_name
        )
        density = calculate_market_density(len(competitors), body.radius_km)

        rankings = {
            "nearest": sort_nearest(competitors),
            "largest_market": sort_largest_market(competitors),
            "largest_team": sort_largest_team(competitors),
            "most_similar": sort_most_similar(competitors),
        }

        # Store radar analysis to DB
        radar = RadarAnalysis(
            tenant_id=current_tenant_id.get(),
            client_id=body.client_id,
            lead_id=body.lead_id,
            target_name=body.target_name,
            target_place_id=body.place_id if hasattr(body, 'place_id') else None,
            target_lat=body.target_lat,
            target_lng=body.target_lng,
            target_address=body.target_address,
            target_phone=body.target_phone,
            target_website=body.target_website,
            target_rating=body.target_rating,
            target_reviews=body.target_reviews,
            target_category=body.target_category,
            radius_km=body.radius_km,
            market_density_score=density,
            competitor_count=len(competitors),
            competitors={"list": competitors},
        )
        session.add(radar)
        session.commit()
        session.refresh(radar)

        return {
            "radar_id": radar.id,
            "target": {
                "name": body.target_name,
                "lat": body.target_lat,
                "lng": body.target_lng,
                "address": body.target_address,
                "phone": body.target_phone,
                "website": body.target_website,
                "rating": body.target_rating,
                "reviews": body.target_reviews,
                "category": body.target_category,
            },
            "radius_km": body.radius_km,
            "competitor_count": len(competitors),
            "market_density_score": density,
            "competitors": competitors,
            "rankings": rankings,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Radar analysis failed: {e}")

@app.get("/radar/analyses")
def get_all_radar_analyses(session: Session = Depends(get_session)):
    """Get all radar analyses."""
    analyses = session.exec(select(RadarAnalysis).order_by(RadarAnalysis.run_date.desc()).limit(50)).all()
    return [
        {
            "id": a.id,
            "client_id": a.client_id,
            "target_name": a.target_name,
            "target_address": a.target_address,
            "radius_km": a.radius_km,
            "competitor_count": a.competitor_count,
            "market_density_score": a.market_density_score,
            "run_date": a.run_date.isoformat() if a.run_date else None,
        }
        for a in analyses
    ]

@app.get("/radar/analyses/{client_id}")
def get_client_radar_analyses(client_id: int, session: Session = Depends(get_session)):
    """Get radar analyses for a specific client."""
    analyses = session.exec(
        select(RadarAnalysis).where(RadarAnalysis.client_id == client_id).order_by(RadarAnalysis.run_date.desc())
    ).all()
    return [
        {
            "id": a.id,
            "target_name": a.target_name,
            "target_address": a.target_address,
            "target_lat": a.target_lat,
            "target_lng": a.target_lng,
            "radius_km": a.radius_km,
            "competitor_count": a.competitor_count,
            "market_density_score": a.market_density_score,
            "competitors": a.competitors,
            "run_date": a.run_date.isoformat() if a.run_date else None,
        }
        for a in analyses
    ]

@app.post("/radar/add-client")
def radar_add_client(body: RadarAddClientRequest, session: Session = Depends(get_session)):
    """Add a competitor discovered via radar to the CRM as a Lead (not a Client)."""
    try:
        comp = body.competitor
        name = comp.get("name", "Unknown Business")
        website = comp.get("website") or None
        phone = comp.get("phone") or None
        address = comp.get("address") or None
        industry = comp.get("category") or None

        # Check for existing Lead by website or name to avoid duplicates
        existing_lead = None
        if website:
            existing_lead = session.exec(select(Lead).where(Lead.website == website)).first()
        if not existing_lead:
            existing_lead = session.exec(select(Lead).where(Lead.company_name == name)).first()

        if existing_lead:
            # Update existing lead with fresher radar data
            existing_lead.last_activity = f"Re-discovered via Radar from {body.source_client_name}"
            if phone and not existing_lead.phone:
                existing_lead.phone = phone
            if address and not existing_lead.address:
                existing_lead.address = address
            if industry and not existing_lead.industry:
                existing_lead.industry = industry
            session.add(existing_lead)
            session.commit()
            lead = existing_lead
            is_new = False
        else:
            # Create new Lead
            lead = Lead(
                company_name=name,
                website=website,
                phone=phone,
                address=address,
                industry=industry,
                source="Radar Analysis",
                status="New",
                last_activity=f"Discovered via Radar Analysis of {body.source_client_name}",
            )
            session.add(lead)
            session.commit()
            session.refresh(lead)
            is_new = True

        # Log competitor relationship (still tracks which source client/lead triggered the discovery)
        try:
            rel = CompetitorRelationship(
                source_client_id=body.source_client_id,
                source_lead_id=body.source_lead_id,
                source_client_name=body.source_client_name,
                discovered_client_id=None,  # no longer creating a ClientProfile
                discovered_lead_id=lead.id,
                discovered_client_name=name,
                source_radar_id=body.radar_id,
                competitor_data={
                    "distance_km": comp.get("distance_km"),
                    "overlap_pct": comp.get("overlap_pct"),
                    "market_size_score": comp.get("market_size_score"),
                    "team_size_estimate": comp.get("team_size_estimate"),
                    "matched_services": comp.get("matched_services", []),
                    "lat": comp.get("lat"),
                    "lng": comp.get("lng"),
                    "lead_id": lead.id,
                }
            )
            session.add(rel)
            session.commit()
        except Exception:
            pass  # Relationship logging is best-effort

        return {
            "success": True,
            "lead_id": lead.id,
            "client_id": lead.id,  # backwards-compat alias
            "client_name": name,
            "is_new": is_new,
            "message": f"{name} added to Leads. Discovered from: {body.source_client_name}",
            "discovered_from": body.source_client_name,
            "discovery_date": datetime.utcnow().strftime("%Y-%m-%d"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add lead: {e}")



@app.get("/radar/relationships/{client_id}")
def get_radar_relationships(client_id: int, type: str = "client", session: Session = Depends(get_session)):
    """Get the competitor discovery graph for a client or lead (who they found + who found them)."""
    if type == "lead":
        discovered = session.exec(
            select(CompetitorRelationship).where(CompetitorRelationship.source_lead_id == client_id)
        ).all()
        found_from = session.exec(
            select(CompetitorRelationship).where(CompetitorRelationship.discovered_lead_id == client_id)
        ).all()
    else:
        discovered = session.exec(
            select(CompetitorRelationship).where(CompetitorRelationship.source_client_id == client_id)
        ).all()
        found_from = session.exec(
            select(CompetitorRelationship).where(CompetitorRelationship.discovered_client_id == client_id)
        ).all()

    return {
        "discovered_from": [
            {
                "source_client_id": r.source_client_id,
                "source_client_name": r.source_client_name,
                "discovery_method": r.discovery_method,
                "discovered_date": r.discovered_date.isoformat() if r.discovered_date else None,
            }
            for r in found_from
        ],
        "discovered_competitors": [
            {
                "discovered_client_id": r.discovered_client_id,
                "discovered_client_name": r.discovered_client_name,
                "discovery_method": r.discovery_method,
                "discovered_date": r.discovered_date.isoformat() if r.discovered_date else None,
                "competitor_data": r.competitor_data,
            }
            for r in discovered
        ],
    }


class AutomationScanRequest(BaseModel):
    url: str


# =====================================================================
# ENHANCED CRM ARCHITECTURE - LEADS, ACCOUNTS, CONTACTS
# =====================================================================
import json
import pandas as pd


class LeadCreateRequest(BaseModel):
    company_name: str
    website: Optional[str] = None
    industry: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    source: Optional[str] = None
    owner_id: Optional[int] = None
    status: str = "New"
    notes: Optional[str] = None

class AccountCreateRequest(BaseModel):
    company_name: str
    website: Optional[str] = None
    industry: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    owner_id: Optional[int] = None

class ContactCreateRequest(BaseModel):
    first_name: str
    last_name: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    email: Optional[str] = None
    mobile_number: Optional[str] = None
    alternate_number: Optional[str] = None
    linkedin_url: Optional[str] = None
    twitter_url: Optional[str] = None
    lead_id: Optional[int] = None
    account_id: Optional[int] = None
    client_id: Optional[int] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = []
    owner_id: Optional[int] = None
    create_new_lead: Optional[bool] = False
    parent_contact_id: Optional[int] = None

# ---- LEADS API ----
@app.get("/leads")
def get_leads(owner_id: Optional[int] = None, session: Session = Depends(get_session)):
    query = select(Lead)
    if owner_id is not None:
        query = query.where(Lead.owner_id == owner_id)
    tenant_id = current_tenant_id.get()
    if tenant_id and tenant_id != 1:
        query = query.where(Lead.tenant_id == tenant_id)
    leads = session.exec(query.order_by(Lead.created_at.desc())).all()
    return {"leads": leads}


@app.post("/leads")
def create_lead(body: LeadCreateRequest, session: Session = Depends(get_session)):
    tenant_id = current_tenant_id.get()
    if tenant_id and tenant_id != 1:
        tenant = session.get(Tenant, tenant_id)
        if tenant:
            current_count = session.exec(select(func.count(Lead.id)).where(Lead.tenant_id == tenant_id)).one()
            if current_count >= tenant.limit_clients:
                raise HTTPException(status_code=403, detail=f"Lead limit reached. Maximum allowed: {tenant.limit_clients}")
    lead = Lead(**body.dict())
    lead.tenant_id = current_tenant_id.get()
    session.add(lead)
    session.commit()
    session.refresh(lead)
    
    try:
        _notify_admins(
            session, current_tenant_id.get(),
            title=f"🎯 New Lead: {lead.company_name or lead.first_name}",
            message=f"Status: {lead.status} | Value: ${lead.estimated_value or 0}",
            notif_type="warning",
            link=f"/leads/{lead.id}"
        )
    except Exception:
        pass
    
    # ── WHATSAPP NOTIFICATION ──
    try:
        from modules.whatsapp import send_ai_polished_whatsapp_message
        base_url = "https://crm-seo.allytechcourses.com"
        send_ai_polished_whatsapp_message("New Lead Added", lead.dict(), f"{base_url}/leads/{lead.id}")
    except Exception as e:
        print("WhatsApp Error:", e)

    # ── AUTO-RESEARCH ──
    try:
        _trigger_background_research(
            entity_id=lead.id,
            entity_type="lead",
            company_name=lead.company_name or "",
            website=lead.website or ""
        )
    except Exception as e:
        print(f"AutoResearch trigger error for lead {lead.id}: {e}")
        
    return lead

@app.get("/leads/{lead_id}")
def get_lead(lead_id: int, session: Session = Depends(get_session)):
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead

@app.get("/leads/{lead_id}/activities")
def get_lead_activities(lead_id: int, session: Session = Depends(get_session)):
    return {"activities": []}

@app.get("/leads/{lead_id}/timeline")
def get_lead_timeline(lead_id: int, session: Session = Depends(get_session)):
    events: list[dict] = []
    # Activities
    for a in session.exec(select(ActivityLog).where(ActivityLog.lead_id == lead_id)).all():
        events.append({"type": "activity", "id": a.id, "title": a.action or a.method or "Activity", "detail": a.content or "", "date": a.createdAt.isoformat() if a.createdAt else None})
    # Emails
    for e in session.exec(select(SentEmail).where(SentEmail.lead_id == lead_id)).all():
        events.append({"type": "email", "id": e.id, "title": f"Email: {e.subject or 'No subject'}", "detail": e.to_email or "", "date": e.sent_at.isoformat() if e.sent_at else None})
    # Notes
    for n in session.exec(select(ClientNote).where(ClientNote.lead_id == lead_id)).all():
        events.append({"type": "note", "id": n.id, "title": "Note Added", "detail": n.content or "", "date": n.created_at.isoformat() if n.created_at else None})
    # Conversations
    for c in session.exec(select(ConversationLog).where(ConversationLog.lead_id == lead_id)).all():
        events.append({"type": "conversation", "id": c.id, "title": c.title or "Conversation", "detail": c.description or "", "date": c.created_at.isoformat() if c.created_at else None})
    
    events.sort(key=lambda x: x["date"] or "", reverse=True)
    return {"timeline": events}

@app.get("/leads/{lead_id}/activities")
def get_lead_activities(lead_id: int, session: Session = Depends(get_session)):
    acts = session.exec(select(ActivityLog).where(ActivityLog.lead_id == lead_id).order_by(ActivityLog.createdAt.desc())).all()
    return {"activities": [a.dict() for a in acts]}

@app.get("/leads/{lead_id}/notes")
def get_lead_notes(lead_id: int, session: Session = Depends(get_session)):
    notes = session.exec(select(ClientNote).where(ClientNote.lead_id == lead_id).order_by(ClientNote.created_at.desc())).all()
    return {"notes": [n.dict() for n in notes]}

class LeadNoteCreate(BaseModel):
    content: str
    author_name: str = "Admin"
    tags: Optional[List[str]] = []

@app.post("/leads/{lead_id}/notes")
def create_lead_note(lead_id: int, body: LeadNoteCreate, session: Session = Depends(get_session)):
    note = ClientNote(lead_id=lead_id, content=body.content, author_name=body.author_name, tags=body.tags)
    session.add(note)
    session.commit()
    session.refresh(note)
    return note.dict()

@app.get("/leads/{lead_id}/conversations")
def get_lead_conversations(lead_id: int, session: Session = Depends(get_session)):
    convs = session.exec(select(ConversationLog).where(ConversationLog.lead_id == lead_id).order_by(ConversationLog.created_at.desc())).all()
    return {"conversations": [c.dict() for c in convs]}

class LeadConversationCreate(BaseModel):
    title: str
    type: str = "call"
    description: Optional[str] = None
    author_name: str = "Admin"

@app.post("/leads/{lead_id}/conversations")
def create_lead_conversation(lead_id: int, body: LeadConversationCreate, session: Session = Depends(get_session)):
    conv = ConversationLog(lead_id=lead_id, title=body.title, type=body.type, description=body.description, author_name=body.author_name)
    session.add(conv)
    session.commit()
    session.refresh(conv)
    return conv.dict()

@app.get("/leads/{lead_id}/files")
def get_lead_files(lead_id: int, session: Session = Depends(get_session)):
    return {"files": []}

@app.post("/leads/{lead_id}/auto-research")
def auto_research_lead(lead_id: int, session: Session = Depends(get_session)):
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
        
    try:
        # Trigger the same deep background research we use on creation
        _trigger_background_research(
            entity_id=lead_id,
            entity_type="lead",
            company_name=lead.company_name or "",
            website=lead.website or ""
        )
        return {"ok": True, "message": "Research started in background"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to auto-research: {str(e)}")


@app.put("/leads/{lead_id}")
def update_lead(lead_id: int, body: LeadCreateRequest, session: Session = Depends(get_session)):
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    for key, value in body.dict().items():
        setattr(lead, key, value)
    session.add(lead)
    session.commit()
    session.refresh(lead)
    return lead




@app.post("/leads/{lead_id}/swot")
async def generate_lead_swot(lead_id: int, session: Session = Depends(get_session)):
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if not lead.website:
        raise HTTPException(status_code=400, detail="Lead has no website URL configured")
        
    from modules.llm_engine import generate_swot_analysis
    import json
    
    swot_data = await generate_swot_analysis(lead.website, lead.company_name or "Lead")
    lead.swot_analysis = json.dumps(swot_data)
    session.add(lead)
    session.commit()
    session.refresh(lead)
    return {"ok": True, "swot_analysis": swot_data}

from sqlmodel import text

@app.delete("/debug/purge-leads")
def purge_leads_debug(session: Session = Depends(get_session)):
    _require_roles(session, ["SuperAdmin"])
    queries = [
        "DELETE FROM sent_emails WHERE lead_id IS NOT NULL",
        "DELETE FROM activity_logs WHERE lead_id IS NOT NULL",
        "DELETE FROM contacts WHERE lead_id IS NOT NULL",
        "DELETE FROM meetings WHERE lead_id IS NOT NULL",
        "DELETE FROM quotes WHERE lead_id IS NOT NULL",
        "DELETE FROM sales_orders WHERE lead_id IS NOT NULL",
        "DELETE FROM cases WHERE lead_id IS NOT NULL",
        "DELETE FROM client_research WHERE lead_id IS NOT NULL",
        "DELETE FROM leads"
    ]
    for q in queries:
        try:
            session.execute(text(q))
        except Exception as e:
            print("Error executing", q, e)
    session.commit()
    return {"ok": True, "message": "All leads purged"}

@app.delete("/leads/{lead_id}")
def delete_lead(lead_id: int, session: Session = Depends(get_session)):
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
        
    try:
        # Delete related records to prevent ForeignKeyViolation
        queries = [
            "DELETE FROM sent_emails WHERE lead_id = :lead_id",
            "DELETE FROM activity_logs WHERE lead_id = :lead_id",
            "DELETE FROM contacts WHERE lead_id = :lead_id",
            "DELETE FROM meetings WHERE lead_id = :lead_id",
            "DELETE FROM quotes WHERE lead_id = :lead_id",
            "DELETE FROM sales_orders WHERE lead_id = :lead_id",
            "DELETE FROM cases WHERE lead_id = :lead_id",
            "DELETE FROM client_research WHERE lead_id = :lead_id",
        ]
        for q in queries:
            session.execute(text(q), {"lead_id": lead_id})
            
        session.delete(lead)
        session.commit()
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete lead: {str(e)}")
        
    return {"ok": True}

class LeadAIAnalyzeRequest(BaseModel):
    agent_type: str


@app.post("/leads/{lead_id}/convert")
def convert_lead_to_client(lead_id: int, session: Session = Depends(get_session)):
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if lead.is_converted:
        raise HTTPException(status_code=400, detail="Lead is already converted")
    
    # 1. Create Account
    account = Account(
        company_name=lead.company_name,
        website=lead.website,
        industry=lead.industry,
        phone=lead.phone,
        address=lead.address,
        owner_id=lead.owner_id
    )
    session.add(account)
    session.commit()
    session.refresh(account)
    
    # 2. Create ClientProfile
    client = ClientProfile(
        companyName=lead.company_name,
        websiteUrl=lead.website,
        industry=lead.industry,
        phone=lead.phone,
        address=lead.address,
        lead_source=lead.source,
        status="Active",
        assignedEmployeeId=lead.owner_id
    )
    session.add(client)
    session.commit()
    session.refresh(client)
    
    # 3. Re-link Contacts
    contacts = session.exec(select(Contact).where(Contact.lead_id == lead.id)).all()
    for contact in contacts:
        contact.account_id = account.id
        contact.client_id = client.id
        session.add(contact)
        
    # 3.5 Re-link Research Data and Sent Emails
    research_entries = session.exec(select(ClientResearch).where(ClientResearch.lead_id == lead.id)).all()
    for r in research_entries:
        r.client_id = client.id
        session.add(r)
        
    sent_emails = session.exec(select(SentEmail).where(SentEmail.lead_id == lead.id)).all()
    for e in sent_emails:
        e.client_id = client.id
        session.add(e)
    
    # 4. Mark Lead as converted
    lead.is_converted = True
    lead.converted_client_id = client.id
    lead.account_id = account.id
    lead.status = "Converted"
    session.add(lead)
    session.commit()
    
    return {"message": "Lead converted successfully", "client_id": client.id, "account_id": account.id}

# ---- ACCOUNTS API ----
@app.get("/accounts")
def get_accounts(session: Session = Depends(get_session)):
    accounts = session.exec(select(Account).order_by(Account.created_at.desc())).all()
    return {"accounts": accounts}

@app.post("/accounts")
def create_account(body: AccountCreateRequest, session: Session = Depends(get_session)):
    account = Account(**body.dict())
    session.add(account)
    session.commit()
    session.refresh(account)
    return account

@app.get("/accounts/{account_id}")
def get_account(account_id: int, session: Session = Depends(get_session)):
    account = session.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account

@app.put("/accounts/{account_id}")
def update_account(account_id: int, body: AccountCreateRequest, session: Session = Depends(get_session)):
    account = session.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    for key, value in body.dict().items():
        setattr(account, key, value)
    session.add(account)
    session.commit()
    session.refresh(account)
    return account

@app.delete("/accounts/{account_id}")
def delete_account(account_id: int, session: Session = Depends(get_session)):
    account = session.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    session.delete(account)
    session.commit()
    return {"ok": True}

# ---- CONTACTS API ----
@app.get("/contacts")
def get_contacts(search: Optional[str] = Query(None), session: Session = Depends(get_session)):
    query = select(Contact)
    if search:
        query = query.where(
            or_(
                Contact.full_name.ilike(f"%{search}%"),
                Contact.email.ilike(f"%{search}%"),
                Contact.first_name.ilike(f"%{search}%"),
                Contact.last_name.ilike(f"%{search}%")
            )
        )
    else:
        query = query.where(Contact.parent_contact_id == None)
        
    query = query.order_by(Contact.created_at.desc())
    contacts = session.exec(query).all()
    
    result = []
    for c in contacts:
        children_count = session.exec(select(func.count(Contact.id)).where(Contact.parent_contact_id == c.id)).one()
        c_dict = c.dict()
        c_dict["children_count"] = children_count
        
        if search:
            path = []
            curr = c
            while curr.parent_contact_id:
                parent = session.get(Contact, curr.parent_contact_id)
                if not parent: break
                path.insert(0, parent.full_name or "Unknown")
                curr = parent
            c_dict["hierarchy_path"] = " → ".join(path) if path else ""
            
        result.append(c_dict)
        
    return {"contacts": result}

@app.get("/contacts/{contact_id}/children")
def get_contact_children(contact_id: int, session: Session = Depends(get_session)):
    children = session.exec(select(Contact).where(Contact.parent_contact_id == contact_id).order_by(Contact.created_at.desc())).all()
    result = []
    for c in children:
        c_count = session.exec(select(func.count(Contact.id)).where(Contact.parent_contact_id == c.id)).one()
        c_dict = c.dict()
        c_dict["children_count"] = c_count
        result.append(c_dict)
    return {"children": result}

@app.post("/contacts")
def create_contact(body: ContactCreateRequest, session: Session = Depends(get_session)):
    contact_data = body.dict(exclude={"create_new_lead"})
    contact = Contact(**contact_data)
    if contact.first_name and contact.last_name:
        contact.full_name = f"{contact.first_name} {contact.last_name}"
    elif contact.first_name:
        contact.full_name = contact.first_name
        
    if body.create_new_lead:
        lead = Lead(
            company_name=contact.full_name,
            email=contact.email,
            phone=contact.mobile_number,
            status="New",
            source="Contact Form"
        )
        session.add(lead)
        session.flush()
        contact.lead_id = lead.id

    if body.parent_contact_id:
        parent = session.get(Contact, body.parent_contact_id)
        if not parent:
            raise HTTPException(status_code=400, detail="Invalid parent contact.")

    session.add(contact)
    session.commit()
    session.refresh(contact)
    return contact

@app.get("/contacts/{contact_id}")
def get_contact(contact_id: int, session: Session = Depends(get_session)):
    contact = session.get(Contact, contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact

@app.put("/contacts/{contact_id}")
def update_contact(contact_id: int, body: ContactCreateRequest, session: Session = Depends(get_session)):
    contact = session.get(Contact, contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
        
    # Check for circular hierarchy if parent_contact_id is changing
    if body.parent_contact_id is not None and body.parent_contact_id != contact.parent_contact_id:
        if body.parent_contact_id == contact.id:
            raise HTTPException(status_code=400, detail="A contact cannot be its own parent.")
        curr_parent_id = body.parent_contact_id
        while curr_parent_id:
            if curr_parent_id == contact.id:
                raise HTTPException(status_code=400, detail="Circular hierarchy detected. Cannot move contact under its own descendant.")
            parent_contact = session.get(Contact, curr_parent_id)
            if not parent_contact:
                raise HTTPException(status_code=400, detail="Invalid parent contact.")
            curr_parent_id = parent_contact.parent_contact_id
            
    for key, value in body.dict().items():
        setattr(contact, key, value)
    
    if contact.first_name and contact.last_name:
        contact.full_name = f"{contact.first_name} {contact.last_name}"
        
    session.add(contact)
    session.commit()
    session.refresh(contact)
    return contact

@app.delete("/contacts/{contact_id}")
def delete_contact(contact_id: int, action: Optional[str] = Query("cascade"), session: Session = Depends(get_session)):
    contact = session.get(Contact, contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
        
    children = session.exec(select(Contact).where(Contact.parent_contact_id == contact.id)).all()
    
    if action == "move_to_parent":
        for child in children:
            child.parent_contact_id = contact.parent_contact_id
            session.add(child)
        session.delete(contact)
    else: # cascade
        def delete_recursively(c_id):
            sub_children = session.exec(select(Contact).where(Contact.parent_contact_id == c_id)).all()
            for child in sub_children:
                delete_recursively(child.id)
            c = session.get(Contact, c_id)
            if c: session.delete(c)
        for child in children:
            delete_recursively(child.id)
        session.delete(contact)
        
    session.commit()
    return {"ok": True}



# ---- IMPORT SYSTEM ----
class ImportPreviewRequest(BaseModel):
    module: str # leads, accounts, contacts, clients

@app.post("/api/import/preview")
async def import_preview(file: UploadFile = File(...)):
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only CSV, XLSX, and XLS files are supported")
    
    try:
        if file.filename.endswith('.csv'):
            df = pd.read_csv(file.file, nrows=5)
        else:
            df = pd.read_excel(file.file, nrows=5)
            
        columns = df.columns.tolist()
        preview_data = df.fillna('').head(3).to_dict(orient='records')
        
        return {
            "columns": columns,
            "preview_data": preview_data,
            "total_columns": len(columns)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {str(e)}")




@app.post("/leads/{lead_id}/followup")
def add_lead_followup(lead_id: int, body: ClientFollowUpRequest, session: Session = Depends(get_session)):
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    # Add to notes
    existing_notes = lead.notes or ""
    new_note = f"Follow-up: {body.content}"
    lead.notes = existing_notes + "\n" + new_note if existing_notes else new_note
    session.add(lead)
    
    # Log activity
    from datetime import datetime
    activity = ActivityLog(
        lead_id=lead_id,
        action="Added Follow-up Note",
        details=body.content,
        timestamp=datetime.utcnow()
    )
    session.add(activity)

    if body.email_agent_data:
        client_research = session.exec(
            select(ClientResearch).where(ClientResearch.lead_id == lead_id)
        ).first()
        if not client_research:
            client_research = ClientResearch(
                lead_id=lead_id,
                email_agent_data=body.email_agent_data
            )
            session.add(client_research)
        else:
            client_research.email_agent_data = body.email_agent_data
            session.add(client_research)

    session.commit()
    
    return {"success": True, "message": "Follow-up added to lead."}


class LeadNoteRequest(BaseModel):
    content: str


def _get_lead_note_author(session: Session, user_id: Optional[int]) -> str:
    if not user_id:
        return "Anonymous"
    from database import User as UserModel
    user = session.get(UserModel, user_id)
    if not user:
        return "Anonymous"
    return user.name or user.email or f"User {user_id}"


@app.get("/leads/{lead_id}/notes")
def get_lead_notes(lead_id: int, session: Session = Depends(get_session)):
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    notes = session.exec(
        select(LeadNote).where(LeadNote.lead_id == lead_id).order_by(LeadNote.created_at.desc())
    ).all()
    return {"ok": True, "notes": [
        {
            "id": n.id,
            "content": n.content,
            "author_name": n.author_name,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in notes
    ]}


@app.post("/leads/{lead_id}/notes")
def add_lead_note(lead_id: int, body: LeadNoteRequest, session: Session = Depends(get_session)):
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    content = (body.content or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Note cannot be empty")

    from datetime import datetime
    now = datetime.utcnow()
    author_id = current_salesperson_id.get()

    note = LeadNote(
        lead_id=lead_id,
        content=content,
        author_id=author_id,
        author_name=_get_lead_note_author(session, author_id),
        created_at=now,
    )
    session.add(note)

    timestamped = f"[{now.strftime('%Y-%m-%d %H:%M')}] {content}"
    existing_notes = lead.notes or ""
    lead.notes = existing_notes + "\n" + timestamped if existing_notes else timestamped
    session.add(lead)

    activity = ActivityLog(
        lead_id=lead_id,
        action="Added Note",
        details=content,
        timestamp=now,
    )
    session.add(activity)

    session.commit()
    session.refresh(note)
    return {"ok": True, "note": {
        "id": note.id,
        "content": note.content,
        "author_name": note.author_name,
        "created_at": note.created_at.isoformat() if note.created_at else None,
    }}


# ═══════════════════════════════════════════════════════════════════════════════
# ACTIVITIES: MEETINGS
# ═══════════════════════════════════════════════════════════════════════════════

class MeetingCreateRequest(BaseModel):
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    meeting_type: str = "Meeting"
    status: str = "Scheduled"
    scheduled_at: Optional[str] = None
    duration_minutes: Optional[int] = None
    host_id: Optional[int] = None
    lead_id: Optional[int] = None
    client_id: Optional[int] = None
    contact_id: Optional[int] = None
    attendees: Optional[List[str]] = []
    notes: Optional[str] = None

class MeetingUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    meeting_type: Optional[str] = None
    status: Optional[str] = None
    scheduled_at: Optional[str] = None
    duration_minutes: Optional[int] = None
    attendees: Optional[List[str]] = None
    notes: Optional[str] = None
    outcome: Optional[str] = None









# ═══════════════════════════════════════════════════════════════════════════════
# INVENTORY: PRODUCTS
# ═══════════════════════════════════════════════════════════════════════════════

class ProductCreateRequest(BaseModel):
    name: str
    sku: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    photo_url: Optional[str] = None
    unit_price: float = 0.0
    currency: str = "USD"
    tax_rate: float = 0.0
    stock_quantity: Optional[int] = None
    is_active: bool = True

class ProductUpdateRequest(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    photo_url: Optional[str] = None
    unit_price: Optional[float] = None
    tax_rate: Optional[float] = None
    stock_quantity: Optional[int] = None
    is_active: Optional[bool] = None







# ═══════════════════════════════════════════════════════════════════════════════
# INVENTORY: QUOTES
# ═══════════════════════════════════════════════════════════════════════════════

class QuoteCreateRequest(BaseModel):
    title: str
    lead_id: Optional[int] = None
    client_id: Optional[int] = None
    contact_id: Optional[int] = None
    status: str = "Draft"
    currency: str = "USD"
    grand_total: float = 0.0
    valid_until: Optional[str] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    owner_id: Optional[int] = None
    items: list[dict] = []
    send_email: bool = False

class QuoteEmailSendRequest(BaseModel):
    subject: Optional[str] = None
    body_html: Optional[str] = None














def _quote_smtp_sender(session: Session):
    """Resolve the sender mailbox used for quote emails (per-tenant settings first,
    then env vars). Returns (sender_email, password, smtp_server, smtp_port)."""
    import os

    sender = None
    password = None
    smtp_server = None
    smtp_port = None

    tenant_id = current_tenant_id.get()
    if tenant_id:
        es = session.exec(select(EmailSettings).where(EmailSettings.tenant_id == tenant_id)).first()
        if es:
            sender = es.from_email
            password = es.smtp_pass
            smtp_server = es.smtp_host
            smtp_port = es.smtp_port

    if not sender or not password:
        sender = sender or os.getenv("EMAIL_SENDER") or os.getenv("OUTLOOK_EMAIL", "crm@serphawk.in")
        password = password or os.getenv("EMAIL_PASSWORD") or os.getenv("OUTLOOK_PASSWORD", "")
        smtp_server = smtp_server or os.getenv("EMAIL_HOST") or os.getenv("SMTP_SERVER", "mail.serphawk.in")
        smtp_port = smtp_port or os.getenv("EMAIL_PORT") or os.getenv("SMTP_PORT", 587)

    return sender, password, smtp_server, smtp_port








# ═══════════════════════════════════════════════════════════════════════════════
# INVENTORY: SALES ORDERS
# ═══════════════════════════════════════════════════════════════════════════════

class SalesOrderCreateRequest(BaseModel):
    quote_id: Optional[int] = None
    lead_id: Optional[int] = None
    client_id: Optional[int] = None
    status: str = "Pending"
    grand_total: float = 0.0
    currency: str = "USD"
    delivery_date: Optional[str] = None
    notes: Optional[str] = None
    owner_id: Optional[int] = None









# ═══════════════════════════════════════════════════════════════════════════════
# INVENTORY: PURCHASE ORDERS
# ═══════════════════════════════════════════════════════════════════════════════

class PurchaseOrderCreateRequest(BaseModel):
    vendor_name: str
    vendor_email: Optional[str] = None
    status: str = "Draft"
    grand_total: float = 0.0
    currency: str = "USD"
    expected_delivery: Optional[str] = None
    notes: Optional[str] = None
    owner_id: Optional[int] = None






# ── PDF Export Request Model ──────────────────────────────────────────────

class ExportPdfRequest(BaseModel):
    email: Optional[str] = None


# ── Sales Order PDF Export ───────────────────────────────────────────────







# ── Purchase Order PDF Export ────────────────────────────────────────────





# ── POS Receipt PDF Export ───────────────────────────────────────────────

class PosReceiptRequest(BaseModel):
    companyName: str = "SERPHAWK"
    ticketNumber: Optional[Union[str, int]] = None
    date: Optional[str] = None
    customer: str = "Público en General"
    products: list = []
    subtotal: Optional[float] = None
    taxRate: Optional[float] = 0
    taxAmount: Optional[float] = None
    total: Optional[float] = None
    paymentMethod: str = "Efectivo"
    amountPaid: Optional[float] = None
    change: Optional[float] = None
    currency: str = "$"
    taxIncluded: bool = True
    taxLabel: str = "IVA"
    email: Optional[str] = None

@app.post("/export-pdf/receipt")
def export_pos_receipt_pdf(body: PosReceiptRequest):
    """Generate a clean A4 POS receipt (Serphawk) and return it as a PDF download."""
    from fastapi.responses import Response
    from modules.pdf_export import pos_receipt_pdf, send_pdf_email
    pdf = pos_receipt_pdf(body.model_dump())
    ticket = body.ticketNumber
    filename = f"receipt_{ticket}.pdf" if ticket is not None and str(ticket) not in ("", "None") else "receipt.pdf"
    if body.email:
        try:
            send_pdf_email(
                body.email, f"Your receipt ({body.companyName})",
                "<p>Your receipt is attached.</p>", pdf, filename
            )
            return {"sent": True, "recipient": body.email}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Email failed: {e}")
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


# ═══════════════════════════════════════════════════════════════════════════════
# SUPPORT: CASES
# ═══════════════════════════════════════════════════════════════════════════════

class CaseCreateRequest(BaseModel):
    subject: str
    description: Optional[str] = None
    status: str = "Open"
    priority: str = "Medium"
    category: Optional[str] = None
    case_type: Optional[str] = "Bug"
    url: Optional[str] = None
    lead_id: Optional[int] = None
    client_id: Optional[int] = None
    contact_id: Optional[int] = None
    assigned_to: Optional[int] = None

class CaseUpdateRequest(BaseModel):
    subject: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    category: Optional[str] = None
    case_type: Optional[str] = None
    url: Optional[str] = None
    assigned_to: Optional[int] = None
    resolution: Optional[str] = None

def _case_dict(c: Case, session: Session) -> dict:
    client = session.get(ClientProfile, c.client_id) if c.client_id else None
    lead = session.get(Lead, c.lead_id) if c.lead_id else None
    assignee = session.get(User, c.assigned_to) if c.assigned_to else None
    d = c.model_dump()
    d["client_name"] = client.companyName if client else None
    d["lead_name"] = lead.company_name if lead else None
    d["assignee_name"] = assignee.name if assignee else None
    d["resolved_at"] = c.resolved_at.isoformat() if c.resolved_at else None
    d["created_at"] = c.created_at.isoformat()
    d["updated_at"] = c.updated_at.isoformat()
    return d

@app.get("/cases")
def list_cases(status: Optional[str] = None, priority: Optional[str] = None, client_id: Optional[int] = None, session: Session = Depends(get_session)):
    q = select(Case).order_by(Case.created_at.desc())
    if status:
        q = q.where(Case.status == status)
    if priority:
        q = q.where(Case.priority == priority)
    if client_id:
        q = q.where(Case.client_id == client_id)
    cases = session.exec(q).all()
    return {"cases": [_case_dict(c, session) for c in cases]}

def _notify_admins(session, tenant_id, title, message, notif_type="info", link=None):
    from database import User, Notification
    from sqlmodel import select
    admins = session.exec(select(User).where(User.role.in_(["admin", "Admin"]))).all()
    for admin in admins:
        if tenant_id and admin.tenant_id and admin.tenant_id != tenant_id:
            continue
        n = Notification(
            user_id=admin.id,
            title=title,
            message=message,
            type=notif_type,
            is_read=False,
            link=link
        )
        if tenant_id:
            n.tenant_id = tenant_id
        session.add(n)
    session.commit()

@app.post("/cases")
def create_case(body: CaseCreateRequest, session: Session = Depends(get_session)):
    import random, string
    tenant_id = current_tenant_id.get()
    c = Case(**body.model_dump())
    if tenant_id:
        c.tenant_id = tenant_id
    c.case_number = "CASE-" + "".join(random.choices(string.digits, k=5))
    session.add(c)
    session.commit()
    session.refresh(c)
    # Notify admins
    try:
        _notify_admins(
            session, tenant_id,
            title=f"🎫 New Case Raised: {c.case_number}",
            message=f"{c.subject} — Priority: {c.priority} | Type: {c.case_type or 'Bug'}",
            notif_type="warning",
            link=f"/support/cases"
        )
    except Exception:
        pass
    return {"case": _case_dict(c, session)}

@app.get("/cases/{case_id}")
def get_case(case_id: int, session: Session = Depends(get_session)):
    c = session.get(Case, case_id)
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")
    return {"case": _case_dict(c, session)}

@app.put("/cases/{case_id}")
def update_case(case_id: int, body: CaseUpdateRequest, session: Session = Depends(get_session)):
    c = session.get(Case, case_id)
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")
    tenant_id = current_tenant_id.get() or c.tenant_id
    updates = body.model_dump(exclude_unset=True)
    old_status = c.status
    if updates.get("status") in ("Resolved", "Closed") and not c.resolved_at:
        c.resolved_at = datetime.utcnow()
    for k, v in updates.items():
        setattr(c, k, v)
    c.updated_at = datetime.utcnow()
    session.add(c)
    session.commit()
    session.refresh(c)
    # Notify on status change
    new_status = updates.get("status")
    if new_status and new_status != old_status:
        try:
            icon = "✅" if new_status in ("Resolved", "Closed") else "🔄"
            _notify_admins(
                session, tenant_id,
                title=f"{icon} Case {c.case_number}: {new_status}",
                message=f"{c.subject} — Status changed from {old_status} → {new_status}",
                notif_type="success" if new_status in ("Resolved", "Closed") else "info",
                link=f"/support/cases"
            )
        except Exception:
            pass
    return {"case": _case_dict(c, session)}

@app.delete("/cases/{case_id}")
def delete_case(case_id: int, session: Session = Depends(get_session)):
    c = session.get(Case, case_id)
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")
    session.delete(c)
    session.commit()
    return {"ok": True}


# ═══════════════════════════════════════════════════════════════════════════════
# SUPPORT: SOLUTIONS
# ═══════════════════════════════════════════════════════════════════════════════

class SolutionCreateRequest(BaseModel):
    title: str
    content: str
    category: Optional[str] = None
    tags: Optional[List[str]] = []
    is_published: bool = True
    author_id: Optional[int] = None

class SolutionUpdateRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    is_published: Optional[bool] = None

@app.get("/solutions")
def list_solutions(category: Optional[str] = None, q: Optional[str] = None, session: Session = Depends(get_session)):
    query = select(Solution).where(Solution.is_published == True).order_by(Solution.view_count.desc())
    if category:
        query = query.where(Solution.category == category)
    solutions = session.exec(query).all()
    if q:
        solutions = [s for s in solutions if q.lower() in s.title.lower() or q.lower() in s.content.lower()]
    return {"solutions": [s.model_dump() for s in solutions]}

@app.post("/solutions")
def create_solution(body: SolutionCreateRequest, session: Session = Depends(get_session)):
    s = Solution(**body.model_dump())
    session.add(s)
    session.commit()
    session.refresh(s)
    return {"solution": s.model_dump()}

@app.get("/solutions/{solution_id}")
def get_solution(solution_id: int, session: Session = Depends(get_session)):
    s = session.get(Solution, solution_id)
    if not s:
        raise HTTPException(status_code=404, detail="Solution not found")
    s.view_count += 1
    session.add(s)
    session.commit()
    return {"solution": s.model_dump()}

@app.put("/solutions/{solution_id}")
def update_solution(solution_id: int, body: SolutionUpdateRequest, session: Session = Depends(get_session)):
    s = session.get(Solution, solution_id)
    if not s:
        raise HTTPException(status_code=404, detail="Solution not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(s, k, v)
    s.updated_at = datetime.utcnow()
    session.add(s)
    session.commit()
    session.refresh(s)
    return {"solution": s.model_dump()}

@app.delete("/solutions/{solution_id}")
def delete_solution(solution_id: int, session: Session = Depends(get_session)):
    s = session.get(Solution, solution_id)
    if not s:
        raise HTTPException(status_code=404, detail="Solution not found")
    session.delete(s)
    session.commit()
    return {"ok": True}

@app.post("/solutions/{solution_id}/helpful")
def mark_solution_helpful(solution_id: int, session: Session = Depends(get_session)):
    s = session.get(Solution, solution_id)
    if not s:
        raise HTTPException(status_code=404, detail="Solution not found")
    s.helpful_count += 1
    session.add(s)
    session.commit()
    return {"helpful_count": s.helpful_count}




# ──────────────────────────────────────────────────────
# EMAIL TRACKER APIs
# ──────────────────────────────────────────────────────

import os
import json
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
import google.auth.transport.requests
from google.oauth2.credentials import Credentials

os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

def get_google_oauth_flow(state=None):
    client_config = {
        "web": {
            "client_id": os.environ.get("GOOGLE_CLIENT_ID", ""),
            "client_secret": os.environ.get("GOOGLE_CLIENT_SECRET", ""),
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }
    return Flow.from_client_config(
        client_config,
        scopes=['https://www.googleapis.com/auth/gmail.readonly'],
        redirect_uri="http://localhost:8000/auth/google/callback"
    )

@app.get("/auth/google/login")
def google_oauth_login(user_id: int):
    if not os.environ.get("GOOGLE_CLIENT_ID"):
        return RedirectResponse(url=f"http://localhost:3000/admin/settings?error=Missing_Google_Keys")
        
    flow = get_google_oauth_flow()
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent',
        state=str(user_id)
    )
    return RedirectResponse(url=authorization_url)

@app.get("/auth/google/callback")
def google_oauth_callback(state: str, code: str, session: Session = Depends(get_session)):
    flow = get_google_oauth_flow()
    flow.fetch_token(code=code)
    credentials = flow.credentials
    
    service = build('gmail', 'v1', credentials=credentials)
    profile = service.users().getProfile(userId='me').execute()
    email_address = profile['emailAddress']
    
    user_id = int(state)
    integration = session.query(EmailIntegration).filter_by(user_id=user_id, email_address=email_address).first()
    
    if not integration:
        integration = EmailIntegration(
            user_id=user_id,
            email_address=email_address,
            provider="Gmail",
            status="Connected"
        )
        session.add(integration)
        
    integration.access_token = credentials.token
    integration.refresh_token = credentials.refresh_token or integration.refresh_token
    integration.token_expiry = credentials.expiry
    session.commit()
    
    return RedirectResponse(url="http://localhost:3000/admin/settings")

@app.get("/email-integrations")
def get_email_integrations(user_id: int, session: Session = Depends(get_session)):
    integrations = session.query(EmailIntegration).filter(EmailIntegration.user_id == user_id).all()
    return {"ok": True, "integrations": integrations}

@app.post("/email-integrations/{integration_id}/sync")
def sync_email_integration(integration_id: int, session: Session = Depends(get_session)):
    integration = session.get(EmailIntegration, integration_id)
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
        
    if not integration.access_token:
        raise HTTPException(status_code=400, detail="Missing OAuth token. Please reconnect.")
        
    creds = Credentials(
        token=integration.access_token,
        refresh_token=integration.refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.environ.get("GOOGLE_CLIENT_ID"),
        client_secret=os.environ.get("GOOGLE_CLIENT_SECRET"),
    )
    
    if creds.expired and creds.refresh_token:
        creds.refresh(google.auth.transport.requests.Request())
        integration.access_token = creds.token
        integration.token_expiry = creds.expiry
        session.commit()
        
    service = build('gmail', 'v1', credentials=creds)
    results = service.users().messages().list(userId='me', maxResults=5).execute()
    messages = results.get('messages', [])
    
    if not messages:
        return {"ok": True, "count": 0, "emails": []}
        
    extracted = []
    from modules.llm_engine import get_openai_client
    import re
    
    for msg in messages:
        txt = service.users().messages().get(userId='me', id=msg['id'], format='full').execute()
        payload = txt.get('payload', {})
        headers = payload.get('headers', [])
        
        subject = "No Subject"
        sender = "Unknown Sender"
        
        for d in headers:
            if d['name'] == 'Subject':
                subject = d['value']
            if d['name'] == 'From':
                sender = d['value']
                
        snippet = txt.get('snippet', '')
        
        prompt = f"""
        Classify this inbound email for a digital marketing agency CRM.
        Sender: {sender}
        Subject: {subject}
        Body: {snippet}
        
        Return ONLY a JSON object with:
        - suggested_type: string (Lead, Client, Spam, Inquiry)
        - ai_analysis: string (Brief 1 sentence explanation)
        """
        try:
            openai_client = get_openai_client()
            response = openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )
            data = json.loads(response.choices[0].message.content or "{}")
            suggested_type = data.get("suggested_type", "Unknown")
            ai_analysis = data.get("ai_analysis", "")
        except Exception:
            suggested_type = "Unknown"
            ai_analysis = "Failed to classify"
            
        match = re.match(r"(.*)<(.*)>", sender)
        if match:
            sender_name = match.group(1).strip()
            sender_email = match.group(2).strip()
        else:
            sender_name = sender
            sender_email = sender

        new_email = ExtractedEmail(
            integration_id=integration.id,
            sender_name=sender_name,
            sender_email=sender_email,
            subject=subject,
            body_snippet=snippet,
            suggested_type=suggested_type,
            ai_analysis=ai_analysis
        )
        session.add(new_email)
        extracted.append(new_email)
        
    integration.last_synced_at = datetime.utcnow()
    session.commit()
    
    # Refresh objects so they have DB IDs
    for e in extracted:
        session.refresh(e)
        
        # ── WHATSAPP NOTIFICATION ──
        try:
            from modules.whatsapp import send_ai_polished_whatsapp_message
            base_url = "https://crm-seo.allytechcourses.com"
            send_ai_polished_whatsapp_message("New Incoming Email", e.dict(), f"{base_url}/admin/settings?tab=email_tracker")
        except Exception as ex:
            print("WhatsApp Email Hook Error:", ex)

    return {"ok": True, "count": len(extracted), "emails": [e.dict() for e in extracted]}
@app.get("/extracted-emails")
def get_extracted_emails(user_id: int, session: Session = Depends(get_session)):
    emails = session.query(ExtractedEmail).join(EmailIntegration).filter(
        EmailIntegration.user_id == user_id,
        ExtractedEmail.status == "Pending"
    ).order_by(ExtractedEmail.created_at.desc()).all()
    return {"ok": True, "emails": emails}

class VerifyEmailRequest(BaseModel):
    action: str # convert_to_lead, convert_to_client, dismiss

@app.post("/extracted-emails/{email_id}/verify")
def verify_extracted_email(email_id: int, data: VerifyEmailRequest, session: Session = Depends(get_session)):
    email_obj = session.get(ExtractedEmail, email_id)
    if not email_obj:
        raise HTTPException(status_code=404, detail="Email not found")
        
    integration = session.get(EmailIntegration, email_obj.integration_id)
    user_id = integration.user_id if integration else None
    
    if data.action == "dismiss":
        email_obj.status = "Dismissed"
    elif data.action == "convert_to_lead":
        email_obj.status = "Verified_Lead"
        lead = Lead(
            company_name=email_obj.sender_name,
            email=email_obj.sender_email,
            source="Email Tracker",
            owner_id=user_id,
            status="New",
            notes=email_obj.body_snippet
        )
        session.add(lead)
    elif data.action == "convert_to_client":
        email_obj.status = "Verified_Client"
        client = ClientProfile(
            companyName=email_obj.sender_name,
            customFields={"email": email_obj.sender_email},
            status="Active",
            lead_source="Email Tracker",
            assignedEmployeeId=user_id
        )
        session.add(client)
        
    session.commit()
    return {"ok": True, "status": email_obj.status}

from fastapi.responses import PlainTextResponse





# --- Email Tracking Endpoint ---

class EmailStatusUpdate(BaseModel):
    email_id: str
    status: str

@app.post("/api/emails/update-status")
def update_email_status(payload: EmailStatusUpdate, session: Session = Depends(get_session)):
    try:
        email_id = int(payload.email_id)
        email = session.get(SentEmail, email_id)
        if not email:
            return {"error": "Email not found"}
        
        email.status = payload.status
        session.add(email)
        session.commit()
        return {"status": "success"}
    except Exception as e:
        return {"error": str(e)}

class EmailReplyUpdate(BaseModel):
    from_email: str

@app.post("/api/emails/mark-replied")
def mark_email_replied(payload: EmailReplyUpdate, session: Session = Depends(get_session)):
    try:
        import re
        print(f"--- DEBUG: Received Reply Payload ---")
        print(f"Payload from_email: '{payload.from_email}'")
        
        raw_email = payload.from_email
        match = re.search(r'<(.+?)>', raw_email)
        if match:
            raw_email = match.group(1).strip()
        else:
            raw_email = raw_email.strip()
            
        print(f"Extracted raw email: '{raw_email}'")
        
        # Find the most recent email sent to this address
        query = select(SentEmail).where(SentEmail.to_email == raw_email).order_by(SentEmail.sent_at.desc())
        email = session.exec(query).first()
        
        if not email:
            print(f"ERROR: No outbound email found in DB for '{raw_email}'")
            return {"error": "No previous outbound email found for this address."}
            
        email.status = "Replied"
        session.add(email)
        session.commit()
        print(f"SUCCESS: Marked email {email.id} as Replied.")
        return {"status": "success", "message": f"Marked email {email.id} as Replied."}
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return {"error": str(e)}


# ─── DATABASE MANAGEMENT ──────────────────────────────────────────────────
from sqlalchemy import inspect, text

@app.get("/admin/db/tables")
def get_db_tables(session: Session = Depends(get_session)):
    _require_roles(session, ["Admin"])
    inspector = inspect(session.bind)
    tables = inspector.get_table_names()
    return {"tables": tables}

@app.get("/admin/db/tables/{table_name}")
def get_db_table_data(table_name: str, page: int = 1, per_page: int = 50, sort_col: str = None, sort_dir: str = "asc", session: Session = Depends(get_session)):
    _require_roles(session, ["Admin"])
    inspector = inspect(session.bind)
    if table_name not in inspector.get_table_names():
        raise HTTPException(status_code=404, detail="Table not found")
        
    columns = [{"name": col["name"], "type": str(col["type"])} for col in inspector.get_columns(table_name)]
    
    query = f'SELECT * FROM "{table_name}"'
    if sort_col:
        # Prevent basic SQL injection on column name
        if sort_col in [c["name"] for c in columns]:
            direction = "ASC" if sort_dir.lower() == "asc" else "DESC"
            query += f' ORDER BY "{sort_col}" {direction}'
    
    query += f" LIMIT {per_page} OFFSET {(page - 1) * per_page}"
    
    result = session.exec(text(query)).mappings().all()
    
    # Get total count
    count_query = f'SELECT COUNT(*) FROM "{table_name}"'
    total = session.exec(text(count_query)).scalar()
    
    return {
        "columns": columns,
        "data": [dict(row) for row in result],
        "total": total,
        "page": page,
        "per_page": per_page
    }

@app.get("/admin/db/export/{table_name}")
def export_db_table(table_name: str, session: Session = Depends(get_session)):
    _require_roles(session, ["Admin"])
    from fastapi.responses import StreamingResponse
    import csv, io
    inspector = inspect(session.bind)
    if table_name not in inspector.get_table_names():
        raise HTTPException(status_code=404, detail="Table not found")
        
    columns = [col["name"] for col in inspector.get_columns(table_name)]
    query = f'SELECT * FROM "{table_name}"'
    result = session.exec(text(query)).mappings().all()
    
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=columns)
    writer.writeheader()
    for row in result:
        writer.writerow(dict(row))
        
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={table_name}_export.csv"}
    )

# ═══════════════════════════════════════════════════════════════
# INVENTORY MODULE ENDPOINTS
# ═══════════════════════════════════════════════════════════════

class InventoryItemCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = []
    photo_url: Optional[str] = None
    unit: Optional[str] = None
    min_stock: Optional[float] = 0
    current_stock: Optional[float] = 0

class InventorySupplierCreate(BaseModel):
    supplier_name: str
    supplier_brand: Optional[str] = None
    supplier_email: Optional[str] = None
    lot_number: Optional[str] = None
    unit_cost: Optional[float] = None
    currency: str = "USD"
    lead_time_days: Optional[int] = None
    min_order_qty: Optional[float] = None
    is_preferred: bool = False
    notes: Optional[str] = None




class MultiInvPdfRequest(BaseModel):
    item_ids: List[int]









class SupplierAddItemRequest(BaseModel):
    supplier_name: str
    supplier_email: str
    code: str
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = []
    photo_url: Optional[str] = None
    unit: Optional[str] = None
    min_stock: float = 0
    current_stock: float = 0
    unit_cost: Optional[float] = None
    currency: str = "USD"
    lead_time_days: Optional[int] = None
    lot_number: Optional[str] = None
    notes: Optional[str] = None






# ═══════════════════════════════════════════════════════════════
# RFQ ENDPOINTS
# ═══════════════════════════════════════════════════════════════

import secrets

class RFQCreate(BaseModel):
    item_id: int
    supplier_name: str
    supplier_email: str
    quantity: Optional[float] = None
    notes: Optional[str] = None

class RFQResponseCreate(BaseModel):
    unit_price: float
    currency: str = "USD"
    lead_time_days: Optional[int] = None
    valid_until: Optional[str] = None
    notes: Optional[str] = None





# ═══════════════════════════════════════════════════════════════
# API KEYS ENDPOINTS
# ═══════════════════════════════════════════════════════════════


class APIKeyCreate(BaseModel):
    name: str
    scopes: Optional[List[str]] = ["read", "write"]



# ═══════════════════════════════════════════════════════════════
# IMPORT: CSV/Excel bulk upload for leads
# ═══════════════════════════════════════════════════════════════

import io, csv

@app.post("/import/leads/csv")
async def import_leads_csv(file: UploadFile = File(...), session: Session = Depends(get_session)):
    content = await file.read()
    try:
        decoded = content.decode("utf-8-sig")
    except Exception:
        decoded = content.decode("latin-1")
    
    reader = csv.DictReader(io.StringIO(decoded))
    created, skipped = 0, 0
    errors = []
    
    FIELD_MAP = {
        "company": "company_name", "company name": "company_name", "companyname": "company_name",
        "name": "company_name",
        "website": "website", "url": "website", "web": "website",
        "email": "email", "e-mail": "email",
        "phone": "phone", "mobile": "phone", "tel": "phone",
        "industry": "industry", "sector": "industry",
        "source": "source", "lead source": "source",
        "status": "status",
        "address": "address", "location": "address",
        "notes": "notes", "note": "notes", "comments": "notes",
    }
    
    for i, row in enumerate(reader):
        try:
            mapped = {}
            for col, val in row.items():
                key = (col or "").strip().lower()
                if key in FIELD_MAP:
                    mapped[FIELD_MAP[key]] = (val or "").strip()
            
            company_name = mapped.get("company_name", "")
            if not company_name:
                skipped += 1
                continue
            
            lead = Lead(
                company_name=company_name,
                website=mapped.get("website") or None,
                email=mapped.get("email") or None,
                phone=mapped.get("phone") or None,
                industry=mapped.get("industry") or None,
                source=mapped.get("source") or "Import",
                status=mapped.get("status") or "New",
                address=mapped.get("address") or None,
                notes=mapped.get("notes") or None,
            )
            session.add(lead)
            created += 1
        except Exception as e:
            errors.append(f"Row {i+2}: {str(e)}")
    
    session.commit()
    return {"created": created, "skipped": skipped, "errors": errors}


# ─────────────────────────────────────────────────────────────────────────────
from pydantic import BaseModel

class ContactLinkRequest(BaseModel):
    contact_id: int
    role_at_company: Optional[str] = None
    is_primary: bool = False

@app.post("/clients/{client_id}/contacts")
def link_contact_to_client(client_id: int, body: ContactLinkRequest, session: Session = Depends(get_session)):
    link = ContactClientLink(
        client_id=client_id,
        contact_id=body.contact_id,
        role_at_company=body.role_at_company,
        is_primary=body.is_primary
    )
    session.add(link)
    session.commit()
    return {"status": "success"}

@app.post("/leads/{lead_id}/contacts")
def link_contact_to_lead(lead_id: int, body: ContactLinkRequest, session: Session = Depends(get_session)):
    link = ContactLeadLink(
        lead_id=lead_id,
        contact_id=body.contact_id,
        role_at_company=body.role_at_company,
        is_primary=body.is_primary
    )
    session.add(link)
    session.commit()
    return {"status": "success"}

@app.get("/clients/{client_id}/contacts")
def get_client_contacts(client_id: int, session: Session = Depends(get_session)):
    links = session.exec(select(ContactClientLink).where(ContactClientLink.client_id == client_id)).all()
    results = []
    for link in links:
        c = session.get(Contact, link.contact_id)
        if c:
            results.append({"link_id": link.id, "contact": c, "role": link.role_at_company, "is_primary": link.is_primary})
    return results

@app.get("/leads/{lead_id}/contacts")
def get_lead_contacts(lead_id: int, session: Session = Depends(get_session)):
    links = session.exec(select(ContactLeadLink).where(ContactLeadLink.lead_id == lead_id)).all()
    results = []
    for link in links:
        c = session.get(Contact, link.contact_id)
        if c:
            results.append({"link_id": link.id, "contact": c, "role": link.role_at_company, "is_primary": link.is_primary})
    return results

@app.get("/telemetry/audit-logs")
def get_telemetry_audit_logs(
    limit: int = 100, 
    offset: int = 0, 
    user_id: Optional[int] = None,
    session: Session = Depends(get_session)
):
    """
    Get all audit logs (telemetry data) for Admin view.
    Joins with User to get user email and name.
    """
    from sqlmodel import select
    from database import AuditLog, User
    
    stmt = select(AuditLog, User).join(User, AuditLog.user_id == User.id, isouter=True)
    if user_id:
        stmt = stmt.where(AuditLog.user_id == user_id)
        
    stmt = stmt.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit)
    results = session.exec(stmt).all()
    
    logs = []
    for log, user in results:
        logs.append({
            "id": log.id,
            "tenant_id": log.tenant_id,
            "user_id": log.user_id,
            "user_email": user.email if user else "System",
            "user_name": user.name if user else "Automated",
            "table_name": log.table_name,
            "record_id": log.record_id,
            "action": log.action,
            "changes": log.changes,
            "timestamp": log.timestamp.isoformat()
        })
        
    from sqlalchemy import func
    count_stmt = select(func.count(AuditLog.id))
    if user_id:
        count_stmt = count_stmt.where(AuditLog.user_id == user_id)
    total_count = session.exec(count_stmt).one()
    
    return {
        "logs": logs,
        "total_count": total_count,
        "limit": limit,
        "offset": offset
    }

@app.post("/demo/signup")
def create_demo_account(body: CreateUserRequest, session: Session = Depends(get_session)):
    existing = session.exec(select(User).where(User.email == body.email)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    # Require a verified signup OTP for this email before creating the account
    from database import EmailOTP
    otp_rec = session.exec(
        select(EmailOTP).where(
            EmailOTP.email == body.email,
            EmailOTP.purpose == "signup",
            EmailOTP.verified == True,
        )
    ).first()
    if not otp_rec:
        raise HTTPException(status_code=400, detail="Please verify your email before creating the account.")

    tenant = Tenant(
        name=f"Demo Tenant {body.email}",
        is_trial=True,
        limit_clients=15,
        limit_emails=5,
        limit_searches=5,
        limit_projects=5
    )
    session.add(tenant)
    session.commit()
    session.refresh(tenant)

    user = User(
        email=body.email,
        password=_hash_password(body.password),
        name=body.name,
        role="Demo",
        tenant_id=tenant.id
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    
    # Notify Admin of new signup (wrapped in try-except so it doesn't block signup if it fails)
    admin = session.exec(select(User).where(User.role == "Admin")).first()
    if admin:
        try:
            from database import Notification
            notification = Notification(
                user_id=admin.id,
                title="New Demo Signup",
                message=f"New demo account created: {user.name} ({user.email})",
                type="info",
                link="/users"
            )
            session.add(notification)
            session.commit()
        except Exception as e:
            session.rollback()
            print(f"Failed to create admin notification for demo signup: {e}")
    
    return {"success": True, "user": _user_dict(user)}

@app.get("/dev/diagnostic")
def diagnostic(session: Session = Depends(get_session)):
    _require_roles(session, ["SuperAdmin"])
    demo_users = session.exec(select(User).where(User.role == "Demo")).all()
    results = {}
    for user in demo_users:
        tid = user.tenant_id
        def q(model, order_col):
            if not tid: return []
            return session.exec(select(model).where(getattr(model, "tenant_id") == tid).order_by(order_col.desc())).all()
        
        results[user.email] = {
            "tenant_id": tid,
            "clients_count": len(q(ClientProfile, ClientProfile.id)),
            "leads_count": len(q(Lead, Lead.created_at)),
            "usage_clients": session.get(Tenant, tid).usage_clients if tid and session.get(Tenant, tid) else 0
        }
    
    return {"demo_payloads": results}

class OnboardingRequest(BaseModel):
    company: str
    phone: Optional[str] = None

@app.post("/onboarding")
def complete_onboarding(body: OnboardingRequest, session: Session = Depends(get_session)):
    tenant_id = current_tenant_id.get()
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
        
    tenant = session.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
        
    tenant.business_name = body.company
    if body.phone:
        tenant.phone = body.phone
        
    session.add(tenant)
    session.commit()
    
    return {"success": True, "message": "Profile updated"}

@app.get("/telemetry/demo-accounts")
def get_demo_accounts(session: Session = Depends(get_session)):
    """Fetch all demo accounts for the Telemetry Dashboard."""
    _require_roles(session, ["Admin"])
    from database import User
    from sqlmodel import select
    demo_users = session.exec(select(User).where(User.role == "Demo").order_by(User.createdAt.desc())).all()
    
    return {
        "success": True,
        "accounts": [
            {
                "id": u.id,
                "email": u.email,
                "name": u.name,
                "created_at": u.createdAt.isoformat() if u.createdAt else None,
                "tenant_id": u.tenant_id
            } for u in demo_users
        ]
    }

@app.get("/demo/limits")
def get_demo_limits(session: Session = Depends(get_session)):
    tenant_id = current_tenant_id.get()
    if not tenant_id:
        return {"success": False, "message": "No tenant ID"}
    
    tenant = session.get(Tenant, tenant_id)
    if not tenant:
        return {"success": False, "message": "Tenant not found"}
        
    lead_count = session.exec(select(func.count(Lead.id)).where(Lead.tenant_id == tenant_id)).one()

    return {
        "success": True,
        "limits": {
            "clients": {"usage": tenant.usage_clients, "limit": tenant.limit_clients},
            "leads": {"usage": lead_count, "limit": tenant.limit_clients},
            "emails": {"usage": tenant.usage_emails, "limit": tenant.limit_emails},
            "searches": {"usage": tenant.usage_searches, "limit": tenant.limit_searches},
            "projects": {"usage": tenant.usage_projects, "limit": tenant.limit_projects}
        }
    }

@app.post("/demo/upgrade")
def request_demo_upgrade(session: Session = Depends(get_session)):
    user_id = current_salesperson_id.get()
    if not user_id:
        return {"success": False, "message": "No user ID"}
    
    user = session.get(User, user_id)
    
    admin_users = session.exec(select(User).where(User.role.in_(["SuperAdmin", "Admin"]))).all()
    for admin in admin_users:
        n = Notification(
            user_id=admin.id,
            title="Account Upgrade Request",
            message=f"Demo account '{user.name}' ({user.email}) has reached their limits and clicked the Upgrade button!",
            type="info"
        )
        session.add(n)
        
    session.commit()
    return {"success": True, "message": "Upgrade request sent to admin."}





@app.post("/demo/request-upgrade")
def request_upgrade(
    email: str = Body(embed=True),
    session: Session = Depends(get_session)
):
    user = session.exec(select(User).where(User.email == email)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    admin = session.exec(select(User).where(User.role == "Admin")).first()
    if admin:
        notification = Notification(
            user_id=admin.id,
            title="Demo Upgrade Request",
            message=f"Demo user {user.name} ({user.email}) requested a full account upgrade.",
            type="alert",
            link="/users"
        )
        session.add(notification)
        session.commit()
    
    return {"status": "success", "message": "Upgrade request sent to admin."}

class EmailSettingsRequest(BaseModel):
    smtp_host: str
    smtp_port: int
    smtp_user: str
    smtp_pass: str
    from_name: str
    from_email: str

@app.get("/settings/email")
def get_email_settings(session: Session = Depends(get_session)):
    tenant_id = current_tenant_id.get()
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    settings = session.exec(select(EmailSettings).where(EmailSettings.tenant_id == tenant_id)).first()
    return settings or {}

@app.post("/settings/email")
def save_email_settings(body: EmailSettingsRequest, otp_verified: bool = False, session: Session = Depends(get_session)):
    tenant_id = current_tenant_id.get()
    uid = current_salesperson_id.get()
    if not tenant_id or not uid:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # Check OTP verification for the from_email address
    if not otp_verified:
        from database import EmailOTP
        verified = session.exec(
            select(EmailOTP).where(
                EmailOTP.user_id == uid,
                EmailOTP.email == body.from_email,
                EmailOTP.purpose == "smtp_settings",
                EmailOTP.verified == True,
            )
        ).first()
        if not verified:
            raise HTTPException(status_code=400, detail="Email address not verified. Please complete OTP verification first.")
    
    settings = session.exec(select(EmailSettings).where(EmailSettings.tenant_id == tenant_id)).first()
    if not settings:
        settings = EmailSettings(tenant_id=tenant_id, **body.dict())
        session.add(settings)
    else:
        for k, v in body.dict().items():
            setattr(settings, k, v)
        settings.updated_at = datetime.utcnow()
        session.add(settings)
    
    session.commit()
    return {"success": True}

# ──────────────────────────────────────────────────────
# EMAIL OTP: Send & Verify OTP for mail account setup
# ──────────────────────────────────────────────────────

class SendEmailOTPRequest(BaseModel):
    email: str
    purpose: str = "smtp_settings"  # smtp_settings | integration

class VerifyEmailOTPRequest(BaseModel):
    email: str
    otp_code: str
    purpose: str = "smtp_settings"

@app.post("/email-otp/send")
def send_email_otp(body: SendEmailOTPRequest, session: Session = Depends(get_session)):
    """Generate a 6-digit OTP, persist it, and email it to the given address."""
    import secrets
    from database import EmailOTP

    # Signup OTPs are not tied to a logged-in user (account doesn't exist yet)
    if body.purpose == "signup":
        uid = None
        existing_user = session.exec(select(User).where(User.email == body.email)).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered. Please sign in instead.")
    else:
        uid = current_salesperson_id.get()
        if not uid:
            raise HTTPException(status_code=401, detail="Unauthorized")

    # Invalidate any previous unused OTPs for this user + email + purpose
    old_q = select(EmailOTP).where(
        EmailOTP.email == body.email,
        EmailOTP.purpose == body.purpose,
        EmailOTP.verified == False,
    )
    old = session.exec(old_q).all()
    for o in old:
        session.delete(o)

    otp_code = f"{secrets.randbelow(900000) + 100000}"  # 6-digit code
    session.add(EmailOTP(
        user_id=uid,
        email=body.email,
        otp_code=otp_code,
        purpose=body.purpose,
        expires_at=datetime.utcnow() + timedelta(minutes=10),
    ))
    session.commit()

    from modules.email_sender import send_otp_email
    sent = send_otp_email(body.email, otp_code, purpose=body.purpose.replace("_", " "))

    return {
        "success": True,
        "delivered": sent,
        "message": "OTP sent to the email address.",
        "debug_otp": otp_code if not sent else None,
    }


@app.post("/email-otp/verify")
def verify_email_otp(body: VerifyEmailOTPRequest, session: Session = Depends(get_session)):
    """Verify the OTP code. Returns { verified: true } on success."""
    from database import EmailOTP
    from datetime import datetime as _dt

    # Signup OTPs are not tied to a logged-in user
    if body.purpose == "signup":
        uid = None
    else:
        uid = current_salesperson_id.get()
        if not uid:
            raise HTTPException(status_code=401, detail="Unauthorized")

    rec = session.exec(
        select(EmailOTP).where(
            EmailOTP.user_id == uid,
            EmailOTP.email == body.email,
            EmailOTP.otp_code == body.otp_code,
            EmailOTP.purpose == body.purpose,
        )
    ).first()

    if not rec or rec.verified or rec.expires_at < _dt.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired OTP code.")

    rec.verified = True
    session.commit()

    return {"success": True, "verified": True, "message": "Email verified successfully."}

@app.get("/leads/{lead_id}/research")
def get_lead_research(lead_id: int, session: Session = Depends(get_session)):
    research = session.exec(select(ClientResearch).where(ClientResearch.lead_id == lead_id)).first()
    if not research:
        return {"research": None}
    return {"research": {
        "id": research.id, "company_overview": research.company_overview,
        "competitors": research.competitors, "tech_stack": research.tech_stack,
        "recent_news": research.recent_news, "pain_points": research.pain_points,
        "business_goals": research.business_goals, "key_decision_makers": research.key_decision_makers,
        "email_agent_data": research.email_agent_data,
        "updated_at": research.updated_at.isoformat(),
    }}

@app.get("/leads/{lead_id}/sent-emails")
def get_lead_sent_emails(lead_id: int, session: Session = Depends(get_session)):
    """Return all sent emails associated with a lead, for the Opportunities tab."""
    emails = session.exec(
        select(SentEmail)
        .where(SentEmail.lead_id == lead_id)
        .order_by(SentEmail.sent_at.desc())
    ).all()
    return {"emails": [e.dict() for e in emails]}

