from database import engine, Tenant, ClientProfile
from sqlmodel import Session, select

with Session(engine) as session:
    master = session.exec(select(Tenant).where(Tenant.name == "Master Admin")).first()
    master_id = master.id if master else 1
    print(f"Master Tenant ID: {master_id}")
    
    # Check how many clients have NULL tenant_id
    null_clients = session.exec(select(ClientProfile).where(ClientProfile.tenant_id == None)).all()
    print(f"Clients with NULL tenant_id: {len(null_clients)}")
