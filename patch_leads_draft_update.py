import re

with open('main.py', 'r') as f:
    content = f.read()

# We need to insert the code to update research.email_agent_data right after session.add(draft) in generate_lead_outbound_draft
target = """        session.add(draft)
        session.commit()
        
        return {"ok": True, "draft": data}"""

replacement = """        session.add(draft)
        
        # Save to research so the UI can display it in OpportunitiesTab
        if not research:
            research = ClientResearch(lead_id=lead_id, tenant_id=current_tenant_id.get())
            session.add(research)
        
        ea_payload = {}
        if research.email_agent_data:
            try:
                ea_payload = _json.loads(research.email_agent_data)
            except:
                pass
                
        ea_payload["draft"] = data
        ea_payload["email_hook"] = data.get("whatsapp_draft", "Custom outreach generated from latest interactions.")
        
        research.email_agent_data = _json.dumps(ea_payload)
        
        session.commit()
        
        return {"ok": True, "draft": data}"""

if "ea_payload[\"email_hook\"]" not in content.split("def generate_lead_outbound_draft")[1]:
    new_content = content.replace(target, replacement)
    with open('main.py', 'w') as f:
        f.write(new_content)
    print("Fixed leads draft saving!")
else:
    print("Already fixed!")
