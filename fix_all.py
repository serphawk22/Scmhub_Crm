from database import engine, User, Tenant, ClientProfile
from sqlmodel import Session, select
from sqlalchemy import text

with Session(engine) as session:
    # Get all tenants
    tenants = session.exec(select(Tenant)).all()
    print("Tenants:")
    for t in tenants:
        print(f"  ID: {t.id}, Name: {t.name}")
        
    # Get all users
    users = session.exec(select(User)).all()
    print("\nUsers:")
    for u in users:
        print(f"  ID: {u.id}, Name: {u.name}, Email: {u.email}, Tenant ID: {u.tenant_id}")
        
    # Get client counts per tenant
    for t in tenants:
        count = session.exec(select(ClientProfile).where(ClientProfile.tenant_id == t.id)).all()
        print(f"Tenant {t.id} has {len(count)} clients")

