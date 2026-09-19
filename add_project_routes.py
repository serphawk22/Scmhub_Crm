import re

with open("main.py", "r") as f:
    content = f.read()

# Add import
content = content.replace("    Project,", "    Project,\n    ProjectTicket,")

# Add Pydantic Models for Team & Ticket
models_code = """
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
"""

routes_code = """
@app.get("/projects/{project_id}/tickets")
def get_project_tickets(project_id: int, session: Session = Depends(get_session)):
    tickets = session.exec(select(ProjectTicket).where(ProjectTicket.project_id == project_id)).all()
    return {"tickets": tickets}

@app.post("/projects/{project_id}/tickets")
def create_project_ticket(project_id: int, body: ProjectTicketRequest, session: Session = Depends(get_session)):
    t = ProjectTicket(**body.model_dump(), project_id=project_id)
    session.add(t)
    session.commit()
    session.refresh(t)
    return t

@app.put("/projects/tickets/{ticket_id}")
def update_project_ticket(ticket_id: int, body: ProjectTicketRequest, session: Session = Depends(get_session)):
    t = session.get(ProjectTicket, ticket_id)
    if not t: raise HTTPException(404, "Ticket not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(t, k, v)
    session.add(t)
    session.commit()
    session.refresh(t)
    return t

@app.delete("/projects/tickets/{ticket_id}")
def delete_project_ticket(ticket_id: int, session: Session = Depends(get_session)):
    t = session.get(ProjectTicket, ticket_id)
    if not t: raise HTTPException(404, "Ticket not found")
    session.delete(t)
    session.commit()
    return {"ok": True}

from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

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
                password_hash=pwd_context.hash("password123")
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
"""

if "ProjectTicketRequest" not in content:
    content = content.replace("class ProjectCreate(BaseModel):", models_code + "\nclass ProjectCreate(BaseModel):")
if "get_project_tickets" not in content:
    # insert before @app.get("/milestones")
    content = content.replace("@app.get(\"/milestones\")", routes_code + "\n@app.get(\"/milestones\")")
    
with open("main.py", "w") as f:
    f.write(content)
print("Project endpoints added.")
