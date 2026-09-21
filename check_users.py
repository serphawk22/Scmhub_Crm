from database import *
from sqlmodel import Session, select
from database import engine

with Session(engine) as session:
    demo_users = session.exec(select(User).where(User.role == "Demo")).all()
    for u in demo_users:
        print(f"User ID: {u.id}, Email: {u.email}, Tenant ID: {u.tenant_id}")
        clients = session.exec(select(ClientProfile).where(ClientProfile.userId == u.id)).all()
        for c in clients:
            print(f"  - Client {c.id}: tenant_id={c.tenant_id}, company={c.companyName}")
        leads = session.exec(select(Lead).where(Lead.owner_id == u.id)).all()
        for l in leads:
            print(f"  - Lead {l.id}: tenant_id={l.tenant_id}, company={l.company_name}")
