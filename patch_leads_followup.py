import os

code_to_append = """

@app.post("/leads/{lead_id}/followup")
def add_lead_followup(lead_id: int, body: ClientFollowUpRequest, session: Session = Depends(get_session)):
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    # Add to notes
    existing_notes = lead.notes or ""
    new_note = f"Follow-up: {body.content}"
    lead.notes = existing_notes + "\\n" + new_note if existing_notes else new_note
    session.add(lead)
    
    # Log activity
    from datetime import datetime
    activity = ActivityLog(
        lead_id=lead_id,
        action="Added Follow-up Note",
        details=body.content,
        timestamp=datetime.utcnow()
    )
    session.add(activity)

    if body.email_agent_data:
        client_research = session.exec(
            select(ClientResearch).where(ClientResearch.lead_id == lead_id)
        ).first()
        if not client_research:
            client_research = ClientResearch(
                lead_id=lead_id,
                email_agent_data=body.email_agent_data
            )
            session.add(client_research)
        else:
            client_research.email_agent_data = body.email_agent_data
            session.add(client_research)

    session.commit()
    
    return {"success": True, "message": "Follow-up added to lead."}
"""

with open("main.py", "a") as f:
    f.write(code_to_append)

print("Appended /leads/{lead_id}/followup endpoint")
