import os
from sqlmodel import Session, select, delete
from database import engine, ClientProfile, User, ClientResearch, Proposal, Invoice, Task, Remark
from sqlalchemy import text

def reset_db():
    print("WARNING: Resetting database for ClientProfiles and Client Users...")
    with Session(engine) as session:
        session.exec(delete(ClientResearch))
        
        is_postgres = engine.url.drivername.startswith("postgres")
        
        if is_postgres:
            session.exec(text("TRUNCATE TABLE client_profiles RESTART IDENTITY CASCADE"))
        else:
            session.exec(delete(ClientProfile))
            try:
                session.exec(text("UPDATE sqlite_sequence SET seq = 0 WHERE name = 'client_profiles'"))
            except Exception:
                pass
                
        session.exec(delete(User).where(User.role == 'Client'))
        session.commit()
    print("Database has been reset! Client profiles are cleared and ID sequence is reset.")

if __name__ == "__main__":
    reset_db()
