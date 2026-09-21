import os
from sqlmodel import Session, select
from database import engine, User, ClientProfile, Lead, Contact, Meeting, CallLog, Invoice, Proposal, CRMQuote, Deal, Task

def clean():
    with Session(engine) as session:
        tables = [
            Task, Deal, CRMQuote, Proposal, Invoice, CallLog, Meeting,
            Contact, Lead, ClientProfile
        ]
        
        for table in tables:
            items = session.exec(select(table)).all()
            for item in items:
                session.delete(item)
                
        # Optional: delete non-admin users?
        users = session.exec(select(User)).all()
        for u in users:
            if u.email != "admin@example.com" and u.role != "admin":
                session.delete(u)
                
        session.commit()
        print("Cleaned all demo data successfully.")

if __name__ == "__main__":
    clean()
