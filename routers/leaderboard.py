from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from typing import List
from pydantic import BaseModel
from database import engine, User, Lead, ClientProfile

router = APIRouter(prefix="/leaderboard", tags=["Leaderboard"])

def get_session():
    with Session(engine) as session:
        yield session

class LeaderboardEntry(BaseModel):
    user_id: int
    name: str
    role: str
    leads_managed: int = 0
    clients_managed: int = 0

@router.get("", response_model=List[LeaderboardEntry])
def get_leaderboard(session: Session = Depends(get_session)):
    query = select(User).where(User.role.in_(["Employee", "Developer", "Sales", "Admin"]))
    users = session.exec(query).all()
    
    leaderboard = []
    
    for user in users:
        leads = session.exec(select(Lead).where(Lead.owner_id == user.id)).all()
        leads_managed = len(leads)
        
        clients = session.exec(select(ClientProfile).where(ClientProfile.assignedEmployeeId == user.id)).all()
        clients_managed = len(clients)

        leaderboard.append(LeaderboardEntry(
            user_id=user.id,
            name=user.name or user.email.split('@')[0],
            role=user.role,
            leads_managed=leads_managed,
            clients_managed=clients_managed
        ))
        
    # Sort by clients + leads
    leaderboard.sort(key=lambda x: x.clients_managed + x.leads_managed, reverse=True)
    
    return leaderboard
