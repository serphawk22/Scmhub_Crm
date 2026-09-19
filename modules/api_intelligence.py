from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, func
from sqlalchemy import Integer
from database import get_session, User, ClientProfile, ApiRequest
from typing import List, Optional
from datetime import datetime, timedelta

router = APIRouter(prefix="/api-intelligence", tags=["API Intelligence"])

from fastapi import Request

@router.get("/overview")
def get_overview(request: Request, session: Session = Depends(get_session)):
    tenant_id_header = request.headers.get("X-Tenant-ID")
    tenant_id = int(tenant_id_header) if tenant_id_header else None
    
    # Base query helpers
    def base_query(model_attr):
        q = select(model_attr)
        if tenant_id and tenant_id != 1:
            q = q.where(ApiRequest.tenant_id == tenant_id)
        return q

    # Total API Calls
    total_calls = session.exec(base_query(func.count(ApiRequest.id))).one()
    
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)
    month_start = today_start.replace(day=1)
    
    today_calls = session.exec(base_query(func.count(ApiRequest.id)).where(ApiRequest.timestamp >= today_start)).one()
    week_calls = session.exec(base_query(func.count(ApiRequest.id)).where(ApiRequest.timestamp >= week_start)).one()
    month_calls = session.exec(base_query(func.count(ApiRequest.id)).where(ApiRequest.timestamp >= month_start)).one()
    
    # Token & Cost
    query_totals = select(
        func.sum(ApiRequest.input_tokens),
        func.sum(ApiRequest.output_tokens),
        func.sum(ApiRequest.reasoning_tokens),
        func.sum(ApiRequest.total_tokens),
        func.sum(ApiRequest.total_cost)
    )
    if tenant_id and tenant_id != 1:
        query_totals = query_totals.where(ApiRequest.tenant_id == tenant_id)
        
    totals = session.exec(query_totals).first()
    
    if not totals:
        totals = (0, 0, 0, 0, 0.0)
    in_tok = totals[0] or 0
    out_tok = totals[1] or 0
    reason_tok = totals[2] or 0
    total_tok = totals[3] or 0
    total_cost = totals[4] or 0.0

    today_cost = session.exec(base_query(func.sum(ApiRequest.total_cost)).where(ApiRequest.timestamp >= today_start)).one() or 0.0
    week_cost = session.exec(base_query(func.sum(ApiRequest.total_cost)).where(ApiRequest.timestamp >= week_start)).one() or 0.0
    month_cost = session.exec(base_query(func.sum(ApiRequest.total_cost)).where(ApiRequest.timestamp >= month_start)).one() or 0.0

    return {
        "calls": {
            "total": total_calls,
            "today": today_calls,
            "this_week": week_calls,
            "this_month": month_calls
        },
        "tokens": {
            "input": in_tok,
            "output": out_tok,
            "reasoning": reason_tok,
            "total": total_tok
        },
        "cost": {
            "total": total_cost,
            "today": today_cost,
            "this_week": week_cost,
            "this_month": month_cost,
            "annual_projection": month_cost * 12 # simple projection
        }
    }

@router.get("/providers")
def get_providers(request: Request, session: Session = Depends(get_session)):
    tenant_id_header = request.headers.get("X-Tenant-ID")
    tenant_id = int(tenant_id_header) if tenant_id_header else None

    query = select(
        ApiRequest.provider,
        func.count(ApiRequest.id).label("calls"),
        func.sum(ApiRequest.total_tokens).label("tokens"),
        func.sum(ApiRequest.total_cost).label("cost"),
        func.avg(ApiRequest.response_time_ms).label("avg_latency"),
        func.sum(func.cast(~ApiRequest.success, Integer)).label("errors")
    ).group_by(ApiRequest.provider)
    if tenant_id and tenant_id != 1:
        query = query.where(ApiRequest.tenant_id == tenant_id)
    
    results = session.exec(query).all()
    out = []
    for row in results:
        calls = row[1] or 0
        errs = row[5] or 0
        out.append({
            "provider": row[0] or "Unknown",
            "calls": calls,
            "tokens": row[2] or 0,
            "cost": row[3] or 0.0,
            "avg_response_time": float(row[4] or 0.0),
            "error_rate": (errs / calls * 100) if calls > 0 else 0.0
        })
    return out

@router.get("/salespersons")
def get_salespersons(request: Request, session: Session = Depends(get_session)):
    tenant_id_header = request.headers.get("X-Tenant-ID")
    tenant_id = int(tenant_id_header) if tenant_id_header else None

    query = select(
        User.id,
        User.name,
        func.count(ApiRequest.id).label("calls"),
        func.sum(ApiRequest.total_tokens).label("tokens"),
        func.sum(ApiRequest.total_cost).label("cost")
    ).outerjoin(ApiRequest, User.id == ApiRequest.salesperson_id).where(User.role.in_(["Employee", "Admin", "SalesManager"])).group_by(User.id, User.name)
    if tenant_id and tenant_id != 1:
        query = query.where(User.tenant_id == tenant_id)
    
    results = session.exec(query).all()
    return [{"id": r[0], "name": r[1], "calls": r[2] or 0, "tokens": r[3] or 0, "cost": r[4] or 0.0} for r in results]

@router.get("/clients")
def get_clients(request: Request, session: Session = Depends(get_session)):
    tenant_id_header = request.headers.get("X-Tenant-ID")
    tenant_id = int(tenant_id_header) if tenant_id_header else None

    query = select(
        ClientProfile.id,
        ClientProfile.companyName,
        func.count(ApiRequest.id).label("calls"),
        func.sum(ApiRequest.total_tokens).label("tokens"),
        func.sum(ApiRequest.total_cost).label("cost"),
        func.max(ApiRequest.timestamp).label("last_activity")
    ).outerjoin(ApiRequest, ClientProfile.id == ApiRequest.client_id).group_by(ClientProfile.id, ClientProfile.companyName)
    if tenant_id and tenant_id != 1:
        query = query.where(ClientProfile.tenant_id == tenant_id)
    
    results = session.exec(query).all()
    return [{"id": r[0], "companyName": r[1], "calls": r[2] or 0, "tokens": r[3] or 0, "cost": r[4] or 0.0, "last_activity": r[5]} for r in results]

@router.get("/endpoints")
def get_endpoints(request: Request, session: Session = Depends(get_session)):
    tenant_id_header = request.headers.get("X-Tenant-ID")
    tenant_id = int(tenant_id_header) if tenant_id_header else None

    query = select(
        ApiRequest.endpoint,
        func.count(ApiRequest.id).label("hits"),
        func.avg(ApiRequest.response_time_ms).label("avg_latency"),
        func.sum(ApiRequest.total_tokens).label("tokens"),
        func.sum(ApiRequest.total_cost).label("cost"),
        func.sum(func.cast(~ApiRequest.success, Integer)).label("errors")
    ).group_by(ApiRequest.endpoint)
    if tenant_id and tenant_id != 1:
        query = query.where(ApiRequest.tenant_id == tenant_id)
    
    results = session.exec(query).all()
    return [{"endpoint": r[0], "hits": r[1] or 0, "avg_latency": float(r[2] or 0.0), "tokens": r[3] or 0, "cost": r[4] or 0.0, "error_rate": ((r[5] or 0)/(r[1] or 1))*100} for r in results]

@router.get("/requests")
def get_requests(request: Request, limit: int = 50, session: Session = Depends(get_session)):
    tenant_id_header = request.headers.get("X-Tenant-ID")
    tenant_id = int(tenant_id_header) if tenant_id_header else None

    query = select(ApiRequest).order_by(ApiRequest.timestamp.desc()).limit(limit)
    if tenant_id and tenant_id != 1:
        query = query.where(ApiRequest.tenant_id == tenant_id)
    reqs = session.exec(query).all()
    
    # join salesperson and client names for ui
    out = []
    for r in reqs:
        sp = session.get(User, r.salesperson_id) if r.salesperson_id else None
        cp = session.get(ClientProfile, r.client_id) if r.client_id else None
        
        out.append({
            "id": r.id,
            "salesperson": sp.name if sp else "System",
            "client": cp.companyName if cp else "N/A",
            "endpoint": r.endpoint,
            "model": r.model,
            "provider": r.provider,
            "total_tokens": r.total_tokens,
            "input_tokens": r.input_tokens,
            "output_tokens": r.output_tokens,
            "total_cost": r.total_cost,
            "response_time_ms": r.response_time_ms,
            "status_code": r.status_code,
            "success": r.success,
            "timestamp": r.timestamp.isoformat()
        })
    return out

@router.get("/charts/trend")
def get_trend(session: Session = Depends(get_session)):
    # Get last 7 days of daily token and cost
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    labels = []
    tokens = []
    costs = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_str = day.strftime("%b %d")
        labels.append(day_str)
        
        day_end = day + timedelta(days=1)
        res = session.exec(select(
            func.sum(ApiRequest.total_tokens),
            func.sum(ApiRequest.total_cost)
        ).where(ApiRequest.timestamp >= day, ApiRequest.timestamp < day_end)).one()
        
        tokens.append(res[0] or 0)
        costs.append(res[1] or 0.0)
        
    return {"labels": labels, "tokens": tokens, "costs": costs}
