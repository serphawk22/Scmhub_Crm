import os

endpoints = """
# ─────────────────────────────────────────────────────────────────────────────
# Contacts (Multiple / Sub-contacts)
# ─────────────────────────────────────────────────────────────────────────────
from pydantic import BaseModel

class ContactCreate(BaseModel):
    first_name: str
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    job_title: Optional[str] = None
    department: Optional[str] = None
    notes: Optional[str] = None

class ContactLinkRequest(BaseModel):
    contact_id: int
    role_at_company: Optional[str] = None
    is_primary: bool = False

@app.get("/contacts")
def list_contacts(session: Session = Depends(get_session)):
    return session.exec(select(Contact)).all()

@app.post("/contacts")
def create_contact(body: ContactCreate, session: Session = Depends(get_session)):
    c = Contact(**body.dict())
    session.add(c)
    session.commit()
    session.refresh(c)
    return c

@app.post("/clients/{client_id}/contacts")
def link_contact_to_client(client_id: int, body: ContactLinkRequest, session: Session = Depends(get_session)):
    link = ContactClientLink(
        client_id=client_id,
        contact_id=body.contact_id,
        role_at_company=body.role_at_company,
        is_primary=body.is_primary
    )
    session.add(link)
    session.commit()
    return {"status": "success"}

@app.post("/leads/{lead_id}/contacts")
def link_contact_to_lead(lead_id: int, body: ContactLinkRequest, session: Session = Depends(get_session)):
    link = ContactLeadLink(
        lead_id=lead_id,
        contact_id=body.contact_id,
        role_at_company=body.role_at_company,
        is_primary=body.is_primary
    )
    session.add(link)
    session.commit()
    return {"status": "success"}

@app.get("/clients/{client_id}/contacts")
def get_client_contacts(client_id: int, session: Session = Depends(get_session)):
    links = session.exec(select(ContactClientLink).where(ContactClientLink.client_id == client_id)).all()
    results = []
    for link in links:
        c = session.get(Contact, link.contact_id)
        if c:
            results.append({"link_id": link.id, "contact": c, "role": link.role_at_company, "is_primary": link.is_primary})
    return results

@app.get("/leads/{lead_id}/contacts")
def get_lead_contacts(lead_id: int, session: Session = Depends(get_session)):
    links = session.exec(select(ContactLeadLink).where(ContactLeadLink.lead_id == lead_id)).all()
    results = []
    for link in links:
        c = session.get(Contact, link.contact_id)
        if c:
            results.append({"link_id": link.id, "contact": c, "role": link.role_at_company, "is_primary": link.is_primary})
    return results
"""

with open("main.py", "a") as f:
    f.write(endpoints)

print("Added Contacts API to main.py")
