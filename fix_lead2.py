import asyncio
from modules.llm_engine import deep_investigate_company
from modules.scraper import research_and_map_company
from sqlmodel import Session, select
from database import ClientResearch, Lead, engine
import json

url = "https://scmbpos.com"
company_name = "SCMBPO Services"

loop = asyncio.new_event_loop()
scrape_result = loop.run_until_complete(research_and_map_company(url))
loop.close()
raw_text = scrape_result.get("raw_text", "") or ""

print("Running deep investigate...")
data = deep_investigate_company(company_name=company_name, website=url, scraped_text=raw_text)

print("Saving to DB...")
with Session(engine) as sess:
    cr = sess.exec(select(ClientResearch).where(ClientResearch.lead_id == 2)).first()
    cr.email_agent_data = json.dumps(data)
    cr.company_overview = data.get("company_overview", "") or data.get("executive_verdict", "")
    cr.key_decision_makers = json.dumps(data.get("contacts", []))
    icps = data.get("ideal_customer_profiles", [])
    cr.pain_points = json.dumps(icps) if icps else None
    cr.business_goals = json.dumps(data.get("gtm_recommendations", {})) if data.get("gtm_recommendations") else None
    cr.competitors = json.dumps(data.get("competitive_landscape", {})) if data.get("competitive_landscape") else None
    sess.add(cr)
    sess.commit()
    
print("Done!")
