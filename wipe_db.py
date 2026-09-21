from sqlmodel import Session, text
from database import engine

print("Connecting to DB to wipe clients and leads...")
try:
    with Session(engine) as session:
        # Check actual table names in metadata
        from database import ClientProfile, Lead
        client_table = ClientProfile.__tablename__
        lead_table = Lead.__tablename__
        
        session.exec(text(f"TRUNCATE TABLE {client_table}, {lead_table} RESTART IDENTITY CASCADE;"))
        session.commit()
        print(f"Successfully wiped {client_table} and {lead_table}, and reset IDs.")
except Exception as e:
    print(f"Error: {e}")
