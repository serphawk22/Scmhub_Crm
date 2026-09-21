import csv
import argparse
from sqlmodel import Session, select
from database import engine, Lead, ClientProfile, User
import uuid

def import_contacts(csv_file: str, mode: str = "lead"):
    """
    Imports contacts from a CSV file (Emmanuel's list) into the CRM.
    The CSV should have at minimum: Company, Email, Phone, Website, Notes
    """
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        with Session(engine) as session:
            count = 0
            for row in reader:
                company = row.get("Company", "").strip()
                email = row.get("Email", "").strip()
                phone = row.get("Phone", "").strip()
                website = row.get("Website", "").strip()
                notes = row.get("Notes", "").strip()
                
                if not company and not email:
                    continue
                
                if mode == "lead":
                    # Check if exists
                    exists = session.exec(select(Lead).where(Lead.email == email)).first() if email else None
                    if not exists:
                        lead = Lead(
                            company_name=company or "Unknown",
                            email=email,
                            phone=phone,
                            website=website,
                            notes=notes,
                            source="Emmanuel's List",
                            status="New",
                            is_converted=False
                        )
                        session.add(lead)
                        count += 1
                elif mode == "client":
                    # Check if user exists
                    user = session.exec(select(User).where(User.email == email)).first() if email else None
                    if not user and email:
                        user = User(
                            email=email,
                            name=company,
                            role="Client",
                            is_active=True,
                            password_hash="temp_hash_change_me"
                        )
                        session.add(user)
                        session.commit()
                        session.refresh(user)
                    
                    client = ClientProfile(
                        userId=user.id if user else None,
                        companyName=company,
                        phone=phone,
                        websiteUrl=website,
                        tagline=notes,
                        status="Active",
                        uuid=str(uuid.uuid4())
                    )
                    session.add(client)
                    count += 1

            session.commit()
            print(f"Successfully imported {count} {mode}s from {csv_file}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import Emmanuel's contact list.")
    parser.add_argument("csv_file", help="Path to the CSV file")
    parser.add_argument("--mode", choices=["lead", "client"], default="lead", help="Import as leads or clients")
    args = parser.parse_args()
    
    import_contacts(args.csv_file, args.mode)
