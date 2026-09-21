import asyncio
from sqlmodel import Session, select
from database import ClientResearch, Lead, engine
import json
from modules.llm_engine import deep_investigate_company
from modules.scraper import research_and_map_company

print("Looking for leads without email_agent_data...")
with Session(engine) as sess:
    leads = sess.exec(select(Lead)).all()
    for lead in leads:
        cr = sess.exec(select(ClientResearch).where(ClientResearch.lead_id == lead.id)).first()
        if not cr or not cr.email_agent_data or 'full_markdown_report' not in cr.email_agent_data:
            print(f"Processing Lead {lead.id}: {lead.company_name}")
            url = lead.website or f"https://www.{lead.company_name.lower().replace(' ', '')}.com"
            
            loop = asyncio.new_event_loop()
            scrape_result = loop.run_until_complete(research_and_map_company(url))
            loop.close()
            raw_text = scrape_result.get("raw_text", "") or ""
            
            data = deep_investigate_company(company_name=lead.company_name, website=url, scraped_text=raw_text)
            
            if not cr:
                cr = ClientResearch(lead_id=lead.id)
                sess.add(cr)
            
            cr.email_agent_data = json.dumps(data)
            cr.company_overview = data.get("company_overview", "")
            cr.key_decision_makers = json.dumps(data.get("contacts", []))
            sess.commit()
            print(f"✅ Lead {lead.id} updated successfully!")

print("All missing leads updated!")
