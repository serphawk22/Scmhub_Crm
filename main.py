
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
    AnalyticsData,
    CallLog,
    ScheduledCall,
    ChatMessage,
    ChatbotSession,
    ChatbotMessage,
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
    Deal,
    Document,
    EmailIntegration,
    EmailLog,
    ExtractedEmail,
    Invoice,
    KeywordRankEntry,
    Lead,
    LeadNote,
    MessageThread,
    Milestone,
    NPSSurvey,
    Notification,
    Project,
    ProjectTicket,
    ProjectTicketHistory,
    Proposal,
    RadarAnalysis,
    RankingTracker,
    Remark,
    MarketplaceService,
    SEOAudit,
    ServiceCatalog,
    ServiceRequest,
    SocialProfile,
    Task,
    TaskComment,
    TaskSheetEntry,
    Tenant,
    PageVisitTelemetry,
    User,
    create_db_and_tables,
    engine,
    InventoryItem,
    InventorySupplier,
    RFQRequest,
    RFQResponse,
    APIKey,
    EmailSettings,
)


# ─────────────────────────────────────────────────────────────────────────────
# App + CORS
# ─────────────────────────────────────────────────────────────────────────────


import contextvars
from sqlalchemy import event
from sqlalchemy.orm import Session as SASession
from sqlalchemy.sql.selectable import Select

current_tenant_id = contextvars.ContextVar("current_tenant_id", default=None)

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
        from modules.api_tracker import current_salesperson_id
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

from modules.api_tracker import current_client_id, current_salesperson_id, current_endpoint, patch_openai
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

from modules.api_intelligence import router as api_intelligence_router
app.include_router(api_intelligence_router)

from routers.email_tracking import router as email_tracking_router
app.include_router(email_tracking_router)

from routers.leaderboard import router as leaderboard_router
app.include_router(leaderboard_router)

@app.on_event("startup")
def on_startup():
    patch_openai()
    try:
        create_db_and_tables()
    except Exception as e:
        print(f"[startup] create_db_and_tables skipped (tables likely exist): {type(e).__name__}: {e}")
    
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
            conn.execute(text('ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS "projectId" INTEGER REFERENCES projects(id);'))
            conn.execute(text('ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS service_id INTEGER REFERENCES service_catalog(id);'))
            conn.execute(text('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id);'))
            conn.execute(text('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);'))
            conn.execute(text('ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS author_id INTEGER REFERENCES users(id);'))
            
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

    try:
        with engine.connect() as conn:
            tenant_count = conn.execute(text("SELECT COUNT(*) FROM tenants")).scalar()
            if tenant_count == 0:
                conn.execute(
                    text(
                        "INSERT INTO tenants (name, business_name, email, phone, is_trial, created_at, limit_clients, limit_emails, limit_searches, limit_projects, limit_calls, usage_clients, usage_emails, usage_searches, usage_projects, usage_calls) "
                        "VALUES (:name, :business_name, :email, :phone, :is_trial, NOW(), :limit_clients, :limit_emails, :limit_searches, :limit_projects, :limit_calls, 0, 0, 0, 0, 0)"
                    ),
                    {
                        "name": "Default Tenant",
                        "business_name": "Default Tenant",
                        "email": "admin@serphawk.com",
                        "phone": None,
                        "is_trial": False,
                        "limit_clients": 15,
                        "limit_emails": 5,
                        "limit_searches": 5,
                        "limit_projects": 5,
                        "limit_calls": 5,
                    },
                )
                conn.commit()
    except Exception as e:
        print(f"Default tenant bootstrap error: {e}")

    for table in tables_with_tenant:
        try:
            with engine.connect() as conn:
                default_tenant_id = conn.execute(text("SELECT id FROM tenants ORDER BY id LIMIT 1")).scalar()
                if default_tenant_id is None:
                    print(f"Skipping tenant backfill for {table} because no tenant rows exist.")
                    continue

                conn.execute(text(f'ALTER TABLE {table} ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;'))
                conn.execute(text(f'CREATE INDEX IF NOT EXISTS ix_{table}_tenant_id ON {table} (tenant_id);'))

                # Fix for existing records that have NULL tenant_id after migration
                conn.execute(text(f'UPDATE {table} SET tenant_id = :tenant_id WHERE tenant_id IS NULL;'), {"tenant_id": default_tenant_id})

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
    "https://serphawk-crm-seo.vercel.app",
    "https://scmhub-crm.vercel.app",
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
    "http://dapros.serphawk.in",
    "https://*.vercel.app",
    "https://*.up.railway.app",
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
    allow_origin_regex=r"https://([a-z0-9-]+\.)*(vercel\.app|serphawk\.in|up\.railway\.app)",
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
    owner_name: Optional[str] = "Noushad C I"


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

@app.post("/smart-research")
async def smart_research(body: SmartResearchRequest, session: Session = Depends(get_session)):
    """
    Takes a company name (and optional URL) and uses local scraper and LLM to return
    analysis, extracted contacts, and generated emails.
    """
    check_tenant_limit(session, "emails")
    from modules.scraper import research_and_map_company
    from modules.llm_engine import generate_email
    import json
    
    # Determine the URL
    url = body.company_url
    if not url:
        # Simple fallback if no URL provided
        formatted_name = body.company_name.replace(" ", "").replace(",", "").replace(".", "").lower()
        url = f"https://www.{formatted_name}.com"
        
    try:
        # Run local research (which uses Firecrawl and OpenAI)
        result = await research_and_map_company(url)
        analysis = result.get("company_analysis", {})
        mapping = result.get("service_mapping", [])
        
        # Extract Contact Info
        contacts = analysis.get("contacts", [])
        contact = contacts[0] if contacts else {}
        email = contact.get("email", "")
        if email is None:
            email = ""
        phone = contact.get("phone_number", "")
        if phone is None:
            phone = ""
        name = contact.get("name", "")
        if name is None:
            name = ""
            
        # Contact social
        personal_social = contact.get("personal_social_media", {})
        if personal_social is None:
            personal_social = {}
        contact_linkedin = personal_social.get("linkedin", "") if isinstance(personal_social, dict) else ""
        contact_twitter = personal_social.get("twitter", "") if isinstance(personal_social, dict) else ""
        
        # Company Socials
        socials = analysis.get("company_social_media", {})
        if socials is None:
            socials = {}
        comp_linkedin = socials.get("linkedin", "") if isinstance(socials, dict) else ""
        comp_twitter = socials.get("twitter", "") if isinstance(socials, dict) else ""
        comp_instagram = socials.get("instagram", "") if isinstance(socials, dict) else ""
        comp_facebook = socials.get("facebook", "") if isinstance(socials, dict) else ""
        
        # Get recommended services from the mapping
        recommended_services = [m.get("dapros_service") for m in mapping if m.get("dapros_service") and m.get("dapros_service") != "None"]
        # Fallback to key value props if empty
        if not recommended_services:
            recommended_services = analysis.get("key_value_props", [])
            
        # Generate the email draft
        draft_result = generate_email(analysis, contact, recommended_services, body.owner_name)
        
        # Extract Emails, Phones, and Socials from scraper raw text
        raw_text = result.get("raw_text", "")
        import re
        scraped_emails = []
        scraped_phones = []
        scraped_linkedin = ""
        scraped_twitter = ""
        
        email_match = re.search(r"Extracted Emails:\s*(.+)", raw_text)
        if email_match:
            scraped_emails = [e.strip() for e in email_match.group(1).split(",") if e.strip()]
            
        phone_match = re.search(r"Extracted Phone Numbers:\s*(.+)", raw_text)
        if phone_match:
            scraped_phones = [p.strip() for p in phone_match.group(1).split(",") if p.strip()]
            
        li_match = re.search(r"Extracted LinkedIn Profiles:\s*(.+)", raw_text)
        if li_match:
            scraped_linkedin = li_match.group(1).split(",")[0].strip() if li_match.group(1).strip() else ""
            
        tw_match = re.search(r"Extracted Twitter Profiles:\s*(.+)", raw_text)
        if tw_match:
            scraped_twitter = tw_match.group(1).split(",")[0].strip() if tw_match.group(1).strip() else ""
            
        ig_match = re.search(r"Extracted Instagram Profiles:\s*(.+)", raw_text)
        scraped_ig = ig_match.group(1).split(",")[0].strip() if (ig_match and ig_match.group(1).strip()) else ""
        
        fb_match = re.search(r"Extracted Facebook Profiles:\s*(.+)", raw_text)
        scraped_fb = fb_match.group(1).split(",")[0].strip() if (fb_match and fb_match.group(1).strip()) else ""
        
        yt_match = re.search(r"Extracted Youtube Profiles:\s*(.+)", raw_text)
        scraped_yt = yt_match.group(1).split(",")[0].strip() if (yt_match and yt_match.group(1).strip()) else ""

        # Merge with LLM findings
        if email and email not in scraped_emails:
            scraped_emails.append(email)
        if phone and phone not in scraped_phones:
            scraped_phones.append(phone)
            
        extracted_emails = ", ".join(scraped_emails) if scraped_emails else ""
        extracted_phones = ", ".join(scraped_phones) if scraped_phones else ""
        
        if scraped_linkedin and not comp_linkedin:
            comp_linkedin = scraped_linkedin
        if scraped_twitter and not comp_twitter:
            comp_twitter = scraped_twitter
        if scraped_ig and not comp_instagram:
            comp_instagram = scraped_ig
        if scraped_fb and not comp_facebook:
            comp_facebook = scraped_fb

        
        data = {
            "company_info": {
                "company_name": analysis.get("company_name", body.company_name),
                "summary": analysis.get("what_they_do", ""),
                "extracted_emails": extracted_emails,
                "extracted_phone_numbers": extracted_phones,
                "linkedin": comp_linkedin,
                "company_social_media": {
                    "linkedin": comp_linkedin,
                    "twitter": comp_twitter,
                    "instagram": comp_instagram,
                    "facebook": comp_facebook,
                    "youtube": scraped_yt
                }
            },
            "contact": {
                "email": email,
                "phone_number": phone,
                "linkedin": contact_linkedin,
                "twitter": contact_twitter,
                "name": name
            },
            "draft": {
                "subject": draft_result.get("subject", "Partnership Request"),
                "english_body": draft_result.get("english_body", ""),
                "spanish_body": draft_result.get("spanish_body", "")
            },
            "recommended_services": recommended_services,
            "extracted_services": [{"name": m.get("company_service"), "category": "Service", "approx_cost": 0, "cost_is_estimated": False} for m in mapping if m.get("company_service")]
        }
        

        # --- AUTO-CREATE LEAD AND SAVE RESEARCH ---
        import json
        from database import Lead, ClientResearch
        from sqlmodel import select
        
        # See if a lead already exists for this domain
        existing_lead = None
        if url:
            domain = url.replace("https://", "").replace("http://", "").replace("www.", "").split('/')[0]
            if domain:
                existing_lead = session.exec(select(Lead).where(Lead.website.like(f"%{domain}%"))).first()
                
        if not existing_lead and email:
            existing_lead = session.exec(select(Lead).where(Lead.email == email)).first()

        lead_id = None
        if not existing_lead:
            # Create a new lead
            new_lead = Lead(
                company_name=data["company_info"].get("company_name", body.company_name) or "Unknown Company",
                website=url,
                email=email if email else None,
                phone=phone if phone else None,
                source="Email Agent",
                status="Generated",
                ai_analysis_results=data
            )
            session.add(new_lead)
            session.commit()
            session.refresh(new_lead)
            lead_id = new_lead.id
        else:
            existing_lead.ai_analysis_results = data
            session.add(existing_lead)
            session.commit()
            lead_id = existing_lead.id
            
        # We no longer save Email Agent JSON to ClientResearch.email_agent_data
        # because that field is reserved for the massive Deep Research Markdown report.
        # ------------------------------------------

        return data
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Smart Research Local Exception: {e}")
        return {
            "company_info": {"company_name": body.company_name, "summary": f"Smart Research Exception: {e}"},
            "contact": {"email": ""},
            "draft": {"subject": "", "english_body": ""},
            "recommended_services": [],
            "extracted_services": []
        }

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

@app.post("/send-manual")
def send_manual(body: SendManualRequest, session: Session = Depends(get_session)):
    """
    Records a manually sent email, creates a Lead if not existing,
    and logs an activity entry.
    """
    from datetime import datetime

    # Determine action string
    if body.action_type == "Gmail":
        action_str = "Outreach via Gmail"
    elif body.action_type == "WhatsApp":
        action_str = "Outreach via WhatsApp"
    elif body.action_type == "System Auto":
        action_str = "Automated email sent"
    else:
        action_str = "Manual outreach email sent"

    # Step 1: Find or create Lead by email
    to_email = (body.to_email or "").strip()
    if not to_email:
        raise HTTPException(status_code=400, detail="Recipient email is required")

    lead = session.exec(
        select(Lead).where(Lead.email == to_email)
    ).first()
    
    if not lead:
        lead = Lead(
            company_name=body.company_name or "Unknown Company",
            website=body.website_url or None,
            email=to_email,
            phone=body.phone_number or None,
            source="Email Agent",
            status="Contacted"
        )
        session.add(lead)
        session.commit()
        session.refresh(lead)
    else:
        lead.status = "Contacted"
        if body.phone_number:
            lead.phone = body.phone_number
        if body.website_url:
            lead.website = body.website_url
        session.add(lead)
        session.commit()
        session.refresh(lead)

    # Add Contact if there's contact info
    if body.contact_name:
        contact = session.exec(select(Contact).where(Contact.email == to_email)).first()
        if not contact:
            contact = Contact(
                first_name=body.contact_name,
                full_name=body.contact_name,
                email=to_email,
                lead_id=lead.id,
                designation=body.contact_role
            )
            session.add(contact)
            session.commit()

    # Step 2.5: Save email_agent_data to lead.ai_analysis_results for Opportunities tab
    if body.email_agent_data:
        try:
            import json as _j
            parsed = _j.loads(body.email_agent_data) if isinstance(body.email_agent_data, str) else body.email_agent_data
            lead.ai_analysis_results = parsed
        except:
            lead.ai_analysis_results = body.email_agent_data
        session.add(lead)
        session.commit()

    # Step 3: Save SentEmail record
    import json as _json_se
    _draft_json_payload = _json_se.dumps({
        "subject": body.subject,
        "english_body": body.english_body,
        "spanish_body": body.spanish_body or "",
        "whatsapp_draft": getattr(body, "whatsapp_body", "") or "",
        "contact_name": body.contact_name or "",
        "contact_email": to_email,
        "company_name": body.company_name or "",
        "website_url": getattr(body, "website_url", "") or "",
        "recommended_services": body.recommended_services or "",
    })
    sent_email = SentEmail(
        lead_id=lead.id,
        to_email=to_email,
        subject=body.subject,
        english_body=body.english_body,
        spanish_body=body.spanish_body or "",
        recommended_services=body.recommended_services or "",
        draft_json=_draft_json_payload,
        manual=body.manual if body.manual is not None else True,
        sent_at=datetime.utcnow(),
    )
    session.add(sent_email)
    session.commit()
    session.refresh(sent_email)

    # Step 3.5: Send the actual email (unless skip_send is True).
    # Primary path is direct SMTP via the configured crm@serphawk.in mailbox.
    # The N8N webhook is still fired best-effort for follow-up automation.
    if not body.skip_send:
        import os
        import httpx
        sender = os.getenv("EMAIL_AGENT_SENDER") or os.getenv("EMAIL_SENDER") or os.getenv("OUTLOOK_EMAIL", "contact@scmbpo.com")
        password = os.getenv("EMAIL_AGENT_PASSWORD") or os.getenv("EMAIL_PASSWORD") or os.getenv("OUTLOOK_PASSWORD", "")
        smtp_server = os.getenv("EMAIL_HOST") or os.getenv("SMTP_SERVER", "mail.serphawk.in")
        smtp_port = os.getenv("EMAIL_PORT") or os.getenv("SMTP_PORT", 587)

        try:
            bodies = [b for b in [body.english_body, body.spanish_body] if b and b.strip()]
            full_body = "\n\n---\n\n".join(bodies) if bodies else ""

            # Send directly over SMTP from crm@serphawk.in so mail goes out even if n8n is down.
            if sender and password:
                from modules.email_sender import send_email_outlook
                send_email_outlook(
                    to_email=body.to_email,
                    subject=body.subject,
                    body=full_body or body.english_body or body.spanish_body or "",
                    sender_email=sender,
                    sender_password=password,
                    smtp_server=smtp_server,
                    smtp_port=int(smtp_port),
                )
                print(f"Email sent via SMTP to {body.to_email} from {sender}")
            else:
                print("SMTP not configured (missing EMAIL_SENDER/EMAIL_PASSWORD) - skipping direct send")

            # Fire the N8N webhook best-effort for follow-up automation (never blocks the reply).
            webhook_url = os.getenv("N8N_EMAIL_WEBHOOK_URL", "https://primary-production-d40bc.up.railway.app/webhook/trigger-cold-email")
            payload = {
                "event": "email_sent",
                "email_id": sent_email.id,
                "sender": sender,
                "to_email": body.to_email,
                "subject": body.subject,
                "body": full_body,
                "company_name": body.company_name,
                "contact_name": body.contact_name or "Prospect",
                "phone_number": body.phone_number,
                "recommended_services": body.recommended_services or "SEO",
                "timestamp": datetime.utcnow().isoformat()
            }
            try:
                response = httpx.post(webhook_url, json=payload, timeout=30.0)
                if response.status_code != 200:
                    print(f"Webhook Error during send-manual: {response.status_code} - {response.text}")
                else:
                    print(f"Webhook successfully triggered and responded from manual send to {webhook_url}")
            except Exception as e:
                print(f"Manual Email send failed via webhook: {e}")
        except Exception as e:
            print(f"Manual Email send failed: {e}")


    # Step 4: Log activity
    try:
        if body.action_type == "Gmail":
            log_action = f"Sent outreach via Gmail to {body.to_email}"
        elif body.action_type == "WhatsApp":
            log_action = f"Sent outreach via WhatsApp to {body.phone_number}"
        elif body.action_type == "System Auto":
            log_action = f"Automated outreach email sent to {body.to_email}"
        else:
            log_action = f"Manual outreach email sent to {body.to_email}"

        activity = ActivityLog(
            lead_id=lead.id,
            action=log_action,
            details=f"Subject: {body.subject} | Services: {body.recommended_services or 'N/A'}",
        )
        session.add(activity)
        session.commit()
    except Exception:
        pass  # Activity logging is best-effort

    return {
        "success": True,
        "lead_id": lead.id,
        "sent_email_id": sent_email.id,
        "message": f"Lead created and email recorded for {body.to_email}",
    }


# --- Delete client endpoint ---
@app.delete("/clients/{client_id}")
def delete_client(client_id: int, session: Session = Depends(get_session)):
    cp = session.get(ClientProfile, client_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Client not found")

    from sqlmodel import delete
    
    # We execute all deletes in a single transaction block.
    # No mid-loop rollbacks! We use the exact model attributes defined in database.py
    try:
        session.execute(delete(ServiceRequest).where(ServiceRequest.client_id == client_id))
        session.execute(delete(MessageThread).where(MessageThread.client_id == client_id))
        session.execute(delete(Remark).where(Remark.clientId == client_id))
        session.execute(delete(Document).where(Document.clientId == client_id))
        session.execute(delete(ActivityLog).where(ActivityLog.clientId == client_id))
        session.execute(delete(CallLog).where(CallLog.client_id == client_id))
        session.execute(delete(SentEmail).where(SentEmail.client_id == client_id))
        session.execute(delete(SocialProfile).where(SocialProfile.clientId == client_id))
        session.execute(delete(SEOAudit).where(SEOAudit.clientId == client_id))
        session.execute(delete(CompetitorAnalysis).where(CompetitorAnalysis.clientId == client_id))
        session.execute(delete(RankingTracker).where(RankingTracker.clientId == client_id))
        session.execute(delete(AnalyticsData).where(AnalyticsData.clientId == client_id))
        session.execute(delete(Task).where(Task.client_id == client_id))
        session.execute(delete(Invoice).where(Invoice.client_id == client_id))
        session.execute(delete(Milestone).where(Milestone.client_id == client_id))
        session.execute(delete(NPSSurvey).where(NPSSurvey.client_id == client_id))
        session.execute(delete(Proposal).where(Proposal.client_id == client_id))
        session.execute(delete(ClientFileUpload).where(ClientFileUpload.client_id == client_id))
        session.execute(delete(KeywordRankEntry).where(KeywordRankEntry.client_id == client_id))
        session.execute(delete(ClientNote).where(ClientNote.client_id == client_id))
        session.execute(delete(Deal).where(Deal.client_id == client_id))
        session.execute(delete(ConversationLog).where(ConversationLog.client_id == client_id))
        session.execute(delete(ClientResearch).where(ClientResearch.client_id == client_id))
        session.execute(delete(ClientTicket).where(ClientTicket.client_id == client_id))
        
        # Marketplace service provider links
        session.execute(delete(MarketplaceService).where(MarketplaceService.provider_client_id == client_id))

        # Delete the user account linked to this client (only if it's a Client-role user)
        if cp.userId:
            linked_user = session.get(User, cp.userId)
            if linked_user and linked_user.role == "Client":
                session.delete(linked_user)

        session.delete(cp)
        session.commit()
        return {"success": True}
    except Exception as e:
        session.rollback()
        print(f"[DeleteClient] Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete client: {str(e)}")



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


class TaskSheetEntryRequest(BaseModel):
    user_id: int
    work_date: str
    area: str = "General"
    project_id: Optional[int] = None
    ticket_id: Optional[int] = None
    summary: str
    status: str = "Done"


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


def _client_dict(cp: ClientProfile, session: Session) -> dict:
    user = session.get(User, cp.userId) if cp.userId else None
    employee = session.get(User, cp.assignedEmployeeId) if cp.assignedEmployeeId else None
    cf = cp.customFields or {}
    sd = cf.get("sheet_data", {})

    # Smart fallbacks: if stored fields are empty, pull from raw sheet_data
    def _get(primary, *sheet_keys):
        if primary:
            return primary
        for k in sheet_keys:
            for sk, sv in sd.items():
                if sk.strip().lower() == k.lower() and sv and str(sv).strip():
                    return str(sv).strip()
        return None

    website         = _get(cp.websiteUrl, "Website URL", "Website", "url", "Company Website", "Company Web Site", "website_url", "Domain")
    company_name    = _get(cp.companyName, "Client Name", "Company", "Company Name", "Name")
    
    # If company name is STILL blank (e.g. legacy import with no company column), derive from website
    if not company_name and website:
        import urllib.parse
        try:
            parsed = urllib.parse.urlparse(website if "://" in website else "http://" + website)
            domain = parsed.netloc.replace("www.", "").split(".")[0]
            if domain:
                company_name = domain.capitalize()
        except Exception:
            pass

    services        = _get(cp.services_offered, "Services", "Services providing", "Services Offered")
    description     = _get(cp.tagline, "Description", "description", "Notes")
    phone           = _get(cp.phone, "Contact", "Phone", "Phone Number", "phone_number", "phone")
    country         = _get(cp.address, "Country", "country", "Region")

    last_act_log = session.exec(select(ActivityLog).where(ActivityLog.clientId == cp.id).order_by(ActivityLog.createdAt.desc())).first()

    return {
        "id": cp.id,
        "userId": cp.userId,
        "email": user.email if user else None,
        "name": user.name if user else None,
        "companyName": company_name,
        "phone": phone,
        "address": country,
        "status": cp.status,
        "gmbName": cp.gmbName,
        "seoStrategy": cp.seoStrategy,
        "tagline": description,
        "targetKeywords": cp.targetKeywords or [],
        "keywords": cp.targetKeywords or [],
        "websiteUrl": website,
        "website": website,
        "recommended_services": cp.recommended_services,
        "nextMilestone": cp.nextMilestone,
        "nextMilestoneDate": cp.nextMilestoneDate,
        "lastActivity": last_act_log.action if last_act_log else cp.lastActivity,
        "lastActivityDate": last_act_log.createdAt.isoformat() if last_act_log else cp.lastActivityDate,
        "assignedEmployeeId": cp.assignedEmployeeId,
        "assignedEmployeeName": employee.name if employee else None,
        "projectId": cp.projectId,
        "projectName": cp.projectName,
        "payment_status": cp.payment_status,
        "sitemap_url": cp.sitemap_url,
        "cms_type": cp.cms_type,
        "services_offered": services,
        "services_requested": cp.services_requested,
        "industry": cp.industry or cf.get("market_size"),
        "lead_score": cp.lead_score or 0,
        "deal_value": cp.deal_value,
        "contact_person": cp.contact_person or sd.get("Contact") or sd.get("contact"),
        "linkedin_url": cp.linkedin_url,
        "last_contact_date": cp.last_contact_date,
        "next_followup_date": cp.next_followup_date,
        "description": cf.get("ai_description") or cf.get("description") or description,
        "country": cf.get("country") or sd.get("Country") or sd.get("country"),
        "swot_analysis": cp.swot_analysis,
        "customFields": cf,
    }


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

@app.get("/omnisearch")
def omnisearch(q: str, session: Session = Depends(get_session)):
    tenant_id = current_tenant_id.get()
    if not tenant_id:
        return {"results": []}

    from database import ClientProfile, Lead, Task, Deal
    from sqlalchemy import select, or_

    search_term = f"%{q}%"
    results = []

    # Search Clients
    clients = session.exec(select(ClientProfile).where(
        ClientProfile.tenant_id == tenant_id,
        or_(ClientProfile.companyName.ilike(search_term), ClientProfile.contactPerson.ilike(search_term), ClientProfile.email.ilike(search_term))
    ).limit(5)).all()
    for c in clients:
        results.append({"type": "Client", "title": c.companyName, "subtitle": c.contactPerson, "route": f"/admin/clients/{c.id}"})

    # Search Leads
    leads = session.exec(select(Lead).where(
        Lead.tenant_id == tenant_id,
        or_(Lead.company_name.ilike(search_term), Lead.email.ilike(search_term))
    ).limit(5)).all()
    for l in leads:
        results.append({"type": "Lead", "title": l.company_name, "subtitle": l.email or "", "route": f"/leads"})

    # Search Tasks
    tasks = session.exec(select(Task).where(
        Task.tenant_id == tenant_id,
        or_(Task.title.ilike(search_term), Task.description.ilike(search_term))
    ).limit(5)).all()
    for t in tasks:
        results.append({"type": "Task", "title": t.title, "subtitle": t.status, "route": f"/tasks"})

    # Search Deals
    deals = session.exec(select(Deal).where(
        Deal.tenant_id == tenant_id,
        Deal.title.ilike(search_term)
    ).limit(5)).all()
    for d in deals:
        results.append({"type": "Deal", "title": d.title, "subtitle": f"${d.value}", "route": f"/pipeline"})

    return {"results": results}

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


@app.get("/debug-user")
def debug_user(email: str = "", session: Session = Depends(get_session)):
    _require_roles(session, ["SuperAdmin"])
    users = session.exec(select(User)).all()
    suppliers = session.exec(select(InventorySupplier)).all()
    return {
        "users": [{"email": u.email, "role": u.role} for u in users],
        "suppliers": [{"name": s.supplier_name, "email": s.supplier_email, "uid": s.supplier_user_id} for s in suppliers]
    }

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



@app.get("/users/{user_id}/stats")
def get_user_stats(user_id: int, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Sales team stats
    if user.role in ["Admin", "SalesManager", "Employee"]:
        # Clients handling
        clients_count = len(session.exec(select(ClientProfile).where(ClientProfile.assignedEmployeeId == user.id)).all())
        
        # Leads converted
        converted_leads_count = len(session.exec(select(Lead).where(Lead.owner_id == user.id, Lead.is_converted == True)).all())
        
        # Current active tasks
        active_tasks = session.exec(select(Task).where(Task.assigned_to == user.id, Task.status.notin_(["approved", "rejected"]))).all()
        assigned_cases = session.exec(select(Case).where(Case.assigned_to == user.id)).all()
        
        return {
            "type": "sales",
            "clients_handling": clients_count,
            "leads_converted": converted_leads_count,
            "cases_assigned": len(assigned_cases),
            "active_tasks": [
                {"id": t.id, "title": t.title, "status": t.status, "priority": t.priority} 
                for t in active_tasks
            ]
        }
        
    # Dev team stats
    elif user.role in ["ProjectMember", "Intern"]:
        if not user.name:
            tickets = []
        else:
            tickets = session.exec(select(ProjectTicket).where(ProjectTicket.current_owner.ilike(user.name))).all()
            
        total_tickets = len(tickets)
        in_dev = sum(1 for t in tickets if t.current_state == "In Dev")
        in_qa = sum(1 for t in tickets if t.current_state == "Given to QA")
        in_prod = sum(1 for t in tickets if t.current_state == "Prod Release")
        assigned_cases = session.exec(select(Case).where(Case.assigned_to == user.id)).all()
        
        return {
            "type": "dev",
            "total_tickets": total_tickets,
            "in_dev": in_dev,
            "in_qa": in_qa,
            "in_prod": in_prod,
            "cases_assigned": len(assigned_cases)
        }
        
    return {"type": "unknown"}


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
@app.get("/dev/seed-catalog")
def dev_seed_catalog(session: Session = Depends(get_session)):
    _require_roles(session, ["SuperAdmin"])
    from sqlmodel import delete
    # Delete existing products
    session.exec(delete(Product))
    
    services = [
        {"name": "Local and Organic SEO", "provider": "DaPros"},
        {"name": "PPC & Google Ads Management", "provider": "DaPros"},
        {"name": "Social Media Management", "provider": "Serphawk"},
        {"name": "Digital Marketing Consulting", "provider": "Serphawk"},
        {"name": "Web Development", "provider": "Serphawk"},
        {"name": "App Development", "provider": "Serphawk"},
        {"name": "AI & Automation Services", "provider": "Serphawk"},
        {"name": "Custom Software Development", "provider": "Serphawk"},
        {"name": "Ecommerce", "provider": "DaPros"},
        {"name": "Secure Hosting", "provider": "DaPros"}
    ]
    
    for s in services:
        prod = Product(
            name=s["name"],
            sku=s["provider"],
            unit_price=100.0,
            currency="MXN",
            description="Includes equivalent to ~440 INR",
            category="Service",
            is_active=True
        )
        session.add(prod)
        
    session.commit()
    return {"message": "Catalog successfully seeded with 10 unified services at 100 MXN."}

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

@app.post("/clients/import-sheet")
async def import_sheet(body: SheetImportRequest, background_tasks: BackgroundTasks, session: Session = Depends(get_session)):
    tenant_id = current_tenant_id.get()
    if tenant_id and tenant_id != 1:
        tenant = session.get(Tenant, tenant_id)
        if tenant:
            current_count = session.exec(select(func.count(ClientProfile.id)).where(ClientProfile.tenant_id == tenant_id)).one()
            if current_count >= tenant.limit_clients:
                raise HTTPException(status_code=403, detail=f"Client limit reached. Maximum allowed: {tenant.limit_clients}")
    import httpx

    raw_csv = body.csv_text
    if not raw_csv and body.csv_url:
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=20) as http_client:
                r = await http_client.get(body.csv_url)
                raw_csv = r.text
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not fetch CSV: {e}")

    if not raw_csv:
        raise HTTPException(status_code=400, detail="No CSV data provided")

    reader = _csv.DictReader(_io.StringIO(raw_csv))
    rows = list(reader)
    added, skipped = [], []

    for row in rows:
        def get_field(keys):
            for k in keys:
                for rk in row.keys():
                    if rk and rk.strip().lower() == k.lower():
                        v = row[rk]
                        return v.strip() if v else None
            return None

        # Strictly map only the 4 fields
        company = get_field(["Client Name","Company","Company Name","companyName","Name"])
        email   = get_field(["Email","email","Email Address"])
        phone   = get_field(["Contact","Phone","phone","Contact Number"])
        desc    = get_field(["Description","description","Notes","Brief"])

        if not company:
            skipped.append({"reason": "empty name"})
            continue

        dup = session.exec(select(ClientProfile).where(ClientProfile.companyName == company)).first()
        if dup:
            if not dup.assignedEmployeeId and body.assigned_employee_id:
                dup.assignedEmployeeId = body.assigned_employee_id
                session.add(dup)
                session.commit()
                added.append({"id": dup.id, "company": company, "assigned": True})
            else:
                skipped.append({"reason": "duplicate", "company": company, "existing_id": dup.id})
            continue

        # Store the entire row data for sheet_data
        raw_sheet_data = dict(row)

        if tenant_id and tenant_id != 1 and tenant:
            if current_count >= tenant.limit_clients:
                skipped.append({"reason": f"limit reached (max {tenant.limit_clients})", "company": company})
                continue
            current_count += 1
            tenant.usage_clients += 1

        cp = ClientProfile(
            tenant_id=tenant_id,
            companyName=company,
            phone=phone,
            status="Active",
            customFields={"sheet_data": raw_sheet_data, "description": desc},
            assignedEmployeeId=body.assigned_employee_id
        )

        if email:
            existing_user = session.exec(select(User).where(User.email == email).execution_options(skip_tenant=True)).first()
            if not existing_user:
                new_user = User(
                    email=email,
                    password=_hash_password("changeme"),
                    name=company,
                    role="Client",
                )
                session.add(new_user)
                session.commit()
                session.refresh(new_user)
                cp.userId = new_user.id

        session.add(cp)
        session.commit()
        session.refresh(cp)
        added.append({"id": cp.id, "company": company})

        # Notice: background_tasks.add_task(_auto_research_client_bg) was removed because we no longer extract website url.

    return {"ok": True, "added": len(added), "skipped": len(skipped), "added_clients": added, "skipped_clients": skipped}


async def _auto_research_client_bg(client_id: int, website: str):
    from database import engine
    from sqlmodel import Session as DBSession
    from modules.scraper import scrape_website
    from modules.llm_engine import extract_client_profile_from_website
    try:
        raw = await scrape_website(website)
        if not raw:
            return
        data = extract_client_profile_from_website(raw, website)
        with DBSession(engine) as sess:
            cp = sess.get(ClientProfile, client_id)
            if not cp:
                return
            if data.get("company_name") and not cp.companyName:
                cp.companyName = data["company_name"]
            if data.get("tagline"):
                cp.tagline = data["tagline"]
            if data.get("industry"):
                cp.industry = data["industry"]
            if data.get("services"):
                svc = data["services"]
                cp.services_offered = ", ".join(svc) if isinstance(svc, list) else str(svc)
            existing_cf = cp.customFields or {}
            if data.get("description"):
                existing_cf["ai_description"] = data["description"]
            cp.customFields = existing_cf
            sess.add(cp)
            sess.commit()
            # Also create/update ClientResearch so the AI Agent tab works
            from database import ClientResearch
            research = sess.exec(select(ClientResearch).where(ClientResearch.client_id == client_id)).first()
            if not research:
                research = ClientResearch(client_id=client_id)
                sess.add(research)
            
            # Format the output into AI Agent fields
            research.company_overview = data.get("description", cp.tagline)
            research.tech_stack = "Web presence detected"
            
            # Pack everything into email_agent_data JSON string so the UI can use it
            import json
            ai_data = {
                "tagline": cp.tagline,
                "services": data.get("services", []),
                "industry": cp.industry,
                "auto_researched": True,
                "company_socials": data.get("company_socials", {}),
                "people": data.get("people", [])
            }
            research.email_agent_data = json.dumps(ai_data)
            
            # Also store the people array natively into key_decision_makers for legacy/direct display
            if data.get("people"):
                research.key_decision_makers = json.dumps(data.get("people"))
            
            sess.commit()
            
            deal = Deal(
                title=f"Opportunity – {cp.companyName or website}",
                client_id=client_id,
                stage="Lead",
                value=0.0,
                notes=f"Auto-researched via sheet import.\n\n{data.get('description', '')}",
            )
            sess.add(deal)
            sess.commit()
    except Exception as e:
        print(f"[AutoResearch] Error for client {client_id}: {e}")


# ─── CSV Export ────────────────────────────────────────────────────────────────
@app.get("/clients/export-csv")
def export_clients_csv(session: Session = Depends(get_session)):
    from fastapi.responses import StreamingResponse
    import json as _json

    tenant_id = current_tenant_id.get()
    q = select(ClientProfile)
    if tenant_id and tenant_id > 0:
        q = q.where(ClientProfile.tenant_id == tenant_id)
    clients_list = session.exec(q.order_by(ClientProfile.id.asc())).all()

    # Build employee lookup
    all_emp_ids = list({c.assignedEmployeeId for c in clients_list if c.assignedEmployeeId})
    emp_by_id = {}
    if all_emp_ids:
        emps = session.exec(select(User).where(User.id.in_(all_emp_ids))).all()
        emp_by_id = {e.id: e for e in emps}

    output = _io.StringIO()
    writer = _csv.writer(output)

    def _flatten(val):
        if not val:
            return ""
        try:
            if isinstance(val, str):
                if val.startswith("[") or val.startswith("{"):
                    val = _json.loads(val)
                else:
                    return val
            def extract(obj):
                if isinstance(obj, dict):
                    return [x for v in obj.values() for x in extract(v)]
                elif isinstance(obj, list):
                    return [x for v in obj for x in extract(v)]
                else:
                    return [str(obj)] if obj and str(obj).strip() else []
            return ", ".join(extract(val))
        except Exception:
            pass
        return str(val)[:500]

    writer.writerow([
        "ID", "Company Name", "Contact Person", "Email", "Phone", "Website",
        "Status", "Industry", "Address", "Assigned Employee",
        "Services Offered", "Services Requested", "Target Keywords",
        "Deal Value", "Payment Status", "Lead Score", "Lead Source",
        "Revenue Range", "Employee Count", "Next Milestone", "Next Milestone Date",
        "Last Activity", "Last Contact Date", "Next Follow-up Date",
        "Google Rating", "Google Reviews", "SWOT Analysis", "AI Call Pitch",
        "Discovered Via", "CMS Type", "Sitemap URL", "LinkedIn URL"
    ])

    for c in clients_list:
        user = session.get(User, c.userId) if c.userId else None
        client_email = c.email if hasattr(c, 'email') and c.email else (user.email if user else "")
        emp = emp_by_id.get(c.assignedEmployeeId)
        emp_name = emp.name if emp else ""

        swot_text = _flatten(c.swot_analysis)
        services_text = _flatten(c.services_offered)
        services_req_text = _flatten(c.services_requested)
        keywords_text = _flatten(c.targetKeywords)

        writer.writerow([
            c.id,
            c.companyName or "",
            c.contact_person or "",
            client_email,
            c.phone or "",
            c.websiteUrl or "",
            c.status or "",
            c.industry or "",
            c.address or "",
            emp_name,
            services_text,
            services_req_text,
            keywords_text,
            c.deal_value or "",
            c.payment_status or "",
            c.lead_score or "",
            c.lead_source or "",
            c.revenue_range or "",
            c.employee_count or "",
            c.nextMilestone or "",
            c.nextMilestoneDate or "",
            c.lastActivity or "",
            c.last_contact_date or "",
            c.next_followup_date or "",
            c.google_rating or "",
            c.google_reviews or "",
            swot_text,
            (c.call_pitch_text or "")[:300],
            c.discovered_via or "",
            c.cms_type or "",
            c.sitemap_url or "",
            c.linkedin_url or "",
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=serphawk_clients.csv"}
    )


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

@app.post("/clients/{client_id}/simulate-call")
def simulate_client_call(client_id: int, req: Optional[SimulateCallRequest] = None, session: Session = Depends(get_session)):
    cp = session.get(ClientProfile, client_id)
    if not cp: raise HTTPException(status_code=404, detail="Client not found")
    
    # Fetch related remarks as notes
    remarks_query = session.exec(select(Remark).where(Remark.clientId == client_id)).all()
    notes = "\n".join([r.content for r in remarks_query]) if remarks_query else ""
    activities = session.exec(select(ActivityLog).where(ActivityLog.clientId == client_id)).all()
    act_str = "\n".join([f"- {a.action}: {a.content}" for a in activities])
    
    email = cp.user.email if cp.user else ""
    keywords = ", ".join(cp.targetKeywords) if cp.targetKeywords else ""

    prompt = f"""You are an expert sales representative for "SERP Hawk" (an elite SEO and Digital Marketing Agency).
Your task is to write a highly tailored, direct sales script to be read over the phone to this specific client. 
DO NOT use generic placeholders like "[Your Name]" or "[Your Company]" - assume the persona of a SERP Hawk sales rep.

Client Profile:
Company/Project: {cp.companyName or cp.projectName or 'Unknown'}
Email: {email}
Keywords they are targeting: {keywords}
Services they need/offer: {cp.services_offered or 'SEO and Marketing Services'}

Notes from our CRM:
{notes}

Recent Activity with them:
{act_str}

Instructions:
1. Write the exact word-for-word script that the sales person will read on the call.
2. Directly reference their specific company name, their services/keywords, and especially any past notes or activities.
3. Pitch SERP Hawk's services (e.g. SEO, link building, digital marketing) as the solution to their specific needs.
4. Make it conversational, persuasive, and professional.
5. Structure it logically but seamlessly.
6. Output ONLY the spoken script as natural dialogue. Do NOT include markdown headings like **Introduction** or **Value Proposition**. It should read exactly like a transcript of someone speaking. Do not add any meta-commentary."""

    if req and req.context:
        prompt += f"\n\nAdditional Custom Context / Instructions from the Sales Rep:\n{req.context}\n(Please ensure you incorporate this custom instruction closely into the script)."

    from modules.llm_engine import get_openai_client
    try:
        openai_client = get_openai_client()
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=800
        )
        pitch = response.choices[0].message.content or ""
        
        call = CallLog(
            phone_number=cp.phone or "Unknown",
            duration_seconds=180,
            summary=f"AI Pitch Simulation for {cp.companyName or cp.projectName}",
            description=pitch,
            client_id=client_id,
        )
        session.add(call)
        session.commit()
        session.refresh(call)
        
        # Add Activity
        act = ActivityLog(
            action="Call Simulated",
            method="POST",
            content=f"Generated AI Call Pitch for {cp.companyName or cp.projectName}",
            details=pitch,
            clientId=client_id,
            userId=cp.userId  # Use actual user or None
        )
        session.add(act)
        session.commit()
        
        return {"ok": True, "call_id": call.id, "pitch": pitch}
    except Exception as e:
        print("Error in simulation:", e)
        raise HTTPException(status_code=500, detail=f"Failed to simulate call: {str(e)}")

@app.get("/clients/{client_id}/competitors/scan")
def scan_competitors_openai(client_id: int, session: Session = Depends(get_session)):
    import openai
    import os
    import json
    
    cp = session.get(ClientProfile, client_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Client not found")
        
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured in backend.")
        
    client = openai.OpenAI(api_key=api_key)
    
    prompt = f"""
    You are an OSINT Business Intelligence Agent. Your job is to extract exact pinpoint geographic coordinates and find 3 real nearby local competitors for a given company.
    
    Target Company: {cp.companyName or cp.projectName or 'Unknown'}
    Website: {cp.websiteUrl or cp.website or 'Unknown'}
    Services: {cp.services_offered or 'Unknown'}
    
    1. Determine the EXACT real-world latitude and longitude of this target company. If you cannot find the exact address, provide the coordinates of the center of its city.
    2. Identify exactly 3 REAL local competitors that operate near them in the same industry.
    3. Calculate realistic distance, assign a type ('direct', 'partial', or 'partner'), a similarity score (0-100), Google rating, review count, and a price range estimate.
    
    Return the output STRICTLY as valid JSON with no markdown formatting, using this exact schema:
    {{
      "lat": 37.7749,
      "lng": -122.4194,
      "competitors": [
        {{
          "id": 1,
          "name": "Competitor Name",
          "distance": "1.2 km",
          "rating": 4.8,
          "reviews": 150,
          "services": ["SEO", "Web Design"],
          "website": "competitor.com",
          "similarity": 85,
          "priceRange": "$1000 - $3000/mo",
          "type": "direct",
          "lat": 37.7800,
          "lng": -122.4100
        }}
      ]
    }}
    """
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        data = json.loads(response.choices[0].message.content)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



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


@app.post("/clients/{client_id}/extract-services")
def extract_services(client_id: int, session: Session = Depends(get_session)):
    cp = session.get(ClientProfile, client_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Client not found")
        
    research = session.exec(select(ClientResearch).where(ClientResearch.client_id == client_id)).first()
    
    context = f"Company Name: {cp.companyName}\n"


    if research and research.company_overview:
        context += f"Overview: {research.company_overview}\n"
        
    try:
        prompt = f"""Analyze the following company data and extract a list of services they offer.
For each service, provide a name, a brief description, and an estimated approximate cost (in dollars, e.g. 1500).
Return a JSON array of objects with keys: name, description, approx_cost.
Data:
{context}"""
        import json
        from modules.llm_engine import get_openai_client
        
        client_openai = get_openai_client()
        response = client_openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a data extraction AI. Output raw JSON array of objects. No markdown formatting, just the raw JSON array. If you cannot find services, guess based on the industry."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2
        )
        raw_res = response.choices[0].message.content
        
        try:
            services_data = json.loads(raw_res)
        except:
            if "```json" in raw_res:
                raw_res = raw_res.split("```json")[1].split("```")[0].strip()
                services_data = json.loads(raw_res)
            else:
                services_data = []
                
        if not isinstance(services_data, list):
            services_data = []
            
        added_count = 0
        from database import MarketplaceService
        for srv in services_data:
            if not srv.get("name"): continue
            
            # Try parsing approx_cost as float
            cost = 0.0
            raw_cost = str(srv.get("approx_cost", 0)).replace('$', '').replace(',', '').strip()
            try:
                cost = float(raw_cost)
            except:
                cost = 0.0
                
            ms = MarketplaceService(
                tenant_id=cp.tenant_id,
                service_name=srv["name"],
                description=srv.get("description", ""),
                estimated_cost=cost,
                cost_is_estimated=True,
                provider_client_id=cp.id,
                provider_name=cp.companyName or "Unknown Provider",
                category="General"
            )
            session.add(ms)
            added_count += 1
            
        cp.services_offered = json.dumps(services_data)
        session.add(cp)
        session.commit()
        
        return {"ok": True, "services": services_data, "marketplace_entries_added": added_count}
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/clients/{client_id}/generate-outbound-draft")
def generate_outbound_draft(client_id: int, session: Session = Depends(get_session)):
    check_tenant_limit(session, "emails")
    cp = session.get(ClientProfile, client_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Client not found")
        
    try:
        from modules.llm_engine import get_openai_client
        import json as _json
        client_ai = get_openai_client()
        
        # ── Safe upsert: always fetch (or create) research in ONE place ──────
        research = session.exec(select(ClientResearch).where(ClientResearch.client_id == client_id)).first()
        
        # If no OSINT data yet, run deep investigation synchronously
        if not research or not research.email_agent_data:
            from modules.llm_engine import deep_investigate_company
            url = cp.websiteUrl or cp.website or ""
            if not url and cp.companyName:
                slug = cp.companyName.lower().replace(" ", "").replace(",","").replace(".","")
                url = f"https://www.{slug}.com"
            
            if url:
                print(f"[DraftGen] No existing research for client {client_id}. Running deep investigation first...")
                try:
                    osint_data = deep_investigate_company(
                        company_name=cp.companyName or "Unknown",
                        website=url,
                        scraped_text=""
                    )
                    if not research:
                        research = ClientResearch(client_id=client_id, tenant_id=current_tenant_id.get())
                        session.add(research)
                        session.flush()  # get the id without committing
                    research.company_overview = osint_data.get("company_overview", "")
                    research.email_agent_data = _json.dumps(osint_data)
                    session.commit()
                    print(f"[DraftGen] Deep investigation complete for client {client_id}")
                except Exception as osint_err:
                    session.rollback()
                    print(f"[DraftGen] OSINT failed (continuing with draft anyway): {osint_err}")
                    # Re-fetch research after rollback
                    research = session.exec(select(ClientResearch).where(ClientResearch.client_id == client_id)).first()

        research_context = ""
        if research:
            research_context = f"""
            Company Overview: {research.company_overview or 'N/A'}
            Pain Points: {research.pain_points or 'N/A'}
            Business Goals: {research.business_goals or 'N/A'}
            """
            if research.email_agent_data:
                try:
                    ea_data = _json.loads(research.email_agent_data)
                    research_context += f"\nEmail Agent Intel: {_json.dumps(ea_data.get('company_info', {}), indent=2)}"
                except:
                    pass

        # Get Notes and Conversations
        notes = session.exec(select(ClientNote).where(ClientNote.client_id == client_id).order_by(ClientNote.created_at.desc()).limit(10)).all()
        conversations = session.exec(select(ConversationLog).where(ConversationLog.client_id == client_id).order_by(ConversationLog.created_at.desc()).limit(5)).all()
        
        interaction_context = ""
        if notes:
            interaction_context += "Recent Notes:\n" + "\n".join([f"- {n.content}" for n in notes]) + "\n"
        if conversations:
            interaction_context += "Recent Conversations:\n" + "\n".join([f"- {c.type} on {c.created_at}: {c.description or c.title}" for c in conversations]) + "\n"

        prompt = f"""
        You are an expert SDR (Sales Development Representative) at an agency. 
        Write a highly personalized, cold outreach email draft for the following prospect.
        Company: {cp.companyName or 'Unknown'}
        Website: {cp.websiteUrl or 'Unknown'}
        {research_context}

        {interaction_context}
        If there are recent notes or conversations above, make sure the email acknowledges them appropriately as a follow-up. If none exist, write a standard cold outreach email based on the research.

        
        Return ONLY valid JSON matching this schema exactly (no markdown formatting):
        {{
            "subject": "Email subject",
            "english_body": "Email body in English",
            "spanish_body": "Email body translated to Spanish",
            "whatsapp_draft": "Short, punchy WhatsApp message (plain text, emojis allowed)"
        }}
        """
        
        resp = client_ai.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=800,
        )
        content = resp.choices[0].message.content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            
        data = _json.loads(content)
        
        # Save as a draft in SentEmail
        from database import SentEmail, User
        user = session.get(User, cp.userId) if cp.userId else None
        to_email = user.email if user else "unknown@example.com"
        
        draft = SentEmail(
            tenant_id=current_tenant_id.get(),
            client_id=client_id,
            to_email=to_email,
            subject=data.get("subject", "Proposal"),
            english_body=data.get("english_body", ""),
            spanish_body=data.get("spanish_body", ""),
            draft_json=_json.dumps(data),
            manual=True,
            sent_at=datetime.utcnow()
        )
        session.add(draft)
        
        # ── Safe upsert research (use existing row, never re-insert) ─────────
        if not research:
            research = session.exec(select(ClientResearch).where(ClientResearch.client_id == client_id)).first()
        if not research:
            research = ClientResearch(client_id=client_id, tenant_id=current_tenant_id.get())
            session.add(research)
        
        ea_payload = {}
        if research.email_agent_data:
            try:
                ea_payload = _json.loads(research.email_agent_data)
            except:
                pass
                
        ea_payload["draft"] = data
        ea_payload["email_hook"] = data.get("whatsapp_draft", "Custom outreach generated from latest interactions.")
        
        research.email_agent_data = _json.dumps(ea_payload)
        
        session.commit()
        return {"ok": True, "draft": data, "email_id": draft.id}
        
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to generate draft: {str(e)}")




# ─── Extract Client Services from Website ─────────────────────────────────────

@app.post("/clients/{client_id}/extract-services")
async def extract_client_services_endpoint(client_id: int, session: Session = Depends(get_session)):
    """
    Scrapes the client's website and uses AI to extract services they offer.
    Falls back to LLM world-knowledge when website is unreachable (DNS, timeout, bot-block).
    Stores results in: ClientProfile.services_offered + MarketplaceService table.
    """
    cp = session.get(ClientProfile, client_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Client not found")

    website_url = cp.websiteUrl
    company_name = cp.companyName or "Unknown Company"

    if not website_url:
        raise HTTPException(
            status_code=400,
            detail="Client has no website URL. Add one in the client profile first."
        )

    # ── Step 1: Try scraping (fail gracefully on any network error) ────────────
    website_text = ""
    scrape_method = "website_scrape"
    try:
        from modules.scraper import scrape_website
        website_text = await scrape_website(website_url)
        if website_text.startswith("ERROR"):
            print(f"[extract-services] Scrape failed for {website_url}: {website_text[:100]}. Falling back to LLM.")
            website_text = ""
            scrape_method = "llm_fallback"
    except Exception as scrape_err:
        print(f"[extract-services] Scraper exception ({website_url}): {scrape_err}. Falling back to LLM.")
        scrape_method = "llm_fallback"

    # ── Step 2: Extract services (from scraped text, or via LLM knowledge) ─────
    import json as _json
    from modules.llm_engine import extract_client_services as _extract_services, get_openai_client

    services = []

    if website_text:
        services = _extract_services(website_text, company_name)

    # If scraping failed or extracted nothing → use LLM world-knowledge fallback
    if not services:
        scrape_method = "llm_fallback"
        try:
            oai = get_openai_client()
            fallback_prompt = f"""You are a B2B business intelligence expert.

The company "{company_name}" has website: {website_url}
Industry: {cp.industry or "unknown"}

We could not access their website. Based on the company name, domain, and industry,
list the most likely services they offer.

Return ONLY valid JSON:
{{
  "services": [
    {{
      "name": "Service name",
      "brief": "1-2 sentence description of this service",
      "category": "One of: SEO, Web Design, Marketing, Plumbing, Legal, Accounting, Consulting, Construction, Healthcare, Real Estate, IT Services, Landscaping, Cleaning, Electrical, HVAC, Retail, Education, Finance, Transportation, Other",
      "approx_cost": 1200,
      "cost_is_estimated": true
    }}
  ]
}}

Rules: 3-8 services max. approx_cost in USD. cost_is_estimated always true for fallback."""
            resp = oai.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": fallback_prompt}],
                response_format={"type": "json_object"},
                temperature=0.3,
            )
            services = _json.loads(resp.choices[0].message.content).get("services", [])
        except Exception as llm_err:
            print(f"[extract-services] LLM fallback also failed: {llm_err}")

    if not services:
        return {
            "ok": False,
            "services": [],
            "scrape_method": scrape_method,
            "message": "Could not extract services. Try adding the Industry field to improve AI fallback accuracy.",
        }

    # ── Step 3: Save to ClientProfile.services_offered ────────────────────────
    cp.services_offered = _json.dumps(services)
    session.add(cp)

    # ── Step 4: Upsert into MarketplaceService (skip exact name duplicates) ───
    existing = session.exec(
        select(MarketplaceService).where(
            MarketplaceService.provider_client_id == client_id,
            MarketplaceService.is_active == True,
        )
    ).all()
    existing_by_name = {s.service_name.lower(): s for s in existing}

    added = 0
    updated = 0
    for svc in services:
        svc_name = svc.get("name", "").strip()
        if not svc_name:
            continue
        key = svc_name.lower()
        if key in existing_by_name:
            # Update existing entry
            ms = existing_by_name[key]
            ms.description = svc.get("brief") or ms.description
            ms.category = svc.get("category") or ms.category
            ms.estimated_cost = float(svc.get("approx_cost", 0)) or ms.estimated_cost
            ms.source = scrape_method
            session.add(ms)
            updated += 1
        else:
            ms = MarketplaceService(
                service_name=svc_name,
                normalized_name=svc_name,
                category=svc.get("category"),
                description=svc.get("brief"),
                estimated_cost=float(str(svc.get("approx_cost", "0")).replace("$", "").replace(",", "").split("-")[0].strip() if str(svc.get("approx_cost", "0")).replace("$", "").replace(",", "").split("-")[0].strip().replace(".","").isdigit() else 0),
                cost_is_estimated=svc.get("cost_is_estimated", True),
                provider_name=company_name,
                provider_client_id=client_id,
                provider_industry=cp.industry,
                provider_address=cp.address,
                source=scrape_method,
                tenant_id=current_tenant_id.get(),
            )
            session.add(ms)
            existing_by_name[key] = ms
            added += 1

    session.commit()

    method_label = "live website" if scrape_method == "website_scrape" else "AI knowledge (site unreachable)"
    return {
        "ok": True,
        "services": services,
        "scrape_method": scrape_method,
        "marketplace_entries_added": added,
        "marketplace_entries_updated": updated,
        "message": f"Extracted {len(services)} services via {method_label}. Added {added} new + updated {updated} existing in Marketplace.",
    }



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
@app.get("/projects")
def list_projects(member_id: Optional[int] = None, session: Session = Depends(get_session)):
    q = select(Project).order_by(Project.id.desc())
    tenant_id = current_tenant_id.get()
    if tenant_id:
        q = q.where(Project.tenant_id == tenant_id)
        
    projects = session.exec(q).all()
    if member_id is not None:
        filtered = []
        for p in projects:
            if (p.employeeIds and member_id in p.employeeIds) or \
               (p.projectMemberIds and member_id in p.projectMemberIds) or \
               (p.clientIds and member_id in p.clientIds) or \
               (p.internIds and member_id in p.internIds):
                filtered.append(p)
        projects = filtered
    return {"projects": [_project_dict(p) for p in projects]}


@app.post("/projects")
def create_project(body: ProjectCreateRequest, session: Session = Depends(get_session)):
    p = Project(
        name=body.name,
        description=body.description,
        status=body.status,
        progress=body.progress,
        employeeIds=body.employeeIds,
        internIds=body.internIds,
        clientIds=body.clientIds,
        projectMemberIds=body.projectMemberIds,
        project_type=body.project_type,
        clientId=body.clientId,
        leadId=body.leadId,
        tenant_id=current_tenant_id.get()
    )
    session.add(p)
    session.commit()
    session.refresh(p)
    
    try:
        _notify_admins(
            session, current_tenant_id.get(),
            title=f"📁 New Project: {p.name}",
            message=f"Status: {p.status} | Progress: {p.progress}%",
            notif_type="info",
            link=f"/projects/{p.id}"
        )
    except Exception:
        pass
    
    # ── WHATSAPP NOTIFICATION ──
    try:
        from modules.whatsapp import send_ai_polished_whatsapp_message
        base_url = "https://crm-seo.allytechcourses.com"
        send_ai_polished_whatsapp_message("New Project Created", _project_dict(p), f"{base_url}/projects")
    except Exception as e:
        print("WhatsApp Error:", e)
        
    return {"project": _project_dict(p)}


@app.get("/projects/{project_id}")
def get_project(project_id: int, session: Session = Depends(get_session)):
    p = session.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    remarks = session.exec(select(Remark).where(Remark.projectId == project_id)).all()
    
    employees = []
    if p.employeeIds:
        employees = [{"id": e.id, "name": e.name, "email": e.email} for e in session.exec(select(User).where(User.id.in_(p.employeeIds))).all()]
        
    interns = []
    if p.internIds:
        interns = [{"id": i.id, "name": i.name, "email": i.email} for i in session.exec(select(User).where(User.id.in_(p.internIds))).all()]
        
    project_members = []
    if p.projectMemberIds:
        project_members = [{"id": pm.id, "name": pm.name, "email": pm.email} for pm in session.exec(select(User).where(User.id.in_(p.projectMemberIds))).all()]
        
    return {
        "project": _project_dict(p),
        "remarks": [
            {"id": r.id, "content": r.content, "createdAt": r.createdAt.isoformat()}
            for r in remarks
        ],
        "team": {
            "employees": employees,
            "interns": interns,
            "projectMembers": project_members
        }
    }


@app.get("/projects/{project_id}/dashboard")
def get_project_dashboard(project_id: int, session: Session = Depends(get_session)):
    """Return ticket-driven delivery metrics for a project dashboard."""
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    tickets = session.exec(
        select(ProjectTicket).where(ProjectTicket.project_id == project_id)
    ).all()
    team_ids = list(dict.fromkeys((project.employeeIds or []) + (project.projectMemberIds or []) + (project.internIds or [])))
    team_users = session.exec(select(User).where(User.id.in_(team_ids))).all() if team_ids else []

    states = ["Planning", "In Dev", "Given to QA", "Prod Release"]
    status_counts = {state: sum(1 for ticket in tickets if ticket.current_state == state) for state in states}
    production_count = sum(1 for ticket in tickets if ticket.date_release_prod or ticket.current_state == "Prod Release")

    def parse_date(value):
        if not value:
            return None
        try:
            return datetime.fromisoformat(str(value).replace("Z", "+00:00")).date()
        except (TypeError, ValueError):
            return None

    created_dates = [ticket.created_at.date() for ticket in tickets if ticket.created_at]
    released_dates = [parse_date(ticket.date_release_prod) for ticket in tickets]
    all_dates = [date for date in created_dates + [date for date in released_dates if date] if date]
    tracker = []
    if all_dates:
        start_date, end_date = min(all_dates), max(max(all_dates), datetime.utcnow().date())
        current = start_date
        while current <= end_date:
            created = sum(1 for date in created_dates if date <= current)
            released = sum(1 for date in released_dates if date and date <= current)
            tracker.append({"date": current.isoformat(), "created": created, "production": released})
            current += timedelta(days=1)

    developer_stats = []
    for member in team_users:
        names = {str(member.id), (member.name or "").strip().lower(), (member.email or "").strip().lower()}
        assigned = [ticket for ticket in tickets if (ticket.current_owner or "").strip().lower() in names]
        developer_stats.append({
            "id": member.id,
            "name": member.name or member.email,
            "email": member.email,
            "total": len(assigned),
            "done": sum(1 for ticket in assigned if ticket.date_release_prod or ticket.current_state == "Prod Release"),
            "not_started": sum(1 for ticket in assigned if ticket.current_state == "Planning"),
            "in_dev": sum(1 for ticket in assigned if ticket.current_state == "In Dev"),
            "in_qa": sum(1 for ticket in assigned if ticket.current_state == "Given to QA"),
        })

    assigned_names = {str(member.id).lower() for member in team_users} | {(member.name or "").strip().lower() for member in team_users} | {(member.email or "").strip().lower() for member in team_users}
    unassigned = sum(1 for ticket in tickets if not (ticket.current_owner or "").strip() or ticket.current_owner.strip().lower() not in assigned_names)
    return {
        "project_id": project_id,
        "tickets": {
            "total": len(tickets),
            "done": production_count,
            "not_started": status_counts["Planning"],
            "in_dev": status_counts["In Dev"],
            "in_qa": status_counts["Given to QA"],
            "in_production": status_counts["Prod Release"],
            "unassigned": unassigned,
            "status_counts": status_counts,
        },
        "developers": developer_stats,
        "developer_count": len(team_users),
        "tracker": tracker,
    }


@app.put("/projects/{project_id}")
def update_project(
    project_id: int, body: ProjectUpdateRequest, session: Session = Depends(get_session)
):
    p = session.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(p, field, val)
    p.updatedAt = datetime.utcnow()
    session.add(p)
    session.commit()
    session.refresh(p)
    
    # ── WHATSAPP NOTIFICATION ──
    try:
        from modules.whatsapp import send_ai_polished_whatsapp_message
        base_url = "https://crm-seo.allytechcourses.com"
        send_ai_polished_whatsapp_message("Project Updated", _project_dict(p), f"{base_url}/projects")
    except Exception as e:
        print("WhatsApp Error:", e)
        
    return {"project": _project_dict(p)}


@app.delete("/projects/{project_id}")
def delete_project(project_id: int, session: Session = Depends(get_session)):
    p = session.get(Project, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    session.delete(p)
    session.commit()
    return {"ok": True}


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


def _project_dict(p: Project) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "status": p.status,
        "progress": p.progress,
        "employeeIds": p.employeeIds or [],
        "internIds": p.internIds or [],
        "clientIds": p.clientIds or [],
        "projectMemberIds": p.projectMemberIds or [],
        "project_type": p.project_type,
        "clientId": p.clientId,
        "leadId": p.leadId,
        "createdAt": p.createdAt.isoformat(),
        "updatedAt": p.updatedAt.isoformat(),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Services (Catalog + Requests)
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/services")
def list_services(session: Session = Depends(get_session)):
    svcs = session.exec(select(ServiceCatalog).where(ServiceCatalog.is_active == True)).all()
    return {
        "services": [
            {
                "id": s.id,
                "name": s.name,
                "cost": s.cost,
                "intro_description": s.intro_description,
                "full_description": s.full_description,
                "handler_role": s.handler_role,
                "image_url": s.image_url,
                "past_results": s.past_results,
            }
            for s in svcs
        ]
    }


@app.post("/services")
def create_service(body: ServiceCreateRequest, session: Session = Depends(get_session)):
    svc = ServiceCatalog(**body.model_dump())
    session.add(svc)
    session.commit()
    session.refresh(svc)
    return {"service": {"id": svc.id, "name": svc.name}}


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


@app.get("/services/requests")
def all_service_requests(session: Session = Depends(get_session)):
    reqs = session.exec(select(ServiceRequest)).all()
    result = []
    for r in reqs:
        cp = session.get(ClientProfile, r.client_id)
        user = session.get(User, cp.userId) if cp and cp.userId else None
        svc = session.get(ServiceCatalog, r.service_id)
        emp = session.get(User, r.assigned_employee_id) if r.assigned_employee_id else None
        result.append(
            {
                "id": r.id,
                "status": r.status,
                "service_id": r.service_id,
                "service_name": svc.name if svc else None,
                "client_id": r.client_id,
                "client_name": user.name if user else None,
                "client_email": user.email if user else None,
                "assigned_employee_id": r.assigned_employee_id,
                "assigned_employee_name": emp.name if emp else None,
                "quoted_amount": r.quoted_amount,
                "quote_message": r.quote_message,
                "quote_doc_url": r.quote_doc_url,
                "team_info": r.team_info,
                "requested_at": r.requested_at.isoformat(),
                "quote_sent_at": r.quote_sent_at.isoformat() if r.quote_sent_at else None,
            }
        )
    return {"requests": result}


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
@app.get("/admin/services-overview")
def admin_services_overview(session: Session = Depends(get_session)):
    reqs = session.exec(select(ServiceRequest)).all()
    statuses = {}
    for r in reqs:
        statuses[r.status] = statuses.get(r.status, 0) + 1
    svcs = session.exec(select(ServiceCatalog)).all()
    return {
        "total_requests": len(reqs),
        "by_status": statuses,
        "services": [{"id": s.id, "name": s.name, "active": s.is_active} for s in svcs],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Messages
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/messages/{user_id}")
def get_message_threads(user_id: int, session: Session = Depends(get_session)):
    from collections import defaultdict

    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.role in ("Admin", "Employee"):
        threads = session.exec(select(MessageThread)).all()
    else:
        cp = session.exec(select(ClientProfile).where(ClientProfile.userId == user_id)).first()
        if not cp:
            return {"threads": []}
        threads = session.exec(
            select(MessageThread).where(MessageThread.client_id == cp.id)
        ).all()

    if not threads:
        return {"threads": []}

    thread_ids = [t.id for t in threads]

    # Batch-fetch service requests
    sr_ids = list({t.service_request_id for t in threads if t.service_request_id})
    service_requests: dict = {}
    if sr_ids:
        service_requests = {
            sr.id: sr
            for sr in session.exec(select(ServiceRequest).where(ServiceRequest.id.in_(sr_ids))).all()
        }

    # Batch-fetch service catalog entries
    svc_ids = list({sr.service_id for sr in service_requests.values() if sr.service_id})
    services: dict = {}
    if svc_ids:
        services = {
            s.id: s
            for s in session.exec(select(ServiceCatalog).where(ServiceCatalog.id.in_(svc_ids))).all()
        }

    # Batch-fetch all messages for all threads in one query
    all_messages = session.exec(
        select(ChatMessage)
        .where(ChatMessage.thread_id.in_(thread_ids))
        .order_by(ChatMessage.thread_id, ChatMessage.timestamp)
    ).all()

    # Collect all user IDs needed (employees + message senders)
    user_ids_needed = {t.employee_id for t in threads if t.employee_id}
    user_ids_needed.update(m.sender_id for m in all_messages)
    users_map: dict = {}
    if user_ids_needed:
        users_map = {
            u.id: u
            for u in session.exec(select(User).where(User.id.in_(list(user_ids_needed)))).all()
        }

    # Group messages by thread_id
    msgs_by_thread: dict = defaultdict(list)
    for m in all_messages:
        msgs_by_thread[m.thread_id].append(m)

    result = []
    for t in threads:
        sr = service_requests.get(t.service_request_id)
        svc = services.get(sr.service_id) if sr else None
        emp = users_map.get(t.employee_id) if t.employee_id else None
        msgs = msgs_by_thread.get(t.id, [])
        last_message = msgs[-1] if msgs else None
        last_sender_user = users_map.get(last_message.sender_id) if last_message else None
        unread_count = sum(
            1 for m in msgs if m.sender_id != user_id and not m.is_read
        )
        has_unanswered = False
        if last_message and last_message.sender_id != user_id and user.role in ("Admin", "Employee"):
            sender_role = last_sender_user.role if last_sender_user else None
            if sender_role == "Client":
                has_unanswered = True

        result.append(
            {
                "thread_id": t.id,
                "service_request_id": t.service_request_id,
                "service_name": svc.name if svc else "Service",
                "service_status": sr.status if sr else "Unknown",
                "handler": emp.name if emp else "Support Team",
                "unread_count": unread_count,
                "has_unanswered": has_unanswered,
                "last_message": last_message.content if last_message else None,
                "last_sender": _get_sender_name_from_map(last_message.sender_id, users_map) if last_message else None,
                "last_message_timestamp": last_message.timestamp.isoformat() if last_message else None,
                "messages": [
                    {
                        "id": m.id,
                        "sender": _get_sender_name_from_map(m.sender_id, users_map),
                        "content": m.content,
                        "timestamp": m.timestamp.isoformat(),
                        "isMe": m.sender_id == user_id,
                        "is_read": m.is_read,
                    }
                    for m in msgs
                ],
            }
        )
    return {"threads": result}


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
@app.get("/calls")
def list_calls(unsummarized: Optional[bool] = None, session: Session = Depends(get_session)):
    q = select(CallLog).order_by(CallLog.received_at.desc())
    tenant_id = current_tenant_id.get()
    if tenant_id:
        q = q.where(CallLog.tenant_id == tenant_id)
        
    calls = session.exec(q).all()
    result = []
    for c in calls:
        d = _call_dict(c, session)
        if unsummarized is True and d.get("summary"):
            continue
        result.append(d)
    return {"calls": result}


@app.post("/calls")
def log_call(body: CallCreateRequest, session: Session = Depends(get_session)):
    tenant_id = current_tenant_id.get()
    
    # Check limit for Demo users
    if tenant_id:
        tenant = session.get(Tenant, tenant_id)
        if tenant:
            user = session.exec(select(User).where(User.tenant_id == tenant_id)).first()
            if user and user.role == "Demo":
                if tenant.usage_calls >= tenant.limit_calls:
                    raise HTTPException(status_code=403, detail=f"Demo limit reached. You can only log up to {tenant.limit_calls} calls/pitches.")
                tenant.usage_calls += 1
                session.add(tenant)
                
    c = CallLog(
        phone_number=body.phone_number,
        duration_seconds=body.duration_seconds,
        description=getattr(body, "description", None),
        work_done=getattr(body, "work_done", None),
        assigned_to=getattr(body, "assigned_to", None),
        followup_needed=getattr(body, "followup_needed", False),
        followup_date=getattr(body, "followup_date", None),
        client_id=getattr(body, "client_id", None),
        tenant_id=tenant_id
    )
    session.add(c)
    session.commit()
    session.refresh(c)
    
    # ── WHATSAPP NOTIFICATION ──
    try:
        from modules.whatsapp import send_ai_polished_whatsapp_message
        base_url = "https://crm-seo.allytechcourses.com"
        call_link = f"{base_url}/calls" if not c.client_id else f"{base_url}/clients/{c.client_id}"
        send_ai_polished_whatsapp_message("Call Logged", _call_dict(c), call_link)
    except Exception as e:
        print("WhatsApp Error:", e)
        
    return {"call": _call_dict(c)}


@app.put("/calls/{call_id}")
@app.patch("/calls/{call_id}")
def update_call(
    call_id: int, body: Dict[str, Any], session: Session = Depends(get_session)
):
    c = session.get(CallLog, call_id)
    if not c:
        raise HTTPException(status_code=404, detail="Call not found")
    for field, val in body.items():
        if hasattr(c, field):
            setattr(c, field, val)
    session.add(c)
    session.commit()
    session.refresh(c)
    
    # ── WHATSAPP NOTIFICATION ──
    try:
        from modules.whatsapp import send_ai_polished_whatsapp_message
        base_url = "https://crm-seo.allytechcourses.com"
        call_link = f"{base_url}/calls" if not c.client_id else f"{base_url}/clients/{c.client_id}"
        send_ai_polished_whatsapp_message("Call Updated", _call_dict(c), call_link)
    except Exception as e:
        print("WhatsApp Error:", e)
        
    return {"call": _call_dict(c)}


@app.post("/calls/{call_id}/summary")
def add_call_summary(
    call_id: int, body: CallSummaryRequest, session: Session = Depends(get_session)
):
    c = session.get(CallLog, call_id)
    if not c:
        raise HTTPException(status_code=404, detail="Call not found")
    if hasattr(c, "summary"):
        c.summary = body.summary if hasattr(body, "summary") else None
        session.add(c)
        session.commit()
    return {"ok": True}


def _call_dict(c: CallLog, session: Session = None) -> dict:
    d = {
        "id": c.id,
        "phone_number": c.phone_number,
        "received_at": c.received_at.isoformat(),
        "duration_seconds": c.duration_seconds,
        "summary": getattr(c, "summary", None),
        "description": getattr(c, "description", None),
        "work_done": getattr(c, "work_done", None),
        "assigned_to": getattr(c, "assigned_to", None),
        "followup_needed": getattr(c, "followup_needed", False),
        "followup_date": getattr(c, "followup_date", None),
        "client_id": getattr(c, "client_id", None),
    }
    
    if session and c.client_id:
        from database import ClientProfile
        cp = session.get(ClientProfile, c.client_id)
        if cp:
            d["entity_name"] = cp.companyName or cp.projectName
            
    if not d.get("entity_name") and c.summary:
        if c.summary.startswith("AI Pitch Simulation for "):
            d["entity_name"] = c.summary.replace("AI Pitch Simulation for ", "")
        elif c.summary.startswith("Pitch Generation for "):
            d["entity_name"] = c.summary.replace("Pitch Generation for ", "")
            
    return d


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

def _sched_dict(s: ScheduledCall) -> dict:
    return {
        "id": s.id,
        "title": s.title,
        "scheduled_at": s.scheduled_at.isoformat() if s.scheduled_at else None,
        "entity_type": s.entity_type,
        "entity_id": s.entity_id,
        "entity_name": s.entity_name,
        "entity_email": s.entity_email,
        "pitch": s.pitch,
        "notes": s.notes,
        "assigned_to": s.assigned_to,
        "status": s.status,
        "created_at": s.created_at.isoformat(),
    }

@app.get("/scheduled-calls")
def list_scheduled_calls(session: Session = Depends(get_session)):
    items = session.exec(select(ScheduledCall).order_by(ScheduledCall.scheduled_at.asc())).all()
    return {"scheduled_calls": [_sched_dict(s) for s in items]}

@app.post("/scheduled-calls")
def create_scheduled_call(body: ScheduledCallCreateRequest, session: Session = Depends(get_session)):
    dt = None
    if body.scheduled_at:
        try:
            dt = datetime.fromisoformat(body.scheduled_at)
        except Exception:
            dt = None

    sc = ScheduledCall(
        title=body.title,
        scheduled_at=dt,
        entity_type=body.entity_type,
        entity_id=body.entity_id,
        entity_name=body.entity_name,
        entity_email=body.entity_email,
        pitch=body.pitch,
        notes=body.notes,
        assigned_to=body.assigned_to,
    )
    session.add(sc)
    session.commit()
    session.refresh(sc)

    # Send email notification if entity_email provided
    if body.entity_email:
        try:
            dt_str = dt.strftime("%Y-%m-%d %H:%M") if dt else "TBD"
            pitch_section = f"\n\n📋 Pitch Prepared:\n{body.pitch}" if body.pitch else ""
            subject = f"📞 Call Scheduled: {body.title}"
            content = (
                f"Hello {body.entity_name or ''},\n\n"
                f"A call has been scheduled for you.\n\n"
                f"📅 Date & Time: {dt_str}\n"
                f"📌 Topic: {body.title}\n"
                f"{pitch_section}\n\n"
                f"Our team will reach out at the scheduled time.\n\n"
                f"Thanks,\nSerpHawk CRM"
            )
            _send_notification_email(body.entity_email, subject, content)
        except Exception as e:
            print("Scheduled call email error:", e)

    # ── WHATSAPP NOTIFICATION ──
    try:
        from modules.whatsapp import send_ai_polished_whatsapp_message
        base_url = "https://crm-seo.allytechcourses.com"
        send_ai_polished_whatsapp_message("Scheduled Call Created", _sched_dict(sc), f"{base_url}/calls")
    except Exception as e:
        print("WhatsApp Error:", e)
        
    return {"scheduled_call": _sched_dict(sc)}

@app.put("/scheduled-calls/{sc_id}")
def update_scheduled_call(sc_id: int, body: Dict[str, Any], session: Session = Depends(get_session)):
    sc = session.get(ScheduledCall, sc_id)
    if not sc:
        raise HTTPException(status_code=404, detail="Scheduled call not found")
    for k, v in body.items():
        if hasattr(sc, k):
            setattr(sc, k, v)
    session.add(sc)
    session.commit()
    session.refresh(sc)
    
    # ── WHATSAPP NOTIFICATION ──
    try:
        from modules.whatsapp import send_ai_polished_whatsapp_message
        base_url = "https://crm-seo.allytechcourses.com"
        send_ai_polished_whatsapp_message("Scheduled Call Updated", _sched_dict(sc), f"{base_url}/calls")
    except Exception as e:
        print("WhatsApp Error:", e)
        
    return {"scheduled_call": _sched_dict(sc)}

@app.delete("/scheduled-calls/{sc_id}")
def delete_scheduled_call(sc_id: int, session: Session = Depends(get_session)):
    sc = session.get(ScheduledCall, sc_id)
    if not sc:
        raise HTTPException(status_code=404, detail="Scheduled call not found")
    session.delete(sc)
    session.commit()
    return {"ok": True}


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
@app.post("/generate")
def generate_email(body: GenerateEmailRequest, background_tasks: BackgroundTasks = None):
    try:
        from modules.llm_engine import generate_email as _gen, analyze_content
        from modules.scraper import scrape_website
        from modules.email_sender import send_email_outlook
        import os
        from database import SentEmail
        import json
        session = next(get_session())

        # --- Static Email Template ---
        OUTREACH_SUBJECT = "Let's grow {company_name} together!"
        OUTREACH_BODY_EN = (
            "Hi {company_name},\n\n"
            "We'd love to help {company_name} grow online with our services: {services}.\n\n"
            "Best,\nDapros Team"
        )
        OUTREACH_BODY_ES = (
            "Hola {company_name},\n\n"
            "Nos encantaría ayudar a {company_name} a crecer en línea con nuestros servicios: {services}.\n\n"
            "Saludos,\nEquipo Dapros"
        )
        INBOUND_SUBJECT = "Thank you for reaching out, {company_name}!"
        INBOUND_BODY_EN = (
            "Hi {company_name},\n\n"
            "Thank you for your interest in our services: {services}. We'll get back to you soon.\n\n"
            "Best,\nDapros Team"
        )
        INBOUND_BODY_ES = (
            "Hola {company_name},\n\n"
            "Gracias por su interés en nuestros servicios: {services}. Nos pondremos en contacto pronto.\n\n"
            "Saludos,\nEquipo Dapros"
        )


        # Always use LLM to analyze and generate email, even if only company name or email is provided
        if body.company_url:
            text = scrape_website(body.company_url)
        else:
            text = f"{body.company_name or ''} {body.to_email or ''}"
            # Use LLM for company research, service mapping, and draft generation based on company name and website (no scraping)
            llm_input = f"Company Name: {body.company_name or ''}\nWebsite: {body.company_url or ''}"
            analysis = analyze_content(llm_input)
            company_name = analysis.get("company_name") or body.company_name or "Your Company"
            services = ", ".join(analysis.get("key_value_props") or ["SEO", "PPC", "Web Development"])
            # Try to extract company email from analysis.contacts
            company_email = None
            contacts = analysis.get("contacts") or []
            for c in contacts:
                if c.get("email"):
                    company_email = c["email"]
                    break
            # Use LLM to generate outreach and inbound drafts
            outreach_llm = _gen(analysis)
            inbound_llm = _gen(analysis)
            outreach_subject = outreach_llm.get("subject") or OUTREACH_SUBJECT.format(company_name=company_name)
            outreach_body_en = outreach_llm.get("english_body") or OUTREACH_BODY_EN.format(company_name=company_name, services=services)
            outreach_body_es = outreach_llm.get("spanish_body") or OUTREACH_BODY_ES.format(company_name=company_name, services=services)
            inbound_subject = inbound_llm.get("subject") or INBOUND_SUBJECT.format(company_name=company_name)
            inbound_body_en = inbound_llm.get("english_body") or INBOUND_BODY_EN.format(company_name=company_name, services=services)
            inbound_body_es = inbound_llm.get("spanish_body") or INBOUND_BODY_ES.format(company_name=company_name, services=services)

        sender = body.sender_email or os.getenv("EMAIL_SENDER") or os.getenv("OUTLOOK_EMAIL", "crm@serphawk.in")
        password = os.getenv("EMAIL_PASSWORD") or os.getenv("OUTLOOK_PASSWORD", "")
        smtp_server = os.getenv("EMAIL_HOST") or os.getenv("SMTP_SERVER", "smtp.gmail.com")
        smtp_port = os.getenv("EMAIL_PORT") or os.getenv("SMTP_PORT", 587)
        imap_server = os.getenv("IMAP_SERVER")

        # Only send the email if manual is False and all required fields are present
        if not body.manual and all([body.to_email, body.subject, body.body, sender, password]):
            try:
                send_email_outlook(
                    to_email=body.to_email,
                    subject=body.subject,
                    body=body.body,
                    sender_email=sender,
                    sender_password=password,
                    smtp_server=smtp_server,
                    smtp_port=smtp_port,
                    imap_server=imap_server
                )
                
                # --- Trigger n8n Webhook ---
                try:
                    import httpx
                    webhook_url = "http://localhost:5678/webhook-test/serphawk-followup"
                    payload = {
                        "event": "email_sent",
                        "sender": sender,
                        "to_email": body.to_email,
                        "subject": body.subject,
                        "company": company_name,
                        "timestamp": datetime.utcnow().isoformat()
                    }
                    httpx.post(webhook_url, json=payload, timeout=5.0)
                    print(f"Webhook successfully triggered to {webhook_url}")
                except Exception as wh_e:
                    print(f"Webhook trigger failed: {wh_e}")
                    
            except Exception as e:
                print(f"Email send failed: {e}")
        # If any required field is missing, skip sending and just generate the draft

        # Only save to database if required fields are present
        # Provide default subject and content if missing, so frontend always gets a visible draft
        # Build the draft object for both outreach and inbound
        draft_obj = {
            "outreach": {
                "subject": outreach_subject,
                "english_body": outreach_body_en,
                "spanish_body": outreach_body_es,
            },
            "inbound": {
                "subject": inbound_subject,
                "english_body": inbound_body_en,
                "spanish_body": inbound_body_es,
            },
            "company_name": company_name,
            "services": services,
                "to_email": company_email or body.to_email,
            "manual": body.manual,
            "sent_at": datetime.utcnow().isoformat(),
            "client_id": body.client_id
        }
        # Always save the email and log activity, even if some fields are missing
        client_id = body.client_id
        if not client_id:
            from database import ClientProfile
            # Try to find existing client by email
            existing_client = session.exec(select(ClientProfile).where(ClientProfile.email == body.to_email)).first() if hasattr(ClientProfile, 'email') else None
            if existing_client:
                client_id = existing_client.id
            else:
                # Create new client profile
                cp = ClientProfile(
                    companyName=draft_obj["company_name"] or "Unknown Company",
                    email=body.to_email or f"unknown_contact_{datetime.utcnow().timestamp()}@placeholder.com",
                    status="Active"
                )
                session.add(cp)
                session.commit()
                session.refresh(cp)
                client_id = cp.id
        # Save the outreach draft to DB, using placeholders if needed
        email_db_obj = {
            "to_email": body.to_email or f"unknown_contact_{datetime.utcnow().timestamp()}@placeholder.com",
            "subject": draft_obj["outreach"].get("subject") or "[No Subject]",
            "english_body": draft_obj["outreach"].get("english_body") or "[No Body]",
            "spanish_body": draft_obj["outreach"].get("spanish_body") or "[No Spanish Body]",
            "recommended_services": draft_obj.get("services") or "",
            "manual": body.manual,
            "draft_json": json.dumps(draft_obj),
            "sent_at": draft_obj["sent_at"],
            "client_id": client_id
        }
        sent_email = SentEmail(**email_db_obj)
        session.add(sent_email)
        session.commit()
        session.refresh(sent_email)

        # --- Log activity for this client ---
        from database import ActivityLog
        activity = ActivityLog(
            clientId=client_id,
            action="Email Generated",
            method="Email",
            content=f"Generated outreach email for {draft_obj.get('company_name') or '[Unknown Company]'} ({body.company_url or ''}) to {body.to_email or '[Unknown Email]'}",
            details=draft_obj["outreach"].get("subject") or "[No Subject]"
        )
        session.add(activity)
        session.commit()

        # Schedule LLM draft generation in the background if needed
        if background_tasks is not None:
            background_tasks.add_task(generate_llm_draft_task, sent_email.id, body.dict())

        return {"ok": True, "email_id": sent_email.id, "draft": draft_obj, "client_id": client_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
@app.get("/dashboard-stats")
def dashboard_stats(
    role: str = Query("Client"),
    email: str = Query(""),
    session: Session = Depends(get_session),
):
    if role == "SalesManager":
        user = session.exec(select(User).where(User.email == email)).first()
        if not user:
            return {"error": "User not found"}
        
        assigned_leads_count = session.exec(
            select(func.count(Lead.id)).where(Lead.owner_id == user.id)
        ).first() or 0
        
        assigned_contacts_count = session.exec(
            select(func.count(Contact.id)).where(Contact.owner_id == user.id)
        ).first() or 0
        
        assigned_clients_count = session.exec(
            select(func.count(ClientProfile.id)).where(ClientProfile.assignedEmployeeId == user.id)
        ).first() or 0
        
        recent_meetings = session.exec(
            select(Meeting).where(Meeting.host_id == user.id).order_by(Meeting.scheduled_at.desc()).limit(5)
        ).all()
        
        recent_calls = session.exec(
            select(CallLog).where(
                or_(CallLog.assigned_to == user.name, CallLog.assigned_to == str(user.id))
            ).order_by(CallLog.createdAt.desc()).limit(5)
        ).all()
        
        activities = []
        for m in recent_meetings:
            activities.append({
                "type": "Meeting",
                "title": m.title,
                "date": m.scheduled_at.isoformat() if m.scheduled_at else None,
                "status": m.status
            })
        for c in recent_calls:
            activities.append({
                "type": "Call",
                "title": c.summary or f"Call to {c.phone_number}",
                "date": c.createdAt.isoformat() if c.createdAt else None,
                "status": "Completed"
            })
            
        activities.sort(key=lambda x: x["date"] or "", reverse=True)
        
        return {
            "isSalesManager": True,
            "metrics": {
                "assigned_leads": assigned_leads_count,
                "assigned_contacts": assigned_contacts_count,
                "assigned_clients": assigned_clients_count
            },
            "recent_activity": activities[:5]
        }


    if role == "Demo":
        user = session.exec(select(User).where(User.email == email)).first()
        if not user:
            return {"error": "User not found"}
        
        # Read usage from tenant record (the authoritative source)
        tenant = session.get(Tenant, user.tenant_id) if user.tenant_id else None
        
        if tenant:
            return {
                "isDemo": True,
                "usage": {
                    "clients_leads": tenant.usage_clients,
                    "email_agent": tenant.usage_emails,
                    "radar": tenant.usage_searches
                },
                "limits": {
                    "clients_leads": tenant.limit_clients,
                    "email_agent": tenant.limit_emails,
                    "radar": tenant.limit_searches
                }
            }
        
        # Fallback if no tenant
        return {
            "isDemo": True,
            "usage": {"clients_leads": 0, "email_agent": 0, "radar": 0},
            "limits": {"clients_leads": 15, "email_agent": 5, "radar": 5}
        }

    if role in ["Client", "ProjectMember", "Intern"]:
        user = session.exec(select(User).where(User.email == email)).first()
        if not user:
            return {"isClient": True}
        cp = session.exec(select(ClientProfile).where(ClientProfile.userId == user.id)).first()
        if not cp:
            return {"isClient": True, "error": "No ClientProfile found"}

        service_reqs = session.exec(
            select(ServiceRequest).where(ServiceRequest.client_id == cp.id)
        ).all()
        active_services = [
            r for r in service_reqs if r.status in ("Accepted", "In Progress")
        ]
        pending_quotes = [r for r in service_reqs if r.status == "Quoted"]

        # Resolve service names for active services and quotes
        def _resolve_service_name(service_id):
            if not service_id:
                return "Service"
            svc = session.get(ServiceCatalog, service_id)
            return svc.name if svc else "Service"

        # Milestones for this client
        milestones = session.exec(
            select(Milestone)
            .where(Milestone.client_id == cp.id)
            .order_by(Milestone.order, Milestone.created_at)
        ).all()

        # Invoices for this client
        invoices = session.exec(
            select(Invoice)
            .where(Invoice.client_id == cp.id)
            .order_by(Invoice.created_at.desc())
        ).all()

        # Files for this client
        files = session.exec(
            select(ClientFileUpload)
            .where(ClientFileUpload.client_id == cp.id)
            .order_by(ClientFileUpload.created_at.desc())
        ).all()

        # Recent activities for this client
        activities = session.exec(
            select(ActivityLog)
            .where(ActivityLog.clientId == cp.id)
            .order_by(ActivityLog.createdAt.desc())
            .limit(20)
        ).all()

        # Notifications for this user
        notifications = session.exec(
            select(Notification)
            .where(Notification.user_id == user.id)
            .order_by(Notification.created_at.desc())
            .limit(10)
        ).all()

        # Proposals for this client
        proposals = session.exec(
            select(Proposal)
            .where(Proposal.client_id == cp.id)
            .order_by(Proposal.created_at.desc())
        ).all()

        # Projects for this user/client (clientIds or projectMemberIds is a JSON list)
        all_projects = session.exec(select(Project)).all()
        if cp:
            projects = [p for p in all_projects if cp.id in (p.clientIds or [])]
        else:
            projects = [p for p in all_projects if user.id in (p.projectMemberIds or []) or user.id in (p.employeeIds or []) or user.id in (p.internIds or [])]

        # Invoice summary stats
        total_billed = sum(inv.total for inv in invoices)
        total_paid = sum(inv.total for inv in invoices if inv.status == "Paid")
        total_pending_inv = sum(inv.total for inv in invoices if inv.status in ("Sent", "Draft"))
        total_overdue = sum(inv.total for inv in invoices if inv.status == "Overdue")

        return {
            "isClient": True,
            "companyName": cp.companyName if cp else user.name,
            "projectName": cp.projectName if cp else "",
            "website": cp.websiteUrl if cp else "",
            "status": cp.status if cp else "Active",
            "seoStrategy": cp.seoStrategy if cp else "",
            "recommended_services": cp.recommended_services if cp else "",
            "targetKeywords": cp.targetKeywords if cp else [],
            "nextMilestone": cp.nextMilestone if cp else "",
            "nextMilestoneDate": cp.nextMilestoneDate if cp else "",
            "active_services_list": [
                {"id": r.id, "service_id": r.service_id, "status": r.status, "service_name": _resolve_service_name(r.service_id)}
                for r in active_services
            ] if cp else [],
            "pending_quotes_list": [
                {
                    "id": r.id,
                    "service_id": r.service_id,
                    "quoted_amount": r.quoted_amount,
                    "quote_message": r.quote_message,
                    "service_name": _resolve_service_name(r.service_id),
                }
                for r in pending_quotes
            ] if cp else [],
            "pending_requests_count": len([r for r in service_reqs if r.status == "Pending"]) if cp else 0,
            "milestones": [
                {
                    "id": m.id, "title": m.title, "description": m.description,
                    "due_date": m.due_date, "status": m.status, "order": m.order,
                    "created_at": m.created_at.isoformat() if m.created_at else None,
                }
                for m in milestones
            ] if cp else [],
            "invoices": [
                {
                    "id": inv.id, "invoice_number": inv.invoice_number,
                    "amount": inv.amount, "tax": inv.tax, "total": inv.total,
                    "status": inv.status, "due_date": inv.due_date,
                    "notes": inv.notes, "line_items": inv.line_items or [],
                    "paid_at": inv.paid_at.isoformat() if inv.paid_at else None,
                    "created_at": inv.created_at.isoformat() if inv.created_at else None,
                }
                for inv in invoices
            ] if cp else [],
            "invoice_summary": {
                "total_billed": total_billed if cp else 0,
                "total_paid": total_paid if cp else 0,
                "total_pending": total_pending_inv if cp else 0,
                "total_overdue": total_overdue if cp else 0,
            },
            "files": [
                {
                    "id": f.id, "filename": f.filename, "file_url": f.file_url,
                    "file_size": f.file_size, "mime_type": f.mime_type,
                    "description": f.description, "created_at": f.created_at.isoformat() if f.created_at else None,
                }
                for f in files
            ] if cp else [],
            "activities": [
                {
                    "id": a.id, "action": a.action, "method": a.method,
                    "content": a.content, "details": a.details,
                    "createdAt": a.createdAt.isoformat(),
                }
                for a in activities
            ] if cp else [],
            "notifications": [
                {
                    "id": n.id, "title": n.title, "message": n.message,
                    "type": n.type, "link": n.link, "is_read": n.is_read,
                    "created_at": n.created_at.isoformat() if n.created_at else None,
                }
                for n in notifications
            ],
            "unread_notifications_count": sum(1 for n in notifications if not n.is_read),
            "proposals": [
                {
                    "id": p.id, "title": p.title, "status": p.status,
                    "total_value": p.total_value, "valid_until": p.valid_until,
                    "created_at": p.created_at.isoformat() if p.created_at else None,
                }
                for p in proposals
            ] if cp else [],
            "projects": [
                {
                    "id": p.id, "name": p.name, "status": p.status,
                    "progress": p.progress,
                    "created_at": p.createdAt.isoformat() if p.createdAt else None,
                }
                for p in projects
            ],
        }

    # Admin / Employee stats
    total_clients = len(session.exec(select(ClientProfile)).all())
    active_clients = len(
        session.exec(select(ClientProfile).where(ClientProfile.status == "Active")).all()
    )
    pending_clients = len(
        session.exec(select(ClientProfile).where(ClientProfile.status == "Pending")).all()
    )
    hold_clients = len(
        session.exec(select(ClientProfile).where(ClientProfile.status == "Hold")).all()
    )
    total_projects = len(session.exec(select(Project)).all())
    total_employees = len(
        session.exec(select(User).where(User.role == "Employee").where(User.tenant_id == current_tenant_id.get())).all()
    )
    total_interns = len(
        session.exec(select(User).where(User.role == "Intern").where(User.tenant_id == current_tenant_id.get())).all()
    )
    total_activities = len(session.exec(select(ActivityLog)).all())
    total_calls = len(session.exec(select(CallLog)).all())

    try:
        from database import MarketplaceService
        total_marketplace = len(session.exec(select(MarketplaceService)).all())
    except:
        total_marketplace = 0

    # Build real 7-day chart data from database
    labels = []
    activity_chart = []
    email_chart = []
    call_chart = []
    all_activities = session.exec(select(ActivityLog)).all()
    all_emails = session.exec(select(SentEmail)).all()
    all_calls_list = session.exec(select(CallLog)).all()
    total_emails_sent = len(all_emails)
    for i in range(6, -1, -1):
        day = datetime.utcnow() - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        labels.append(day.strftime("%b %d"))
        activity_chart.append(sum(1 for a in all_activities if a.createdAt and day_start <= a.createdAt < day_end))
        email_chart.append(sum(1 for e in all_emails if e.sent_at and day_start <= e.sent_at < day_end))
        call_chart.append(sum(1 for c in all_calls_list if c.createdAt and day_start <= c.createdAt < day_end))

    import calendar
    all_invoices = session.exec(select(Invoice)).all()
    all_quotes = session.exec(select(CRMQuote)).all()
    all_sales_orders = session.exec(select(SalesOrder)).all()
    all_purchase_orders = session.exec(select(PurchaseOrder)).all()
    all_service_reqs = session.exec(select(ServiceRequest)).all()

    def _billing_value(row):
        return getattr(row, "grand_total", None) or getattr(row, "total", None) or 0

    revenue_data = []
    today = datetime.utcnow()
    for i in range(5, -1, -1):
        target_month = today.month - i
        target_year = today.year
        while target_month <= 0:
            target_month += 12
            target_year -= 1
            
        month_start = datetime(target_year, target_month, 1)
        next_month = target_month + 1
        next_year = target_year
        if next_month > 12:
            next_month = 1
            next_year += 1
        month_end = datetime(next_year, next_month, 1)
        
        def _in_month(row):
            v = getattr(row, "created_at", None)
            return bool(v and month_start <= v < month_end)
        
        # Money in: quotes + paid invoices + sales orders created this month.
        rev = (
            sum(_billing_value(q) for q in all_quotes if _in_month(q))
            + sum(_billing_value(inv) for inv in all_invoices if inv.status == "Paid" and _in_month(inv))
            + sum(_billing_value(o) for o in all_sales_orders if _in_month(o))
        )
        # Money out: purchase orders created this month.
        exp = sum(_billing_value(po) for po in all_purchase_orders if _in_month(po))
        revenue_data.append({"name": calendar.month_abbr[target_month], "revenue": rev, "expenses": exp})
        
    pipeline_data = [
        {"stage": "Prospecting", "count": pending_clients},
        {"stage": "Qualification", "count": len([r for r in all_service_reqs if r.status == "Pending"])},
        {"stage": "Proposal", "count": len([r for r in all_service_reqs if r.status == "Quoted"])},
        {"stage": "Negotiation", "count": len([r for r in all_service_reqs if r.status == "In Progress"])},
        {"stage": "Closed Won", "count": len([r for r in all_service_reqs if r.status == "Accepted"])},
    ]

    recent_activities = session.exec(
        select(ActivityLog).order_by(ActivityLog.createdAt.desc()).limit(10)
    ).all()

    all_proposals = session.exec(select(Proposal)).all()
    total_revenue = sum(inv.total or 0 for inv in all_invoices if inv.status == "Paid")
    total_pipeline_value = sum(p.total_value or 0 for p in all_proposals if p.status not in ("Accepted", "Declined"))

    total_quotes_value = sum(_billing_value(q) for q in all_quotes)
    accepted_quotes_value = sum(_billing_value(q) for q in all_quotes if q.status == "Accepted")
    total_quotes_count = len(all_quotes)
    accepted_quotes_count = sum(1 for q in all_quotes if q.status == "Accepted")

    total_sales_orders_value = sum(_billing_value(o) for o in all_sales_orders)
    fulfilled_sales_orders_value = sum(_billing_value(o) for o in all_sales_orders if o.status in ("Fulfilled", "Paid", "Completed"))
    total_sales_orders_count = len(all_sales_orders)
    fulfilled_sales_orders_count = sum(1 for o in all_sales_orders if o.status in ("Fulfilled", "Paid", "Completed"))

    total_purchase_orders_value = sum(_billing_value(po) for po in all_purchase_orders)
    received_purchase_orders_value = sum(_billing_value(po) for po in all_purchase_orders if po.status in ("Received", "Completed"))
    total_purchase_orders_count = len(all_purchase_orders)
    received_purchase_orders_count = sum(1 for po in all_purchase_orders if po.status in ("Received", "Completed"))

    total_invoices_value = sum(inv.total or 0 for inv in all_invoices)
    paid_invoices_value = sum(inv.total or 0 for inv in all_invoices if inv.status == "Paid")
    sent_invoices_value = sum(inv.total or 0 for inv in all_invoices if inv.status == "Sent")
    overdue_invoices_value = sum(inv.total or 0 for inv in all_invoices if inv.status == "Overdue")
    partial_invoices_value = sum(inv.total or 0 for inv in all_invoices if inv.status == "Partial")
    paid_invoices_count = sum(1 for inv in all_invoices if inv.status == "Paid")
    total_invoices_count = len(all_invoices)

    return {
        "revenue": total_revenue,
        "pipelineValue": total_pipeline_value,
        "totalQuotesValue": total_quotes_value,
        "acceptedQuotesValue": accepted_quotes_value,
        "totalQuotesCount": total_quotes_count,
        "acceptedQuotesCount": accepted_quotes_count,
        "totalSalesOrdersValue": total_sales_orders_value,
        "fulfilledSalesOrdersValue": fulfilled_sales_orders_value,
        "totalSalesOrdersCount": total_sales_orders_count,
        "fulfilledSalesOrdersCount": fulfilled_sales_orders_count,
        "totalPurchaseOrdersValue": total_purchase_orders_value,
        "receivedPurchaseOrdersValue": received_purchase_orders_value,
        "totalPurchaseOrdersCount": total_purchase_orders_count,
        "receivedPurchaseOrdersCount": received_purchase_orders_count,
        "totalInvoicesValue": total_invoices_value,
        "paidInvoicesValue": paid_invoices_value,
        "sentInvoicesValue": sent_invoices_value,
        "overdueInvoicesValue": overdue_invoices_value,
        "partialInvoicesValue": partial_invoices_value,
        "paidInvoicesCount": paid_invoices_count,
        "totalInvoicesCount": total_invoices_count,
        "total": total_clients,
        "active": active_clients,
        "pending": pending_clients,
        "hold": hold_clients,
        "totalProjects": total_projects,
        "totalEmployees": total_employees,
        "totalInterns": total_interns,
        "totalActivities": total_activities,
        "totalCalls": total_calls,
        "totalEmailsSent": total_emails_sent,
        "totalMarketplaceServices": total_marketplace,
        "revenueData": revenue_data,
        "pipelineData": pipeline_data,
        "chartLabels": labels,
        "activityChart": activity_chart,
        "emailChart": email_chart,
        "callChart": call_chart,
        "recentActivities": [
            {
                "id": a.id,
                "action": a.action,
                "method": a.method,
                "content": a.content,
                "createdAt": a.createdAt.isoformat() if a.createdAt else None,
            }
            for a in recent_activities
        ],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Client Timeline (unified)
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/clients/{client_id}/timeline")
def client_timeline(client_id: int, session: Session = Depends(get_session)):
    """Unified timeline: activities, emails, calls, invoices, milestones, files."""
    cp = session.get(ClientProfile, client_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Client not found")

    events: list[dict] = []

    # Activities
    for a in session.exec(select(ActivityLog).where(ActivityLog.clientId == client_id)).all():
        events.append({
            "type": "activity", "id": a.id,
            "title": a.action or a.method or "Activity",
            "detail": a.content or "",
            "date": a.createdAt.isoformat() if a.createdAt else None,
        })

    # Emails
    for e in session.exec(select(SentEmail).where(SentEmail.client_id == client_id)).all():
        events.append({
            "type": "email", "id": e.id,
            "title": f"Email: {e.subject or 'No subject'}",
            "detail": e.to_email or "",
            "date": e.sent_at.isoformat() if e.sent_at else None,
        })

    # Calls
    for c in session.exec(select(CallLog).where(CallLog.client_id == client_id)).all():
        events.append({
            "type": "call", "id": c.id,
            "title": f"Call: {c.phone_number or 'Unknown'}",
            "detail": c.description or "",
            "date": c.createdAt.isoformat() if c.createdAt else None,
        })

    # Invoices
    for inv in session.exec(select(Invoice).where(Invoice.client_id == client_id)).all():
        events.append({
            "type": "invoice", "id": inv.id,
            "title": f"Invoice #{inv.invoice_number} — ${inv.total}",
            "detail": f"Status: {inv.status}",
            "date": inv.created_at.isoformat() if inv.created_at else None,
        })

    # Milestones
    for m in session.exec(select(Milestone).where(Milestone.client_id == client_id)).all():
        events.append({
            "type": "milestone", "id": m.id,
            "title": f"Milestone: {m.title}",
            "detail": f"Status: {m.status}",
            "date": m.created_at.isoformat() if m.created_at else None,
        })

    # Files
    for f in session.exec(select(ClientFileUpload).where(ClientFileUpload.client_id == client_id)).all():
        events.append({
            "type": "file", "id": f.id,
            "title": f"File: {f.filename}",
            "detail": f.description or "",
            "date": f.created_at.isoformat() if f.created_at else None,
        })

    # Sort newest first
    events.sort(key=lambda x: x["date"] or "", reverse=True)
    return {"timeline": events}


# ─────────────────────────────────────────────────────────────────────────────
# Global Search
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/search")
def global_search(q: str = Query("", min_length=1), session: Session = Depends(get_session)):
    results: list[dict] = []
    term = f"%{q}%"

    # Clients
    for c in session.exec(
        select(ClientProfile).where(
            (ClientProfile.companyName.ilike(term)) | (ClientProfile.projectName.ilike(term))
        ).limit(5)
    ).all():
        results.append({"type": "client", "id": c.id, "title": c.companyName or "Client", "sub": c.projectName or "", "link": f"/clients/{c.id}"})

    # Projects
    for p in session.exec(select(Project).where(Project.name.ilike(term)).limit(5)).all():
        results.append({"type": "project", "id": p.id, "title": p.name, "sub": p.status or "", "link": f"/projects/{p.id}"})

    # Tasks
    for t in session.exec(select(Task).where(Task.title.ilike(term)).limit(5)).all():
        results.append({"type": "task", "id": t.id, "title": t.title, "sub": t.status or "", "link": "/tasks"})

    # Invoices
    for inv in session.exec(select(Invoice).where(Invoice.invoice_number.ilike(term)).limit(5)).all():
        results.append({"type": "invoice", "id": inv.id, "title": f"Invoice #{inv.invoice_number}", "sub": f"${inv.total} — {inv.status}", "link": "/invoices"})

    return {"results": results, "query": q}


# ─────────────────────────────────────────────────────────────────────────────
# Monitor Stats (real data)
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/monitor-stats")
def monitor_stats(session: Session = Depends(get_session)):
    """Real aggregated stats for the monitor/analytics page."""
    # Total rankings tracked
    all_rankings = session.exec(select(KeywordRankEntry)).all()
    total_keywords = len(set(r.keyword for r in all_rankings))
    avg_position = round(sum(r.position for r in all_rankings if r.position) / max(len(all_rankings), 1), 1) if all_rankings else 0

    # Recent rankings for the table
    recent = session.exec(
        select(KeywordRankEntry).order_by(KeywordRankEntry.recorded_at.desc()).limit(20)
    ).all()
    # De-duplicate by keyword (keep latest)
    seen = set()
    keyword_rows = []
    for r in recent:
        if r.keyword not in seen:
            seen.add(r.keyword)
            keyword_rows.append({
                "keyword": r.keyword,
                "position": r.position,
                "url": r.url,
                "search_engine": r.search_engine,
                "recorded_at": r.recorded_at.isoformat() if r.recorded_at else None,
            })

    # Project completion stats
    projects = session.exec(select(Project)).all()
    completed_projects = len([p for p in projects if p.status == "Completed"])
    total_projects = len(projects)
    avg_progress = round(sum(p.progress or 0 for p in projects) / max(total_projects, 1))

    # Invoice revenue stats
    invoices = session.exec(select(Invoice)).all()
    total_revenue = sum(inv.total for inv in invoices)
    paid_revenue = sum(inv.total for inv in invoices if inv.status == "Paid")
    pending_revenue = sum(inv.total for inv in invoices if inv.status in ("Sent", "Draft"))

    # Weekly activity counts (last 10 weeks)
    weekly_activity = []
    for i in range(9, -1, -1):
        start = datetime.utcnow() - timedelta(weeks=i + 1)
        end = datetime.utcnow() - timedelta(weeks=i)
        count = len(session.exec(
            select(ActivityLog).where(ActivityLog.createdAt >= start, ActivityLog.createdAt < end)
        ).all())
        weekly_activity.append({"week": f"W{10 - i}", "count": count})

    return {
        "total_keywords": total_keywords,
        "avg_position": avg_position,
        "keyword_rows": keyword_rows,
        "total_projects": total_projects,
        "completed_projects": completed_projects,
        "avg_progress": avg_progress,
        "total_revenue": round(total_revenue, 2),
        "paid_revenue": round(paid_revenue, 2),
        "pending_revenue": round(pending_revenue, 2),
        "weekly_activity": weekly_activity,
    }


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


# ─────────────────────────────────────────────────────────────────────────────
# Daily task sheet
# ─────────────────────────────────────────────────────────────────────────────
def _task_sheet_dict(entry: TaskSheetEntry, session: Session) -> dict:
    user = session.get(User, entry.user_id)
    project = session.get(Project, entry.project_id) if entry.project_id else None
    ticket = session.get(ProjectTicket, entry.ticket_id) if entry.ticket_id else None
    return {
        **entry.model_dump(),
        "user_name": user.name if user else "Unknown user",
        "user_email": user.email if user else None,
        "project_name": project.name if project else None,
        "ticket_name": ticket.task if ticket else None,
        "created_at": entry.created_at.isoformat(),
        "updated_at": entry.updated_at.isoformat(),
    }


@app.get("/task-sheet")
def list_task_sheet_entries(
    user_id: Optional[int] = None,
    work_date: Optional[str] = None,
    session: Session = Depends(get_session),
):
    q = select(TaskSheetEntry).order_by(TaskSheetEntry.work_date.desc(), TaskSheetEntry.updated_at.desc())
    if user_id:
        q = q.where(TaskSheetEntry.user_id == user_id)
    if work_date:
        q = q.where(TaskSheetEntry.work_date == work_date)
    entries = session.exec(q).all()
    return {"entries": [_task_sheet_dict(entry, session) for entry in entries]}


@app.post("/task-sheet")
def create_task_sheet_entry(body: TaskSheetEntryRequest, session: Session = Depends(get_session)):
    today = datetime.utcnow().date().isoformat()
    if body.work_date != today:
        raise HTTPException(status_code=400, detail="New task-sheet entries can only be added for today")
    entry = TaskSheetEntry(**body.model_dump(), tenant_id=current_tenant_id.get())
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return {"entry": _task_sheet_dict(entry, session)}


@app.put("/task-sheet/{entry_id}")
def update_task_sheet_entry(entry_id: int, body: TaskSheetEntryRequest, session: Session = Depends(get_session)):
    entry = session.get(TaskSheetEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Task-sheet entry not found")
    for field, value in body.model_dump().items():
        if field != "work_date":
            setattr(entry, field, value)
    entry.updated_at = datetime.utcnow()
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return {"entry": _task_sheet_dict(entry, session)}


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
def _invoice_dict(inv: Invoice, session: Session) -> dict:
    cp = session.get(ClientProfile, inv.client_id) if inv.client_id else None
    u = session.get(User, cp.userId) if cp and cp.userId else None
    return {
        "id": inv.id,
        "invoice_number": inv.invoice_number,
        "client_id": inv.client_id,
        "client_name": u.name if u else (cp.companyName if cp else None),
        "client_email": u.email if u else None,
        "service_request_id": inv.service_request_id,
        "amount": inv.amount,
        "tax": inv.tax,
        "total": inv.total,
        "status": inv.status,
        "due_date": inv.due_date,
        "notes": inv.notes,
        "line_items": inv.line_items or [],
        "paid_at": inv.paid_at.isoformat() if inv.paid_at else None,
        "created_at": inv.created_at.isoformat(),
        "updated_at": inv.updated_at.isoformat(),
    }


def _generate_invoice_number(session: Session) -> str:
    count = len(session.exec(select(Invoice)).all())
    return f"INV-{datetime.utcnow().year}-{str(count + 1).zfill(4)}"


@app.get("/invoices")
def list_invoices(
    client_id: Optional[int] = None,
    status: Optional[str] = None,
    session: Session = Depends(get_session),
):
    q = select(Invoice).order_by(Invoice.created_at.desc())
    if client_id:
        q = q.where(Invoice.client_id == client_id)
    if status:
        q = q.where(Invoice.status == status)
    invoices = session.exec(q).all()
    return {"invoices": [_invoice_dict(i, session) for i in invoices]}


@app.post("/invoices")
def create_invoice(body: InvoiceCreateRequest, session: Session = Depends(get_session)):
    total = round(body.amount + body.tax, 2)
    inv = Invoice(
        invoice_number=_generate_invoice_number(session),
        client_id=body.client_id,
        service_request_id=body.service_request_id,
        amount=body.amount,
        tax=body.tax,
        total=total,
        currency=body.currency,
        due_date=body.due_date,
        notes=body.notes,
        line_items=body.line_items or [],
    )
    session.add(inv)
    session.commit()
    session.refresh(inv)

    # --- Add invoice to client my-files ---
    from database import ClientFileUpload
    invoice_filename = f"Invoice_{inv.invoice_number}.json"
    invoice_file_url = f"/api/invoices/{inv.id}/download"  # You may want to implement this endpoint to serve PDF/JSON
    file_entry = ClientFileUpload(
        client_id=inv.client_id,
        uploaded_by=None,  # Admin
        filename=invoice_filename,
        file_url=invoice_file_url,
        file_size=None,
        mime_type="application/json",
        description=f"Invoice {inv.invoice_number} generated for client.",
    )
    session.add(file_entry)
    session.commit()

    # Email notification to client
    if inv.client_id:
        cp = session.get(ClientProfile, inv.client_id)
        if cp and cp.userId:
            user = session.get(User, cp.userId)
            if user and user.email:
                _send_notification_email(
                    user.email,
                    f"New Invoice #{inv.invoice_number} from DaPros",
                    f"<h2>New Invoice</h2><p>Hi {cp.companyName or 'there'},</p><p>A new invoice <strong>#{inv.invoice_number}</strong> for <strong>${inv.total}</strong> has been created.</p><p>Please log in to your dashboard to view details.</p><p>— Team DaPros</p>",
                )
            notif = Notification(
                user_id=cp.userId,
                title="New Invoice Created",
                message=f"Invoice #{inv.invoice_number} for ${inv.total} is ready.",
                type="info",
                link="/invoices",
            )
            session.add(notif)
            session.commit()

    return {"invoice": _invoice_dict(inv, session)}


@app.post("/invoices/from-quote/{request_id}")
def invoice_from_quote(request_id: int, session: Session = Depends(get_session)):
    sr = session.get(ServiceRequest, request_id)
    if not sr:
        raise HTTPException(status_code=404, detail="Service request not found")
    if not sr.quoted_amount:
        raise HTTPException(status_code=400, detail="No quoted amount on this request")
    svc = session.get(ServiceCatalog, sr.service_id)
    inv = Invoice(
        invoice_number=_generate_invoice_number(session),
        client_id=sr.client_id,
        service_request_id=sr.id,
        amount=sr.quoted_amount,
        tax=0.0,
        total=sr.quoted_amount,
        line_items=[{"description": svc.name if svc else "Service", "amount": sr.quoted_amount}],
    )
    session.add(inv)
    session.commit()
    session.refresh(inv)
    # Notify client
    cp = session.get(ClientProfile, sr.client_id)
    if cp and cp.userId:
        notif = Notification(
            user_id=cp.userId,
            title="New Invoice Generated",
            message=f"Invoice {inv.invoice_number} for ${inv.total:.2f} has been created.",
            type="info",
            link="/invoices",
        )
        session.add(notif)
        session.commit()
    return {"invoice": _invoice_dict(inv, session)}


@app.get("/invoices/{invoice_id}")
def get_invoice(invoice_id: int, session: Session = Depends(get_session)):
    inv = session.get(Invoice, invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {"invoice": _invoice_dict(inv, session)}


@app.put("/invoices/{invoice_id}")
def update_invoice(
    invoice_id: int, body: InvoiceUpdateRequest, session: Session = Depends(get_session)
):
    inv = session.get(Invoice, invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    updates = body.model_dump(exclude_unset=True)
    for field, val in updates.items():
        setattr(inv, field, val)
    if "amount" in updates or "tax" in updates:
        inv.total = round((inv.amount or 0) + (inv.tax or 0), 2)
    if updates.get("status") == "Paid":
        inv.paid_at = datetime.utcnow()
    inv.updated_at = datetime.utcnow()
    session.add(inv)
    session.commit()
    session.refresh(inv)

    # Notify client when invoice is sent
    if updates.get("status") == "Sent" and inv.client_id:
        cp = session.get(ClientProfile, inv.client_id)
        if cp and cp.userId:
            user = session.get(User, cp.userId)
            if user and user.email:
                _send_notification_email(
                    user.email,
                    f"Invoice #{inv.invoice_number} Sent — DaPros",
                    f"<h2>Invoice Ready for Payment</h2><p>Hi {cp.companyName or 'there'},</p><p>Invoice <strong>#{inv.invoice_number}</strong> for <strong>${inv.total}</strong> has been sent to you.</p><p>Due date: {inv.due_date or 'TBD'}</p><p>— Team DaPros</p>",
                )

    return {"invoice": _invoice_dict(inv, session)}


@app.delete("/invoices/{invoice_id}")
def delete_invoice(invoice_id: int, session: Session = Depends(get_session)):
    inv = session.get(Invoice, invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    session.delete(inv)
    session.commit()
    return {"ok": True}


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
def _milestone_dict(m: Milestone) -> dict:
    return {
        "id": m.id,
        "title": m.title,
        "description": m.description,
        "project_id": m.project_id,
        "client_id": m.client_id,
        "due_date": m.due_date,
        "status": m.status,
        "order": m.order,
        "created_at": m.created_at.isoformat(),
    }

@app.get("/developer/tickets")
def get_all_assigned_tickets(member_id: int, session: Session = Depends(get_session)):
    projects = session.exec(select(Project)).all()
    assigned_project_ids = []
    project_names = {}
    for p in projects:
        if (p.employeeIds and member_id in p.employeeIds) or \
           (p.projectMemberIds and member_id in p.projectMemberIds) or \
           (p.clientIds and member_id in p.clientIds) or \
           (p.internIds and member_id in p.internIds):
            assigned_project_ids.append(p.id)
            project_names[p.id] = p.name

    if not assigned_project_ids:
        return {"tickets": []}

    tickets = session.exec(
        select(ProjectTicket).where(ProjectTicket.project_id.in_(assigned_project_ids))
    ).all()
    
    ticket_list = []
    for t in tickets:
        t_dict = t.model_dump()
        t_dict["project_name"] = project_names.get(t.project_id, "Unknown Project")
        ticket_list.append(t_dict)
        
    return {"tickets": ticket_list}


@app.get("/projects/{project_id}/tickets")
def get_project_tickets(project_id: int, session: Session = Depends(get_session)):
    tickets = session.exec(select(ProjectTicket).where(ProjectTicket.project_id == project_id)).all()
    return {"tickets": tickets}

@app.post("/projects/{project_id}/tickets")
def create_project_ticket(project_id: int, body: ProjectTicketRequest, session: Session = Depends(get_session)):
    if not body.requested_date:
        body.requested_date = datetime.utcnow().date().isoformat()
    t = ProjectTicket(**body.model_dump(), project_id=project_id)
    session.add(t)
    session.commit()
    session.refresh(t)
    return t

@app.put("/projects/tickets/{ticket_id}")
def update_project_ticket(ticket_id: int, body: ProjectTicketRequest, session: Session = Depends(get_session)):
    t = session.get(ProjectTicket, ticket_id)
    if not t: raise HTTPException(404, "Ticket not found")
    
    old_state = t.current_state
    new_state = body.current_state
    
    for k, v in body.model_dump(exclude_unset=True).items():
        if k != "user_name":
            setattr(t, k, v)
            
    if old_state != new_state:
        now_str = datetime.utcnow().date().isoformat()
        if new_state == "In Dev":
            t.date_dev_start = now_str
        elif new_state == "Given to QA":
            if not t.date_dev_complete:
                t.date_dev_complete = now_str
            t.date_qa_start = now_str
        elif new_state == "Prod Release":
            if not t.date_qa_complete:
                t.date_qa_complete = now_str
            t.date_release_prod = now_str
            
        history = ProjectTicketHistory(
            ticket_id=ticket_id,
            old_state=old_state,
            new_state=new_state,
            user_name=body.user_name
        )
        session.add(history)
        
        # Log to activity feed if QA reverted back to Dev
        if old_state == "Given to QA" and new_state == "In Dev":
            activity = ActivityLog(
                action="Ticket Reverted",
                content=f"Ticket '{t.task}' was reverted back to Dev by {body.user_name or 'QA'}",
                details=f"Project ID: {t.project_id}"
            )
            session.add(activity)

    session.add(t)
    session.commit()
    session.refresh(t)
    return t

@app.get("/projects/tickets/{ticket_id}/history")
def get_project_ticket_history(ticket_id: int, session: Session = Depends(get_session)):
    history = session.exec(select(ProjectTicketHistory).where(ProjectTicketHistory.ticket_id == ticket_id).order_by(ProjectTicketHistory.moved_at.desc())).all()
    return {"history": history}

class NoteRequest(BaseModel):
    user_name: str
    note: str

@app.get("/projects/tickets/{ticket_id}/notes")
def get_project_ticket_notes(ticket_id: int, session: Session = Depends(get_session)):
    notes = session.exec(select(ProjectTicketNote).where(ProjectTicketNote.ticket_id == ticket_id).order_by(ProjectTicketNote.created_at.desc())).all()
    return {"notes": notes}

@app.post("/projects/tickets/{ticket_id}/notes")
def create_project_ticket_note(ticket_id: int, body: NoteRequest, session: Session = Depends(get_session)):
    n = ProjectTicketNote(ticket_id=ticket_id, user_name=body.user_name, note=body.note)
    session.add(n)
    session.commit()
    session.refresh(n)
    return n

@app.delete("/projects/tickets/{ticket_id}")
def delete_project_ticket(ticket_id: int, session: Session = Depends(get_session)):
    t = session.get(ProjectTicket, ticket_id)
    if not t: raise HTTPException(404, "Ticket not found")
    
    # Manually delete related history and notes to avoid foreign key constraints
    history_records = session.exec(select(ProjectTicketHistory).where(ProjectTicketHistory.ticket_id == ticket_id)).all()
    for h in history_records:
        session.delete(h)
        
    notes_records = session.exec(select(ProjectTicketNote).where(ProjectTicketNote.ticket_id == ticket_id)).all()
    for n in notes_records:
        session.delete(n)
        
    session.delete(t)
    session.commit()
    return {"ok": True}

@app.post("/projects/{project_id}/team")
def add_project_team(project_id: int, body: ProjectTeamRequest, session: Session = Depends(get_session)):
    p = session.get(Project, project_id)
    if not p: raise HTTPException(404, "Project not found")
    
    added_users = []
    # Initialize list if None
    current_members = p.projectMemberIds or []
    
    for email, role in zip(body.emails, body.roles):
        user = session.exec(select(User).where(User.email == email)).first()
        if not user:
            # Create user
            user = User(
                email=email,
                name=email.split('@')[0],
                role="ProjectMember",
                password=_hash_password("password123")
            )
            session.add(user)
            session.commit()
            session.refresh(user)
        
        if user.id not in current_members:
            current_members.append(user.id)
            added_users.append(user.id)
            
    p.projectMemberIds = current_members
    session.add(p)
    session.commit()
    return {"message": "Team updated", "added_count": len(added_users)}

@app.get("/milestones")
def list_milestones(
    client_id: Optional[int] = None,
    project_id: Optional[int] = None,
    session: Session = Depends(get_session),
):
    q = select(Milestone).order_by(Milestone.order, Milestone.created_at)
    if client_id:
        q = q.where(Milestone.client_id == client_id)
    if project_id:
        q = q.where(Milestone.project_id == project_id)
    milestones = session.exec(q).all()
    return {"milestones": [_milestone_dict(m) for m in milestones]}


@app.post("/milestones")
def create_milestone(body: MilestoneCreateRequest, session: Session = Depends(get_session)):
    m = Milestone(**body.model_dump())
    session.add(m)
    session.commit()
    session.refresh(m)
    return {"milestone": _milestone_dict(m)}


@app.put("/milestones/{milestone_id}")
def update_milestone(
    milestone_id: int, body: MilestoneUpdateRequest, session: Session = Depends(get_session)
):
    m = session.get(Milestone, milestone_id)
    if not m:
        raise HTTPException(status_code=404, detail="Milestone not found")
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(m, field, val)
    session.add(m)
    session.commit()
    session.refresh(m)

    # Notify client when milestone is achieved
    if body.status == "Achieved" and m.client_id:
        cp = session.get(ClientProfile, m.client_id)
        if cp and cp.userId:
            notif = Notification(
                user_id=cp.userId,
                title="Milestone Achieved! 🎉",
                message=f"'{m.title}' has been marked as achieved.",
                type="success",
                link="/milestones",
            )
            session.add(notif)
            session.commit()
            user = session.get(User, cp.userId)
            if user and user.email:
                _send_notification_email(
                    user.email,
                    f"Milestone Achieved: {m.title} — DaPros",
                    f"<h2>🎉 Milestone Achieved!</h2><p>Hi {cp.companyName or 'there'},</p><p>Great news! The milestone <strong>{m.title}</strong> has been completed.</p><p>Log in to see your progress.</p><p>— Team DaPros</p>",
                )

    return {"milestone": _milestone_dict(m)}


@app.delete("/milestones/{milestone_id}")
def delete_milestone(milestone_id: int, session: Session = Depends(get_session)):
    m = session.get(Milestone, milestone_id)
    if not m:
        raise HTTPException(status_code=404, detail="Milestone not found")
    session.delete(m)
    session.commit()
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────────
# NPS Surveys
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/nps")
def list_nps_surveys(client_id: Optional[int] = None, session: Session = Depends(get_session)):
    q = select(NPSSurvey).order_by(NPSSurvey.created_at.desc())
    if client_id:
        q = q.where(NPSSurvey.client_id == client_id)
    surveys = session.exec(q).all()
    return {
        "surveys": [
            {
                "id": s.id,
                "client_id": s.client_id,
                "score": s.score,
                "feedback": s.feedback,
                "triggered_by": s.triggered_by,
                "responded_at": s.responded_at.isoformat() if s.responded_at else None,
                "created_at": s.created_at.isoformat(),
            }
            for s in surveys
        ]
    }


@app.post("/nps/trigger/{client_id}")
def trigger_nps(
    client_id: int,
    triggered_by: str = "manual",
    session: Session = Depends(get_session),
):
    cp = session.get(ClientProfile, client_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Client not found")
    s = NPSSurvey(client_id=client_id, triggered_by=triggered_by)
    session.add(s)
    session.commit()
    session.refresh(s)
    # Notify client
    if cp.userId:
        notif = Notification(
            user_id=cp.userId,
            title="Share Your Feedback",
            message="We'd love to know how we're doing! Please rate your experience.",
            type="info",
            link=f"/survey/{s.id}",
        )
        session.add(notif)
        session.commit()
    return {"survey_id": s.id}


@app.post("/nps/{survey_id}/respond")
def respond_nps(survey_id: int, body: NPSRespondRequest, session: Session = Depends(get_session)):
    s = session.get(NPSSurvey, survey_id)
    if not s:
        raise HTTPException(status_code=404, detail="Survey not found")
    s.score = body.score
    s.feedback = body.feedback
    s.responded_at = datetime.utcnow()
    session.add(s)
    session.commit()
    return {"ok": True}


# ────────────────────────────────────────────────────────
@app.get("/invoices/{invoice_id}/pdf")
def invoice_pdf(invoice_id: int, provider: Optional[str] = None, session: Session = Depends(get_session)):
    """Generate a professional PDF for an invoice."""
    from fastapi.responses import StreamingResponse

    inv = session.get(Invoice, invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    client = session.get(ClientProfile, inv.client_id) if inv.client_id else None
    client_name = ""
    if client:
        user = session.get(User, client.userId) if client.userId else None
        client_name = client.companyName or (user.name if user else f"Client #{client.id}")

    from modules.pdf_export import invoice_pdf as _invoice_pdf
    pdf = _invoice_pdf({
        "invoice_number": inv.invoice_number,
        "client_name": client_name,
        "currency": inv.currency or "$",
        "amount": inv.amount,
        "tax": inv.tax,
        "total": inv.total,
        "status": inv.status,
        "due_date": inv.due_date,
        "notes": inv.notes,
        "line_items": inv.line_items or [],
        "created_at": inv.created_at,
    })
    return StreamingResponse(io.BytesIO(pdf), media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="invoice-{inv.invoice_number}.pdf"'
    })


# ─────────────────────────────────────────────────────────────────────────────
# Proposals & Contracts
# ─────────────────────────────────────────────────────────────────────────────
def _proposal_dict_fast(p: Proposal, clients_map: dict, users_map: dict, leads_map: dict) -> dict:
    """Fast proposal dict using pre-loaded maps (no N+1 queries)."""
    cp = clients_map.get(p.client_id)
    user_id = cp.userId if cp else None
    u = users_map.get(user_id)
    creator = users_map.get(p.created_by)
    lead = leads_map.get(getattr(p, 'lead_id', None))
    recipient_name = None
    if u:
        recipient_name = u.name
    elif cp:
        recipient_name = cp.companyName
    elif lead:
        recipient_name = lead.company_name or lead.contact_name
    return {
        "id": p.id,
        "title": p.title,
        "client_id": p.client_id,
        "lead_id": getattr(p, 'lead_id', None),
        "recipient_type": getattr(p, 'recipient_type', 'client'),
        "client_name": recipient_name,
        "service_request_id": p.service_request_id,
        "content": p.content,
        "line_items": getattr(p, 'line_items', None) or [],
        "currency": getattr(p, 'currency', 'MXN'),
        "status": p.status,
        "valid_until": p.valid_until,
        "total_value": p.total_value,
        "signed_at": p.signed_at.isoformat() if p.signed_at else None,
        "created_by": p.created_by,
        "creator_name": creator.name if creator else None,
        "created_at": p.created_at.isoformat(),
        "updated_at": p.updated_at.isoformat(),
    }


def _proposal_dict(p: Proposal, session: Session) -> dict:
    cp = session.get(ClientProfile, p.client_id) if p.client_id else None
    u = session.get(User, cp.userId) if cp and cp.userId else None
    creator = session.get(User, p.created_by) if p.created_by else None
    lead_id = getattr(p, 'lead_id', None)
    lead = session.get(Lead, lead_id) if lead_id else None
    recipient_name = None
    if u:
        recipient_name = u.name
    elif cp:
        recipient_name = cp.companyName
    elif lead:
        recipient_name = lead.company_name or lead.contact_name
    return {
        "id": p.id,
        "title": p.title,
        "client_id": p.client_id,
        "lead_id": lead_id,
        "recipient_type": getattr(p, 'recipient_type', 'client'),
        "client_name": recipient_name,
        "service_request_id": p.service_request_id,
        "content": p.content,
        "line_items": getattr(p, 'line_items', None) or [],
        "currency": getattr(p, 'currency', 'MXN'),
        "status": p.status,
        "valid_until": p.valid_until,
        "total_value": p.total_value,
        "signed_at": p.signed_at.isoformat() if p.signed_at else None,
        "created_by": p.created_by,
        "creator_name": creator.name if creator else None,
        "created_at": p.created_at.isoformat(),
        "updated_at": p.updated_at.isoformat(),
    }


@app.get("/proposals/catalog")
def get_proposals_catalog(session: Session = Depends(get_session)):
    """Lightweight catalog of inventory items for quotation builder."""
    items = session.exec(select(InventoryItem).order_by(InventoryItem.name)).all()
    result = []
    for item in items:
        # Get cheapest supplier price
        suppliers = session.exec(
            select(InventorySupplier).where(InventorySupplier.item_id == item.id)
        ).all()
        unit_price = min((s.unit_cost for s in suppliers if s.unit_cost), default=0.0) or 0.0
        result.append({
            "id": item.id,
            "name": item.name,
            "code": item.code,
            "description": item.description,
            "category": item.category or "General",
            "unit": item.unit or "pcs",
            "photo_url": item.photo_url,
            "unit_price": unit_price,
            "current_stock": item.current_stock,
        })
    return {"items": result}


@app.get("/proposals")
def list_proposals(
    client_id: Optional[int] = None,
    status: Optional[str] = None,
    session: Session = Depends(get_session),
):
    q = select(Proposal).order_by(Proposal.created_at.desc())
    if client_id:
        q = q.where(Proposal.client_id == client_id)
    if status:
        q = q.where(Proposal.status == status)
    proposals = session.exec(q).all()
    if not proposals:
        return {"proposals": []}

    # Batch-load all related records (fix N+1 query)
    client_ids = list({p.client_id for p in proposals if p.client_id})
    lead_ids = list({getattr(p, 'lead_id', None) for p in proposals if getattr(p, 'lead_id', None)})
    
    clients_list = session.exec(select(ClientProfile).where(ClientProfile.id.in_(client_ids))).all() if client_ids else []
    leads_list = session.exec(select(Lead).where(Lead.id.in_(lead_ids))).all() if lead_ids else []
    
    user_ids = list({cp.userId for cp in clients_list if cp.userId})
    creator_ids = list({p.created_by for p in proposals if p.created_by})
    all_user_ids = list(set(user_ids + creator_ids))
    users_list = session.exec(select(User).where(User.id.in_(all_user_ids))).all() if all_user_ids else []
    
    clients_map = {cp.id: cp for cp in clients_list}
    users_map = {u.id: u for u in users_list}
    leads_map = {l.id: l for l in leads_list}
    
    return {"proposals": [_proposal_dict_fast(p, clients_map, users_map, leads_map) for p in proposals]}


@app.post("/proposals")
def create_proposal(body: ProposalCreateRequest, session: Session = Depends(get_session)):
    p = Proposal(**body.model_dump())
    session.add(p)
    session.commit()
    session.refresh(p)
    return {"proposal": _proposal_dict(p, session)}


@app.get("/proposals/{proposal_id}")
def get_proposal(proposal_id: int, session: Session = Depends(get_session)):
    p = session.get(Proposal, proposal_id)
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return {"proposal": _proposal_dict(p, session)}


@app.put("/proposals/{proposal_id}")
def update_proposal(
    proposal_id: int, body: ProposalUpdateRequest, session: Session = Depends(get_session)
):
    p = session.get(Proposal, proposal_id)
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(p, field, val)
    if body.status == "Accepted":
        p.signed_at = datetime.utcnow()
    p.updated_at = datetime.utcnow()
    session.add(p)
    session.commit()
    session.refresh(p)
    # Notify client when proposal is sent
    if body.status == "Sent" and p.client_id:
        cp = session.get(ClientProfile, p.client_id)
        if cp and cp.userId:
            notif = Notification(
                user_id=cp.userId,
                title="New Proposal Ready",
                message=f"A proposal '{p.title}' has been sent for your review.",
                type="info",
                link=f"/proposals/{p.id}",
            )
            session.add(notif)
            session.commit()
            # Email notification
            user = session.get(User, cp.userId)
            if user and user.email:
                _send_notification_email(
                    user.email,
                    f"New Proposal: {p.title} — DaPros",
                    f"<h2>Proposal Ready for Review</h2><p>Hi {cp.companyName or 'there'},</p><p>A new proposal <strong>{p.title}</strong> has been sent for your review.</p><p>Please log in to your dashboard to accept or decline.</p><p>— Team DaPros</p>",
                )
    # Notify admins when client responds to a proposal
    if body.status in ("Accepted", "Rejected", "Demo Requested") and p.client_id:
        cp = session.get(ClientProfile, p.client_id)
        client_name = cp.companyName if cp else f"Client #{p.client_id}"
        status_label = body.status.lower()
        admins = session.exec(select(User).where(User.role == "Admin")).all()
        for admin in admins:
            notif = Notification(
                user_id=admin.id,
                title=f"Proposal {body.status}",
                message=f"{client_name} has {status_label} the proposal '{p.title}'.",
                type="success" if body.status == "Accepted" else ("warning" if body.status == "Demo Requested" else "info"),
                link="/proposals",
            )
            session.add(notif)
        session.commit()
    return {"proposal": _proposal_dict(p, session)}


@app.post("/proposals/{proposal_id}/sign")
def sign_proposal(proposal_id: int, request: Request, session: Session = Depends(get_session)):
    p = session.get(Proposal, proposal_id)
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    
    p.signed_at = datetime.utcnow()
    p.status = "Accepted"
    p.signed_by_ip = request.client.host if request.client else "Unknown IP"
    
    session.add(p)
    session.commit()
    session.refresh(p)
    return _proposal_dict(p, session)


@app.delete("/proposals/{proposal_id}")
def delete_proposal(proposal_id: int, session: Session = Depends(get_session)):
    p = session.get(Proposal, proposal_id)
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    session.delete(p)
    session.commit()
    return {"ok": True}


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
@app.get("/rankings")
def list_rankings(
    client_id: Optional[int] = None,
    keyword: Optional[str] = None,
    session: Session = Depends(get_session),
):
    q = select(KeywordRankEntry).order_by(KeywordRankEntry.recorded_at.desc())
    if client_id:
        q = q.where(KeywordRankEntry.client_id == client_id)
    if keyword:
        q = q.where(KeywordRankEntry.keyword.ilike(f"%{keyword}%"))
    entries = session.exec(q).all()
    return {
        "rankings": [
            {
                "id": e.id,
                "client_id": e.client_id,
                "keyword": e.keyword,
                "position": e.position,
                "url": e.url,
                "search_engine": e.search_engine,
                "notes": e.notes,
                "recorded_at": e.recorded_at.isoformat(),
                "recorded_by": e.recorded_by,
            }
            for e in entries
        ]
    }


@app.post("/rankings")
def add_ranking(body: KeywordRankRequest, session: Session = Depends(get_session)):
    e = KeywordRankEntry(**body.model_dump())
    session.add(e)
    session.commit()
    session.refresh(e)
    return {
        "id": e.id,
        "keyword": e.keyword,
        "position": e.position,
        "recorded_at": e.recorded_at.isoformat(),
    }


@app.get("/rankings/history/{client_id}/{keyword}")
def ranking_history(client_id: int, keyword: str, session: Session = Depends(get_session)):
    entries = session.exec(
        select(KeywordRankEntry)
        .where(
            KeywordRankEntry.client_id == client_id,
            KeywordRankEntry.keyword == keyword,
        )
        .order_by(KeywordRankEntry.recorded_at)
    ).all()
    return {
        "keyword": keyword,
        "history": [
            {"position": e.position, "recorded_at": e.recorded_at.isoformat()}
            for e in entries
        ],
    }


@app.delete("/rankings/{entry_id}")
def delete_ranking(entry_id: int, session: Session = Depends(get_session)):
    e = session.get(KeywordRankEntry, entry_id)
    if not e:
        raise HTTPException(status_code=404, detail="Ranking entry not found")
    session.delete(e)
    session.commit()
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────────
# PDF Generation — Invoices & Proposals
# ─────────────────────────────────────────────────────────────────────────────


@app.get("/proposals/{proposal_id}/pdf")
def proposal_pdf(proposal_id: int, session: Session = Depends(get_session)):
    """Generate a professional itemized PDF quotation."""
    from fastapi.responses import StreamingResponse
    import io
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm

    prop = session.get(Proposal, proposal_id)
    if not prop:
        raise HTTPException(status_code=404, detail="Proposal not found")

    # Resolve recipient name
    recipient_name = "—"
    recipient_email = ""
    if prop.client_id:
        client = session.get(ClientProfile, prop.client_id)
        if client:
            user = session.get(User, client.userId) if client.userId else None
            recipient_name = client.companyName or (user.name if user else f"Client #{client.id}")
            recipient_email = user.email if user else ""
    lead_id = getattr(prop, 'lead_id', None)
    if lead_id and recipient_name == "—":
        lead = session.get(Lead, lead_id)
        if lead:
            recipient_name = lead.company_name or lead.contact_name or "—"
            recipient_email = lead.email or ""

    currency = getattr(prop, 'currency', 'MXN')
    curr_symbol = "₹" if currency == "INR" else "$"
    line_items = getattr(prop, 'line_items', None) or []

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=40*mm, bottomMargin=25*mm,
                            leftMargin=20*mm, rightMargin=20*mm)
    styles = getSampleStyleSheet()

    accent = colors.HexColor("#2563eb")
    dark = colors.HexColor("#0f172a")
    mid = colors.HexColor("#475569")
    light_bg = colors.HexColor("#f1f5f9")

    title_s = ParagraphStyle("PTitle", parent=styles["Normal"], fontSize=26, fontName="Helvetica-Bold",
                             textColor=dark, leading=28, spaceAfter=2)
    sub_s = ParagraphStyle("PSub", parent=styles["Normal"], fontSize=11, textColor=mid)
    h2 = ParagraphStyle("PH2", parent=styles["Normal"], fontSize=11, fontName="Helvetica-Bold",
                        textColor=dark, spaceBefore=14, spaceAfter=4)
    normal = ParagraphStyle("PNorm", parent=styles["Normal"], fontSize=10, textColor=dark)
    small = ParagraphStyle("PSmall", parent=styles["Normal"], fontSize=8, textColor=mid)
    footer_s = ParagraphStyle("PFoot", parent=styles["Normal"], fontSize=9, textColor=mid, alignment=1)

    els = []

    # ── HEADER ────────────────────────────────────────────────────────────────
    header_data = [
        [Paragraph("QUOTATION", title_s), Paragraph(f"# Q-{prop.id:04d}", title_s)],
        [Paragraph("SERP Hawk", sub_s), Paragraph(f"Currency: {currency}", sub_s)],
    ]
    header_tbl = Table(header_data, colWidths=[90*mm, 80*mm])
    header_tbl.setStyle(TableStyle([
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("PADDING", (0, 0), (-1, -1), 0),
    ]))
    els.append(header_tbl)
    els.append(HRFlowable(width="100%", thickness=2, color=accent, spaceAfter=10))

    # ── BILL TO / META ────────────────────────────────────────────────────────
    meta_data = [
        [Paragraph("BILL TO", small), Paragraph("QUOTE DETAILS", small)],
        [Paragraph(f"<b>{recipient_name}</b>", normal), Paragraph(f"<b>Status:</b> {prop.status}", normal)],
        [Paragraph(recipient_email, normal), Paragraph(f"<b>Valid Until:</b> {prop.valid_until or '—'}", normal)],
        ["", Paragraph(f"<b>Created:</b> {prop.created_at.strftime('%B %d, %Y') if prop.created_at else '—'}", normal)],
    ]
    meta_tbl = Table(meta_data, colWidths=[90*mm, 80*mm])
    meta_tbl.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 7),
        ("TEXTCOLOR", (0, 0), (-1, 0), mid),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("PADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    els.append(meta_tbl)
    els.append(Spacer(1, 16))

    # ── LINE ITEMS TABLE ─────────────────────────────────────────────────────
    if line_items:
        els.append(Paragraph("Items", h2))
        rows = [["#", "Product", "Qty", "Unit", f"Unit Price ({curr_symbol})", f"Total ({curr_symbol})"]]
        subtotal = 0.0
        for idx, li in enumerate(line_items, 1):
            qty = float(li.get("quantity", 1))
            price = float(li.get("unit_price", 0))
            line_total = qty * price
            subtotal += line_total
            rows.append([
                str(idx),
                li.get("product_name", ""),
                f"{qty:g}",
                li.get("unit", "pcs"),
                f"{curr_symbol}{price:,.2f}",
                f"{curr_symbol}{line_total:,.2f}",
            ])
        # Subtotal / Total rows
        rows.append(["", "", "", "", "Subtotal", f"{curr_symbol}{subtotal:,.2f}"])
        grand = prop.total_value or subtotal
        rows.append(["", "", "", "", "TOTAL", f"{curr_symbol}{grand:,.2f}"])

        items_tbl = Table(rows, colWidths=[8*mm, 65*mm, 16*mm, 16*mm, 35*mm, 30*mm])
        items_tbl.setStyle(TableStyle([
            # Header
            ("BACKGROUND", (0, 0), (-1, 0), accent),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("PADDING", (0, 0), (-1, -1), 7),
            ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
            ("GRID", (0, 0), (-1, -3), 0.3, colors.HexColor("#e2e8f0")),
            # Subtotal row
            ("LINEABOVE", (0, -2), (-1, -2), 0.5, mid),
            ("FONTNAME", (4, -2), (-1, -2), "Helvetica"),
            # Total row
            ("BACKGROUND", (0, -1), (-1, -1), dark),
            ("TEXTCOLOR", (0, -1), (-1, -1), colors.white),
            ("FONTNAME", (4, -1), (-1, -1), "Helvetica-Bold"),
            ("FONTSIZE", (4, -1), (-1, -1), 10),
            # Alt row shading
            *[("BACKGROUND", (0, i), (-1, i), light_bg) for i in range(2, len(rows)-2, 2)],
        ]))
        els.append(items_tbl)
    else:
        # Fallback — just show total_value if no line items
        els.append(Paragraph(f"Total Value: {curr_symbol}{prop.total_value:,.2f}" if prop.total_value else "No items.", normal))

    # ── NOTES ─────────────────────────────────────────────────────────────────
    if prop.content:
        els.append(Spacer(1, 16))
        els.append(Paragraph("Notes", h2))
        for para in prop.content.split("\n"):
            if para.strip():
                els.append(Paragraph(para.strip(), normal))
                els.append(Spacer(1, 4))

    els.append(Spacer(1, 20))
    els.append(HRFlowable(width="100%", thickness=0.5, color=mid))
    els.append(Spacer(1, 6))
    els.append(Paragraph("SERP Hawk — Thank you for your business!", footer_s))

    doc.build(els)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="quotation-Q{prop.id:04d}.pdf"'
    })


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

from database import Deal

@app.get("/deals")
def get_deals(user_id: Optional[int] = None, session: Session = Depends(get_session)):
    q = select(Deal).order_by(Deal.created_at.desc())
    if user_id:
        q = q.where(Deal.assigned_to == user_id)
    deals = session.exec(q).all()
    
    # We fetch client names for the UI manually
    results = []
    for d in deals:
        client = session.get(ClientProfile, d.client_id)
        results.append({
            "id": d.id,
            "title": d.title,
            "value": d.value,
            "client_id": d.client_id,
            "client_name": client.companyName or client.email if client else "Unknown",
            "assigned_to": d.assigned_to,
            "stage": d.stage,
            "expected_close_date": d.expected_close_date,
            "created_at": d.created_at.isoformat()
        })
    return {"deals": results}

@app.post("/deals")
def create_deal(body: DealCreateRequest, session: Session = Depends(get_session)):
    deal = Deal(
        title=body.title,
        value=body.value,
        client_id=body.client_id,
        assigned_to=body.assigned_to,
        stage=body.stage,
        expected_close_date=body.expected_close_date
    )
    session.add(deal)
    session.commit()
    session.refresh(deal)
    return {"ok": True, "id": deal.id}

@app.put("/deals/{deal_id}")
def update_deal(deal_id: int, body: DealUpdateRequest, session: Session = Depends(get_session)):
    deal = session.get(Deal, deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    if body.title is not None: deal.title = body.title
    if body.value is not None: deal.value = body.value
    if body.assigned_to is not None: deal.assigned_to = body.assigned_to
    if body.stage is not None: deal.stage = body.stage
    if body.expected_close_date is not None: deal.expected_close_date = body.expected_close_date
    deal.updated_at = datetime.utcnow()
    session.add(deal)
    session.commit()
    return {"ok": True}

@app.delete("/deals/{deal_id}")
def delete_deal(deal_id: int, session: Session = Depends(get_session)):
    deal = session.get(Deal, deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    session.delete(deal)
    session.commit()
    return {"ok": True}


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
    from modules.api_tracker import current_salesperson_id
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
    from modules.api_tracker import current_salesperson_id
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

@app.get("/chatbot/history/{session_id}")
async def get_chatbot_history(session_id: str, session: Session = Depends(get_session)):
    from database import ChatbotMessage
    messages = session.exec(select(ChatbotMessage).where(ChatbotMessage.session_id == session_id).order_by(ChatbotMessage.created_at.asc())).all()
    history = []
    for m in messages:
        history.append({
            "role": "bot" if m.role == "assistant" else "user",
            "text": m.content,
            "action": m.action_taken
        })
    return {"ok": True, "history": history}

# ─── Chatbot endpoint ────────────────────────────────────────────────────────
@app.post("/chatbot/message")
async def chatbot_message(
    request: ChatbotRequest, 
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session)
):
    from modules.llm_engine import process_chatbot_command
    from database import ClientProfile, ClientNote, ConversationLog, ActivityLog, Project, MarketplaceService, User, ChatbotSession, ChatbotMessage
    from modules.api_tracker import current_salesperson_id
    
    user_id = current_salesperson_id.get()

    # Handle Session Memory
    session_id = request.session_id or f"anon_{datetime.utcnow().timestamp()}"
    cb_session = session.exec(select(ChatbotSession).where(ChatbotSession.session_id == session_id)).first()
    if not cb_session:
        cb_session = ChatbotSession(session_id=session_id, user_id=user_id)
        session.add(cb_session)
        session.commit()
    
    # Save user message
    user_msg = ChatbotMessage(session_id=session_id, role="user", content=request.message)
    session.add(user_msg)
    session.commit()
    
    # Load recent history (last 10 messages)
    history_records = session.exec(select(ChatbotMessage).where(ChatbotMessage.session_id == session_id).order_by(ChatbotMessage.created_at.desc()).limit(10)).all()
    history_records.reverse()
    chat_history_str = "\n".join([f"{m.role}: {m.content}" for m in history_records])

    # Gather rich CRM summary for context
    active_clients = session.exec(select(ClientProfile).limit(10)).all()
    client_names = [c.companyName for c in active_clients if c.companyName]
    crm_summary = f"CRM Summary: {len(client_names)} active clients ({', '.join(client_names[:5])}...)\nHistory:\n{chat_history_str}"
    
    client_context = None
    if request.client_id:
        cp = session.get(ClientProfile, request.client_id)
        if cp:
            client_context = {
                "client_id": cp.id,
                "company_name": cp.companyName,
                "contact_person": cp.contact_person,
                "email": cp.user.email if cp.user else None,
                "industry": cp.industry
            }
            
    # Advanced Omni-Agent AI processing
    result = process_chatbot_command(request.message, client_context, request.current_route, crm_summary, user_role=request.user_role)
    
    actions = result.get("actions", [])
    action_taken = None
    route = None
    
    try:
        for action_obj in actions:
            action_name = action_obj.get("action")
            params = action_obj.get("parameters", {})
            
            if action_name == "research_lead":
                from database import Lead
                company_name = params.get("company_name", "Unknown Company")
                website = params.get("website", "")
                
                # Create lead immediately
                lead = Lead(
                    company_name=company_name,
                    website=website,
                    email="",
                    source="Chatbot Auto-Research",
                    status="New"
                )
                session.add(lead)
                session.commit()
                session.refresh(lead)
                
                # Kick off smart research endpoint logic in background or inline
                # For simplicity, we just use the background task if it was a website
                if website:
                    # We can use the existing _auto_research_client_bg, but that is for ClientProfile
                    # We should probably do a smart-research call for this Lead
                    # Let's trigger a background smart research for Lead
                    pass
                
                action_taken = "lead_created"
                route = f"/leads/{lead.id}"
                
            elif action_name == "bulk_import_websites":
                from modules.scraper import scrape_website
                from modules.llm_engine import extract_client_profile_from_website
                
                urls = params.get("urls", [])
                for website_url in urls:
                    # Create a skeleton client first
                    cp = ClientProfile(
                        companyName=website_url.replace("https://", "").replace("http://", "").split("/")[0],
                        websiteUrl=website_url,
                        status="Active",
                        tagline="Scraping in progress..."
                    )
                    session.add(cp)
                    session.commit()
                    session.refresh(cp)
                    
                    # Spawn the background task to scrape and auto-research!
                    background_tasks.add_task(_auto_research_client_bg, cp.id, website_url)
                    
                action_taken = "bulk_clients_created"
                
            elif action_name == "create_client":
                from modules.scraper import scrape_website
                from modules.llm_engine import extract_client_profile_from_website
                
                website_url = params.get("website")
                email = params.get("email") or f"bot_{datetime.utcnow().timestamp()}@placeholder.com"
                existing_user = session.exec(select(User).where(User.email == email)).first() if hasattr(User, 'email') else None
                user = existing_user
                if not user:
                    user = User(
                        email=email,
                        password="changeme",
                        name=params.get("company_name") or "Client",
                        role="Client",
                    )
                    session.add(user)
                    session.commit()
                    session.refresh(user)

                cp = ClientProfile(
                    userId=user.id,
                    companyName=params.get("company_name", "New Client"),
                    websiteUrl=website_url,
                    phone=params.get("phone", ""),
                    status="Active"
                )
                session.add(cp)
                session.commit()
                session.refresh(cp)
                action_taken = "client_created"
                route = f"/clients/{cp.id}"
                
                if website_url:
                    background_tasks.add_task(_auto_research_client_bg, cp.id, website_url)
                
            elif action_name == "create_deal":
                from database import Deal
                client_id = params.get("client_id") or request.client_id
                if client_id:
                    deal = Deal(
                        title=params.get("title", "New Deal"),
                        client_id=client_id,
                        stage=params.get("stage", "Lead"),
                        value=params.get("value", 0.0),
                        notes="Created by Omni-Agent"
                    )
                    session.add(deal)
                    session.commit()
                    action_taken = "deal_created"
                    
            elif action_name == "draft_email":
                client_id = params.get("client_id") or request.client_id
                if client_id:
                    # In a real setup, we would call generate_email() here and save it to an EmailLog.
                    # For now, navigate to the email agent
                    action_taken = "navigate"
                    route = f"/email-agent?client_id={client_id}"
                
            elif action_name == "navigate_user":
                action_taken = "navigate"
                route = params.get("route", "/")
                
            elif action_name == "trigger_whatsapp_support":
                action_taken = "trigger_whatsapp"
                
                # 1. Update the reply for the user
                result["reply"] = "I've notified our live agents. Please wait a moment while they connect."
                
                # 2. Extract issue summary
                issue_summary = params.get("issue_summary", result.get("reply", "No issue summary provided."))
                
                # 3. Create LiveChatSession and Send AI WhatsApp summary to admin
                try:
                    from database import LiveChatSession
                    if request.session_id:
                        # check if exists
                        existing_lcs = session.exec(select(LiveChatSession).where(LiveChatSession.session_id == request.session_id)).first()
                        if not existing_lcs:
                            lcs = LiveChatSession(
                                session_id=request.session_id,
                                status="pending",
                                client_id=client_context["client_id"] if client_context else None
                            )
                            session.add(lcs)
                            session.commit()
                    
                    from modules.whatsapp import send_whatsapp_message
                    
                    company = client_context["company_name"] if client_context else "Unknown Visitor"
                    msg = f"🚨 *Live Chat Request!* 🚨\n\n*From:* {company}\n*Issue:* {issue_summary}\n\n*Chat History:*\n{request.chat_history or request.message}\n\nReply *YES* to claim this chat and talk directly to the visitor!"
                    
                    from database import User
                    admins = session.exec(select(User).where(User.role.in_(["SuperAdmin", "Admin"]))).all()
                    
                    admin_phones = []
                    for adm in admins:
                        if adm.phone:
                            p = adm.phone.replace("whatsapp:", "").replace("+", "").replace("-", "").replace(" ", "").strip()
                            admin_phones.append(f"whatsapp:+{p}")
                            
                    if not admin_phones:
                        print("No admins with phone numbers found for live chat handoff.")
                    else:
                        for phone_str in set(admin_phones):
                            try:
                                send_whatsapp_message(msg, phone_str)
                                
                                # Store a pending action in WhatsAppSession so if they reply YES it triggers live chat
                                from database import WhatsAppSession
                                import json
                                pending = session.exec(select(WhatsAppSession).where(WhatsAppSession.phone_number == phone_str)).first()
                                if pending:
                                    session.delete(pending)
                                new_pending = WhatsAppSession(
                                    phone_number=phone_str,
                                    pending_action="claim_live_chat",
                                    action_data=json.dumps({"session_id": request.session_id}) if request.session_id else "{}"
                                )
                                session.add(new_pending)
                            except Exception as e:
                                print(f"Failed to send to {phone_str}: {e}")
                        session.commit()
                    
                except Exception as e:
                    print("WhatsApp Chatbot Handoff Error:", e)
                
            elif action_name == "add_note_to_client":
                target_client_id = request.client_id or params.get("client_id")
                if target_client_id:
                    new_note = ClientNote(
                        client_id=target_client_id,
                        content=params.get("content", ""),
                        author_name="Omni-Agent",
                        type="Note"
                    )
                    session.add(new_note)
                    log = ActivityLog(clientId=target_client_id, action="Note Added via Omni-Agent", details=new_note.content[:100], method="bot")
                    session.add(log)
                    session.commit()
                    action_taken = "note_added"
                    
    except Exception as e:
        print(f"Chatbot mutation error: {e}")

    # Save bot message
    try:
        bot_reply = result.get("reply", "I processed your request.")
        bot_msg = ChatbotMessage(session_id=session_id, role="assistant", content=bot_reply, action_taken=action_taken)
        session.add(bot_msg)
        session.commit()
    except Exception as e:
        print(f"Failed to save bot message: {e}")

    # Fallback response format for the frontend
    return {
        "reply": result.get("reply", "I processed your request."),
        "intent": "omni_agent", # Legacy
        "actions": actions,
        "action_taken": action_taken,
        "route": route
    }

class LiveChatSendRequest(BaseModel):
    message: str

@app.post("/chatbot/live-chat/{session_id}/send")
def live_chat_send(session_id: str, request: LiveChatSendRequest, db: Session = Depends(get_session)):
    from database import LiveChatSession, LiveChatMessage, WhatsAppSession
    lcs = db.exec(select(LiveChatSession).where(LiveChatSession.session_id == session_id)).first()
    if not lcs or lcs.status != "active":
        return {"ok": False, "error": "Live chat is not active"}
    
    # Save message
    msg = LiveChatMessage(session_id=session_id, sender="user", message=request.message)
    db.add(msg)
    db.commit()
    
    # Forward to WhatsApp
    from modules.whatsapp import send_whatsapp_message
    active_admin = db.exec(select(WhatsAppSession).where(WhatsAppSession.active_live_chat_session == session_id)).first()
    if active_admin:
        send_whatsapp_message(f"👤 *Visitor:* {request.message}", active_admin.phone_number)
        
    return {"ok": True}

@app.get("/chatbot/live-chat/{session_id}/sync")
def live_chat_sync(session_id: str, db: Session = Depends(get_session)):
    from database import LiveChatSession, LiveChatMessage
    lcs = db.exec(select(LiveChatSession).where(LiveChatSession.session_id == session_id)).first()
    if not lcs:
        return {"status": "inactive", "messages": []}
    
    # Fetch all admin messages
    messages = db.exec(select(LiveChatMessage).where(LiveChatMessage.session_id == session_id).order_by(LiveChatMessage.timestamp.asc())).all()
    
    return {
        "status": lcs.status,
        "messages": [
            {"sender": m.sender, "message": m.message, "timestamp": m.timestamp.isoformat()}
            for m in messages
        ]
    }



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


def _marketplace_row(s: MarketplaceService) -> dict:
    return {
        "id": s.id,
        "service_name": s.service_name,
        "normalized_name": s.normalized_name,
        "category": s.category,
        "description": s.description,
        "estimated_cost": s.estimated_cost,
        "cost_is_estimated": s.cost_is_estimated,
        "provider_name": s.provider_name,
        "provider_client_id": s.provider_client_id,
        "provider_industry": s.provider_industry,
        "provider_address": s.provider_address,
        "source": s.source,
        "is_active": s.is_active,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


@app.get("/marketplace/services")
def list_marketplace_services(
    search: Optional[str] = None,
    category: Optional[str] = None,
    min_cost: Optional[float] = None,
    max_cost: Optional[float] = None,
    provider: Optional[str] = None,
    page: int = 1,
    per_page: int = 18,
    session: Session = Depends(get_session),
):
    _require_roles(session, ["Admin"])
    query = select(MarketplaceService).where(MarketplaceService.is_active == True)
    # Filter by tenant so each account only sees their own extracted services
    tenant_id = current_tenant_id.get()
    if tenant_id and tenant_id > 0:
        query = query.where(
            or_(
                MarketplaceService.tenant_id == tenant_id,
                MarketplaceService.tenant_id == None,
            )
        )

    if search:
        like = f"%{search}%"
        query = query.where(
            or_(
                MarketplaceService.service_name.ilike(like),
                MarketplaceService.description.ilike(like),
                MarketplaceService.provider_name.ilike(like),
            )
        )
    if category:
        query = query.where(MarketplaceService.category.ilike(f"%{category}%"))
    if min_cost is not None:
        query = query.where(MarketplaceService.estimated_cost >= min_cost)
    if max_cost is not None:
        query = query.where(MarketplaceService.estimated_cost <= max_cost)
    if provider:
        query = query.where(MarketplaceService.provider_name.ilike(f"%{provider}%"))

    total = len(session.exec(query).all())
    offset = (page - 1) * per_page
    items = session.exec(query.offset(offset).limit(per_page)).all()

    return {
        "services": [_marketplace_row(s) for s in items],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": max(1, -(-total // per_page)),
    }


@app.post("/marketplace/services")
def create_marketplace_service(
    body: MarketplaceServiceCreate,
    session: Session = Depends(get_session),
):
    _require_roles(session, ["Admin"])
    # Auto-fill provider info from CRM if client_id given
    provider_name = body.provider_name
    provider_industry = None
    provider_address = None
    if body.provider_client_id:
        cp = session.get(ClientProfile, body.provider_client_id)
        if cp:
            provider_name = provider_name or cp.companyName
            provider_industry = cp.industry
            provider_address = cp.address

    svc = MarketplaceService(
        service_name=body.service_name,
        category=body.category,
        description=body.description,
        estimated_cost=body.estimated_cost,
        provider_client_id=body.provider_client_id,
        provider_name=provider_name,
        provider_industry=provider_industry,
        provider_address=provider_address,
        source="manual",
    )
    session.add(svc)
    session.commit()
    session.refresh(svc)
    return {"service": _marketplace_row(svc)}


@app.put("/marketplace/services/{service_id}")
def update_marketplace_service(
    service_id: int,
    body: MarketplaceServiceUpdate,
    session: Session = Depends(get_session),
):
    _require_roles(session, ["Admin"])
    svc = session.get(MarketplaceService, service_id)
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(svc, field, value)
    svc.updated_at = datetime.utcnow()
    session.add(svc)
    session.commit()
    session.refresh(svc)
    return {"service": _marketplace_row(svc)}


@app.delete("/marketplace/services/{service_id}")
def delete_marketplace_service(
    service_id: int,
    session: Session = Depends(get_session),
):
    _require_roles(session, ["Admin"])
    svc = session.get(MarketplaceService, service_id)
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")
    svc.is_active = False
    svc.updated_at = datetime.utcnow()
    session.add(svc)
    session.commit()
    return {"success": True}


@app.get("/marketplace/categories")
def list_marketplace_categories(
    session: Session = Depends(get_session),
):
    _require_roles(session, ["Admin"])
    rows = session.exec(
        select(MarketplaceService.category)
        .where(MarketplaceService.is_active == True)
        .where(MarketplaceService.category != None)
        .distinct()
        .order_by(MarketplaceService.category)
    ).all()
    return {"categories": [r for r in rows if r]}


@app.post("/marketplace/services/{service_id}/ai-categorize")
def ai_categorize_marketplace_service(
    service_id: int,
    session: Session = Depends(get_session),
):
    _require_roles(session, ["Admin"])
    svc = session.get(MarketplaceService, service_id)
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")

    import openai, os
    client_ai = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    prompt = f"""You are a B2B service categorization expert.

Given this service:
Name: {svc.service_name}
Description: {svc.description or 'N/A'}
Provider Industry: {svc.provider_industry or 'N/A'}

Respond with ONLY valid JSON (no markdown):
{{
  "normalized_name": "<clean, professional service name>",
  "category": "<one of: SEO, Web Design, Plumbing, Legal, Accounting, Marketing, Consulting, Construction, Healthcare, Real Estate, IT Services, Landscaping, Cleaning, Electrical, HVAC, Other>",
  "estimated_cost_usd": <number or null if truly unknown>,
  "cost_is_estimated": <true or false>
}}"""

    try:
        response = client_ai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
        )
        import json
        data = json.loads(response.choices[0].message.content.strip())
        svc.normalized_name = data.get("normalized_name", svc.service_name)
        svc.category = data.get("category", svc.category)
        if data.get("estimated_cost_usd") is not None:
            svc.estimated_cost = float(data["estimated_cost_usd"])
            svc.cost_is_estimated = data.get("cost_is_estimated", True)
        svc.updated_at = datetime.utcnow()
        session.add(svc)
        session.commit()
        session.refresh(svc)
        return {"service": _marketplace_row(svc)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI categorization failed: {e}")

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

@app.post("/radar/search")
async def radar_search(body: RadarSearchRequest):
    """Search for a business on Google Maps and return its exact place details."""
    try:
        from modules.radar_engine import find_place
        if body.place_id:
            from modules.radar_engine import get_place_details
            place = await get_place_details(body.place_id)
        else:
            place = await find_place(body.query, body.location_hint)
            
        if not place:
            fallback_location = body.location_hint
            website_to_scrape = body.website
            
            # Extract website from query if not provided explicitly
            if not website_to_scrape:
                import re
                urls = re.findall(r'(https?://\S+|www\.\S+|\b\w+\.\w{2,}\b)', body.query)
                for u in urls:
                    if "." in u and len(u.split(".")[-1]) >= 2:
                        website_to_scrape = u
                        break
            
            if not fallback_location and website_to_scrape:
                try:
                    from modules.scraper import scrape_website
                    from openai import AsyncOpenAI
                    import os
                    
                    try:
                        scraped_text = await scrape_website(website_to_scrape)
                    except Exception:
                        scraped_text = ""
                        
                    from modules.llm_engine import get_openai_client
                    client_ai = get_openai_client()
                    resp = client_ai.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=[
                            {"role": "system", "content": "You are a data extraction assistant. Return ONLY the primary physical city and state (e.g. 'Miami, FL' or 'San Francisco, CA') for the given company. Use the provided website content if available, otherwise use your internal knowledge. If totally unknown, reply 'UNKNOWN'."},
                            {"role": "user", "content": f"Company: {body.company_name or body.query}\nWebsite: {website_to_scrape}\n\nWebsite Content:\n{scraped_text[:10000]}"}
                        ],
                        temperature=0
                    )
                    extracted = resp.choices[0].message.content.strip()
                    if extracted and extracted.upper() != "UNKNOWN":
                        fallback_location = extracted
                except Exception as e:
                    print(f"Failed to scrape/extract location: {e}")
            
            geocode_place = None
            if fallback_location:
                geocode_place = await find_place(fallback_location)
                
            if geocode_place:
                place = {
                    "place_id": geocode_place.get("place_id", "synthetic_id"),
                    "name": body.company_name or (body.query.split()[0] if body.query else "Target Business"),
                    "address": geocode_place.get("address", fallback_location),
                    "lat": geocode_place.get("lat"),
                    "lng": geocode_place.get("lng"),
                    "website": website_to_scrape or "",
                    "phone": "",
                    "rating": 5.0,
                    "reviews": 1,
                    "types": [],
                    "business_status": "OPERATIONAL"
                }
            else:
                # If no location is found from Google API or GPT, we don't default to NY.
                # We tell the user exactly what happened.
                if not fallback_location and not scraped_text:
                    err = f"Could not find a location on the website for '{body.company_name or body.query}'. The business might be fully remote. Please provide a manual location below."
                elif not fallback_location and scraped_text:
                    err = f"Our AI scanned the website, but '{body.company_name or body.query}' appears to be a fully remote business with no physical headquarters. Please manually enter a target city to scan."
                else:
                    err = f"Could not find the target location '{fallback_location}' on Google Maps. The name might be ambiguous."
                
                raise HTTPException(status_code=404, detail=err)

        return {"place": place}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Radar search failed: {e}")

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

@app.post("/automations/intelligence-scan")
async def automations_intelligence_scan(body: AutomationScanRequest):
    import json as _json
    import os
    import requests
    from modules.llm_engine import get_openai_client
    from modules.scraper import scrape_website
    
    url = body.url.strip()
    if not url.startswith("http"):
        url = "https://" + url
    
    domain = url.replace("https://", "").replace("http://", "").split("/")[0]
    
    try:
        scraped_content = await scrape_website(url)
    except Exception as e:
        scraped_content = f"Failed to scrape: {str(e)}"
        
    serp_data_str = "No Google Search API key provided, search data unavailable."
    serper_api_key = os.environ.get("SERPER_API_KEY")
    if serper_api_key:
        try:
            search_query = domain.split(".")[0].capitalize()
            payload = _json.dumps({"q": search_query})
            headers = {
                'X-API-KEY': serper_api_key,
                'Content-Type': 'application/json'
            }
            serp_response = requests.post("https://google.serper.dev/search", headers=headers, data=payload, timeout=10)
            if serp_response.ok:
                serp_json = serp_response.json()
                serp_data_str = _json.dumps({
                    "knowledgeGraph": serp_json.get("knowledgeGraph"),
                    "organic": serp_json.get("organic", [])[:10]
                })
        except Exception as e:
            serp_data_str = f"Error fetching SERP: {str(e)}"
    
    prompt = f"""
    You are an expert business intelligence gathering AI.
    We are running a scan on the website/domain: {url} ({domain}).
    
    Here is the live, scraped content of their website (which may include extracted social links):
    <scraped_content>
    {scraped_content[:15000]}
    </scraped_content>
    
    Here is live Google Search data for the company (including Organic results and Google Maps/Knowledge Graph data):
    <google_search_data>
    {serp_data_str}
    </google_search_data>
    
    Based ONLY on the provided scraped content and Google Search data:
    1. Extract their real social profiles from the scrape or organic search results. Do not guess.
    2. Extract their Google Maps rating and review count from the knowledgeGraph (if present) to formulate a review mention.
    3. Use the organic search results to populate the `webMentions`. For example, if a top organic result is their LinkedIn page, Crunchbase, or a news article, list it exactly as found in the search data.
    4. Estimate Google Search Volume, Trend, and Size based on the search presence and scraped content.
    
    Return ONLY a valid JSON object matching the following structure EXACTLY:
    {{
        "domain": "{domain}",
        "name": "Company Name (extracted or inferred)",
        "googleSearchVolume": "Number/mo (e.g. '15,000/mo')",
        "googleTrend": "rising",
        "socialProfiles": [
            {{
                "platform": "LinkedIn",
                "handle": "extracted_handle",
                "followers": "10.5K",
                "engagement": "2.5%",
                "url": "https://linkedin.com/company/handle",
                "verified": true,
                "color": "#0A66C2",
                "popularity": 85
            }}
        ],
        "webMentions": [
            {{
                "title": "Exact Title from organic search results or knowledge graph",
                "url": "https://exact-url-from-search.com",
                "domain": "exact-domain.com",
                "snippet": "Short snippet from organic result...",
                "domainAuthority": 80,
                "type": "news"
            }}
        ],
        "estimatedSize": "SMB (11-50)",
        "sizeScore": 45,
        "overallScore": 75
    }}
    
    Provide up to 4 social platforms if found. Provide 4-6 web mentions STRICTLY derived from the `<google_search_data>` and `<scraped_content>`.
    Platform colors: LinkedIn: #0A66C2, Twitter/X: #000000, Instagram: #E4405F, Facebook: #1877F2, YouTube: #FF0000
    Mention types must be: news, directory, social, review, partner, or blog.
    Estimated size must be: Startup (1-10), SMB (11-50), Mid-Market (51-200), or Enterprise (200+)
    Google trend must be: rising, stable, or declining.
    
    Do not use markdown blocks. Return only raw JSON.
    """
    
    try:
        client_ai = get_openai_client()
        resp = client_ai.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=2000,
            response_format={"type": "json_object"}
        )
        content = resp.choices[0].message.content.strip()
        data = _json.loads(content)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to scan: {str(e)}")

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

@app.get("/leads/export-csv")
def export_leads_csv(owner_id: Optional[int] = None, session: Session = Depends(get_session)):
    from fastapi.responses import StreamingResponse
    import io as _io
    import csv as _csv
    import json as _json

    query = select(Lead)
    if owner_id is not None:
        query = query.where(Lead.owner_id == owner_id)
    tenant_id = current_tenant_id.get()
    if tenant_id and tenant_id != 1:
        query = query.where(Lead.tenant_id == tenant_id)
    leads = session.exec(query.order_by(Lead.created_at.desc())).all()

    # Build user lookup for owner names
    all_user_ids = list({l.owner_id for l in leads if l.owner_id})
    users_by_id = {}
    if all_user_ids:
        users = session.exec(select(User).where(User.id.in_(all_user_ids))).all()
        users_by_id = {u.id: u for u in users}
    
    output = _io.StringIO()
    writer = _csv.writer(output)

    def _flatten_ai(val):
        """Convert AI analysis JSON into readable plain text."""
        if not val:
            return ""
        try:
            if isinstance(val, str):
                val = _json.loads(val)
            def extract(obj):
                if isinstance(obj, dict):
                    return [x for v in obj.values() for x in extract(v)]
                elif isinstance(obj, list):
                    return [x for v in obj for x in extract(v)]
                else:
                    return [str(obj)] if obj and str(obj).strip() else []
            return ", ".join(extract(val))
        except Exception:
            pass
        return str(val)[:500]

    writer.writerow([
        "ID", "Company Name", "Website", "Industry", "Email", "Phone",
        "Address", "Source", "Status", "Lead Score", "Deal Value",
        "Assigned To", "Is Converted", "Notes", "Last Activity",
        "Created At", "AI Analysis Summary", "SWOT Analysis"
    ])

    for l in leads:
        owner = users_by_id.get(l.owner_id)
        owner_name = owner.name if owner else ""

        # Flatten AI analysis into readable text
        ai_text = _flatten_ai(l.ai_analysis_results)

        # Clean SWOT
        swot_raw = l.swot_analysis or ""
        if swot_raw.startswith("{") or swot_raw.startswith("["):
            swot_text = _flatten_ai(swot_raw)
        else:
            swot_text = swot_raw[:800]

        writer.writerow([
            l.id,
            l.company_name or "",
            l.website or "",
            l.industry or "",
            l.email or "",
            l.phone or "",
            l.address or "",
            l.source or "",
            l.status or "",
            l.lead_score if hasattr(l, "lead_score") and l.lead_score is not None else "",
            l.deal_value if hasattr(l, "deal_value") and l.deal_value is not None else "",
            owner_name,
            "Yes" if l.is_converted else "No",
            (l.notes or "")[:300],
            l.last_activity or "",
            l.created_at.strftime("%Y-%m-%d %H:%M") if l.created_at else "",
            ai_text[:800],
            swot_text,
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=serphawk_leads.csv"}
    )

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

@app.post("/leads/{lead_id}/extract-services")
async def extract_lead_services_endpoint(lead_id: int, session: Session = Depends(get_session)):
    """
    Scrapes the lead's website and uses AI to extract services they offer.
    Falls back to LLM world-knowledge when website is unreachable.
    Stores results in MarketplaceService table.
    """
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    website_url = lead.website
    company_name = lead.company_name or "Unknown Company"

    if not website_url:
        raise HTTPException(
            status_code=400,
            detail="Lead has no website URL. Add one in the lead profile first."
        )

    # ── Step 1: Try scraping (fail gracefully on any network error) ────────────
    website_text = ""
    scrape_method = "website_scrape"
    try:
        from modules.scraper import scrape_website
        website_text = await scrape_website(website_url)
        if website_text.startswith("ERROR"):
            print(f"[extract-services] Scrape failed for {website_url}: {website_text[:100]}. Falling back to LLM.")
            website_text = ""
            scrape_method = "llm_fallback"
    except Exception as scrape_err:
        print(f"[extract-services] Scraper exception ({website_url}): {scrape_err}. Falling back to LLM.")
        scrape_method = "llm_fallback"

    # ── Step 2: Extract services (from scraped text, or via LLM knowledge) ─────
    import json as _json
    from modules.llm_engine import extract_client_services as _extract_services, get_openai_client

    services = []

    if website_text:
        services = _extract_services(website_text, company_name)

    # If scraping failed or extracted nothing → use LLM world-knowledge fallback
    if not services:
        scrape_method = "llm_fallback"
        try:
            oai = get_openai_client()
            fallback_prompt = f"""You are a B2B business intelligence expert.

The company "{company_name}" has website: {website_url}
Industry: {lead.industry or "unknown"}

We could not access their website. Based on the company name, domain, and industry,
list the most likely services they offer.

Return ONLY valid JSON:
{{
  "services": [
    {{
      "name": "Service name",
      "brief": "1-2 sentence description of this service",
      "category": "One of: SEO, Web Design, Marketing, Plumbing, Legal, Accounting, Consulting, Construction, Healthcare, Real Estate, IT Services, Landscaping, Cleaning, Electrical, HVAC, Retail, Education, Finance, Transportation, Other",
      "approx_cost": 1200,
      "cost_is_estimated": true
    }}
  ]
}}

Rules: 3-8 services max. approx_cost in USD. cost_is_estimated always true for fallback."""
            resp = oai.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": fallback_prompt}],
                response_format={"type": "json_object"},
                temperature=0.3,
            )
            services = _json.loads(resp.choices[0].message.content).get("services", [])
        except Exception as llm_err:
            print(f"[extract-services] LLM fallback also failed: {llm_err}")

    if not services:
        return {
            "ok": False,
            "extracted_count": 0,
            "marketplace_count": 0,
            "scrape_method": scrape_method,
            "message": "Could not extract services. Try adding the Industry field to improve AI fallback accuracy.",
        }

    # ── Step 3: Save to Lead ai_analysis_results (simulate services_offered) ────────
    if lead.ai_analysis_results:
        if isinstance(lead.ai_analysis_results, str):
            try:
                import json as _j
                analysis_data = _j.loads(lead.ai_analysis_results)
            except:
                analysis_data = {}
        else:
            analysis_data = dict(lead.ai_analysis_results)
    else:
        analysis_data = {}
    analysis_data["product_portfolio"] = services
    analysis_data["services_offered"] = services
    lead.ai_analysis_results = analysis_data
    session.add(lead)

    # ── Step 4: Upsert into MarketplaceService (skip exact name duplicates) ───
    existing = session.exec(
        select(MarketplaceService).where(
            MarketplaceService.provider_name == company_name,
            MarketplaceService.is_active == True,
        )
    ).all()
    existing_names = {s.service_name.lower() for s in existing}

    added = 0
    for svc in services:
        svc_name = svc.get("name", "").strip()
        if not svc_name or svc_name.lower() in existing_names:
            continue
        ms = MarketplaceService(
            service_name=svc_name,
            normalized_name=svc_name,
            category=svc.get("category"),
            description=svc.get("brief"),
            estimated_cost=float(str(svc.get("approx_cost", "0")).replace("$", "").replace(",", "").split("-")[0].strip() if str(svc.get("approx_cost", "0")).replace("$", "").replace(",", "").split("-")[0].strip().replace(".","").isdigit() else 0),
            cost_is_estimated=svc.get("cost_is_estimated", True),
            provider_name=company_name,
            provider_client_id=None,
            provider_industry=lead.industry,
            provider_address=lead.address,
            source=scrape_method,
            tenant_id=current_tenant_id.get(),
        )
        session.add(ms)
        existing_names.add(svc_name.lower())
        added += 1

    session.commit()

    method_label = "live website" if scrape_method == "website_scrape" else "AI knowledge (site unreachable)"
    return {
        "ok": True,
        "services": services,
        "marketplace_entries_added": added,
        "extracted_count": len(services),
        "marketplace_count": added,
        "scrape_method": scrape_method,
        "message": f"Extracted {len(services)} services via {method_label}. Added {added} to Marketplace.",
    }

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


@app.post("/leads/{lead_id}/generate-outbound-draft")
def generate_lead_outbound_draft(lead_id: int, session: Session = Depends(get_session)):
    check_tenant_limit(session, "emails")
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
        
    try:
        from modules.llm_engine import get_openai_client
        import json as _json
        client_ai = get_openai_client()
        
        # Get existing research
        research = session.exec(select(ClientResearch).where(ClientResearch.lead_id == lead_id)).first()
        
        # If no OSINT data yet, run deep investigation synchronously (blocking) so we have rich context
        if not research or not research.email_agent_data:
            from modules.llm_engine import deep_investigate_company
            url = lead.website or ""
            if not url and lead.company_name:
                slug = lead.company_name.lower().replace(" ", "").replace(",","").replace(".","")
                url = f"https://www.{slug}.com"
            
            if url:
                print(f"[DraftGen] No existing research for lead {lead_id}. Running deep investigation first...")
                try:
                    osint_data = deep_investigate_company(
                        company_name=lead.company_name or "Unknown",
                        website=url,
                        scraped_text=""
                    )
                    # Save research so it's available and also for context
                    if not research:
                        research = ClientResearch(lead_id=lead_id, tenant_id=current_tenant_id.get())
                        session.add(research)
                    research.company_overview = osint_data.get("company_overview", "")
                    research.email_agent_data = _json.dumps(osint_data)
                    # Update lead phone/email if found
                    contacts = osint_data.get("contacts", []) or []
                    contact = contacts[0] if contacts else {}
                    company_info = osint_data.get("company_info", {}) or {}
                    if not lead.email:
                        email_found = contact.get("email") or company_info.get("extracted_emails","").split(",")[0].strip()
                        if email_found: lead.email = email_found
                    if not lead.phone:
                        phone_found = contact.get("phone_number") or company_info.get("extracted_phone_numbers","").split(",")[0].strip()
                        if phone_found: lead.phone = phone_found
                    session.add(lead)
                    session.commit()
                    print(f"[DraftGen] Deep investigation complete for lead {lead_id}")
                except Exception as osint_err:
                    session.rollback()
                    print(f"[DraftGen] OSINT failed (continuing with draft anyway): {osint_err}")
                    # Re-fetch after rollback to avoid stale session state
                    research = session.exec(select(ClientResearch).where(ClientResearch.lead_id == lead_id)).first()

        research_context = ""
        if research:
            research_context = f"""
            Company Overview: {research.company_overview or 'N/A'}
            Pain Points: {research.pain_points or 'N/A'}
            Business Goals: {research.business_goals or 'N/A'}
            """
            if research.email_agent_data:
                try:
                    ea_data = _json.loads(research.email_agent_data)
                    research_context += f"\nEmail Agent Intel: {_json.dumps(ea_data.get('company_info', {}), indent=2)}"
                except:
                    pass

        # Get Notes (Leads don't have notes implemented yet, skipping)
        notes = []
        
        interaction_context = ""
        if notes:
            interaction_context += "Recent Notes:\n" + "\n".join([f"- {n.content}" for n in notes]) + "\n"


        prompt = f"""
        You are an expert SDR (Sales Development Representative) at an agency. 
        Write a highly personalized, cold outreach email draft for the following prospect.
        Company: {lead.company_name or 'Unknown'}
        Website: {lead.website or 'Unknown'}
        {research_context}

        {interaction_context}
        If there are recent notes or conversations above, make sure the email acknowledges them appropriately as a follow-up. If none exist, write a standard cold outreach email based on the research.

        
        Return ONLY valid JSON matching this schema exactly (no markdown formatting):
        {{
            "subject": "Email subject",
            "english_body": "Email body in English",
            "spanish_body": "Email body translated to Spanish",
            "whatsapp_draft": "Short, punchy WhatsApp message (plain text, emojis allowed)"
        }}
        """
        
        resp = client_ai.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=800,
        )
        content = resp.choices[0].message.content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            
        data = _json.loads(content)
        
        # Save as a draft in SentEmail
        from database import SentEmail
        to_email = lead.email or "unknown@example.com"
        
        draft = SentEmail(
            tenant_id=current_tenant_id.get(),
            lead_id=lead_id,
            to_email=to_email,
            subject=data.get("subject", "Proposal"),
            english_body=data.get("english_body", ""),
            spanish_body=data.get("spanish_body", ""),
            draft_json=_json.dumps(data),
            manual=True,
            sent_at=datetime.utcnow()
        )
        session.add(draft)
        
        # ── Safe upsert research (use existing row, never re-insert) ──────────
        if not research:
            research = session.exec(select(ClientResearch).where(ClientResearch.lead_id == lead_id)).first()
        if not research:
            research = ClientResearch(lead_id=lead_id, tenant_id=current_tenant_id.get())
            session.add(research)
        
        ea_payload = {}
        if research.email_agent_data:
            try:
                ea_payload = _json.loads(research.email_agent_data)
            except:
                pass
                
        # Ensure company_info exists so the UI doesn't show empty fields if auto-research wasn't run
        if "company_info" not in ea_payload:
            ea_payload["company_info"] = {
                "company_name": lead.company_name or "Unknown Company",
                "extracted_emails": lead.email or "",
                "extracted_phone_numbers": lead.phone or "",
                "company_social_media": {},
                "summary": "AI Draft generated. Run 'AI Agent Analysis' in Pre-Sales tab for deep OSINT data."
            }
            
        ea_payload["draft"] = data
        ea_payload["email_hook"] = data.get("whatsapp_draft", "Custom outreach generated from latest interactions.")
        
        research.email_agent_data = _json.dumps(ea_payload)
        
        session.commit()
        
        return {"ok": True, "draft": data}
    except Exception as e:
        session.rollback()
        print(f"Error generating lead draft: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to generate draft: {str(e)}")


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

@app.post("/leads/{lead_id}/ai/analyze")
async def analyze_lead_ai(lead_id: int, body: LeadAIAnalyzeRequest, session: Session = Depends(get_session)):
    from database import Lead
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
        
    url = lead.website or f"https://{lead.company_name.lower().replace(' ', '')}.com"
    
    results = lead.ai_analysis_results or {}
    
    try:
        from modules.llm_engine import get_openai_client
        import json
        client = get_openai_client()
        
        system_prompt = f"You are an elite B2B CRM intelligence AI. Analyze this target lead: Company: {lead.company_name}, Website: {url}, Industry: {lead.industry or 'Unknown'}. "
        
        prompt = None
        if body.agent_type == "scanner":
            prompt = system_prompt + """
Generate a highly detailed, professional website scan report. Return ONLY valid JSON matching exactly:
{
  "url": "the website url",
  "title": "Clean company name",
  "description": "2-3 sentence deep analysis of what they do",
  "industry": "Specific industry",
  "score": integer between 40-95,
  "issues": ["Issue 1", "Issue 2", "Issue 3", "Issue 4"],
  "opportunities": ["Opp 1", "Opp 2", "Opp 3"],
  "tech": ["Tech 1", "Tech 2", "Tech 3", "Tech 4"]
}
"""
        elif body.agent_type == "radar":
            prompt = system_prompt + """
Generate deeply researched, realistic social media and market intelligence insights. Return ONLY valid JSON matching exactly:
{
  "insights": ["Insight 1 (e.g. recent hires, funding, strategy)", "Insight 2", "Insight 3"],
  "social_links": {
    "linkedin": "Predicted company linkedin url",
    "twitter": "Predicted company twitter url"
  }
}
"""
        elif body.agent_type == "competitor":
            prompt = system_prompt + """
Identify 2 realistic competitors in their exact industry. Return ONLY valid JSON matching exactly:
{
  "competitor": [
    {
      "name": "Competitor 1",
      "url": "competitor1.com",
      "overlap": "High overlap %",
      "strengths": ["Strength 1", "Strength 2"],
      "weaknesses": ["Weakness 1", "Weakness 2"]
    },
    {
      "name": "Competitor 2",
      "url": "competitor2.com",
      "overlap": "Medium overlap %",
      "strengths": ["Strength 1", "Strength 2"],
      "weaknesses": ["Weakness 1", "Weakness 2"]
    }
  ]
}
"""
        elif body.agent_type == "email":
            prompt = system_prompt + """
Write a hyper-personalized, ultra-concise, and compelling cold outreach email to the CEO or decision-maker. 
CRITICAL RULES:
1. NO PLACEHOLDERS: Do NOT use brackets like [Your Name], [Your Company], etc. Write the email from the perspective of an elite B2B Growth/Marketing Agency (SerpHawk).
2. NO BOILERPLATE: Never use generic openers like "I hope this message finds you well" or "My name is X". Jump STRAIGHT into the value and why you are contacting them.
3. BE SPECIFIC: Use the actual insights, industry, and URL provided to make it hyper-relevant to their specific business.
4. KEEP IT SHORT: Keep it under 4 short paragraphs. Make it punchy.

Return ONLY valid JSON matching exactly:
{
  "subject": "Compelling, non-spammy subject line (lowercase, casual)",
  "body": "The full email body, formatted beautifully with line breaks."
}
"""
        elif body.agent_type == "calling":
            prompt = system_prompt + """
Write a professional, punchy, and conversational B2B sales teleprompter script for a sales agent to read on a cold call. 
CRITICAL RULES:
1. NO PLACEHOLDERS: Do NOT use brackets like [Your Name] or [Your Company]. Introduce yourself as calling from SerpHawk (an elite Growth/SEO agency).
2. SOUND HUMAN: Make it sound like a real person speaking, not a corporate robot. Use casual but professional language.
3. BE SPECIFIC: Use the lead's actual company name and industry to make the pitch highly relevant.

Return ONLY valid JSON matching exactly:
{
  "calling": {
    "intro": "The opening hook (casual, getting straight to the point)...",
    "value_prop": "The core pitch tailored to their specific industry...",
    "objections": ["If they say 'Not interested', say...", "If they say 'We already have an agency', say..."],
    "closing": "The soft call to action to book a meeting..."
  }
}
"""
        elif body.agent_type == "automations":
            results["automations"] = {
                "status": "Active",
                "workflows": [
                    "Auto-follow up if no reply in 3 days",
                    "Score lead based on email open rate",
                    "Notify Slack #sales when lead visits pricing page"
                ]
            }
            
        if prompt:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.7,
            )
            data = json.loads(response.choices[0].message.content)
            
            if body.agent_type == "calling":
                results["calling"] = data.get("calling", data)
            elif body.agent_type == "competitor":
                results["competitor"] = data.get("competitor", [])
            else:
                results[body.agent_type] = data

    except Exception as e:
        print(f"Error generating AI analysis: {e}")
        raise HTTPException(status_code=502, detail=f"AI generation failed: {e}")
        
    lead.ai_analysis_results = results
    
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(lead, "ai_analysis_results")
    
    session.add(lead)
    session.commit()
    session.refresh(lead)
    
    return {"ok": True, "lead": lead}

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

@app.post("/api/import/execute")
async def import_execute(
    module: str = Form(...),
    mapping: str = Form(...), # JSON string
    skip_duplicates: bool = Form(True),
    update_existing: bool = Form(False),
    file: UploadFile = File(...),
    session: Session = Depends(get_session)
):
    try:
        column_mapping = json.loads(mapping) # e.g. {"First Name": "first_name", ...}
        
        if file.filename.endswith('.csv'):
            df = pd.read_csv(file.file)
        else:
            df = pd.read_excel(file.file)
            
        df = df.fillna('')
        records = df.to_dict(orient='records')
        
        imported_count = 0
        skipped_count = 0
        updated_count = 0
        
        for record in records:
            mapped_record = {}
            for file_col, db_col in column_mapping.items():
                if file_col in record and db_col:
                    mapped_record[db_col] = record[file_col]
                    
            if not mapped_record:
                continue
                
            if module == 'leads':
                # Duplicate check by email or website
                existing = None
                if mapped_record.get('email'):
                    existing = session.exec(select(Lead).where(Lead.email == mapped_record['email'])).first()
                if not existing and mapped_record.get('website'):
                    existing = session.exec(select(Lead).where(Lead.website == mapped_record['website'])).first()
                    
                if existing:
                    if update_existing:
                        for k, v in mapped_record.items():
                            if v: setattr(existing, k, v)
                        session.add(existing)
                        updated_count += 1
                    else:
                        skipped_count += 1
                else:
                    if 'company_name' not in mapped_record or not mapped_record['company_name']:
                        mapped_record['company_name'] = 'Unknown Company'
                    lead = Lead(**mapped_record)
                    session.add(lead)
                    imported_count += 1
                    
            elif module == 'contacts':
                existing = None
                if mapped_record.get('email'):
                    existing = session.exec(select(Contact).where(Contact.email == mapped_record['email'])).first()
                    
                if existing:
                    if update_existing:
                        for k, v in mapped_record.items():
                            if v: setattr(existing, k, v)
                        session.add(existing)
                        updated_count += 1
                    else:
                        skipped_count += 1
                else:
                    if 'first_name' not in mapped_record or not mapped_record['first_name']:
                        mapped_record['first_name'] = 'Unknown'
                    contact = Contact(**mapped_record)
                    if contact.first_name and contact.last_name:
                        contact.full_name = f"{contact.first_name} {contact.last_name}"
                    elif contact.first_name:
                        contact.full_name = contact.first_name
                    session.add(contact)
                    imported_count += 1
            
            # Additional modules (accounts, clients) follow similar logic...
        
        session.commit()
        return {
            "success": True,
            "imported": imported_count,
            "skipped": skipped_count,
            "updated": updated_count,
            "total": len(records)
        }
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")



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
from database import Meeting, Product, CRMQuote, QuoteItem, SalesOrder, PurchaseOrder, Case, Solution

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

def _meeting_dict(m: Meeting, session: Session) -> dict:
    host = session.get(User, m.host_id) if m.host_id else None
    lead = session.get(Lead, m.lead_id) if m.lead_id else None
    client = session.get(ClientProfile, m.client_id) if m.client_id else None
    return {
        "id": m.id, "title": m.title, "description": m.description,
        "location": m.location, "meeting_type": m.meeting_type,
        "status": m.status,
        "scheduled_at": m.scheduled_at.isoformat() if m.scheduled_at else None,
        "duration_minutes": m.duration_minutes,
        "host_id": m.host_id, "host_name": host.name if host else None,
        "lead_id": m.lead_id, "lead_name": lead.company_name if lead else None,
        "client_id": m.client_id, "client_name": client.companyName if client else None,
        "attendees": m.attendees or [],
        "notes": m.notes, "outcome": m.outcome,
        "created_at": m.created_at.isoformat(),
        "updated_at": m.updated_at.isoformat(),
    }

@app.get("/meetings")
def list_meetings(
    status: Optional[str] = None,
    lead_id: Optional[int] = None,
    client_id: Optional[int] = None,
    session: Session = Depends(get_session)
):
    q = select(Meeting).order_by(Meeting.scheduled_at.desc())
    tenant_id = current_tenant_id.get()
    if tenant_id:
        q = q.where(Meeting.tenant_id == tenant_id)
        
    if status:
        q = q.where(Meeting.status == status)
    if lead_id:
        q = q.where(Meeting.lead_id == lead_id)
    if client_id:
        q = q.where(Meeting.client_id == client_id)
    meetings = session.exec(q).all()
    return {"meetings": [_meeting_dict(m, session) for m in meetings]}

@app.post("/meetings")
def create_meeting(body: MeetingCreateRequest, session: Session = Depends(get_session)):
    data = body.model_dump()
    if data.get("scheduled_at"):
        try:
            data["scheduled_at"] = datetime.fromisoformat(data["scheduled_at"])
        except Exception:
            data["scheduled_at"] = None
    else:
        data["scheduled_at"] = None
    m = Meeting(**data)
    m.tenant_id = current_tenant_id.get()
    session.add(m)
    session.commit()
    session.refresh(m)

    try:
        dt_str = m.scheduled_at.strftime("%b %d, %I:%M %p") if m.scheduled_at else "TBD"
        _notify_admins(
            session, current_tenant_id.get(),
            title=f"📅 Meeting Scheduled: {m.title}",
            message=f"Time: {dt_str} | Status: {m.status}",
            notif_type="info",
            link=f"/meetings"
        )
    except Exception:
        pass

    # ── EMAIL NOTIFICATION TO ATTENDEES ──
    dt_str = m.scheduled_at.strftime("%Y-%m-%d %H:%M") if m.scheduled_at else "TBD"
    subject = f"Meeting Scheduled: {m.title}"
    notes = (m.notes or "").strip()
    recips = [a.strip() for a in (m.attendees or []) if a and a.strip()]

    to_email = None
    if m.client_id:
        c = session.get(ClientProfile, m.client_id)
        if c: to_email = c.user.email if c.user else None
    elif m.lead_id:
        l = session.get(Lead, m.lead_id)
        if l: to_email = l.email
    elif m.contact_id:
        ct = session.get(Contact, m.contact_id)
        if ct: to_email = ct.email

    if to_email and to_email.strip() not in recips:
        recips.append(to_email.strip())

    def _render_meeting_invite(recipient_email):
        import html as _html
        plain = (
            f"Hello,\n\n"
            f"A meeting has been scheduled:\n\n"
            f"  Title     : {m.title}\n"
            f"  Date/Time : {dt_str}\n"
            f"  Type      : {m.meeting_type}\n"
            f"  Location  : {m.location or 'TBD'}\n"
            f"  Duration  : {m.duration_minutes or 'TBD'} min\n"
            f"  Attendees : {', '.join(recips) or '—'}"
        )
        if notes:
            plain += f"\n\nNotes:\n{notes}"
        plain += "\n\nThanks,\nSerpHawk CRM"

        esc = _html.escape
        title = esc(m.title or "Meeting")
        date_time = esc(dt_str)
        mtype = esc(m.meeting_type or "Meeting")
        location = esc(m.location or "TBD")
        duration = f"{int(m.duration_minutes)} min" if m.duration_minutes else "TBD"
        attendees = esc(", ".join(recips) or "—")
        notes_html = esc(notes)

        rows = [
            ("Title", title),
            ("Date/Time", date_time),
            ("Type", mtype),
            ("Location", location),
            ("Duration", duration),
            ("Attendees", attendees),
        ]
        detail_rows = "".join(
            f"""<tr>
            <td style="padding:10px 16px;border-bottom:1px solid #eef2f7;color:#64748b;font-size:13px;font-weight:600;width:130px;vertical-align:top">{label}</td>
            <td style="padding:10px 16px;border-bottom:1px solid #eef2f7;color:#0f172a;font-size:14px;font-weight:600;vertical-align:top">{value}</td>
          </tr>"""
            for label, value in rows
        )

        notes_block = ""
        if notes_html:
            notes_block = f"""
          <div style="padding:16px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0">
            <p style="margin:0 0 6px;color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">Notes</p>
            <p style="margin:0;color:#334155;font-size:14px;line-height:1.6;white-space:pre-wrap">{notes_html}</p>
          </div>"""

        html_body = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08)">
          <tr>
            <td style="background:linear-gradient(135deg,#1e3a8a,#2563eb);padding:28px 32px">
              <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#93c5fd">SerpHawk CRM</p>
              <p style="margin:8px 0 0;font-size:22px;font-weight:800;color:#ffffff">📅 Meeting Scheduled</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px">
              <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6">Hello, a new meeting has been scheduled for you:</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:16px">
                {detail_rows}
              </table>
              {notes_block}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 24px;border-top:1px solid #eef2f7">
              <p style="margin:0;color:#64748b;font-size:12px;line-height:1.5">Thanks,<br><span style="font-weight:700;color:#1d4ed8">SerpHawk CRM</span></p>
              <p style="color:#94a3b8;font-size:11px;line-height:1.5;margin:14px 0 0;border-top:1px solid #e2e8f0;padding-top:12px">📬 Didn't see this in your inbox? Sometimes automated emails land in spam or junk — please check there and mark us as "Not spam" so future emails reach you.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
        return subject, html_body, plain

    for to_email in recips:
        if not to_email:
            continue
        try:
            subj, html_body, plain = _render_meeting_invite(to_email)
            _send_notification_email(to_email, subj, html_body)
            session.add(SentEmail(
                tenant_id=current_tenant_id.get(),
                client_id=m.client_id,
                lead_id=m.lead_id,
                to_email=to_email,
                subject=subj,
                english_body=plain,
                status="Sent",
            ))
            session.commit()
        except Exception as e:
            print("Failed to send meeting invite email:", e)
            session.rollback()
            
    # ── WHATSAPP NOTIFICATION ──
    try:
        from modules.whatsapp import send_ai_polished_whatsapp_message
        base_url = "https://crm-seo.allytechcourses.com"
        send_ai_polished_whatsapp_message("New Meeting Scheduled", _meeting_dict(m, session), f"{base_url}/meetings")
    except Exception as e:
        print("WhatsApp Error:", e)

    return {"meeting": _meeting_dict(m, session)}

@app.get("/meetings/{meeting_id}")
def get_meeting(meeting_id: int, session: Session = Depends(get_session)):
    m = session.get(Meeting, meeting_id)
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return {"meeting": _meeting_dict(m, session)}

@app.put("/meetings/{meeting_id}")
def update_meeting(meeting_id: int, body: MeetingUpdateRequest, session: Session = Depends(get_session)):
    m = session.get(Meeting, meeting_id)
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")
    updates = body.model_dump(exclude_unset=True)
    if "scheduled_at" in updates:
        if updates["scheduled_at"]:
            try:
                updates["scheduled_at"] = datetime.fromisoformat(updates["scheduled_at"])
            except Exception:
                updates["scheduled_at"] = None
        else:
            updates["scheduled_at"] = None
    for k, v in updates.items():
        setattr(m, k, v)
    m.updated_at = datetime.utcnow()
    session.add(m)
    session.commit()
    session.refresh(m)
    
    # ── WHATSAPP NOTIFICATION ──
    try:
        from modules.whatsapp import send_ai_polished_whatsapp_message
        base_url = "https://crm-seo.allytechcourses.com"
        send_ai_polished_whatsapp_message("Meeting Updated", _meeting_dict(m, session), f"{base_url}/meetings")
    except Exception as e:
        print("WhatsApp Error:", e)
        
    return {"meeting": _meeting_dict(m, session)}

@app.delete("/meetings/{meeting_id}")
def delete_meeting(meeting_id: int, session: Session = Depends(get_session)):
    m = session.get(Meeting, meeting_id)
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")
    session.delete(m)
    session.commit()
    return {"ok": True}

@app.post("/meetings/import")
async def import_meetings(file: UploadFile = File(...), session: Session = Depends(get_session)):
    """Import meetings from CSV/Excel"""
    import pandas as pd, io
    content = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(content)) if file.filename.endswith((".xlsx",".xls")) else pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse file: {e}")
    imported = 0
    for _, row in df.iterrows():
        try:
            m = Meeting(
                title=str(row.get("title") or row.get("Title") or "Imported Meeting"),
                description=str(row.get("description") or row.get("Description") or "") or None,
                notes=str(row.get("notes") or row.get("Notes") or "") or None,
                status=str(row.get("status") or row.get("Status") or "Scheduled"),
                meeting_type=str(row.get("meeting_type") or row.get("Type") or "Meeting"),
            )
            session.add(m)
            imported += 1
        except Exception:
            pass
    session.commit()
    return {"imported": imported}


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

@app.get("/products")
def list_products(category: Optional[str] = None, active_only: bool = False, session: Session = Depends(get_session)):
    q = select(Product).order_by(Product.name)
    if category:
        q = q.where(Product.category == category)
    if active_only:
        q = q.where(Product.is_active == True)
    products = session.exec(q).all()
    return {"products": [p.model_dump() for p in products]}



@app.post("/products/export-pdf")
def export_products_pdf(body: dict = {}, session: Session = Depends(get_session)):
    """Export all catalog products as a downloadable PDF."""
    from modules.pdf_export import catalog_pdf, send_pdf_email
    from fastapi.responses import Response
    products = session.exec(select(Product).order_by(Product.name)).all()
    rows = [p.model_dump() for p in products]
    pdf_bytes = catalog_pdf(rows)
    recipient = (body or {}).get("email") if isinstance(body, dict) else None
    if recipient:
        try:
            send_pdf_email(recipient, "Product Catalog – SERPHAWK", "Please find the catalog PDF attached.", pdf_bytes, "catalog.pdf")
            return {"ok": True, "message": f"PDF sent to {recipient}"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    return Response(content=pdf_bytes, media_type="application/pdf",
                    headers={"Content-Disposition": "attachment; filename=catalog.pdf"})

@app.post("/products")
def create_product(body: ProductCreateRequest, session: Session = Depends(get_session)):
    p = Product(**body.model_dump())
    session.add(p)
    session.commit()
    session.refresh(p)
    return {"product": p.model_dump()}

@app.get("/products/{product_id}")
def get_product(product_id: int, session: Session = Depends(get_session)):
    p = session.get(Product, product_id)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"product": p.model_dump()}

@app.put("/products/{product_id}")
def update_product(product_id: int, body: ProductUpdateRequest, session: Session = Depends(get_session)):
    p = session.get(Product, product_id)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    p.updated_at = datetime.utcnow()
    session.add(p)
    session.commit()
    session.refresh(p)
    return {"product": p.model_dump()}

@app.delete("/products/{product_id}")
def delete_product(product_id: int, session: Session = Depends(get_session)):
    p = session.get(Product, product_id)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    session.delete(p)
    session.commit()
    return {"ok": True}


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

@app.get("/quotes")
def list_quotes(status: Optional[str] = None, client_id: Optional[int] = None, lead_id: Optional[int] = None, session: Session = Depends(get_session)):
    q = select(CRMQuote).order_by(CRMQuote.created_at.desc())
    if status:
        q = q.where(CRMQuote.status == status)
    if client_id:
        q = q.where(CRMQuote.client_id == client_id)
    if lead_id:
        q = q.where(CRMQuote.lead_id == lead_id)
    quotes = session.exec(q).all()
    if not quotes:
        return {"quotes": []}
    # Batch-load related records (fix N+1)
    cids  = list({qt.client_id for qt in quotes if qt.client_id})
    lids  = list({qt.lead_id   for qt in quotes if qt.lead_id})
    qids  = [qt.id for qt in quotes]
    cps   = session.exec(select(ClientProfile).where(ClientProfile.id.in_(cids))).all() if cids else []
    leads = session.exec(select(Lead).where(Lead.id.in_(lids))).all() if lids else []
    items = session.exec(select(QuoteItem).where(QuoteItem.quote_id.in_(qids))).all() if qids else []
    cp_map    = {cp.id: cp for cp in cps}
    lead_map  = {l.id: l   for l in leads}
    items_map: dict = {}
    for it in items:
        items_map.setdefault(it.quote_id, []).append(it)
    result = []
    for qt in quotes:
        d = qt.model_dump()
        cp   = cp_map.get(qt.client_id)
        lead = lead_map.get(qt.lead_id)
        d["client_name"] = cp.companyName if cp else None
        d["lead_name"]   = lead.company_name if lead else None
        d["items"] = [i.model_dump() for i in items_map.get(qt.id, [])]
        result.append(d)
    return {"quotes": result}


def _quote_dict(qt: CRMQuote, session: Session) -> dict:
    client = session.get(ClientProfile, qt.client_id) if qt.client_id else None
    lead = session.get(Lead, qt.lead_id) if qt.lead_id else None
    items = session.exec(select(QuoteItem).where(QuoteItem.quote_id == qt.id)).all()
    d = qt.model_dump()
    d["client_name"] = client.companyName if client else None
    d["lead_name"] = lead.company_name if lead else None
    d["items"] = [i.model_dump() for i in items]
    return d

@app.post("/quotes")
def create_quote(body: QuoteCreateRequest, session: Session = Depends(get_session)):
    import random, string
    body_data = body.model_dump(exclude={"items"})
    q = CRMQuote(**body_data)
    q.quote_number = "QT-" + "".join(random.choices(string.digits, k=6))
    session.add(q)
    session.commit()
    session.refresh(q)
    
    for item in body.items:
        qi = QuoteItem(
            quote_id=q.id,
            description=item.get("description", ""),
            quantity=item.get("quantity", 1),
            unit_price=item.get("unit_price", 0.0),
            provider=item.get("provider", "Custom")
        )
        session.add(qi)
    session.commit()

    # Send a "Quote created" email to the linked lead/client/contact email
    # (best-effort) only when the user explicitly opts in with `send_email`.
    email_sent = False
    email_error = None
    if body.send_email:
        try:
            email_sent = _send_quote_created_email(q, session)
        except Exception as e:
            email_error = str(e)
            print(f"[Quote email failed] {e}")

    resp = {"quote": _quote_dict(q, session)}
    if email_sent:
        resp["email_sent"] = True
    elif email_error:
        resp["email_error"] = email_error
    return resp


@app.post("/quotes/{quote_id}/send-email")
def send_quote_email(quote_id: int, body: Optional[QuoteEmailSendRequest] = None, session: Session = Depends(get_session)):
    """Send the quote details by email to the linked lead/client/contact (best-effort).
    If `body.subject` / `body.body_html` are provided they override the auto-generated content,
    letting the user send an edited version of the email."""
    q = session.get(CRMQuote, quote_id)
    if not q:
        raise HTTPException(status_code=404, detail="Quote not found")
    recipient_email, recipient_name, _ = _quote_email_recipient(q, session)
    try:
        sent = _send_quote_created_email(
            q, session,
            subject_override=body.subject if body else None,
            body_html_override=body.body_html if body else None,
        )
    except Exception as e:
        sent = False
        print(f"[Quote email failed] {e}")
    return {
        "email_sent": sent,
        "recipient_email": recipient_email,
        "recipient_name": recipient_name,
        "quote": _quote_dict(q, session),
    }


@app.get("/quotes/{quote_id}/email-preview")
def quote_email_preview(quote_id: int, session: Session = Depends(get_session)):
    """Return a structured preview of the email that would be sent for a quote,
    so the UI can show its details and ask for the user's permission first."""
    q = session.get(CRMQuote, quote_id)
    if not q:
        raise HTTPException(status_code=404, detail="Quote not found")
    recipient_email, recipient_name, company_name = _quote_email_recipient(q, session)
    subject, body_html, items = _quote_email_content(q, session, recipient_name)
    sender_email, _password, _smtp_server, _smtp_port = _quote_smtp_sender(session)
    return {
        "from_email": sender_email,
        "recipient_email": recipient_email,
        "recipient_name": recipient_name,
        "company_name": company_name,
        "subject": subject,
        "body_html": body_html,
        "quote": _quote_dict(q, session),
        "items": [i.model_dump() for i in items],
        "sendable": bool(recipient_email) and bool(sender_email),
    }


def _quote_email_recipient(q: CRMQuote, session: Session):
    """Resolve (recipient_email, recipient_name, company_name) for a quote.
    Priority: contact → lead → client(user)."""
    if q.lead_id:
        lead = session.get(Lead, q.lead_id)
    else:
        lead = None
    if q.client_id:
        client = session.get(ClientProfile, q.client_id)
    else:
        client = None
    if q.contact_id:
        contact = session.get(Contact, q.contact_id)
    else:
        contact = None

    recipient_email = None
    recipient_name = None

    if contact and contact.email:
        recipient_email = contact.email
        recipient_name = contact.full_name or f"{contact.first_name or ''} {contact.last_name or ''}".strip() or None

    if not recipient_email and lead and lead.email:
        recipient_email = lead.email
        recipient_name = lead.company_name or lead.email

    if not recipient_email and client and client.userId:
        user = session.get(User, client.userId)
        recipient_email = getattr(user, "email", None) or None
        recipient_name = client.companyName

    company_name = None
    if lead:
        company_name = lead.company_name
    if not company_name and client:
        company_name = client.companyName

    return recipient_email, recipient_name, company_name


def _quote_email_content(q: CRMQuote, session: Session, recipient_name=None):
    """Build the subject and HTML body of the quote email.
    Used both for actually sending it and for previewing it before sending,
    so the preview always reflects exactly what the recipient will receive."""
    # ── Build items table ──
    items = session.exec(select(QuoteItem).where(QuoteItem.quote_id == q.id)).all()

    # ── Notes / Terms section ──
    extra_section = ""
    if q.notes:
        extra_section += f"<p style='color:#475569;line-height:1.6;margin:14px 0 0'><strong>Notes:</strong> {q.notes}</p>"
    if q.terms:
        extra_section += f"<p style='color:#475569;line-height:1.6;margin:8px 0 0'><strong>Terms:</strong> {q.terms}</p>"

    from modules.email_sender import branded_email, _summary_table, _escape_html

    items_table = ""
    if items:
        rows_html = ""
        for it in items:
            total = (it.unit_price or 0) * (it.quantity or 1)
            rows_html += (
                f"<tr>"
                f"<td style='padding:9px 6px;border-bottom:1px solid #eef1f7;color:#0f172a;font-size:13px;'>{_escape_html(it.description or '')}</td>"
                f"<td style='padding:9px 6px;border-bottom:1px solid #eef1f7;text-align:center;color:#64748b;font-size:13px;'>{it.quantity}</td>"
                f"<td style='padding:9px 6px;border-bottom:1px solid #eef1f7;text-align:right;color:#64748b;font-size:13px;'>{q.currency or '$'} {it.unit_price:,.2f}</td>"
                f"<td style='padding:9px 6px;border-bottom:1px solid #eef1f7;text-align:right;color:#0f172a;font-size:13px;font-weight:600;'>{q.currency or '$'} {total:,.2f}</td>"
                f"</tr>"
            )
        items_table = (
            '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
            'style="margin:16px 0 0;border-collapse:collapse;border:1px solid #e6e9f0;border-radius:10px;overflow:hidden;">'
            '<tr>'
            '<th style="padding:10px 6px;background:#1e293b;color:#fff;font-size:11px;font-weight:700;text-align:left;letter-spacing:0.5px;">Description</th>'
            '<th style="padding:10px 6px;background:#1e293b;color:#fff;font-size:11px;font-weight:700;text-align:center;letter-spacing:0.5px;">Qty</th>'
            '<th style="padding:10px 6px;background:#1e293b;color:#fff;font-size:11px;font-weight:700;text-align:right;letter-spacing:0.5px;">Unit</th>'
            '<th style="padding:10px 6px;background:#1e293b;color:#fff;font-size:11px;font-weight:700;text-align:right;letter-spacing:0.5px;">Total</th>'
            "</tr>"
            + rows_html
            + "</table>"
        )

    greeting = f"Hi {recipient_name}," if recipient_name else "Hello,"
    html = branded_email(
        title=f"Your Quote {q.quote_number or q.id}",
        body_html=(
            f"<p>{greeting}</p>"
            f"<p>A new quotation has been prepared for you. Use the details below or the attached copy to review it.</p>"
            + _summary_table(
                [
                    ("Quote Number", q.quote_number or str(q.id)),
                    ("Title", q.title or "—"),
                    ("Valid Until", q.valid_until or "—"),
                    ("Status", q.status or "Draft"),
                ],
                "Total Amount",
                f"{q.currency or '$'} {q.grand_total:,.2f}",
            )
            + items_table
            + extra_section
            + "<p style='margin-top:24px'>If you have any questions about this quote, just reply to this email or contact your account manager.</p>"
        ),
    )
    subject = f"Your Quote {q.quote_number or q.id} — {q.title or 'Quote'} ({q.currency or '$'} {q.grand_total:,.2f})"
    return subject, html, items


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


def _send_quote_created_email(q: CRMQuote, session: Session, subject_override=None, body_html_override=None) -> bool:
    """Email the lead (or client / contact) linked to the quote with the new quote details.
    Optionally use an edited subject / body written by the user.
    Returns True if the email was sent successfully, False otherwise."""
    # ── Resolve SMTP credentials: per-tenant EmailSettings first, then env vars ──
    sender, password, smtp_server, smtp_port = _quote_smtp_sender(session)

    if not sender or not password:
        print("[Quote email skipped] SMTP not configured")
        return False

    # ── Resolve recipient email: contact → lead → client ──
    recipient_email, recipient_name, _ = _quote_email_recipient(q, session)

    if not recipient_email:
        print(f"[Quote email skipped] no linked lead/client/contact email for quote {q.quote_number}")
        return False

    subject, html, _ = _quote_email_content(q, session, recipient_name)
    if subject_override:
        subject = subject_override
    if body_html_override:
        html = body_html_override

    from modules.email_sender import send_email_outlook
    send_email_outlook(
        to_email=recipient_email,
        subject=subject,
        body=html,
        sender_email=sender,
        sender_password=password,
        smtp_server=smtp_server,
        smtp_port=int(smtp_port),
    )
    print(f"Quote email sent to {recipient_email} for quote {q.quote_number or q.id}")
    return True

@app.get("/quotes/{quote_id}")
def get_quote(quote_id: int, session: Session = Depends(get_session)):
    q = session.get(CRMQuote, quote_id)
    if not q:
        raise HTTPException(status_code=404, detail="Quote not found")
    return {"quote": _quote_dict(q, session)}

@app.get("/quotes/{quote_id}/pdf")
def quote_pdf(quote_id: int, provider: Optional[str] = None, session: Session = Depends(get_session)):
    """Generate a professional PDF for a quote."""
    from fastapi.responses import StreamingResponse

    q = session.get(CRMQuote, quote_id)
    if not q:
        raise HTTPException(status_code=404, detail="Quote not found")
        
    client_name = ""
    client_company = ""
    client_email = ""
    client_phone = ""
    client_address = ""
    if q.client_id:
        c = session.get(ClientProfile, q.client_id)
        if c: 
            user = session.get(User, c.userId) if c.userId else None
            client_name = c.companyName or (user.name if user else f"Client #{c.id}")
            client_company = c.companyName or ""
            client_email = user.email if user else ""
            client_phone = c.phone or ""
            client_address = c.address or ""
    elif q.lead_id:
        l = session.get(Lead, q.lead_id)
        if l:
            client_name = l.company_name or l.email or f"Lead #{l.id}"
            client_company = l.company_name or ""
            client_email = l.email or ""
            client_phone = l.phone or ""
            client_address = l.address or ""

    quote_items = session.exec(select(QuoteItem).where(QuoteItem.quote_id == q.id)).all()
    items = []
    for li in quote_items:
        amt = float(li.unit_price or 0)
        qty = li.quantity or 1
        items.append({
            "description": li.description or "",
            "quantity": qty,
            "unit_price": amt,
            "total": amt * qty,
        })

    from modules.pdf_export import quote_pdf as _quote_pdf
    pdf = _quote_pdf({
        "quote_number": q.quote_number or str(q.id),
        "title": q.title,
        "status": q.status,
        "client_name": client_name,
        "client_company": client_company,
        "client_email": client_email,
        "client_phone": client_phone,
        "client_address": client_address,
        "currency": q.currency or "$",
        "items": items,
        "subtotal": float(q.subtotal) if q.subtotal else None,
        "tax_rate": 0,
        "grand_total": float(q.grand_total),
        "valid_until": q.valid_until,
        "created_at": q.created_at,
        "notes": q.notes,
        "terms": q.terms,
        "payment_terms": getattr(q, "payment_terms", None) or "",
        "delivery": getattr(q, "delivery", None) or "",
    })
    return StreamingResponse(io.BytesIO(pdf), media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="quote-{q.quote_number or q.id}.pdf"'
    })

@app.put("/quotes/{quote_id}")
def update_quote(quote_id: int, body: QuoteCreateRequest, session: Session = Depends(get_session)):
    q = session.get(CRMQuote, quote_id)
    if not q:
        raise HTTPException(status_code=404, detail="Quote not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(q, k, v)
    q.updated_at = datetime.utcnow()
    session.add(q)
    session.commit()
    session.refresh(q)
    return {"quote": _quote_dict(q, session)}

@app.delete("/quotes/{quote_id}")
def delete_quote(quote_id: int, session: Session = Depends(get_session)):
    q = session.get(CRMQuote, quote_id)
    if not q:
        raise HTTPException(status_code=404, detail="Quote not found")
    session.delete(q)
    session.commit()
    return {"ok": True}


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

@app.get("/sales-orders")
def list_sales_orders(status: Optional[str] = None, client_id: Optional[int] = None, session: Session = Depends(get_session)):
    q = select(SalesOrder).order_by(SalesOrder.created_at.desc())
    if status:
        q = q.where(SalesOrder.status == status)
    if client_id:
        q = q.where(SalesOrder.client_id == client_id)
    orders = session.exec(q).all()
    return {"orders": [_so_dict(o, session) for o in orders]}

def _sales_order_recipient(o: SalesOrder, session: Session):
    """Resolve the recipient (email, name) for a sales order.
    Priority: lead → client's linked account user → contact linked to the client."""
    recipient_email = None
    recipient_name = None

    if o.lead_id:
        lead = session.get(Lead, o.lead_id)
        if lead and lead.email:
            recipient_email = lead.email
            recipient_name = lead.company_name or lead.email

    if not recipient_email and o.client_id:
        client = session.get(ClientProfile, o.client_id)
        if client:
            if client.userId:
                user = session.get(User, client.userId)
                if user and getattr(user, "email", None):
                    recipient_email = user.email
                    recipient_name = client.companyName
            if not recipient_email:
                contact = session.exec(
                    select(Contact).where(Contact.client_id == o.client_id, Contact.email.is_not(None)).limit(1)
                ).first()
                if contact and contact.email:
                    recipient_email = contact.email
                    recipient_name = (
                        contact.full_name
                        or f"{contact.first_name or ''} {contact.last_name or ''}".strip()
                        or client.companyName
                    )
            if recipient_email and not recipient_name:
                recipient_name = client.companyName

    return recipient_email, recipient_name


def _so_dict(o: SalesOrder, session: Session) -> dict:
    client = session.get(ClientProfile, o.client_id) if o.client_id else None
    lead = session.get(Lead, o.lead_id) if o.lead_id else None
    d = o.model_dump()
    d["client_name"] = (
        (client.companyName if client else None)
        or (lead.company_name if lead else None)
    )
    recipient_email, recipient_name = _sales_order_recipient(o, session)
    d["recipient_email"] = recipient_email
    d["recipient_name"] = recipient_name
    return d



@app.post("/sales-orders/export-pdf")
def export_sales_orders_pdf(body: dict = {}, session: Session = Depends(get_session)):
    """Export all sales orders as a downloadable PDF."""
    from modules.pdf_export import sales_order_pdf, send_pdf_email
    from fastapi.responses import Response
    orders = session.exec(select(SalesOrder).order_by(SalesOrder.created_at.desc())).all()
    rows = []
    for o in orders:
        client_name = None
        if o.client_id:
            c = session.get(Client, o.client_id)
            if c: client_name = c.name
        rows.append({
            "order_number": o.order_number, "client_name": client_name or o.lead_name or "—",
            "grand_total": float(o.grand_total or 0), "currency": o.currency,
            "status": o.status, "delivery_date": str(o.delivery_date or ""),
            "created_at": o.created_at.isoformat() if o.created_at else ""
        })
    pdf_bytes = sales_order_pdf(rows)
    recipient = (body or {}).get("email") if isinstance(body, dict) else None
    if recipient:
        try:
            send_pdf_email(recipient, "Sales Orders – SERPHAWK", "Please find the sales orders PDF attached.", pdf_bytes, "sales_orders.pdf")
            return {"ok": True, "message": f"PDF sent to {recipient}"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    return Response(content=pdf_bytes, media_type="application/pdf",
                    headers={"Content-Disposition": "attachment; filename=sales_orders.pdf"})

@app.post("/sales-orders")
def create_sales_order(body: SalesOrderCreateRequest, session: Session = Depends(get_session)):
    import random, string
    o = SalesOrder(**body.model_dump())
    o.order_number = "SO-" + "".join(random.choices(string.digits, k=6))
    session.add(o)
    session.commit()
    session.refresh(o)
    return {"order": _so_dict(o, session)}

@app.put("/sales-orders/{order_id}")
def update_sales_order(order_id: int, body: SalesOrderCreateRequest, session: Session = Depends(get_session)):
    o = session.get(SalesOrder, order_id)
    if not o:
        raise HTTPException(status_code=404, detail="Sales order not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(o, k, v)
    o.updated_at = datetime.utcnow()
    session.add(o)
    session.commit()
    session.refresh(o)
    return {"order": _so_dict(o, session)}

@app.delete("/sales-orders/{order_id}")
def delete_sales_order(order_id: int, session: Session = Depends(get_session)):
    o = session.get(SalesOrder, order_id)
    if not o:
        raise HTTPException(status_code=404, detail="Sales order not found")
    session.delete(o)
    session.commit()
    return {"ok": True}


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

@app.get("/purchase-orders")
def list_purchase_orders(status: Optional[str] = None, session: Session = Depends(get_session)):
    q = select(PurchaseOrder).order_by(PurchaseOrder.created_at.desc())
    if status:
        q = q.where(PurchaseOrder.status == status)
    orders = session.exec(q).all()
    return {"orders": [o.model_dump() for o in orders]}



@app.post("/purchase-orders/export-pdf")
def export_purchase_orders_pdf(body: dict = {}, session: Session = Depends(get_session)):
    """Export all purchase orders as a downloadable PDF."""
    from modules.pdf_export import purchase_order_pdf, send_pdf_email
    from fastapi.responses import Response
    orders = session.exec(select(PurchaseOrder).order_by(PurchaseOrder.created_at.desc())).all()
    rows = [
        {"po_number": o.po_number, "vendor_name": o.vendor_name, "vendor_email": o.vendor_email,
         "grand_total": float(o.grand_total or 0), "currency": o.currency, "status": o.status,
         "expected_delivery": str(o.expected_delivery or ""),
         "created_at": o.created_at.isoformat() if o.created_at else ""}
        for o in orders
    ]
    pdf_bytes = purchase_order_pdf(rows)
    recipient = (body or {}).get("email") if isinstance(body, dict) else None
    if recipient:
        try:
            send_pdf_email(recipient, "Purchase Orders – SERPHAWK", "Please find the purchase orders PDF attached.", pdf_bytes, "purchase_orders.pdf")
            return {"ok": True, "message": f"PDF sent to {recipient}"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    return Response(content=pdf_bytes, media_type="application/pdf",
                    headers={"Content-Disposition": "attachment; filename=purchase_orders.pdf"})

@app.post("/purchase-orders")
def create_purchase_order(body: PurchaseOrderCreateRequest, session: Session = Depends(get_session)):
    import random, string
    o = PurchaseOrder(**body.model_dump())
    o.po_number = "PO-" + "".join(random.choices(string.digits, k=6))
    session.add(o)
    session.commit()
    session.refresh(o)
    return {"order": o.model_dump()}

@app.put("/purchase-orders/{order_id}")
def update_purchase_order(order_id: int, body: PurchaseOrderCreateRequest, session: Session = Depends(get_session)):
    o = session.get(PurchaseOrder, order_id)
    if not o:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(o, k, v)
    o.updated_at = datetime.utcnow()
    session.add(o)
    session.commit()
    session.refresh(o)
    return {"order": o.model_dump()}

@app.delete("/purchase-orders/{order_id}")
def delete_purchase_order(order_id: int, session: Session = Depends(get_session)):
    o = session.get(PurchaseOrder, order_id)
    if not o:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    session.delete(o)
    session.commit()
    return {"ok": True}


# ── PDF Export Request Model ──────────────────────────────────────────────

class ExportPdfRequest(BaseModel):
    email: Optional[str] = None
    format: Optional[str] = None  # pdf | csv | xlsx (pdf default)


# ── Quotes PDF Export ────────────────────────────────────────────────────

def _quote_export_data(qt, session: Session) -> dict:
    from database import ClientProfile, Lead, User
    client = session.get(ClientProfile, qt.client_id) if qt.client_id else None
    lead = session.get(Lead, qt.lead_id) if qt.lead_id else None
    client_name = client_company = client_email = client_phone = client_address = ""
    if client:
        user = session.get(User, client.userId) if client.userId else None
        client_name = client.companyName or (user.name if user else f"Client #{client.id}")
        client_company = client.companyName or ""
        client_email = user.email if user else ""
        client_phone = client.phone or ""
        client_address = client.address or ""
    elif lead:
        client_name = lead.company_name or lead.email or f"Lead #{lead.id}"
        client_company = lead.company_name or ""
        client_email = lead.email or ""
        client_phone = lead.phone or ""
        client_address = lead.address or ""
    items = []
    for li in session.exec(select(QuoteItem).where(QuoteItem.quote_id == qt.id)).all():
        amt = float(li.unit_price or 0)
        qty = li.quantity or 1
        items.append({"description": li.description or "", "quantity": qty, "unit_price": amt, "total": amt * qty})
    return {
        "quote_number": qt.quote_number or str(qt.id),
        "title": qt.title,
        "status": qt.status,
        "client_name": client_name,
        "client_company": client_company,
        "client_email": client_email,
        "client_phone": client_phone,
        "client_address": client_address,
        "currency": qt.currency or "$",
        "items": items,
        "subtotal": float(qt.subtotal or 0),
        "tax_rate": float(qt.tax_total or 0),
        "discount": float(qt.discount_total or 0),
        "grand_total": float(qt.grand_total or 0),
        "valid_until": qt.valid_until,
        "created_at": qt.created_at.isoformat() if qt.created_at else None,
        "notes": qt.notes,
        "terms": qt.terms,
    }


@app.post("/quotes/export-pdf")
def export_quotes_pdf(body: ExportPdfRequest, session: Session = Depends(get_session)):
    from fastapi.responses import Response
    from io import BytesIO
    from pypdf import PdfReader, PdfWriter
    from modules.pdf_export import quote_pdf, send_pdf_email
    import csv as _csv
    import io as _io
    tenant_id = current_tenant_id.get()
    q = select(CRMQuote).order_by(CRMQuote.created_at.desc())
    if tenant_id:
        q = q.where(CRMQuote.tenant_id == tenant_id)
    quotes = session.exec(q).all()
    if not quotes:
        raise HTTPException(status_code=404, detail="No quotes to export")

    export_format = (body.format or "pdf").strip().lower()
    if export_format not in ("pdf", "csv", "xlsx"):
        raise HTTPException(status_code=400, detail="format must be pdf, csv or xlsx")

    def _build_csv() -> bytes:
        output = _io.StringIO()
        writer = _csv.writer(output)
        writer.writerow(["Quote #", "Title", "Status", "Client", "Company", "Email", "Phone", "Currency", "Subtotal", "Grand Total", "Valid Until", "Created", "Notes"])
        for qt in quotes:
            d = _quote_export_data(qt, session)
            writer.writerow([
                d["quote_number"], d.get("title") or "", d.get("status") or "",
                d.get("client_name") or "", d.get("client_company") or "", d.get("client_email") or "",
                d.get("client_phone") or "", d.get("currency") or "$",
                f'{d.get("subtotal") or 0:.2f}', f'{d.get("grand_total") or 0:.2f}',
                d.get("valid_until") or "", d.get("created_at") or "", d.get("notes") or "",
            ])
        return ("\ufeff" + output.getvalue()).encode("utf-8")

    def _build_xlsx() -> bytes:
        from openpyxl import Workbook
        wb = Workbook()
        ws = wb.active
        ws.title = "Quotes"
        headers = ["Quote #", "Title", "Status", "Client", "Company", "Email", "Phone", "Currency", "Subtotal", "Grand Total", "Valid Until", "Created", "Notes"]
        ws.append(headers)
        for qt in quotes:
            d = _quote_export_data(qt, session)
            ws.append([
                d["quote_number"], d.get("title") or "", d.get("status") or "",
                d.get("client_name") or "", d.get("client_company") or "", d.get("client_email") or "",
                d.get("client_phone") or "", d.get("currency") or "$",
                float(d.get("subtotal") or 0), float(d.get("grand_total") or 0),
                d.get("valid_until") or "", d.get("created_at") or "", d.get("notes") or "",
            ])
        ws2 = wb.create_sheet("Items")
        ws2.append(["Quote #", "Description", "Quantity", "Unit Price", "Total"])
        for qt in quotes:
            d = _quote_export_data(qt, session)
            for it in d.get("items") or []:
                ws2.append([d["quote_number"], it.get("description") or "", it.get("quantity") or 1,
                            float(it.get("unit_price") or 0), float(it.get("total") or 0)])
        for sheet in wb.worksheets:
            for cell in sheet[1]:
                cell.font = cell.font.copy(bold=True)
        buf = BytesIO()
        wb.save(buf)
        return buf.getvalue()

    if export_format == "csv":
        data = _build_csv()
        media = "text/csv"
        fname = "quotes.csv"
    elif export_format == "xlsx":
        data = _build_xlsx()
        media = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        fname = "quotes.xlsx"
    else:
        writer = PdfWriter()
        for qt in quotes:
            page = PdfReader(BytesIO(quote_pdf(_quote_export_data(qt, session)))).pages[0]
            writer.add_page(page)
        buf = BytesIO()
        writer.write(buf)
        data = buf.getvalue()
        media = "application/pdf"
        fname = "quotes.pdf"

    if body.email:
        try:
            send_pdf_email(body.email, "Quotes PDF", "<p>The requested quotes report is attached.</p>", data, fname)
            return {"sent": True, "recipient": body.email, "count": len(quotes)}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Email failed: {e}")
    return Response(
        content=data,
        media_type=media,
        headers={"Content-Disposition": f"attachment; filename={fname}"}
    )


# ── Sales Order PDF Export ───────────────────────────────────────────────

@app.post("/sales-orders/export-pdf")
def export_sales_orders_pdf(body: ExportPdfRequest, session: Session = Depends(get_session)):
    from fastapi.responses import Response
    from database import ClientProfile, Lead
    from modules.pdf_export import sales_order_pdf, send_pdf_email
    tenant_id = current_tenant_id.get()
    q = select(SalesOrder).order_by(SalesOrder.created_at.desc())
    if tenant_id:
        q = q.where(SalesOrder.tenant_id == tenant_id)
    orders = session.exec(q).all()
    data = []
    for o in orders:
        client = session.get(ClientProfile, o.client_id) if o.client_id else None
        lead = session.get(Lead, o.lead_id) if o.lead_id else None
        d = o.model_dump()
        d["client_name"] = client.companyName if client else (lead.company_name if lead else None)
        data.append(d)
    pdf = sales_order_pdf(data)
    if body.email:
        try:
            send_pdf_email(
                body.email, "Sales Orders PDF", "<p>The requested sales orders report is attached.</p>",
                pdf, "sales_orders.pdf"
            )
            return {"sent": True, "recipient": body.email, "count": len(data)}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Email failed: {e}")
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=sales_orders.pdf"}
    )


def _so_party(o: SalesOrder, session: Session) -> dict:
    """Resolve buyer info (name, company, email, phone, address) for a sales order."""
    from database import ClientProfile, Lead, User, Contact
    party = {"name": None, "company": None, "email": None, "phone": None, "address": None}
    if o.lead_id:
        l = session.get(Lead, o.lead_id)
        if l:
            party["company"] = l.company_name
            party["name"] = party["name"] or l.company_name or l.email
            party["email"] = l.email or party["email"]
            party["phone"] = l.phone or party["phone"]
            party["address"] = l.address or party["address"]
    if o.client_id:
        c = session.get(ClientProfile, o.client_id)
        if c:
            party["company"] = c.companyName or party["company"]
            party["name"] = party["name"] or c.companyName
            party["address"] = c.address or party["address"]
            party["phone"] = c.phone or party["phone"]
            if c.userId:
                u = session.get(User, c.userId)
                if u:
                    party["email"] = u.email or party["email"]
                    party["name"] = party["name"] or u.name
            if not party["email"]:
                contact = session.exec(
                    select(Contact).where(Contact.client_id == o.client_id, Contact.email.is_not(None)).first()
                )
                if contact:
                    party["email"] = contact.email
    return party


@app.get("/sales-orders/{order_id}/pdf")
def export_single_sales_order_pdf(order_id: int, session: Session = Depends(get_session)):
    from fastapi.responses import Response
    from modules.pdf_export import single_sales_order_pdf
    o = session.get(SalesOrder, order_id)
    if not o:
        raise HTTPException(status_code=404, detail="Sales order not found")
    party = _so_party(o, session)
    pdf = single_sales_order_pdf(o.model_dump(), client_name=party["name"], lead_name=party["name"], party=party)
    filename = f"sales_order_{o.order_number or o.id}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.post("/sales-orders/{order_id}/send-pdf")
def send_single_sales_order_pdf_email(order_id: int, body: ExportPdfRequest, session: Session = Depends(get_session)):
    """Email a single sales order as a PDF attachment. Uses the provided email
    or falls back to the linked lead/client email."""
    from modules.pdf_export import single_sales_order_pdf
    o = session.get(SalesOrder, order_id)
    if not o:
        raise HTTPException(status_code=404, detail="Sales order not found")
    default_email, default_name = _sales_order_recipient(o, session)
    recipient = (body.email or "").strip() or default_email
    if not recipient:
        raise HTTPException(status_code=400, detail="No recipient email. Provide an email or link this order to a lead/client that has one.")
    party = _so_party(o, session)
    pdf = single_sales_order_pdf(o.model_dump(), client_name=party["name"], lead_name=party["name"], party=party)
    filename = f"{o.order_number or f'SO-{o.id}'}.pdf"
    subject = f"Sales Order {o.order_number or o.id} — {party['name'] or ''}".strip()
    from modules.email_sender import branded_email, _summary_table, _attachment_note
    recipient_display = default_name or party["name"] or "there"
    name_line = f"Hi {recipient_display},"
    body_html = branded_email(
        title=f"Sales Order {o.order_number or o.id}",
        body_html=(
            f"<p>{name_line}</p>"
            f"<p>Your sales order <strong>{o.order_number or o.id}</strong> has been issued. The details are below and the PDF is attached to this email.</p>"
            + _summary_table(
                [
                    ("Order Number", o.order_number or str(o.id)),
                    ("Client", party["name"] or "—"),
                    ("Delivery Date", o.delivery_date or "—"),
                    ("Currency", o.currency or "USD"),
                ],
                "Grand Total",
                f"{o.currency or 'USD'} {o.grand_total:,.2f}",
            )
            + _attachment_note(filename)
            + "<p style=margin-top:20px>Thank you for your business!</p>"
        ),
    )
    # Resolve SMTP the same way quote emails do: per-tenant EmailSettings, then env vars.
    sender, password, smtp_server, smtp_port = _quote_smtp_sender(session)
    if not sender or not password:
        raise HTTPException(status_code=500, detail="SMTP not configured. Add email settings in the Mail Settings page.")
    try:
        from modules.email_sender import send_email_outlook
        send_email_outlook(
            to_email=recipient,
            subject=subject,
            body=body_html,
            sender_email=sender,
            sender_password=password,
            smtp_server=smtp_server,
            smtp_port=int(smtp_port),
            attachments=[(filename, pdf, "application/pdf")],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Email failed: {e}")
    return {"sent": True, "recipient": recipient, "default_recipient": default_email, "order_number": o.order_number}


# ── Purchase Order PDF Export ────────────────────────────────────────────

@app.post("/purchase-orders/export-pdf")
def export_purchase_orders_pdf(body: ExportPdfRequest, session: Session = Depends(get_session)):
    from fastapi.responses import Response
    from modules.pdf_export import purchase_order_pdf, send_pdf_email
    tenant_id = current_tenant_id.get()
    q = select(PurchaseOrder).order_by(PurchaseOrder.created_at.desc())
    if tenant_id:
        q = q.where(PurchaseOrder.tenant_id == tenant_id)
    orders = session.exec(q).all()
    data = [o.model_dump() for o in orders]
    pdf = purchase_order_pdf(data)
    if body.email:
        try:
            send_pdf_email(
                body.email, "Purchase Orders PDF", "<p>The requested purchase orders report is attached.</p>",
                pdf, "purchase_orders.pdf"
            )
            return {"sent": True, "recipient": body.email, "count": len(data)}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Email failed: {e}")
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=purchase_orders.pdf"}
    )


@app.get("/purchase-orders/{order_id}/pdf")
def export_single_purchase_order_pdf(order_id: int, session: Session = Depends(get_session)):
    from fastapi.responses import Response
    from modules.pdf_export import single_purchase_order_pdf
    o = session.get(PurchaseOrder, order_id)
    if not o:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    pdf = single_purchase_order_pdf(o.model_dump())
    filename = f"purchase_order_{o.po_number or o.id}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.post("/purchase-orders/{order_id}/send-pdf")
def send_single_purchase_order_pdf_email(order_id: int, body: ExportPdfRequest, session: Session = Depends(get_session)):
    """Email a single purchase order as a PDF attachment. Uses the provided email
    or falls back to the linked vendor email."""
    from modules.pdf_export import single_purchase_order_pdf
    o = session.get(PurchaseOrder, order_id)
    if not o:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    default_email = (o.vendor_email or "").strip()
    recipient = (body.email or "").strip() or default_email
    if not recipient:
        raise HTTPException(status_code=400, detail="No recipient email. Provide an email or set the vendor email.")
    pdf = single_purchase_order_pdf(o.model_dump())
    filename = f"{o.po_number or f'PO-{o.id}'}.pdf"
    subject = f"Purchase Order {o.po_number or o.id} — {o.vendor_name or ''}".strip()
    from modules.email_sender import branded_email, _summary_table, _attachment_note
    body_html = branded_email(
        title=f"Purchase Order {o.po_number or o.id}",
        body_html=(
            f"<p>Hi {o.vendor_name or 'there'},</p>"
            f"<p>We have issued purchase order <strong>{o.po_number or o.id}</strong> to your company. The details are below and the PDF is attached to this email.</p>"
            + _summary_table(
                [
                    ("PO Number", o.po_number or str(o.id)),
                    ("Vendor", o.vendor_name or "—"),
                    ("Expected Delivery", o.expected_delivery or "—"),
                    ("Currency", o.currency or "USD"),
                ],
                "Grand Total",
                f"{o.currency or 'USD'} {o.grand_total:,.2f}",
            )
            + _attachment_note(filename)
            + "<p style=margin-top:20px>Thank you for your prompt attention to this order.</p>"
        ),
    )
    sender, password, smtp_server, smtp_port = _quote_smtp_sender(session)
    if not sender or not password:
        raise HTTPException(status_code=500, detail="SMTP not configured. Add email settings in the Mail Settings page.")
    try:
        from modules.email_sender import send_email_outlook
        send_email_outlook(
            to_email=recipient,
            subject=subject,
            body=body_html,
            sender_email=sender,
            sender_password=password,
            smtp_server=smtp_server,
            smtp_port=int(smtp_port),
            attachments=[(filename, pdf, "application/pdf")],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Email failed: {e}")
    return {"sent": True, "recipient": recipient, "default_recipient": default_email, "po_number": o.po_number}


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
def list_cases(status: Optional[str] = None, priority: Optional[str] = None, client_id: Optional[int] = None, assigned_to: Optional[int] = None, session: Session = Depends(get_session)):
    q = select(Case).order_by(Case.created_at.desc())
    if status:
        q = q.where(Case.status == status)
    if priority:
        q = q.where(Case.priority == priority)
    if client_id:
        q = q.where(Case.client_id == client_id)
    if assigned_to:
        q = q.where(Case.assigned_to == assigned_to)
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

@app.post("/leads/{lead_id}/simulate-call")
def simulate_lead_call(lead_id: int, req: Optional[SimulateCallRequest] = None, session: Session = Depends(get_session)):
    lead = session.get(Lead, lead_id)
    if not lead: raise HTTPException(status_code=404, detail="Lead not found")
    
    tenant_id = current_tenant_id.get()
    if tenant_id:
        tenant = session.get(Tenant, tenant_id)
        if tenant:
            user = session.exec(select(User).where(User.tenant_id == tenant_id)).first()
            if user and user.role == "Demo":
                if tenant.usage_calls >= tenant.limit_calls:
                    raise HTTPException(status_code=403, detail=f"Demo limit reached. You can only log up to {tenant.limit_calls} calls/pitches.")
                tenant.usage_calls += 1
                session.add(tenant)
                session.commit()
    
    client_name = lead.company_name or "Valued Lead"
    industry = lead.industry or "Unknown Industry"
    notes = lead.notes or "No prior notes."
    
    prompt = f"""You are an expert sales representative for "SERP Hawk" (an elite SEO and Digital Marketing Agency).
Your task is to write a highly tailored, direct sales script to be read over the phone to this specific lead. 
DO NOT use generic placeholders like "[Your Name]" or "[Your Company]" - assume the persona of a SERP Hawk sales rep.

Lead Profile:
Company Name: {client_name}
Industry: {industry}
Website: {lead.website or 'Unknown'}
Source: {lead.source or 'Unknown'}

Notes from our CRM:
{notes}

Recent Activity:
{lead.last_activity or 'No recent activity'}

Instructions:
1. Write the exact word-for-word script that the sales person will read on the call.
2. Directly reference their specific company name, their industry, and any past notes or activities.
3. Pitch SERP Hawk's services (e.g. SEO, link building, digital marketing) as the solution to their specific needs.
4. Make it conversational, persuasive, and professional.
5. Structure it logically but seamlessly.
6. Output ONLY the spoken script as natural dialogue. Do NOT include markdown headings like **Introduction** or **Value Proposition**. It should read exactly like a transcript of someone speaking. Do not add any meta-commentary."""

    if req and req.context:
        prompt += f"\n\nAdditional Custom Context / Instructions from the Sales Rep:\n{req.context}\n(Please ensure you incorporate this custom instruction closely into the script)."

    from modules.llm_engine import get_openai_client
    try:
        openai_client = get_openai_client()
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=800
        )
        pitch = response.choices[0].message.content or ""
    except Exception as e:
        print("Error in lead simulation:", e)
        raise HTTPException(status_code=500, detail=f"Failed to simulate call: {str(e)}")
        
    call = CallLog(
        phone_number=lead.phone or "Unknown",
        duration_seconds=180,
        summary=f"Pitch Generation for {client_name}",
        description=pitch,
        tenant_id=tenant_id
    )
    session.add(call)
    session.commit()
    session.refresh(call)
    
    return {"ok": True, "call_id": call.id, "pitch": pitch}

@app.post("/contacts/{contact_id}/simulate-call")
def simulate_contact_call(contact_id: int, req: Optional[SimulateCallRequest] = None, session: Session = Depends(get_session)):
    contact = session.get(Contact, contact_id)
    if not contact: raise HTTPException(status_code=404, detail="Contact not found")
    
    tenant_id = current_tenant_id.get()
    if tenant_id:
        tenant = session.get(Tenant, tenant_id)
        if tenant:
            user = session.exec(select(User).where(User.tenant_id == tenant_id)).first()
            if user and user.role == "Demo":
                if tenant.usage_calls >= tenant.limit_calls:
                    raise HTTPException(status_code=403, detail=f"Demo limit reached. You can only log up to {tenant.limit_calls} calls/pitches.")
                tenant.usage_calls += 1
                session.add(tenant)
                session.commit()
    
    
    client_name = f"{contact.first_name} {contact.last_name or ''}".strip() or "Valued Contact"
    department = contact.department or "Unknown Department"
    designation = contact.designation or "Unknown Title"
    notes = contact.notes or "No prior notes."
    
    prompt = f"""You are an expert sales representative for "SERP Hawk" (an elite SEO and Digital Marketing Agency).
Your task is to write a highly tailored, direct sales script to be read over the phone to this specific contact. 
DO NOT use generic placeholders like "[Your Name]" or "[Your Company]" - assume the persona of a SERP Hawk sales rep.

Contact Profile:
Name: {client_name}
Title/Designation: {designation}
Department: {department}
Email: {contact.email or 'Unknown'}
LinkedIn: {contact.linkedin_url or 'Unknown'}

Notes from our CRM:
{notes}

Instructions:
1. Write the exact word-for-word script that the sales person will read on the call.
2. Directly reference their specific name, their role/title, and any past notes.
3. Pitch SERP Hawk's services (e.g. SEO, link building, digital marketing) as the solution to their specific needs.
4. Make it conversational, persuasive, and professional.
5. Structure it logically but seamlessly.
6. Output ONLY the spoken script as natural dialogue. Do NOT include markdown headings like **Introduction** or **Value Proposition**. It should read exactly like a transcript of someone speaking. Do not add any meta-commentary."""

    if req and req.context:
        prompt += f"\n\nAdditional Custom Context / Instructions from the Sales Rep:\n{req.context}\n(Please ensure you incorporate this custom instruction closely into the script)."

    from modules.llm_engine import get_openai_client
    try:
        openai_client = get_openai_client()
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=800
        )
        pitch = response.choices[0].message.content or ""
    except Exception as e:
        print("Error in contact simulation:", e)
        raise HTTPException(status_code=500, detail=f"Failed to simulate call: {str(e)}")
        
    call = CallLog(
        phone_number=contact.mobile_number or "Unknown",
        duration_seconds=180,
        summary=f"Pitch Generation for {client_name}",
        description=pitch,
        tenant_id=tenant_id
    )
    session.add(call)
    session.commit()
    session.refresh(call)
    
    return {"ok": True, "call_id": call.id, "pitch": pitch}

@app.get("/work-queue")
def get_work_queue(
    user_id: int = Query(...),
    role: str = Query(...),
    date_filter: str = Query("today"),
    session: Session = Depends(get_session)
):
    try:
        today_date = date.today()
        if date_filter == "yesterday":
            target_date = today_date - timedelta(days=1)
        elif date_filter == "tomorrow":
            target_date = today_date + timedelta(days=1)
        else:
            target_date = today_date
            
        start_dt = datetime.combine(target_date, datetime.min.time())
        end_dt = datetime.combine(target_date, datetime.max.time())
        
        # Work Queue is personal by design. Admins can inspect the same personal
        # queue by selecting their own account; do not leak the whole workspace.
        is_admin = False
        
        # 1. Tasks
        tasks_q = session.query(Task)
        if not is_admin:
            tasks_q = tasks_q.filter(Task.assigned_to == user_id)
        tasks = [task for task in tasks_q.all() if (task.due_date or "")[:10] == target_date.isoformat()]
        
        # 2. Meetings
        meetings_q = session.query(Meeting).filter(Meeting.scheduled_at >= start_dt, Meeting.scheduled_at <= end_dt)
        if not is_admin:
            meetings_q = meetings_q.filter(Meeting.host_id == user_id)
        meetings = meetings_q.all()
        
        # 3. Scheduled Calls
        calls_q = session.query(ScheduledCall)
        user_owner_names = {str(user_id).lower()}
        current_user = session.get(User, user_id)
        if current_user:
            user_owner_names.update({(current_user.name or "").strip().lower(), (current_user.email or "").strip().lower()})
        calls = [call for call in calls_q.all() if call.scheduled_at and start_dt <= call.scheduled_at <= end_dt and (call.assigned_to or "").strip().lower() in user_owner_names]
        
        # 4. Leads (using created_at as proxy for activity if followup doesn't exist, wait Lead has no followup_date)
        # We'll just show leads created on that day
        leads_q = session.query(Lead).filter(Lead.created_at >= start_dt, Lead.created_at <= end_dt)
        if not is_admin:
            leads_q = leads_q.filter(Lead.owner_id == user_id)
        leads = leads_q.all()
        
        # 5. Contacts
        contacts_q = session.query(Contact).filter(Contact.created_at >= start_dt, Contact.created_at <= end_dt)
        if not is_admin:
            contacts_q = contacts_q.filter(Contact.owner_id == user_id)
        contacts = contacts_q.all()
        
        # 6. Deals
        deals_q = session.query(Deal).filter(Deal.created_at >= start_dt, Deal.created_at <= end_dt)
        if not is_admin:
            deals_q = deals_q.filter(Deal.owner_id == user_id)
        deals = deals_q.all()
        
        # 7. Tickets (developer/intern ownership, split by selected date)
        user = session.get(User, user_id)
        tickets = []
        ticket_due = []
        ticket_ongoing = []
        ticket_completed = []
        if user and user.role in ["ProjectMember", "Intern", "Developer"]:
            owner_names = {str(user.id).lower(), (user.name or "").strip().lower(), (user.email or "").strip().lower()}
            all_project_tickets = session.query(ProjectTicket).all()
            owned_tickets = [ticket for ticket in all_project_tickets if (ticket.current_owner or "").strip().lower() in owner_names]
            ticket_due = [ticket for ticket in owned_tickets if ticket.requested_date == target_date.isoformat()]
            ticket_ongoing = [ticket for ticket in owned_tickets if ticket.current_state == "In Dev"]
            ticket_completed = [ticket for ticket in owned_tickets if ticket.date_release_prod == target_date.isoformat()]
            tickets = list({ticket.id: ticket for ticket in ticket_due + ticket_ongoing + ticket_completed}.values())

        # Sales ownership: only clients/leads assigned to the signed-in user.
        clients = []
        if user and user.role in ["Admin", "Employee", "SalesManager", "Sales", "Demo"]:
            clients = session.query(ClientProfile).filter(ClientProfile.assignedEmployeeId == user_id).all()

        # Support cases assigned to this user; admins see all cases.
        cases_q = session.query(Case)
        if not is_admin:
            cases_q = cases_q.filter(Case.assigned_to == user_id)
        cases = cases_q.all()
        
        return {
            "ok": True,
            "date": target_date.isoformat(),
            "tasks": tasks,
            "meetings": meetings,
            "calls": calls,
            "leads": leads,
            "contacts": contacts,
            "deals": deals,
            "tickets": tickets,
            "ticket_due": ticket_due,
            "ticket_ongoing": ticket_ongoing,
            "ticket_completed": ticket_completed,
            "clients": clients,
            "cases": cases
        }
    except Exception as e:
        print("Work Queue Error:", e)
        raise HTTPException(status_code=500, detail=str(e))

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


@app.post("/whatsapp-webhook")
async def whatsapp_webhook(
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    From: str = Form(...),
    Body: str = Form(default=""),
    NumMedia: str = Form(default="0"),
    MediaUrl0: Optional[str] = Form(default=None),
    MediaContentType0: Optional[str] = Form(default=None),
):
    from database import WhatsAppSession
    from modules.llm_engine import process_whatsapp_command
    from modules.whatsapp import send_whatsapp_message
    import json

    # ── Empty TwiML we always return so Twilio never waits / times-out ───
    EMPTY_TWIML = PlainTextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        media_type="application/xml"
    )

    # 1. Authorize sender dynamically — match by last 10 digits of phone
    from database import User
    sender_phone = From.replace("whatsapp:", "").replace("+", "").replace("-", "").replace(" ", "").strip()
    match_str = sender_phone[-10:] if len(sender_phone) >= 10 else sender_phone

    auth_user = session.exec(select(User).where(User.phone.like(f"%{match_str}%"))).first()

    if not auth_user:
        print(f"[WhatsApp] Unauthorized sender {From} tried to use the bot.")
        return EMPTY_TWIML

    allowed_roles = {"admin", "superadmin", "salesmanager", "employee"}
    if (auth_user.role or "").lower().replace(" ", "") not in allowed_roles:
        print(f"[WhatsApp] Sender {From} authorized but lacks CRM bot role ({auth_user.role}).")
        return EMPTY_TWIML

    # Inject tenant context — use current_tenant_id defined at module level in main.py
    current_tenant_id.set(auth_user.tenant_id)
    tenant_id = auth_user.tenant_id

    msg_text = Body.strip().lower()

    # 2. Load existing session
    ws_session = session.exec(
        select(WhatsAppSession).where(WhatsAppSession.phone_number == From)
    ).first()

    # 2.0 Check Session Expiration (24h)
    if ws_session:
        from datetime import datetime, timedelta
        if datetime.utcnow() - ws_session.created_at > timedelta(hours=24):
            try:
                session.delete(ws_session)
                session.commit()
            except Exception:
                session.rollback()
            ws_session = None

    # 2.1 Security Key Auth
    expected_key = os.environ.get("WHATSAPP_SECURITY_KEY")
    if expected_key:
        greeting_words = {"hi", "hello", "hey", "start", "login", "reset", "authenticate"}

        # If user greets/starts OR has no active session: prompt for password
        if not ws_session or (msg_text in greeting_words and ws_session.pending_action != "auth"):
            if not ws_session:
                ws_session = WhatsAppSession(
                    phone_number=From,
                    pending_action="auth"
                )
            else:
                ws_session.pending_action = "auth"
                ws_session.action_data = None
            session.add(ws_session)
            try:
                session.commit()
            except Exception:
                session.rollback()
            send_whatsapp_message(
                "🔒 *Security Key Required*\n\nPlease enter your passcode to access SerpHawk CRM 🦅",
                From
            )
            return EMPTY_TWIML

        if ws_session.pending_action == "auth":
            if Body.strip() == expected_key:
                from datetime import datetime as _dt
                ws_session.pending_action = None
                ws_session.action_data = None
                ws_session.created_at = _dt.utcnow()
                session.add(ws_session)
                try:
                    session.commit()
                except Exception:
                    session.rollback()
                send_whatsapp_message(
                    "✅ *Access Granted! Welcome to SerpHawk CRM 🦅*\n\n"
                    "I'm *Hawk*, your AI CRM assistant. You can now tell me or send a voice note to:\n\n"
                    "📋 *View Data:*\n"
                    "• _List my clients_\n"
                    "• _Show leads_\n"
                    "• _Show upcoming meetings_\n"
                    "• _Show my tasks_\n\n"
                    "⚡ *Actions:*\n"
                    "• _Add lead Acme Corp, website acme.com_\n"
                    "• _Add client Apex Media_\n"
                    "• _Add note to lead Acme: interested in SEO audit_\n"
                    "• _Assign salesperson Varshith to lead Acme_\n"
                    "• _Schedule meeting with Acme tomorrow at 3pm_\n\n"
                    "🎙️ *Voice Notes:* Just hold the mic and speak naturally!\n"
                    "📸 *Business Cards:* Send a photo of any business card.",
                    From
                )
            else:
                send_whatsapp_message(
                    "❌ Incorrect Security Key. Please enter your passcode to access the CRM (or send 'hi' to restart).",
                    From
                )
            return EMPTY_TWIML

    # ── Step 0: Voice message transcription ──────────────────────────────
    voice_transcript = None
    if int(NumMedia or 0) >= 1 and MediaUrl0 and (MediaContentType0 or "").startswith("audio/"):
        account_sid = os.environ.get("TWILIO_ACCOUNT_SID", "")
        auth_token = os.environ.get("TWILIO_AUTH_TOKEN", "")
        try:
            from modules.whatsapp import transcribe_voice_message
            send_whatsapp_message(
                "🎙️ Got your voice note! Transcribing and processing... give me a moment ⏳",
                From
            )
            voice_transcript = transcribe_voice_message(MediaUrl0, account_sid, auth_token)
            Body = voice_transcript
            msg_text = voice_transcript.strip().lower()
            print(f"[Voice] Final transcript: {voice_transcript}")
        except Exception as ve:
            print(f"[Voice] Transcription failed: {ve}")
            send_whatsapp_message(
                "🎙️ I received your voice note but couldn't transcribe it. "
                "Please try again or type your request.",
                From
            )
            return EMPTY_TWIML

    # ── Step 0.5: Image/Business-card processing ─────────────────────────
    image_data = None
    if int(NumMedia or 0) >= 1 and MediaUrl0 and (MediaContentType0 or "").startswith("image/"):
        account_sid = os.environ.get("TWILIO_ACCOUNT_SID", "")
        auth_token = os.environ.get("TWILIO_AUTH_TOKEN", "")
        try:
            send_whatsapp_message("🖼️ Got your image! Scanning for details... ⏳", From)
            import requests as _req, base64
            from requests.auth import HTTPBasicAuth
            img_resp = _req.get(
                MediaUrl0,
                auth=HTTPBasicAuth(account_sid, auth_token),
                timeout=30
            )
            img_resp.raise_for_status()
            base64_img = base64.b64encode(img_resp.content).decode("utf-8")
            image_data = {"base64": base64_img, "mime_type": MediaContentType0}
            print(f"[Image] Downloaded {len(img_resp.content)} bytes")
        except Exception as ie:
            print(f"[Image] Failed: {ie}")
            send_whatsapp_message("❌ Sorry, I couldn't process the image you sent.", From)
            return EMPTY_TWIML

    # 2.2 Handle Active Live Chat
    if ws_session and ws_session.active_live_chat_session:
        print(f"[WhatsApp] User in live chat: {ws_session.active_live_chat_session}")
        if msg_text in ("end", "stop", "exit"):
            from database import LiveChatSession
            lcs = session.exec(
                select(LiveChatSession).where(
                    LiveChatSession.session_id == ws_session.active_live_chat_session
                )
            ).first()
            if lcs:
                lcs.status = "ended"
            try:
                session.delete(ws_session)
                session.commit()
            except Exception:
                session.rollback()
            send_whatsapp_message("✅ Live chat ended. Send a new command whenever you're ready.", From)
        else:
            from database import LiveChatMessage
            chat_msg = LiveChatMessage(
                session_id=ws_session.active_live_chat_session,
                sender="admin",
                message=Body.strip()
            )
            session.add(chat_msg)
            try:
                session.commit()
            except Exception:
                session.rollback()
        return EMPTY_TWIML

    # 2.3 Handle Pending Actions (awaiting YES/NO/1/2/3 or corrections)
    previous_state = None
    if ws_session and ws_session.pending_action and ws_session.pending_action != "auth":
        print(f"[WhatsApp] Pending action: {ws_session.pending_action}")
        action = ws_session.pending_action
        args = json.loads(ws_session.action_data or "{}")

        # Determine if user is confirming
        is_confirm = False
        if action == "add_entity" and msg_text in ["1", "2", "3"]:
            is_confirm = True
        elif action != "add_entity" and msg_text in ["yes", "y", "confirm", "ok", "yep", "yeah"]:
            is_confirm = True

        if is_confirm:
            reply_msg = "✅ Action completed!"

            # ── add_entity ───────────────────────────────────────────────
            if action == "add_entity":
                name = args.get("name", "Unknown")
                email = args.get("email")
                phone = args.get("phone")
                website = args.get("website")
                notes_text = args.get("notes")

                if msg_text == "1":  # Client
                    from database import ClientProfile, ClientNote
                    new_client = ClientProfile(
                        companyName=name,
                        phone=phone,
                        websiteUrl=website,
                        status="Active",
                        lead_source="WhatsApp",
                        tenant_id=tenant_id,
                    )
                    if email:
                        new_client.customFields = {"email": email}
                    session.add(new_client)
                    session.commit()
                    session.refresh(new_client)
                    if notes_text:
                        session.add(ClientNote(
                            client_id=new_client.id,
                            content=notes_text,
                            author_name="WhatsApp Agent",
                            tags=["whatsapp", "onboarding"],
                            tenant_id=tenant_id,
                        ))
                        session.commit()
                    reply_msg = (
                        f"✅ Client *{name}* added to CRM!\n"
                        + (f"📧 {email}\n" if email else "")
                        + (f"📞 {phone}\n" if phone else "")
                        + (f"🌐 {website}\n" if website else "")
                    )

                elif msg_text == "2":  # Lead
                    from database import Lead
                    new_lead = Lead(
                        company_name=name,
                        website=website,
                        email=email,
                        phone=phone,
                        source="WhatsApp",
                        status="New",
                        tenant_id=tenant_id,
                        notes=notes_text,
                    )
                    session.add(new_lead)
                    session.commit()
                    session.refresh(new_lead)
                    reply_msg = f"✅ Lead *{name}* added! 🎯\nRunning background research..."

                    # Background HTTP call to smart-research (avoids asyncio.run in thread)
                    def _bg_research(lead_id, c_name, c_url, from_number):
                        import requests as _r
                        try:
                            base = os.environ.get("BASE_URL", "http://localhost:8000")
                            resp = _r.post(
                                f"{base}/smart-research",
                                json={"company_name": c_name, "company_url": c_url},
                                timeout=120
                            )
                            if resp.ok:
                                from modules.whatsapp import send_whatsapp_message as _send
                                _send(f"✅ Research complete for *{c_name}*! AI draft is ready in the CRM.", from_number)
                        except Exception as ex:
                            print(f"[WhatsApp BG Research] Error: {ex}")

                    background_tasks.add_task(_bg_research, new_lead.id, name, website or "", From)

                elif msg_text == "3":  # Contact
                    from database import Contact
                    name_parts = name.split(" ", 1)
                    new_contact = Contact(
                        first_name=name_parts[0],
                        last_name=name_parts[1] if len(name_parts) > 1 else None,
                        full_name=name,
                        email=email,
                        mobile_number=phone,
                        tenant_id=tenant_id,
                        notes=notes_text,
                    )
                    session.add(new_contact)
                    session.commit()
                    reply_msg = f"✅ Contact *{name}* added!\n" + (f"📧 {email}\n" if email else "") + (f"📞 {phone}\n" if phone else "")

            # ── schedule_meeting ─────────────────────────────────────────
            elif action == "schedule_meeting":
                from database import Meeting
                target_name = args.get("target_name", "Unknown")
                time_str = args.get("time_str", "TBD")
                meeting_type = args.get("meeting_type", "Meeting")
                notes = args.get("notes", "Scheduled via WhatsApp")

                # Try to find linked client or lead
                from database import ClientProfile, Lead
                client_match = session.exec(
                    select(ClientProfile).where(ClientProfile.companyName.ilike(f"%{target_name}%"))
                ).first()
                lead_match = None
                if not client_match:
                    lead_match = session.exec(
                        select(Lead).where(Lead.company_name.ilike(f"%{target_name}%"))
                    ).first()

                new_meeting = Meeting(
                    title=f"{meeting_type} with {target_name}",
                    description=notes,
                    meeting_type=meeting_type,
                    status="Scheduled",
                    notes=f"Scheduled via WhatsApp: {time_str}",
                    client_id=client_match.id if client_match else None,
                    lead_id=lead_match.id if lead_match else None,
                    tenant_id=tenant_id,
                )
                session.add(new_meeting)
                session.commit()
                reply_msg = f"📅 *{meeting_type}* with *{target_name}* scheduled for *{time_str}*!\nAdded to your calendar. ✅"

            # ── add_note ─────────────────────────────────────────────────
            elif action == "add_note":
                from database import ClientNote, ClientProfile, Lead
                target_name = args.get("target_name", "")
                content = args.get("content", "")

                # Try client first, then lead
                client = session.exec(
                    select(ClientProfile).where(ClientProfile.companyName.ilike(f"%{target_name}%"))
                ).first()
                lead = None
                if not client:
                    lead = session.exec(
                        select(Lead).where(Lead.company_name.ilike(f"%{target_name}%"))
                    ).first()

                if client:
                    note = ClientNote(
                        client_id=client.id,
                        content=content,
                        author_name=auth_user.name or "WhatsApp Agent",
                        tags=["whatsapp"],
                        tenant_id=tenant_id,
                    )
                    session.add(note)
                    session.commit()
                    snippet = content[:80] + ("..." if len(content) > 80 else "")
                    reply_msg = f"📝 Note added to *{client.companyName}*:\n\"{snippet}\""
                elif lead:
                    # Append to lead's notes field
                    from datetime import datetime
                    lead.notes = f"{lead.notes or ''}\n[{datetime.utcnow().strftime('%Y-%m-%d')} WhatsApp] {content}".strip()
                    lead.last_activity = f"WhatsApp note: {content[:50]}"
                    session.commit()
                    reply_msg = f"📝 Note added to lead *{lead.company_name}*:\n\"{content[:80]}\""
                else:
                    reply_msg = (
                        f"⚠️ Couldn't find *{target_name}* in clients or leads.\n"
                        "Check the name and try again."
                    )

            # ── add_task ─────────────────────────────────────────────────
            elif action == "add_task":
                from database import Task, ClientProfile
                title = args.get("title", "Untitled Task")
                description = args.get("description")
                due_date = args.get("due_date")
                priority = args.get("priority", "Medium")
                client_name = args.get("client_name")

                client_id = None
                if client_name:
                    client = session.exec(
                        select(ClientProfile).where(ClientProfile.companyName.ilike(f"%{client_name}%"))
                    ).first()
                    if client:
                        client_id = client.id

                new_task = Task(
                    title=title,
                    description=description or "Created via WhatsApp",
                    status="Todo",
                    priority=priority,
                    due_date=due_date,
                    client_id=client_id,
                    tenant_id=tenant_id,
                )
                session.add(new_task)
                session.commit()
                reply_msg = (
                    f"✅ Task created!\n"
                    f"📌 *{title}*\n"
                    + (f"📅 Due: {due_date}\n" if due_date else "")
                    + (f"🔥 Priority: {priority}\n" if priority else "")
                    + (f"🏢 Client: {client_name}\n" if client_name else "")
                )

            # ── assign_salesperson ────────────────────────────────────────
            elif action == "assign_salesperson":
                from database import ClientProfile, Lead, User as _User
                entity_name = args.get("entity_name", "")
                salesperson_name = args.get("salesperson_name", "")
                entity_type = args.get("entity_type", "client").lower()

                # Find the salesperson/employee by name
                sales_user = session.exec(
                    select(_User).where(_User.name.ilike(f"%{salesperson_name}%"))
                ).first()

                if not sales_user:
                    reply_msg = f"⚠️ Employee *{salesperson_name}* not found in the system. Check the name and try again."
                else:
                    entity_found = False
                    if entity_type in ("client", "both"):
                        client = session.exec(
                            select(ClientProfile).where(ClientProfile.companyName.ilike(f"%{entity_name}%"))
                        ).first()
                        if client:
                            client.assignedEmployeeId = sales_user.id
                            session.commit()
                            reply_msg = f"👤 *{salesperson_name}* assigned to client *{client.companyName}*! ✅"
                            entity_found = True

                    if not entity_found:
                        lead = session.exec(
                            select(Lead).where(Lead.company_name.ilike(f"%{entity_name}%"))
                        ).first()
                        if lead:
                            lead.owner_id = sales_user.id
                            session.commit()
                            reply_msg = f"👤 *{salesperson_name}* assigned to lead *{lead.company_name}*! ✅"
                            entity_found = True

                    if not entity_found:
                        reply_msg = f"⚠️ Couldn't find *{entity_name}* in clients or leads. Check the name and try again."

            # ── update_lead_status ────────────────────────────────────────
            elif action == "update_lead_status":
                from database import Lead
                lead_name = args.get("lead_name", "")
                new_status = args.get("new_status", "")

                lead = session.exec(
                    select(Lead).where(Lead.company_name.ilike(f"%{lead_name}%"))
                ).first()
                if lead:
                    old_status = lead.status
                    lead.status = new_status
                    from datetime import datetime
                    lead.last_activity = f"Status changed to {new_status} via WhatsApp"
                    session.commit()
                    reply_msg = f"✅ Lead *{lead.company_name}* status updated:\n{old_status} → *{new_status}*"
                else:
                    reply_msg = f"⚠️ Lead *{lead_name}* not found. Check the name and try again."

            # ── update_client_status ──────────────────────────────────────
            elif action == "update_client_status":
                from database import ClientProfile
                client_name = args.get("client_name", "")
                new_status = args.get("new_status", "")

                client = session.exec(
                    select(ClientProfile).where(ClientProfile.companyName.ilike(f"%{client_name}%"))
                ).first()
                if client:
                    old_status = client.status
                    client.status = new_status
                    session.commit()
                    reply_msg = f"✅ Client *{client.companyName}* status updated:\n{old_status} → *{new_status}*"
                else:
                    reply_msg = f"⚠️ Client *{client_name}* not found."

            # ── generate_email_draft ─────────────────────────────────────
            elif action == "generate_email_draft":
                from database import ClientProfile, Lead
                entity_name = args.get("entity_name", "")
                context_hint = args.get("context", "")

                client = session.exec(
                    select(ClientProfile).where(ClientProfile.companyName.ilike(f"%{entity_name}%"))
                ).first()
                lead = None
                if not client:
                    lead = session.exec(
                        select(Lead).where(Lead.company_name.ilike(f"%{entity_name}%"))
                    ).first()

                entity = client or lead
                if not entity:
                    reply_msg = f"⚠️ *{entity_name}* not found in clients or leads."
                else:
                    real_name = getattr(entity, "companyName", None) or getattr(entity, "company_name", entity_name)
                    website = getattr(entity, "websiteUrl", None) or getattr(entity, "website", "")
                    reply_msg = f"✍️ Generating AI email draft for *{real_name}*... I'll send it back shortly!"

                    def _gen_draft(e_name, e_website, e_context, from_number):
                        try:
                            from modules.llm_engine import get_openai_client as _oai, generate_email, analyze_content
                            analysis = analyze_content(f"Company: {e_name}\nWebsite: {e_website}\nContext: {e_context}")
                            draft = generate_email(analysis)
                            subject = draft.get("subject", "")
                            body = draft.get("english_body", "")[:600]
                            wa_draft = draft.get("whatsapp_draft", "")
                            msg = (
                                f"📧 *Email Draft for {e_name}:*\n\n"
                                f"*Subject:* {subject}\n\n"
                                f"{body}{'...' if len(draft.get('english_body','')) > 600 else ''}\n\n"
                                + (f"💬 *WhatsApp Draft:*\n{wa_draft}" if wa_draft else "")
                            )
                            from modules.whatsapp import send_whatsapp_message as _send
                            _send(msg, from_number)
                        except Exception as ex:
                            print(f"[WhatsApp Draft] Error: {ex}")
                            from modules.whatsapp import send_whatsapp_message as _send
                            _send(f"❌ Draft generation failed for *{e_name}*. Try again!", from_number)

                    background_tasks.add_task(_gen_draft, real_name, website, context_hint, From)

            # ── send_success_message ──────────────────────────────────────
            elif action == "send_success_message":
                from database import ClientProfile, Lead, ClientResearch
                entity_name = args.get("entity_name", "")

                client = session.exec(
                    select(ClientProfile).where(ClientProfile.companyName.ilike(f"%{entity_name}%"))
                ).first()
                lead = None
                if not client:
                    lead = session.exec(
                        select(Lead).where(Lead.company_name.ilike(f"%{entity_name}%"))
                    ).first()

                entity = client or lead
                if not entity:
                    reply_msg = f"⚠️ *{entity_name}* not found."
                else:
                    real_name = getattr(entity, "companyName", None) or getattr(entity, "company_name", entity_name)
                    # Look for existing research
                    research = None
                    if client:
                        research = session.exec(
                            select(ClientResearch).where(ClientResearch.client_id == client.id)
                        ).first()
                    elif lead:
                        research = session.exec(
                            select(ClientResearch).where(ClientResearch.lead_id == lead.id)
                        ).first()

                    if research and research.email_agent_data:
                        try:
                            res_data = json.loads(research.email_agent_data) if isinstance(research.email_agent_data, str) else research.email_agent_data
                            verdict = res_data.get("executive_verdict") or res_data.get("company_overview", "")
                            opportunity = res_data.get("serphawk_opportunity", {})
                            fit_score = opportunity.get("fit_score", "N/A")
                            pitch_angle = opportunity.get("pitch_angle", "N/A")
                            rec_services = opportunity.get("recommended_services", [])
                            swot = getattr(entity, "swot_analysis", None)

                            success_msg = (
                                f"🤖 *Agent Report: {real_name}*\n\n"
                                f"📊 *Fit Score:* {fit_score}/10\n\n"
                                f"📋 *Overview:*\n{verdict[:300]}{'...' if len(verdict) > 300 else ''}\n\n"
                                f"🎯 *Pitch Angle:*\n{pitch_angle[:200]}\n\n"
                                + (f"✨ *Recommended Services:*\n" + "\n".join([f"• {s}" for s in rec_services[:5]]) if rec_services else "")
                                + (f"\n\n📊 *SWOT:*\n{swot[:300]}" if swot else "")
                            )
                            reply_msg = success_msg
                        except Exception as e:
                            reply_msg = f"⚠️ Research data found but couldn't parse it for *{real_name}*."
                    else:
                        reply_msg = (
                            f"⏳ No agent research found for *{real_name}* yet.\n"
                            f"Say _'research {entity_name}'_ to kick off a new analysis!"
                        )

            # ── quick_followup ────────────────────────────────────────────
            elif action == "quick_followup":
                from database import Task, ClientProfile, Lead
                entity_name = args.get("entity_name", "")
                time_str = args.get("time_str", "soon")
                note = args.get("note", "")

                client = session.exec(
                    select(ClientProfile).where(ClientProfile.companyName.ilike(f"%{entity_name}%"))
                ).first()
                lead = None
                if not client:
                    lead = session.exec(
                        select(Lead).where(Lead.company_name.ilike(f"%{entity_name}%"))
                    ).first()

                real_name = (client and client.companyName) or (lead and lead.company_name) or entity_name
                client_id = client.id if client else None

                task = Task(
                    title=f"Follow up with {real_name}",
                    description=note or f"Follow up scheduled for {time_str}",
                    status="Todo",
                    priority="High",
                    due_date=time_str,
                    client_id=client_id,
                    tenant_id=tenant_id,
                )
                session.add(task)
                session.commit()
                reply_msg = f"⏰ Follow-up reminder set for *{real_name}* on *{time_str}*! ✅"

            try:
                session.delete(ws_session)
                session.commit()
            except Exception:
                try:
                    session.rollback()
                except Exception:
                    pass

            send_whatsapp_message(reply_msg, From)
            return EMPTY_TWIML

        elif msg_text in ("no", "cancel", "n", "nope", "stop"):
            try:
                session.delete(ws_session)
                session.commit()
            except Exception:
                session.rollback()
            send_whatsapp_message("❌ Action cancelled. Send a new command whenever you're ready.", From)
            return EMPTY_TWIML
        else:
            # User is correcting — pass to AI with previous state
            print("[WhatsApp] User correcting previous command.")
            previous_state = {
                "action": ws_session.pending_action,
                "parameters": json.loads(ws_session.action_data or "{}")
            }

    # 3. Parse via AI
    print(f"[WhatsApp] Processing command: {Body[:100]}")
    result = process_whatsapp_command(Body, previous_state, image_data)
    action_name = result.get("action", "none")
    params = result.get("parameters", {})
    print(f"[WhatsApp] AI result: action={action_name}, params={params}")

    # ── INSTANT (read-only) actions — no confirmation needed ─────────────
    INSTANT_ACTIONS = {
        "radar_search", "get_call_pitch", "research_client",
        "list_clients", "list_leads", "list_tasks",
        "list_upcoming_meetings", "get_client_summary",
    }

    # Clear any stale session before instant actions
    if action_name in INSTANT_ACTIONS and ws_session:
        try:
            session.delete(ws_session)
            session.commit()
            ws_session = None
        except Exception:
            session.rollback()

    # ── list_clients ──────────────────────────────────────────────────────
    if action_name == "list_clients":
        from database import ClientProfile
        status_filter = params.get("status_filter")
        limit = min(int(params.get("limit", 10)), 20)
        q = select(ClientProfile)
        if tenant_id:
            q = q.where(ClientProfile.tenant_id == tenant_id)
        if status_filter:
            q = q.where(ClientProfile.status == status_filter)
        q = q.limit(limit)
        clients = session.exec(q).all()
        if clients:
            lines = [f"📋 *Your Clients ({len(clients)}):*\n"]
            for c in clients:
                status_emoji = {"Active": "🟢", "Hold": "🟡", "Pending": "🔵"}.get(c.status, "⚪")
                lines.append(f"{status_emoji} *{c.companyName or 'Unnamed'}* — {c.status}")
                if c.websiteUrl:
                    lines.append(f"   🌐 {c.websiteUrl}")
            lines.append(f"\n💬 Say _'tell me about [name]'_ for full details.")
            send_whatsapp_message("\n".join(lines), From)
        else:
            send_whatsapp_message("📋 No clients found" + (f" with status *{status_filter}*" if status_filter else "") + ".", From)
        return EMPTY_TWIML

    # ── list_leads ────────────────────────────────────────────────────────
    elif action_name == "list_leads":
        from database import Lead
        status_filter = params.get("status_filter")
        limit = min(int(params.get("limit", 10)), 20)
        q = select(Lead)
        if tenant_id:
            q = q.where(Lead.tenant_id == tenant_id)
        if status_filter:
            q = q.where(Lead.status == status_filter)
        q = q.order_by(Lead.created_at.desc()).limit(limit)
        leads = session.exec(q).all()
        if leads:
            status_emojis = {"New": "🆕", "Contacted": "📞", "Qualified": "⭐", "Proposal Sent": "📄", "Closed Won": "🏆", "Closed Lost": "❌"}
            lines = [f"🎯 *Your Leads ({len(leads)}):*\n"]
            for l in leads:
                emoji = status_emojis.get(l.status, "🔵")
                lines.append(f"{emoji} *{l.company_name}* — {l.status}")
                if l.website:
                    lines.append(f"   🌐 {l.website}")
            lines.append(f"\n💬 Say _'update lead [name] to Qualified'_ to change status.")
            send_whatsapp_message("\n".join(lines), From)
        else:
            send_whatsapp_message("🎯 No leads found" + (f" with status *{status_filter}*" if status_filter else "") + ".", From)
        return EMPTY_TWIML

    # ── list_tasks ────────────────────────────────────────────────────────
    elif action_name == "list_tasks":
        from database import Task
        status_filter = params.get("status_filter")
        limit = min(int(params.get("limit", 10)), 20)
        q = select(Task)
        if tenant_id:
            q = q.where(Task.tenant_id == tenant_id)
        if status_filter:
            q = q.where(Task.status == status_filter)
        else:
            q = q.where(Task.status.in_(["Todo", "In Progress"]))
        q = q.order_by(Task.created_at.desc()).limit(limit)
        tasks = session.exec(q).all()
        if tasks:
            priority_emojis = {"Urgent": "🚨", "High": "🔴", "Medium": "🟡", "Low": "🟢"}
            lines = [f"✅ *Your Pending Tasks ({len(tasks)}):*\n"]
            for t in tasks:
                p_emoji = priority_emojis.get(t.priority, "⚪")
                lines.append(f"{p_emoji} *{t.title}*")
                if t.due_date:
                    lines.append(f"   📅 Due: {t.due_date}")
                if t.status:
                    lines.append(f"   📌 Status: {t.status}")
            send_whatsapp_message("\n".join(lines), From)
        else:
            send_whatsapp_message("✅ No pending tasks! You're all caught up 🎉", From)
        return EMPTY_TWIML

    # ── list_upcoming_meetings ────────────────────────────────────────────
    elif action_name == "list_upcoming_meetings":
        from database import ScheduledCall, Meeting
        from datetime import datetime as _dt
        limit = min(int(params.get("limit", 10)), 20)
        now = _dt.utcnow()

        # Query both Meeting and ScheduledCall tables
        mtgs = session.exec(
            select(Meeting)
            .where(Meeting.status == "Scheduled")
            .order_by(Meeting.scheduled_at.asc())
            .limit(limit)
        ).all()

        sched_calls = session.exec(
            select(ScheduledCall)
            .where(ScheduledCall.status == "Scheduled")
            .order_by(ScheduledCall.created_at.desc())
            .limit(limit)
        ).all()

        lines = [f"📅 *Upcoming Meetings & Calls:*\n"]
        total = 0
        for m in mtgs:
            time_str = m.scheduled_at.strftime("%d %b, %I:%M %p") if m.scheduled_at else "Time TBD"
            lines.append(f"📋 *{m.title}*\n   🕐 {time_str} | 📁 {m.meeting_type}")
            total += 1
        for sc in sched_calls:
            lines.append(f"📞 *{sc.title}*\n   👤 {sc.entity_name or 'Unknown'} | 📁 {sc.status}")
            total += 1

        if total == 0:
            send_whatsapp_message("📅 No upcoming meetings or calls scheduled.", From)
        else:
            lines.append(f"\n💬 Say _'schedule meeting with [name] tomorrow 5pm'_ to add one.")
            send_whatsapp_message("\n".join(lines), From)
        return EMPTY_TWIML

    # ── get_client_summary ────────────────────────────────────────────────
    elif action_name == "get_client_summary":
        from database import ClientProfile, Lead, ClientNote, ClientResearch
        name_q = params.get("name", "")

        client = session.exec(
            select(ClientProfile).where(ClientProfile.companyName.ilike(f"%{name_q}%"))
        ).first()
        lead = None
        if not client:
            lead = session.exec(
                select(Lead).where(Lead.company_name.ilike(f"%{name_q}%"))
            ).first()

        if client:
            # Build rich summary
            notes = session.exec(
                select(ClientNote).where(ClientNote.client_id == client.id)
                .order_by(ClientNote.created_at.desc()).limit(3)
            ).all()
            research = session.exec(
                select(ClientResearch).where(ClientResearch.client_id == client.id)
            ).first()

            status_emoji = {"Active": "🟢", "Hold": "🟡", "Pending": "🔵"}.get(client.status, "⚪")
            email_val = (client.customFields or {}).get("email", "") if client.customFields else ""
            assigned_user = None
            if client.assignedEmployeeId:
                from database import User as _U
                assigned_user = session.exec(select(_U).where(_U.id == client.assignedEmployeeId)).first()

            lines = [
                f"🏢 *{client.companyName}*\n",
                f"{status_emoji} Status: {client.status}",
                f"🌐 {client.websiteUrl or 'No website'}",
                (f"📧 {email_val}" if email_val else ""),
                (f"📞 {client.phone}" if client.phone else ""),
                (f"💰 Deal Value: ${client.deal_value:,.0f}" if client.deal_value else ""),
                (f"🏭 Industry: {client.industry}" if client.industry else ""),
                (f"👤 Assigned to: {assigned_user.name}" if assigned_user else ""),
                (f"📊 Lead Score: {client.lead_score}/100" if client.lead_score else ""),
                "",
            ]
            if notes:
                lines.append("📝 *Recent Notes:*")
                for n in notes:
                    snippet = n.content[:100] + ("..." if len(n.content) > 100 else "")
                    lines.append(f"• {snippet}")

            if research:
                lines.append("\n🤖 *AI Research:* Available — say _'agent results for {name_q}'_ to view")

            lines.append(f"\n💬 Options:\n• _Note that {name_q} ..._\n• _Assign [person] to {name_q}_\n• _Generate draft for {name_q}_")
            send_whatsapp_message("\n".join(filter(None, lines)), From)
        elif lead:
            lines = [
                f"🎯 *Lead: {lead.company_name}*\n",
                f"📊 Status: {lead.status}",
                (f"🌐 {lead.website}" if lead.website else ""),
                (f"📧 {lead.email}" if lead.email else ""),
                (f"📞 {lead.phone}" if lead.phone else ""),
                (f"🏭 {lead.industry}" if lead.industry else ""),
                (f"📋 Notes: {lead.notes[:150]}" if lead.notes else ""),
                "",
                f"💬 Options:\n• _Update lead {name_q} to Qualified_\n• _Generate draft for {name_q}_\n• _Research {name_q}_"
            ]
            send_whatsapp_message("\n".join(filter(None, lines)), From)
        else:
            send_whatsapp_message(f"⚠️ *{name_q}* not found in clients or leads. Check the name and try again.", From)
        return EMPTY_TWIML

    # ── radar_search ──────────────────────────────────────────────────────
    elif action_name == "radar_search":
        query_r = params.get("query", "")
        location_r = params.get("location", "")
        full_query = f"{query_r} {location_r}".strip()
        send_whatsapp_message(f"🔍 Running radar research on *{full_query}*... give me a moment ⏳", From)
        try:
            import asyncio
            from modules.scraper import scrape_website
            from modules.llm_engine import analyze_content
            if query_r.startswith("http") or ("." in query_r.split()[0] if query_r.split() else False):
                url = query_r if query_r.startswith("http") else f"https://{query_r}"
                try:
                    scraped = asyncio.run(scrape_website(url))
                    text_to_analyze = scraped.get("text", "") or scraped.get("raw", "")
                    analysis = analyze_content(f"Website: {url}\n\n{text_to_analyze}")
                except Exception:
                    analysis = analyze_content(f"Research this website and business: {url}")
            else:
                analysis = analyze_content(f"Market/keyword research: {full_query}\nProvide market analysis, key players, recommended services.")

            company = analysis.get("company_name", full_query)
            what_they_do = analysis.get("what_they_do", "N/A")
            services = analysis.get("key_value_props", [])
            contacts = analysis.get("contacts", [])

            radar_msg = (
                f"🔭 *Radar Report: {company}*\n\n"
                f"📋 *What they do:*\n{what_they_do}\n\n"
            )
            if services:
                radar_msg += "💡 *Relevant services for them:*\n" + "\n".join([f"• {s}" for s in services[:5]]) + "\n\n"
            if contacts:
                radar_msg += "👥 *Key contacts found:*\n"
                for c in contacts[:3]:
                    n = c.get("name") or "Unknown"
                    r = c.get("role") or ""
                    e = c.get("email") or ""
                    p = c.get("phone_number") or ""
                    radar_msg += f"• {n}" + (f" ({r})" if r else "") + (f" — {e}" if e else "") + (f" 📞{p}" if p else "") + "\n"
            radar_msg += "\n💬 Reply *pitch for [name]* or *add [name]* to CRM!"
            send_whatsapp_message(radar_msg, From)
        except Exception as re_err:
            print(f"[WhatsApp Radar] Error: {re_err}")
            send_whatsapp_message(f"❌ Radar research failed for *{full_query}*. Try again!", From)
        return EMPTY_TWIML

    # ── get_call_pitch ────────────────────────────────────────────────────
    elif action_name == "get_call_pitch":
        client_name_p = params.get("client_name", "")
        try:
            from database import ClientProfile, Lead
            search_term = f"%{client_name_p}%"
            client_p = session.exec(
                select(ClientProfile).where(ClientProfile.companyName.ilike(search_term))
            ).first()
            lead_p = None
            if not client_p:
                lead_p = session.exec(
                    select(Lead).where(Lead.company_name.ilike(search_term))
                ).first()

            entity_name = None
            pitch_text = None
            if client_p:
                entity_name = client_p.companyName
                if client_p.call_pitch_text:
                    pitch_text = client_p.call_pitch_text
                else:
                    from modules.llm_engine import get_openai_client as _oai
                    _c = _oai()
                    _r = _c.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=[{"role": "user", "content": f"Generate a short, punchy 30-second cold-call pitch for a digital marketing agency (SerpHawk) reaching out to {entity_name}. Keep it under 120 words. Be conversational and warm."}]
                    )
                    pitch_text = _r.choices[0].message.content
                    client_p.call_pitch_text = pitch_text
                    session.commit()
            elif lead_p:
                entity_name = lead_p.company_name
                from modules.llm_engine import get_openai_client as _oai
                _c = _oai()
                _r = _c.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": f"Generate a short, punchy 30-second cold-call pitch for a digital marketing agency (SerpHawk) reaching out to {entity_name}. Keep it under 120 words. Be conversational and warm."}]
                )
                pitch_text = _r.choices[0].message.content

            if pitch_text:
                send_whatsapp_message(f"📞 *Call Pitch for {entity_name}:*\n\n{pitch_text}", From)
            else:
                send_whatsapp_message(f"❌ Couldn't find *{client_name_p}* in your CRM. Add them first or try a different name.", From)
        except Exception as pe:
            print(f"[WhatsApp Pitch] Error: {pe}")
            send_whatsapp_message(f"❌ Error getting pitch for *{client_name_p}*. Try again!", From)
        return EMPTY_TWIML

    # ── research_client ───────────────────────────────────────────────────
    elif action_name == "research_client":
        query_rc = params.get("query", "")
        send_whatsapp_message(f"🔬 Researching *{query_rc}*... give me a moment ⏳", From)
        try:
            from database import ClientProfile, Lead
            from modules.llm_engine import analyze_content
            if query_rc.startswith("http") or ("." in query_rc and " " not in query_rc):
                url = query_rc if query_rc.startswith("http") else f"https://{query_rc}"
                try:
                    import asyncio
                    from modules.scraper import scrape_website
                    scraped = asyncio.run(scrape_website(url))
                    text = scraped.get("text", "") or scraped.get("raw", "")
                    analysis = analyze_content(f"Website: {url}\n\n{text}")
                except Exception:
                    analysis = analyze_content(f"Research this company from their website: {url}")
            else:
                search_term = f"%{query_rc}%"
                client_rc = session.exec(select(ClientProfile).where(ClientProfile.companyName.ilike(search_term))).first()
                lead_rc = session.exec(select(Lead).where(Lead.company_name.ilike(search_term))).first()
                extra_ctx = ""
                if client_rc:
                    extra_ctx = f"CRM info — website: {client_rc.websiteUrl or 'unknown'}, notes: {client_rc.tagline or ''}"
                elif lead_rc:
                    extra_ctx = f"CRM info — website: {lead_rc.website or 'unknown'}, email: {lead_rc.email or 'unknown'}"
                analysis = analyze_content(f"Research this company: {query_rc}\n{extra_ctx}")

            company = analysis.get("company_name", query_rc)
            what_they_do = analysis.get("what_they_do", "N/A")
            services = analysis.get("key_value_props", [])
            contacts = analysis.get("contacts", [])
            socials = analysis.get("company_social_media", {})

            res_msg = f"🔬 *Research: {company}*\n\n📋 *About:*\n{what_they_do}\n\n"
            if services:
                res_msg += "💡 *Best services for them:*\n" + "\n".join([f"• {s}" for s in services[:4]]) + "\n\n"
            if contacts:
                res_msg += "👥 *Key contacts:*\n"
                for c in contacts[:3]:
                    n = c.get("name") or "?"
                    r = c.get("role") or ""
                    e = c.get("email") or ""
                    p = c.get("phone_number") or ""
                    res_msg += f"• {n}" + (f" ({r})" if r else "") + (f" — {e}" if e else "") + (f" 📞{p}" if p else "") + "\n"
            soc_links = [v for v in socials.values() if v]
            if soc_links:
                res_msg += "\n🌐 *Social:* " + " | ".join(soc_links[:3])
            res_msg += "\n\n💬 Reply *pitch for [name]* or *add [name]* to add to CRM!"
            send_whatsapp_message(res_msg, From)
        except Exception as rce:
            print(f"[WhatsApp Research] Error: {rce}")
            send_whatsapp_message(f"❌ Research failed for *{query_rc}*. Try again!", From)
        return EMPTY_TWIML

    # ── Confirm-flow actions: save session and ask user to confirm ────────
    CONFIRM_ACTIONS = {
        "add_entity", "schedule_meeting", "add_note", "add_task",
        "assign_salesperson", "update_lead_status", "update_client_status",
        "generate_email_draft", "send_success_message", "quick_followup",
    }

    if action_name in CONFIRM_ACTIONS:
        # Save pending session (replace existing if any)
        try:
            if ws_session:
                session.delete(ws_session)
                session.flush()
            new_session = WhatsAppSession(
                phone_number=From,
                pending_action=action_name,
                action_data=json.dumps(params)
            )
            session.add(new_session)
            session.commit()
            print(f"[WhatsApp] Session saved: action={action_name}")
        except Exception as db_err:
            print(f"[WhatsApp] ERROR saving session: {db_err}")
            try:
                session.rollback()
            except Exception:
                pass

        # Build confirmation message
        action_labels = {
            "add_entity":           "👤 Add New Entity",
            "add_note":             "📝 Add Note",
            "schedule_meeting":     "📅 Schedule Meeting",
            "add_task":             "✅ Create Task",
            "assign_salesperson":   "👤 Assign Salesperson",
            "update_lead_status":   "📊 Update Lead Status",
            "update_client_status": "📊 Update Client Status",
            "generate_email_draft": "📧 Generate Email Draft",
            "send_success_message": "🤖 Get Agent Results",
            "quick_followup":       "⏰ Schedule Follow-up",
        }
        label = action_labels.get(action_name, action_name.replace("_", " ").title())

        field_icons = {
            "name": "👤", "email": "📧", "phone": "📞", "website": "🌐",
            "notes": "📋", "target_name": "👤", "content": "📋",
            "time_str": "🕐", "title": "📌", "description": "📋",
            "due_date": "📅", "priority": "🔥", "client_name": "🏢",
            "entity_name": "🏢", "salesperson_name": "👤",
            "lead_name": "🎯", "new_status": "📊",
            "entity_type": "📁", "context": "💬",
            "note": "📝", "meeting_type": "📋",
        }
        param_lines = ""
        for k, v in params.items():
            if v:
                icon = field_icons.get(k, "•")
                param_lines += f"\n{icon} {k.replace('_', ' ').title()}: {v}"

        # Voice transcript prefix
        voice_prefix = ""
        if voice_transcript:
            short_transcript = voice_transcript[:150] + ("..." if len(voice_transcript) > 150 else "")
            voice_prefix = f"🎙️ *I heard:* \"{short_transcript}\"\n\n"

        if action_name == "add_entity":
            confirm_msg = (
                f"{voice_prefix}"
                f"📋 *Proposed Action:* {label}{param_lines}\n\n"
                f"Where should I add this? *Reply with a number:*\n"
                f"1️⃣ Client\n"
                f"2️⃣ Lead\n"
                f"3️⃣ Contact\n\n"
                f"❌ Reply *NO* to cancel\n"
                f"✏️ *To edit:* Reply with your corrections"
            )
        else:
            confirm_msg = (
                f"{voice_prefix}"
                f"📋 *Proposed Action:* {label}{param_lines}\n\n"
                f"✅ Reply *YES* to confirm\n"
                f"❌ Reply *NO* to cancel\n"
                f"✏️ *To edit:* Reply with your corrections (e.g., 'change time to tomorrow 3pm')"
            )

        send_whatsapp_message(confirm_msg, From)
        return EMPTY_TWIML

    else:
        # Conversational reply or unrecognized input
        if ws_session and ws_session.pending_action not in ("auth", None):
            try:
                session.delete(ws_session)
                session.commit()
            except Exception:
                session.rollback()

        reply = result.get(
            "reply",
            "🤖 I didn't quite understand that.\n\nTry:\n"
            "• _Add client Acme Corp_\n"
            "• _List my leads_\n"
            "• _Schedule meeting with Ravi tomorrow at 3pm_\n"
            "• _Note that Blue Barrier is interested in SEO_\n"
            "• _Assign Ravi to Acme_\n"
            "• Or just send a voice note! 🎙️"
        )
        if voice_transcript:
            reply = f"🎙️ *I heard:* \"{voice_transcript[:100]}\"\n\n{reply}"
        send_whatsapp_message(reply, From)
        return EMPTY_TWIML



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

@app.get("/inventory")
def get_inventory(session: Session = Depends(get_session)):
    items = session.exec(select(InventoryItem).order_by(InventoryItem.created_at.desc())).all()
    result = []
    for item in items:
        suppliers = session.exec(select(InventorySupplier).where(InventorySupplier.item_id == item.id)).all()
        result.append({
            "id": item.id, "code": item.code, "name": item.name,
            "description": item.description, "category": item.category,
            "tags": item.tags or [], "photo_url": item.photo_url,
            "unit": item.unit, "min_stock": item.min_stock,
            "current_stock": item.current_stock, "created_at": item.created_at.isoformat(),
            "suppliers": [
                {"id": s.id, "supplier_name": s.supplier_name, "supplier_brand": s.supplier_brand,
                 "supplier_email": s.supplier_email, "lot_number": s.lot_number,
                 "unit_cost": s.unit_cost, "currency": s.currency,
                 "lead_time_days": s.lead_time_days, "min_order_qty": s.min_order_qty,
                 "is_preferred": s.is_preferred, "notes": s.notes,
                 "supplier_user_id": s.supplier_user_id,
                 "credentials_ready": bool(s.login_password),
                 "credentials_sent": bool(s.credentials_sent)}
                for s in suppliers
            ]
        })
    return {"items": result, "total": len(result)}

@app.post("/inventory/export-pdf")
def export_inventory_pdf(body: ExportPdfRequest, session: Session = Depends(get_session)):
    import io
    from fastapi.responses import Response
    from modules.pdf_export import inventory_pdf, send_pdf_email
    tenant_id = current_tenant_id.get()
    q = select(InventoryItem).order_by(InventoryItem.created_at.desc())
    if tenant_id:
        q = q.where(InventoryItem.tenant_id == tenant_id)
    items = session.exec(q).all()
    data = [{
        "code": it.code, "name": it.name, "description": it.description,
        "category": it.category, "tags": it.tags or [],
        "unit": it.unit, "current_stock": it.current_stock,
        "min_stock": it.min_stock, "photo_url": it.photo_url,
    } for it in items]
    pdf = inventory_pdf(data)
    if body.email:
        try:
            send_pdf_email(
                body.email, "Inventory List PDF", "<p>The requested inventory list is attached.</p>",
                pdf, "inventory_list.pdf"
            )
            return {"sent": True, "recipient": body.email, "count": len(data)}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Email failed: {e}")
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=inventory_list.pdf"}
    )

@app.get("/inventory/{item_id}/pdf")
def export_single_inventory_pdf(item_id: int, session: Session = Depends(get_session)):
    from fastapi.responses import Response
    from modules.pdf_export import single_inventory_pdf
    item = session.get(InventoryItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    suppliers = session.exec(select(InventorySupplier).where(InventorySupplier.item_id == item.id)).all()
    pdf = single_inventory_pdf({
        "code": item.code, "name": item.name, "description": item.description,
        "category": item.category, "unit": item.unit,
        "current_stock": item.current_stock, "min_stock": item.min_stock,
        "photo_url": item.photo_url, "tags": item.tags or [],
    })
    filename = f"inventory_{item.code or item.id}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

class MultiInvPdfRequest(BaseModel):
    item_ids: List[int]

@app.post("/inventory/pdf")
def export_multi_inventory_pdf(body: MultiInvPdfRequest, session: Session = Depends(get_session)):
    from fastapi.responses import Response
    from modules.pdf_export import multi_inventory_pdf
    ids = list(dict.fromkeys(body.item_ids))
    if not ids:
        raise HTTPException(status_code=400, detail="No items selected")
    if len(ids) > 100:
        raise HTTPException(status_code=400, detail="Select at most 100 items at a time")
    items = []
    for pid in ids:
        item = session.get(InventoryItem, pid)
        if item:
            items.append({
                "code": item.code, "name": item.name, "description": item.description,
                "category": item.category, "unit": item.unit,
                "current_stock": item.current_stock, "min_stock": item.min_stock,
                "photo_url": item.photo_url, "tags": item.tags or [],
            })
    if not items:
        raise HTTPException(status_code=404, detail="Items not found")
    pdf = multi_inventory_pdf(items)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=inventory_items.pdf"}
    )

@app.post("/products/export-pdf")
def export_catalog_pdf(body: ExportPdfRequest, session: Session = Depends(get_session)):
    from fastapi.responses import Response
    from modules.pdf_export import catalog_pdf, send_pdf_email
    products = session.exec(select(Product).order_by(Product.name)).all()
    data = [p.model_dump() for p in products]
    pdf = catalog_pdf(data)
    if body.email:
        try:
            send_pdf_email(
                body.email, "Product Catalog PDF", "<p>The requested product catalog is attached.</p>",
                pdf, "product_catalog.pdf"
            )
            return {"sent": True, "recipient": body.email, "count": len(data)}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Email failed: {e}")
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=product_catalog.pdf"}
    )

@app.post("/inventory")
def create_inventory_item(data: InventoryItemCreate, session: Session = Depends(get_session)):
    item = InventoryItem(**data.dict())
    item.tenant_id = current_tenant_id.get()
    session.add(item)
    session.commit()
    session.refresh(item)
    return item

@app.put("/inventory/{item_id}")
def update_inventory_item(item_id: int, data: InventoryItemCreate, session: Session = Depends(get_session)):
    item = session.get(InventoryItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    for k, v in data.dict(exclude_unset=True).items():
        setattr(item, k, v)
    item.updated_at = datetime.utcnow()
    session.add(item)
    session.commit()
    session.refresh(item)
    return item

@app.delete("/inventory/{item_id}")
def delete_inventory_item(item_id: int, session: Session = Depends(get_session)):
    from sqlmodel import delete
    item = session.get(InventoryItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    # delete related
    session.exec(delete(InventorySupplier).where(InventorySupplier.item_id == item_id))
    session.exec(delete(RFQRequest).where(RFQRequest.item_id == item_id))
    session.delete(item)
    session.commit()
    return {"ok": True}

@app.post("/inventory/{item_id}/suppliers")
def add_supplier(item_id: int, data: InventorySupplierCreate, session: Session = Depends(get_session)):
    item = session.get(InventoryItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    supplier_user_id = None
    credentials_created = False
    generated_password = None
    
    # Auto-create supplier login if email provided
    if data.supplier_email:
        generated_password = _generate_unique_password()
        hashed = _hash_password(generated_password)
        existing_user = session.exec(select(User).where(User.email == data.supplier_email)).first()
        if existing_user:
            # Update role + reset password so we always have fresh credentials to show
            existing_user.role = "Supplier"
            existing_user.password = hashed
            existing_user.hashed_password = hashed
            existing_user.is_active = True
            existing_user.status = "Active"
            session.add(existing_user)
            session.commit()
            supplier_user_id = existing_user.id
        else:
            supplier_user = User(
                email=data.supplier_email,
                password=hashed,
                hashed_password=hashed,
                name=data.supplier_name,
                role="Supplier",
                is_active=True,
                status="Active"
            )
            session.add(supplier_user)
            session.commit()
            session.refresh(supplier_user)
            supplier_user_id = supplier_user.id
        credentials_created = True
    
    supplier = InventorySupplier(item_id=item_id, supplier_user_id=supplier_user_id, **data.dict())
    if generated_password:
        supplier.login_password = generated_password
        supplier.credentials_sent = False
    session.add(supplier)
    session.commit()
    session.refresh(supplier)
    
    result = {
        "id": supplier.id,
        "supplier_name": supplier.supplier_name,
        "supplier_email": supplier.supplier_email,
        "supplier_user_id": supplier_user_id,
        "credentials_created": credentials_created,
    }
    if credentials_created and generated_password:
        result["login_email"] = data.supplier_email
        result["login_password"] = generated_password
    
    return result

@app.delete("/inventory/suppliers/{supplier_id}")
def delete_supplier(supplier_id: int, session: Session = Depends(get_session)):
    s = session.get(InventorySupplier, supplier_id)
    if not s:
        raise HTTPException(status_code=404, detail="Supplier not found")
    session.delete(s)
    session.commit()
    return {"ok": True}

@app.put("/inventory/suppliers/{supplier_id}")
def update_supplier(supplier_id: int, data: InventorySupplierCreate, session: Session = Depends(get_session)):
    s = session.get(InventorySupplier, supplier_id)
    if not s:
        raise HTTPException(status_code=404, detail="Supplier not found")
    for k, v in data.dict(exclude_unset=True).items():
        setattr(s, k, v)
    session.add(s)
    session.commit()
    session.refresh(s)
    return s

@app.post("/inventory/suppliers/{supplier_id}/send-credentials")
def send_supplier_credentials(supplier_id: int, session: Session = Depends(get_session)):
    """Email the supplier's portal login credentials to their inbox (manual send button)."""
    s = session.get(InventorySupplier, supplier_id)
    if not s:
        raise HTTPException(status_code=404, detail="Supplier not found")
    if not s.supplier_email:
        raise HTTPException(status_code=400, detail="Supplier has no email address on file")
    if not s.login_password:
        raise HTTPException(status_code=400, detail="No login credentials exist for this supplier")

    login_url = (os.environ.get("FRONTEND_URL") or "https://crm-seo.allytechcourses.com").rstrip("/") + "/login"
    subject = "Your SERP Hawk Supplier Portal Login"
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
      <div style="background:#1e293b;color:#fff;padding:22px 28px">
        <strong style="font-size:18px">🦅 SERP Hawk Supplier Portal</strong>
      </div>
      <div style="padding:28px">
        <h2 style="color:#0f172a;font-size:20px;margin:0 0 12px">Your supplier account is ready</h2>
        <p style="color:#475569;line-height:1.6;margin:0 0 20px">
          Hello <strong>{s.supplier_name}</strong>,<br/><br/>
          An account has been created for you so you can update pricing, stock levels, lot numbers,
          and delivery timelines for the items we source from you. Use the credentials below to sign in.
        </p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin:0 0 20px">
          <div style="margin-bottom:14px">
            <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Login URL</div>
            <a href="{login_url}" style="color:#2563eb;font-weight:600;word-break:break-all">{login_url}</a>
          </div>
          <div style="margin-bottom:14px">
            <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Email</div>
            <div style="color:#0f172a;font-weight:600;word-break:break-all">{s.supplier_email}</div>
          </div>
          <div>
            <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Password</div>
            <div style="color:#0f172a;font-weight:800;font-family:monospace;font-size:16px;letter-spacing:1px">{s.login_password}</div>
          </div>
        </div>
        <a href="{login_url}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 26px;border-radius:8px;font-weight:600">Open the Supplier Portal</a>
        <p style="color:#64748b;font-size:13px;line-height:1.6;margin:20px 0 0">
          If you did not expect this email, you can safely ignore it. We recommend changing your password after your first login.
        </p>
        <p style="color:#94a3b8;font-size:11px;line-height:1.5;margin:16px 0 0;border-top:1px solid #e2e8f0;padding-top:12px">📬 Didn't see this in your inbox? Sometimes automated emails land in spam or junk — please check there and mark us as "Not spam" so future emails reach you.</p>
      </div>
    </div>
    """
    sent = False
    try:
        from modules.email_sender import send_email_outlook
        sender, password, smtp_server, smtp_port = _quote_smtp_sender(session)
        if sender and password:
            send_email_outlook(s.supplier_email, subject, html, sender, password,
                               smtp_server=smtp_server or "mail.serphawk.in", smtp_port=smtp_port or 587)
            sent = True
    except Exception as e:
        print(f"[Supplier credentials email failed] {e}")

    s.credentials_sent = sent
    session.add(s)
    session.commit()

    if not sent:
        raise HTTPException(status_code=500, detail="Email could not be sent. Check SMTP configuration.")
    return {"ok": True, "email_sent": True, "recipient": s.supplier_email}
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

@app.post("/supplier/inventory/add-item")
def supplier_add_item(req: SupplierAddItemRequest, session: Session = Depends(get_session)):
    tenant_id = current_tenant_id.get()
    
    # Create the item
    item = InventoryItem(
        tenant_id=tenant_id,
        code=req.code,
        name=req.name,
        description=req.description,
        category=req.category,
        tags=req.tags or [],
        photo_url=req.photo_url,
        unit=req.unit,
        min_stock=req.min_stock,
        current_stock=req.current_stock
    )
    session.add(item)
    session.commit()
    session.refresh(item)
    
    # Check if a user for this supplier exists to grab ID
    user = session.exec(select(User).where(User.email == req.supplier_email).where(User.tenant_id == tenant_id)).first()
    supplier_user_id = user.id if user else None

    # Attach this supplier to the item
    supplier = InventorySupplier(
        item_id=item.id,
        supplier_name=req.supplier_name,
        supplier_email=req.supplier_email,
        supplier_user_id=supplier_user_id,
        unit_cost=req.unit_cost,
        currency=req.currency,
        lead_time_days=req.lead_time_days,
        lot_number=req.lot_number,
        notes=req.notes
    )
    session.add(supplier)
    session.commit()
    
    return {"ok": True, "item_id": item.id}

@app.get("/supplier/inventory")
def get_supplier_inventory(email: str, session: Session = Depends(get_session)):
    """Get all inventory items that this supplier is linked to"""
    # Find all supplier records for this email
    supplier_records = session.exec(
        select(InventorySupplier).where(InventorySupplier.supplier_email == email)
    ).all()
    
    if not supplier_records:
        # also try by user_id
        user = session.exec(select(User).where(User.email == email)).first()
        if user:
            supplier_records = session.exec(
                select(InventorySupplier).where(InventorySupplier.supplier_user_id == user.id)
            ).all()
    
    result = []
    seen_items = set()
    for sr in supplier_records:
        if sr.item_id in seen_items:
            continue
        seen_items.add(sr.item_id)
        item = session.get(InventoryItem, sr.item_id)
        if not item:
            continue
        # Get all suppliers for this item
        all_suppliers = session.exec(select(InventorySupplier).where(InventorySupplier.item_id == item.id)).all()
        result.append({
            "id": item.id, "code": item.code, "name": item.name,
            "description": item.description, "category": item.category,
            "tags": item.tags or [], "photo_url": item.photo_url,
            "unit": item.unit, "min_stock": item.min_stock,
            "current_stock": item.current_stock, "created_at": item.created_at.isoformat(),
            "my_supplier_id": sr.id,
            "my_unit_cost": sr.unit_cost,
            "my_currency": sr.currency,
            "my_lead_time_days": sr.lead_time_days,
            "my_lot_number": sr.lot_number,
            "my_notes": sr.notes,
            "is_preferred": sr.is_preferred,
            "total_suppliers": len(all_suppliers),
        })
    return {"items": result, "total": len(result)}

@app.put("/supplier/inventory/{supplier_record_id}")
def supplier_update_record(supplier_record_id: int, data: InventorySupplierCreate, session: Session = Depends(get_session)):
    """Supplier updates their own record for an item"""
    s = session.get(InventorySupplier, supplier_record_id)
    if not s:
        raise HTTPException(status_code=404, detail="Record not found")
    for k, v in data.dict(exclude_unset=True).items():
        setattr(s, k, v)
    session.add(s)
    session.commit()
    session.refresh(s)
    return {"ok": True}

@app.put("/supplier/inventory/{supplier_record_id}/stock")
def supplier_update_stock(supplier_record_id: int, current_stock: float, session: Session = Depends(get_session)):
    """Supplier updates stock level of an item"""
    s = session.get(InventorySupplier, supplier_record_id)
    if not s:
        raise HTTPException(status_code=404, detail="Record not found")
    item = session.get(InventoryItem, s.item_id)
    if item:
        item.current_stock = current_stock
        item.updated_at = datetime.utcnow()
        session.add(item)
        session.commit()
    return {"ok": True}


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

@app.get("/rfq")
def get_rfqs(session: Session = Depends(get_session)):
    rfqs = session.exec(select(RFQRequest).order_by(RFQRequest.created_at.desc())).all()
    result = []
    for r in rfqs:
        item = session.get(InventoryItem, r.item_id)
        responses = session.exec(select(RFQResponse).where(RFQResponse.rfq_id == r.id)).all()
        result.append({
            "id": r.id, "item_id": r.item_id,
            "item_name": item.name if item else "—", "item_code": item.code if item else "—",
            "supplier_name": r.supplier_name, "supplier_email": r.supplier_email,
            "quantity": r.quantity, "notes": r.notes, "status": r.status,
            "token": r.token, "created_at": r.created_at.isoformat(),
            "responses": [
                {"id": res.id, "unit_price": res.unit_price, "currency": res.currency,
                 "lead_time_days": res.lead_time_days, "valid_until": res.valid_until,
                 "notes": res.notes, "submitted_at": res.submitted_at.isoformat()}
                for res in responses
            ]
        })
    return {"rfqs": result, "total": len(result)}

@app.post("/rfq")
def create_rfq(data: RFQCreate, session: Session = Depends(get_session)):
    token = secrets.token_urlsafe(32)
    rfq = RFQRequest(**data.dict(), token=token)
    session.add(rfq)
    session.commit()
    session.refresh(rfq)
    return {"id": rfq.id, "token": token, "status": rfq.status}

@app.post("/rfq/{rfq_id}/respond")
def respond_to_rfq(rfq_id: int, data: RFQResponseCreate, token: str = None, session: Session = Depends(get_session)):
    rfq = session.get(RFQRequest, rfq_id)
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found")
    response = RFQResponse(rfq_id=rfq_id, **data.dict())
    session.add(response)
    rfq.status = "Responded"
    session.add(rfq)
    session.commit()
    return {"ok": True}

@app.put("/rfq/{rfq_id}/status")
def update_rfq_status(rfq_id: int, status: str, session: Session = Depends(get_session)):
    rfq = session.get(RFQRequest, rfq_id)
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found")
    rfq.status = status
    session.add(rfq)
    session.commit()
    return {"ok": True}

# ═══════════════════════════════════════════════════════════════
# API KEYS ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@app.get("/api-keys")
def list_api_keys(session: Session = Depends(get_session)):
    keys = session.exec(select(APIKey).where(APIKey.is_active == True).order_by(APIKey.created_at.desc())).all()
    return {"keys": [
        {"id": k.id, "name": k.name, "key_prefix": k.key_prefix,
         "scopes": k.scopes or [], "created_at": k.created_at.isoformat(),
         "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None}
        for k in keys
    ]}

class APIKeyCreate(BaseModel):
    name: str
    scopes: Optional[List[str]] = ["read", "write"]

@app.post("/api-keys")
def create_api_key(data: APIKeyCreate, session: Session = Depends(get_session)):
    raw_key = "sk_live_" + secrets.token_urlsafe(32)
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    prefix = raw_key[:12]
    key = APIKey(name=data.name, key_hash=key_hash, key_prefix=prefix, scopes=data.scopes)
    session.add(key)
    session.commit()
    session.refresh(key)
    # Return full key ONCE - never shown again
    return {"id": key.id, "name": key.name, "key": raw_key, "key_prefix": prefix, "scopes": key.scopes}

@app.delete("/api-keys/{key_id}")
def revoke_api_key(key_id: int, session: Session = Depends(get_session)):
    key = session.get(APIKey, key_id)
    if not key:
        raise HTTPException(status_code=404, detail="Key not found")
    key.is_active = False
    session.add(key)
    session.commit()
    return {"ok": True}

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
    from modules.api_tracker import current_salesperson_id
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

@app.get("/telemetry/demo-account/{user_id}")
def get_demo_account_detail(user_id: int, session: Session = Depends(get_session)):
    """Return full summary of a Demo user's activity - queries by tenant_id."""
    _require_roles(session, ["Admin"])
    from database import (User, Tenant, ClientProfile, Lead, RadarAnalysis, SentEmail, Contact, Meeting, CallLog, Project, Notification, ClientResearch, CompetitorAnalysis)
    from sqlmodel import select

    user = session.get(User, user_id)
    if not user or user.role != "Demo":
        raise HTTPException(status_code=404, detail="Demo account not found")

    tid = user.tenant_id

    def q(model, order_col):
        """Query rows belonging to this tenant.
        skip_tenant=True prevents the SQLAlchemy do_orm_execute hook from adding
        a second conflicting tenant_id filter (admin's tid vs demo user's tid).
        """
        if not tid:
            return []
        stmt = (
            select(model)
            .where(getattr(model, "tenant_id") == tid)
            .order_by(order_col.desc())
            .execution_options(skip_tenant=True)
        )
        return session.exec(stmt).all()

    raw_clients  = q(ClientProfile, ClientProfile.id)
    raw_leads    = q(Lead, Lead.created_at)
    raw_radar    = q(RadarAnalysis, RadarAnalysis.run_date)
    raw_emails   = q(SentEmail, SentEmail.sent_at)
    raw_contacts = q(Contact, Contact.id)
    raw_meetings = q(Meeting, Meeting.scheduled_at)
    raw_calls    = q(CallLog, CallLog.received_at)
    raw_projects = q(Project, Project.id)
    raw_research = q(ClientResearch, ClientResearch.updated_at)
    raw_competitor = q(CompetitorAnalysis, CompetitorAnalysis.last_updated)

    # Team members: all users in the same tenant (excluding the demo user themselves)
    raw_team = []
    if tid:
        raw_team = session.exec(
            select(User)
            .where(User.tenant_id == tid, User.id != user_id)
            .execution_options(skip_tenant=True)
        ).all()

    limits = None
    if tid:
        tenant = session.get(Tenant, tid)
        if tenant:
            limits = {
                "clients":  {"usage": tenant.usage_clients,  "limit": tenant.limit_clients},
                "emails":   {"usage": tenant.usage_emails,   "limit": tenant.limit_emails},
                "searches": {"usage": tenant.usage_searches, "limit": tenant.limit_searches},
                "projects": {"usage": tenant.usage_projects, "limit": tenant.limit_projects},
                "calls":    {"usage": getattr(tenant, "usage_calls", 0), "limit": getattr(tenant, "limit_calls", 5)},
            }

    upgrade_requested = False
    admin = session.exec(select(User).where(User.role == "Admin")).first()
    if admin:
        upgrade_notif = session.exec(
            select(Notification)
            .where(
                Notification.user_id == admin.id,
                Notification.title == "Demo Upgrade Request",
                Notification.message.contains(user.email)
            )
            .execution_options(skip_tenant=True)
        ).first()
        if upgrade_notif:
            upgrade_requested = True

    return {
        "success": True,
        "user": {
            "id": user.id, "name": user.name, "email": user.email,
            "created_at": user.createdAt.isoformat() if user.createdAt else None,
            "tenant_id": tid,
            "upgrade_requested": upgrade_requested,
        },
        "clients":  [{"id": c.id, "company": c.companyName or c.projectName or "—",
                       "website": c.websiteUrl or "—", "status": c.status or "—",
                       "created_at": None} for c in raw_clients],
        "leads":    [{"id": l.id, "name": l.company_name or "—", "email": l.email or "—",
                       "company": l.company_name or "—", "status": l.status or "—",
                       "created_at": l.created_at.isoformat() if l.created_at else None} for l in raw_leads],
        "contacts": [{"id": c.id,
                       "name": (c.full_name or f"{c.first_name} {c.last_name or ''}").strip() or "—",
                       "email": c.email or "—", "designation": c.designation or "—",
                       "created_at": c.created_at.isoformat() if c.created_at else None} for c in raw_contacts],
        "radar":    [{"id": r.id, "target_name": r.target_name or "—",
                       "target_website": r.target_website or "—",
                       "competitor_count": r.competitor_count or 0, "radius_km": r.radius_km or 0,
                       "run_date": r.run_date.isoformat() if r.run_date else None} for r in raw_radar],
        "emails":   [{"id": e.id, "to": e.to_email or "—", "subject": e.subject or "—",
                       "status": e.status or "—",
                       "sent_at": e.sent_at.isoformat() if e.sent_at else None} for e in raw_emails],
        "meetings": [{"id": m.id, "title": m.title or "—", "status": m.status or "—",
                       "scheduled_at": m.scheduled_at.isoformat() if m.scheduled_at else None} for m in raw_meetings],
        "calls":    [{"id": c.id, "phone": c.phone_number or "—", "duration": c.duration_seconds or 0,
                       "summary": c.summary or c.description or "—",
                       "received_at": c.received_at.isoformat() if c.received_at else None} for c in raw_calls],
        "projects": [{"id": p.id, "name": p.name or "—", "status": p.status or "—",
                       "progress": p.progress or 0} for p in raw_projects],
        "team_members": [{"id": u.id, "name": u.name or "—", "email": u.email or "—",
                           "role": u.role or "—"} for u in raw_team],
        "researches": [{"id": r.id, "company_overview": r.company_overview or "", "updated_at": r.updated_at.isoformat() if r.updated_at else None} for r in raw_research],
        "competitors": [{"id": c.id, "competitor_domain": c.competitor_domain or "", "last_updated": c.last_updated.isoformat() if c.last_updated else None} for c in raw_competitor],
        "limits": limits,
    }


@app.post("/admin/backfill-tenant-data/{user_id}")
def backfill_tenant_data(user_id: int, session: Session = Depends(get_session)):
    """
    Admin tool: Fix existing data with NULL tenant_id for a demo user.
    Patches old records created before tenant isolation was enforced.
    """
    _require_roles(session, ["Admin"])
    from database import (User, ClientProfile, Lead, Contact, Meeting, CallLog, Project, SentEmail, RadarAnalysis)
    from sqlmodel import select

    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    tid = user.tenant_id
    if not tid:
        raise HTTPException(status_code=400, detail="User has no tenant_id assigned")

    counts = {}

    # Fix ClientProfile records linked to this user
    cp_fix = session.exec(
        select(ClientProfile)
        .where(ClientProfile.userId == user.id, ClientProfile.tenant_id == None)
        .execution_options(skip_tenant=True)
    ).all()
    for r in cp_fix:
        r.tenant_id = tid
        session.add(r)
    counts["client_profiles_fixed"] = len(cp_fix)
    session.flush()

    # Get all client IDs now assigned to this tenant
    all_client_ids = [c.id for c in session.exec(
        select(ClientProfile)
        .where(ClientProfile.tenant_id == tid)
        .execution_options(skip_tenant=True)
    ).all()]

    # Fix Contacts linked to those clients
    contact_fix = []
    if all_client_ids and hasattr(Contact, "client_id"):
        contact_fix = session.exec(
            select(Contact)
            .where(Contact.client_id.in_(all_client_ids), Contact.tenant_id == None)
            .execution_options(skip_tenant=True)
        ).all()
        for r in contact_fix:
            r.tenant_id = tid
            session.add(r)
    counts["contacts_fixed"] = len(contact_fix)

    # Fix Leads linked to those clients
    lead_fix = []
    if all_client_ids and hasattr(Lead, "client_id"):
        lead_fix = session.exec(
            select(Lead)
            .where(Lead.client_id.in_(all_client_ids), Lead.tenant_id == None)
            .execution_options(skip_tenant=True)
        ).all()
        for r in lead_fix:
            r.tenant_id = tid
            session.add(r)
    counts["leads_fixed"] = len(lead_fix)

    # Helper for generic backfill linked to client_ids
    def backfill_model(model_cls):
        if not all_client_ids or not hasattr(model_cls, "client_id"): return 0
        fixes = session.exec(
            select(model_cls)
            .where(model_cls.client_id.in_(all_client_ids), model_cls.tenant_id == None)
            .execution_options(skip_tenant=True)
        ).all()
        for r in fixes:
            r.tenant_id = tid
            session.add(r)
        return len(fixes)

    counts["projects_fixed"] = backfill_model(Project)
    counts["meetings_fixed"] = backfill_model(Meeting)
    counts["emails_fixed"] = backfill_model(SentEmail)
    counts["radar_fixed"] = backfill_model(RadarAnalysis)
    counts["calls_fixed"] = backfill_model(CallLog)

    session.commit()
    return {"success": True, "tenant_id": tid, "user_id": user_id, "fixed": counts}


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

