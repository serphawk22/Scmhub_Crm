from sqlmodel import Session, select
from database import ClientResearch, engine
import json

with Session(engine) as s:
    cr = s.exec(select(ClientResearch).where(ClientResearch.lead_id==2)).first()
    if cr and cr.email_agent_data:
        try:
            data = json.loads(cr.email_agent_data)
            print("KEYS:", list(data.keys()))
        except Exception as e:
            print("ERROR parsing JSON:", e)
            print("RAW:", cr.email_agent_data[:100])
    else:
        print('No CR or email_agent_data')
