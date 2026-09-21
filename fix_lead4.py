import asyncio
from modules.llm_engine import deep_investigate_company
from modules.scraper import research_and_map_company
from sqlmodel import Session, select
from database import ClientResearch, engine
import json

url = "https://watco.in"
company_name = "Watco India Pvt. Ltd."

loop = asyncio.new_event_loop()
scrape_result = loop.run_until_complete(research_and_map_company(url))
loop.close()
raw_text = scrape_result.get("raw_text", "") or ""

print("Running deep investigate...")
data = deep_investigate_company(company_name=company_name, website=url, scraped_text=raw_text)

print("Saving to DB...")
with Session(engine) as sess:
    cr = sess.exec(select(ClientResearch).where(ClientResearch.lead_id == 4)).first()
    if not cr:
        cr = ClientResearch(lead_id=4)
        sess.add(cr)
    
    cr.email_agent_data = json.dumps(data)
    cr.company_overview = data.get("company_overview", "")
    cr.key_decision_makers = json.dumps(data.get("contacts", []))
    sess.commit()
    
print("Done!")
