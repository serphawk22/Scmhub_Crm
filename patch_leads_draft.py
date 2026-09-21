import re

with open('main.py', 'r') as f:
    content = f.read()

endpoint_code = """
@app.post("/leads/{lead_id}/generate-outbound-draft")
def generate_lead_outbound_draft(lead_id: int, session: Session = Depends(get_session)):
    check_tenant_limit(session, "emails")
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
        
    try:
        from modules.llm_engine import get_openai_client
        import json as _json
        client_ai = get_openai_client()
        
        # Get existing research
        research = session.exec(select(ClientResearch).where(ClientResearch.lead_id == lead_id)).first()
        research_context = ""
        if research:
            research_context = f\"\"\"
            Company Overview: {research.company_overview or 'N/A'}
            Pain Points: {research.pain_points or 'N/A'}
            Business Goals: {research.business_goals or 'N/A'}
            \"\"\"
            if research.email_agent_data:
                try:
                    ea_data = _json.loads(research.email_agent_data)
                    research_context += f"\\nEmail Agent Intel: {_json.dumps(ea_data.get('company_info', {}), indent=2)}"
                except:
                    pass

        # Get Notes and Conversations
        notes = session.exec(select(ClientNote).where(ClientNote.lead_id == lead_id).order_by(ClientNote.created_at.desc()).limit(10)).all()
        conversations = session.exec(select(ClientConversation).where(ClientConversation.lead_id == lead_id).order_by(ClientConversation.date.desc()).limit(5)).all()
        
        interaction_context = ""
        if notes:
            interaction_context += "Recent Notes:\\n" + "\\n".join([f"- {n.content}" for n in notes]) + "\\n"
        if conversations:
            interaction_context += "Recent Conversations:\\n" + "\\n".join([f"- {c.type} on {c.date}: {c.summary}" for c in conversations]) + "\\n"

        prompt = f\"\"\"
        You are an expert SDR (Sales Development Representative) at an agency. 
        Write a highly personalized, cold outreach email draft for the following prospect.
        Company: {lead.company_name or 'Unknown'}
        Website: {lead.website or 'Unknown'}
        {research_context}

        {interaction_context}
        If there are recent notes or conversations above, make sure the email acknowledges them appropriately as a follow-up. If none exist, write a standard cold outreach email based on the research.

        
        Return ONLY valid JSON matching this schema exactly (no markdown formatting):
        {{
            "subject": "Email subject",
            "english_body": "Email body in English",
            "spanish_body": "Email body translated to Spanish",
            "whatsapp_draft": "Short, punchy WhatsApp message (plain text, emojis allowed)"
        }}
        \"\"\"
        
        resp = client_ai.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=800,
        )
        content = resp.choices[0].message.content.strip()
        if content.startswith("```"):
            content = content.split("\\n", 1)[1].rsplit("```", 1)[0].strip()
            
        data = _json.loads(content)
        
        # Save as a draft in SentEmail
        from database import SentEmail
        to_email = lead.email or "unknown@example.com"
        
        draft = SentEmail(
            tenant_id=current_tenant_id.get(),
            lead_id=lead_id,
            to_email=to_email,
            subject=data.get("subject", "Proposal"),
            english_body=data.get("english_body", ""),
            spanish_body=data.get("spanish_body", ""),
            draft_json=_json.dumps(data),
            manual=True,
            sent_at=datetime.utcnow()
        )
        session.add(draft)
        session.commit()
        
        return {"ok": True, "draft": data}
    except Exception as e:
        print(f"Error generating lead draft: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to generate draft: {str(e)}")

"""

if "@app.post(\"/leads/{lead_id}/generate-outbound-draft\")" not in content:
    content = content.replace(
        "@app.post(\"/leads/{lead_id}/swot\")",
        endpoint_code + "\n@app.post(\"/leads/{lead_id}/swot\")"
    )
    with open('main.py', 'w') as f:
        f.write(content)
    print("Endpoint added successfully")
else:
    print("Endpoint already exists")
