import re

with open("main.py", "r") as f:
    content = f.read()

# 1. Update send_manual logic
old_send_manual = """@app.post("/send-manual")
def send_manual(body: SendManualRequest, session: Session = Depends(get_session)):
    \"\"\"
    Records a manually sent email, creates a client (User + ClientProfile) if not existing,
    and logs an activity entry.
    \"\"\"
    from datetime import datetime
    import hashlib

    # Step 1: Find or create User by email
    user = session.exec(select(User).where(User.email == body.to_email)).first()
    if not user:
        hashed_pw = hashlib.sha256("password123".encode()).hexdigest()
        user = User(
            email=body.to_email,
            password=hashed_pw,
            name=body.contact_name or body.company_name or "New Client",
            role="Client",
        )
        session.add(user)
        session.commit()
        session.refresh(user)

    # Determine action string
    if body.action_type == "Gmail":
        action_str = "Outreach via Gmail"
    elif body.action_type == "WhatsApp":
        action_str = "Outreach via WhatsApp"
    elif body.action_type == "System Auto":
        action_str = "Automated email sent"
    else:
        action_str = "Manual outreach email sent"

    # Step 2: Find or create ClientProfile
    client_profile = session.exec(
        select(ClientProfile).where(ClientProfile.userId == user.id)
    ).first()
    if not client_profile:
        client_profile = ClientProfile(
            userId=user.id,
            companyName=body.company_name,
            websiteUrl=body.website_url or None,
            phone=body.phone_number or None,
            status="Active",
            recommended_services=body.recommended_services,
            lastActivity=action_str,
            lastActivityDate=datetime.utcnow().isoformat(),
        )
        session.add(client_profile)
        session.commit()
        session.refresh(client_profile)
    else:
        # Update existing profile
        client_profile.lastActivity = action_str
        client_profile.lastActivityDate = datetime.utcnow().isoformat()
        if body.recommended_services:
            client_profile.recommended_services = body.recommended_services
        if body.phone_number:
            client_profile.phone = body.phone_number
        session.add(client_profile)
        session.commit()
        session.refresh(client_profile)

    # Step 2.5: Find or create ClientResearch to save email_agent_data
    if body.email_agent_data:
        client_research = session.exec(
            select(ClientResearch).where(ClientResearch.client_id == client_profile.id)
        ).first()
        if not client_research:
            client_research = ClientResearch(
                client_id=client_profile.id,
                email_agent_data=body.email_agent_data
            )
            session.add(client_research)
        else:
            client_research.email_agent_data = body.email_agent_data
            session.add(client_research)
        session.commit()

    # Step 2.5: Normalize and validate recipient email
    to_email = (body.to_email or "").strip()
    if not to_email:
        raise HTTPException(status_code=400, detail="Recipient email is required")

    # Step 3: Save SentEmail record
    sent_email = SentEmail(
        client_id=client_profile.id,
        to_email=to_email,
        subject=body.subject,
        english_body=body.english_body,
        spanish_body=body.spanish_body or "",
        recommended_services=body.recommended_services or "",
        manual=body.manual if body.manual is not None else True,
        sent_at=datetime.utcnow(),
    )
    session.add(sent_email)
    session.commit()
    session.refresh(sent_email)"""

new_send_manual = """@app.post("/send-manual")
def send_manual(body: SendManualRequest, session: Session = Depends(get_session)):
    \"\"\"
    Records a manually sent email, creates a Lead if not existing,
    and logs an activity entry.
    \"\"\"
    from datetime import datetime

    # Determine action string
    if body.action_type == "Gmail":
        action_str = "Outreach via Gmail"
    elif body.action_type == "WhatsApp":
        action_str = "Outreach via WhatsApp"
    elif body.action_type == "System Auto":
        action_str = "Automated email sent"
    else:
        action_str = "Manual outreach email sent"

    # Step 1: Find or create Lead by email
    to_email = (body.to_email or "").strip()
    if not to_email:
        raise HTTPException(status_code=400, detail="Recipient email is required")

    lead = session.exec(
        select(Lead).where(Lead.email == to_email)
    ).first()
    
    if not lead:
        lead = Lead(
            company_name=body.company_name or "Unknown Company",
            website=body.website_url or None,
            email=to_email,
            phone=body.phone_number or None,
            source="Email Agent",
            status="Contacted"
        )
        session.add(lead)
        session.commit()
        session.refresh(lead)
    else:
        lead.status = "Contacted"
        if body.phone_number:
            lead.phone = body.phone_number
        if body.website_url:
            lead.website = body.website_url
        session.add(lead)
        session.commit()
        session.refresh(lead)

    # Add Contact if there's contact info
    if body.contact_name:
        contact = session.exec(select(Contact).where(Contact.email == to_email)).first()
        if not contact:
            contact = Contact(
                first_name=body.contact_name,
                full_name=body.contact_name,
                email=to_email,
                lead_id=lead.id,
                designation=body.contact_role
            )
            session.add(contact)
            session.commit()

    # Step 2.5: Find or create ClientResearch to save email_agent_data
    if body.email_agent_data:
        client_research = session.exec(
            select(ClientResearch).where(ClientResearch.lead_id == lead.id)
        ).first()
        if not client_research:
            client_research = ClientResearch(
                lead_id=lead.id,
                email_agent_data=body.email_agent_data
            )
            session.add(client_research)
        else:
            client_research.email_agent_data = body.email_agent_data
            session.add(client_research)
        session.commit()

    # Step 3: Save SentEmail record
    sent_email = SentEmail(
        lead_id=lead.id,
        to_email=to_email,
        subject=body.subject,
        english_body=body.english_body,
        spanish_body=body.spanish_body or "",
        recommended_services=body.recommended_services or "",
        manual=body.manual if body.manual is not None else True,
        sent_at=datetime.utcnow(),
    )
    session.add(sent_email)
    session.commit()
    session.refresh(sent_email)"""

content = content.replace(old_send_manual, new_send_manual)


# Also update the activity log creation in send_manual
old_activity_log = """        activity = ActivityLog(
            client_id=client_profile.id,
            action=log_action,
            details=f"Subject: {body.subject} | Services: {body.recommended_services or 'N/A'}",
            timestamp=datetime.utcnow(),
        )"""

new_activity_log = """        activity = ActivityLog(
            lead_id=lead.id,
            action=log_action,
            details=f"Subject: {body.subject} | Services: {body.recommended_services or 'N/A'}",
        )"""

# using simple replace for the activity log inside send_manual
content = content.replace(
"""        activity = ActivityLog(
            client_id=client_profile.id,
            action=log_action,
            details=f"Subject: {body.subject} | Services: {body.recommended_services or 'N/A'}",
            timestamp=datetime.utcnow(),
        )""", 
"""        activity = ActivityLog(
            lead_id=lead.id,
            action=log_action,
            details=f"Subject: {body.subject} | Services: {body.recommended_services or 'N/A'}",
        )"""
)

# Replace the success return statement
content = content.replace(
"""        "client_id": client_profile.id,
        "user_id": user.id,
        "sent_email_id": sent_email.id,
        "message": f"Client created and email recorded for {body.to_email}",""",
"""        "lead_id": lead.id,
        "sent_email_id": sent_email.id,
        "message": f"Lead created and email recorded for {body.to_email}","""
)

with open("main.py", "w") as f:
    f.write(content)
print("Updated send_manual")
