import re

def main():
    with open('/Users/apple/Desktop/emailagent/serphawk_crm_seo/main.py', 'r') as f:
        content = f.read()

    # Append endpoints at the end of the file
    endpoints = """
@app.get("/leads/{lead_id}/research")
def get_lead_research(lead_id: int, session: Session = Depends(get_session)):
    research = session.exec(select(ClientResearch).where(ClientResearch.lead_id == lead_id)).first()
    if not research:
        raise HTTPException(status_code=404, detail="Research not found for this lead")
    return research

@app.get("/clients/{client_id}/research")
def get_client_research(client_id: int, session: Session = Depends(get_session)):
    research = session.exec(select(ClientResearch).where(ClientResearch.client_id == client_id)).first()
    if not research:
        raise HTTPException(status_code=404, detail="Research not found for this client")
    return research
"""

    if "@app.get(\"/leads/{lead_id}/research\")" not in content:
        with open('/Users/apple/Desktop/emailagent/serphawk_crm_seo/main.py', 'a') as f:
            f.write(endpoints)
        print("Success adding backend endpoints!")
    else:
        print("Endpoints already exist.")

if __name__ == "__main__":
    main()
