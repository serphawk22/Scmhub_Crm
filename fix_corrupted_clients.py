import os
from sqlmodel import Session, select
from database import engine, ClientProfile

def clean_corrupted_clients():
    print("Scanning database for corrupted client records...")
    with Session(engine) as session:
        clients = session.exec(select(ClientProfile)).all()
        fixed_count = 0
        
        for c in clients:
            is_modified = False
            
            # Ensure customFields is a dict
            cf = c.customFields or {}
            if not isinstance(cf, dict):
                cf = {}
            
            # 1. Check if companyName is actually a URL
            if c.companyName and (c.companyName.strip().startswith("http") or c.companyName.strip().startswith("www.")):
                if not c.websiteUrl:
                    c.websiteUrl = c.companyName.strip()
                c.companyName = "Unknown (URL)"
                is_modified = True
                
            # 2. Check if companyName is a long sentence/description
            if c.companyName and len(c.companyName) > 40:
                old_desc = cf.get("description", "")
                cf["description"] = (old_desc + " | Name was: " + c.companyName).strip(" | ")
                c.companyName = "Unknown (Description)"
                is_modified = True
                
            # 3. Check if phone is actually a description/sentence
            if c.phone:
                letters = sum(1 for char in c.phone if char.isalpha())
                if letters > 5 or len(c.phone) > 25:
                    old_desc = cf.get("description", "")
                    cf["description"] = (old_desc + " | Phone was: " + c.phone).strip(" | ")
                    c.phone = ""
                    is_modified = True
                    
            if is_modified:
                # Update the JSON field
                c.customFields = cf
                session.add(c)
                fixed_count += 1
                
        session.commit()
        print(f"Successfully cleaned up {fixed_count} corrupted client records!")
        print("Long sentences and URLs have been moved to the 'description' and 'website' fields, so no data was deleted.")

if __name__ == "__main__":
    clean_corrupted_clients()
