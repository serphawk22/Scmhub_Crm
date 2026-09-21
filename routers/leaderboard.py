from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from typing import List
from pydantic import BaseModel
from database import engine, User, Deal, ConversationLog, Lead, ClientProfile, ProjectTicket
from modules.api_tracker import current_salesperson_id

router = APIRouter(prefix="/leaderboard", tags=["Leaderboard"])

def get_session():
    with Session(engine) as session:
        yield session

class LeaderboardEntry(BaseModel):
    user_id: int
    name: str
    role: str
    deals_closed: int
    revenue_closed: float
    meetings_booked: int
    calls_made: int
    leads_managed: int = 0
    clients_managed: int = 0
    tickets_assigned: int = 0
    tickets_in_production: int = 0
    tickets_completed: int = 0

@router.get("", response_model=List[LeaderboardEntry])
def get_leaderboard(kind: str = "all", session: Session = Depends(get_session)):
    roles = ["Employee", "SalesManager"] if kind == "sales" else ["ProjectMember", "Intern"] if kind == "tickets" else ["Employee", "SalesManager", "ProjectMember", "Intern"]
    query = select(User).where(User.role.in_(roles))
    requester_id = current_salesperson_id.get()
    if requester_id:
        requester = session.get(User, requester_id)
        if requester and requester.tenant_id:
            query = query.where(User.tenant_id == requester.tenant_id)
    users = session.exec(query).all()
    
    leaderboard = []
    
    for user in users:
        # Get deals closed (Closed Won)
        deals = session.exec(select(Deal).where(Deal.assigned_to == user.id, Deal.stage == "Closed Won")).all()
        deals_closed = len(deals)
        revenue_closed = sum(deal.value for deal in deals)
        
        # Get meetings booked
        meetings = session.exec(select(ConversationLog).where(ConversationLog.author_id == user.id, ConversationLog.type == "meeting")).all()
        meetings_booked = len(meetings)
        
        # Get calls made
        calls = session.exec(select(ConversationLog).where(ConversationLog.author_id == user.id, ConversationLog.type == "call")).all()
        calls_made = len(calls)
        leads_managed = len(session.exec(select(Lead).where(Lead.owner_id == user.id)).all())
        clients_managed = len(session.exec(select(ClientProfile).where(ClientProfile.userId == user.id)).all())
        all_tickets = session.exec(select(ProjectTicket)).all()
        owner_name = (user.name or "").strip().lower()
        assigned_tickets = [ticket for ticket in all_tickets if owner_name and (ticket.current_owner or "").strip().lower() == owner_name]
        tickets_in_production = sum(1 for ticket in assigned_tickets if ticket.current_state == "Prod Release")
        tickets_completed = sum(1 for ticket in assigned_tickets if ticket.date_release_prod or ticket.current_state == "Prod Release")

        leaderboard.append(LeaderboardEntry(
            user_id=user.id,
            name=user.name or user.email.split('@')[0],
            role=user.role,
            deals_closed=deals_closed,
            revenue_closed=revenue_closed,
            meetings_booked=meetings_booked,
            calls_made=calls_made
            , leads_managed=leads_managed
            , clients_managed=clients_managed
            , tickets_assigned=len(assigned_tickets)
            , tickets_in_production=tickets_in_production
            , tickets_completed=tickets_completed
        ))
        
    # Sort by revenue as primary metric
    leaderboard.sort(key=lambda x: x.revenue_closed, reverse=True)
    
    return leaderboard
