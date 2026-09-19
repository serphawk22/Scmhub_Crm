import re

filepath = 'main.py'
with open(filepath, 'r') as f:
    content = f.read()

# I need to insert code to save the lead and research right before returning `data`.
# In main.py, the return statement is:
#         return data
#     except Exception as e:

insertion = """
        # --- AUTO-CREATE LEAD AND SAVE RESEARCH ---
        import json
        from database import Lead, ClientResearch
        from sqlmodel import select
        
        # See if a lead already exists for this domain
        existing_lead = None
        if url:
            domain = url.replace("https://", "").replace("http://", "").replace("www.", "").split('/')[0]
            if domain:
                existing_lead = session.exec(select(Lead).where(Lead.website.like(f"%{domain}%"))).first()
                
        if not existing_lead and email:
            existing_lead = session.exec(select(Lead).where(Lead.email == email)).first()

        lead_id = None
        if not existing_lead:
            # Create a new lead
            new_lead = Lead(
                company_name=data["company_info"].get("company_name", body.company_name) or "Unknown Company",
                website=url,
                email=email if email else None,
                phone=phone if phone else None,
                source="Email Agent",
                status="Generated"
            )
            session.add(new_lead)
            session.commit()
            session.refresh(new_lead)
            lead_id = new_lead.id
        else:
            lead_id = existing_lead.id
            
        # Upsert ClientResearch for this lead
        if lead_id:
            cr = session.exec(select(ClientResearch).where(ClientResearch.lead_id == lead_id)).first()
            if not cr:
                cr = ClientResearch(lead_id=lead_id)
            cr.email_agent_data = json.dumps(data)
            session.add(cr)
            session.commit()
        # ------------------------------------------

        return data
"""

content = content.replace("        return data\n        \n    except Exception as e:", insertion + "        \n    except Exception as e:")

with open(filepath, 'w') as f:
    f.write(content)

print("Updated smart-research endpoint.")
