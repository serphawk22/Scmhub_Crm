from database import engine, ClientProfile, User
from sqlmodel import Session, select

with Session(engine) as session:
    clients_null = session.exec(select(ClientProfile).where(ClientProfile.tenant_id == None)).all()
    clients_tenant_1 = session.exec(select(ClientProfile).where(ClientProfile.tenant_id == 1)).all()
    print(f"Clients with NULL tenant_id: {len(clients_null)}")
    print(f"Clients with tenant_id=1: {len(clients_tenant_1)}")

