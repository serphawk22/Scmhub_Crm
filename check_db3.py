from sqlmodel import Session, select
from database import ClientResearch, engine
import json

with Session(engine) as s:
    cr = s.exec(select(ClientResearch).where(ClientResearch.lead_id==2)).first()
    if cr and cr.email_agent_data:
        data = json.loads(cr.email_agent_data)
        if "company_info" in data:
            print(list(data["company_info"].keys()))
