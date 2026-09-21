import os
from sqlmodel import Session, select
from database import engine, User, ClientProfile, Lead, CRMQuote, Proposal, Invoice, Meeting, Task, EmailCampaign, EmailTemplate, EmailAccount, SupportTicket

def clean():
    with Session(engine) as session:
        # Keep users who are admin or salesmanager maybe? Or keep just admin@example.com
        admin_user = session.exec(select(User).where(User.email == "admin@example.com")).first()
        admin_id = admin_user.id if admin_user else None
        
        # Delete everything else
        tables = [
            SupportTicket, EmailCampaign, EmailTemplate, EmailAccount,
            Task, Meeting, Invoice, Proposal, CRMQuote,
            ClientProfile, Lead
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
