from sqlmodel import Session, select
from database import ClientResearch, Lead, engine
with Session(engine) as sess:
    leads = sess.exec(select(Lead)).all()
    print("Leads in DB:")
    for lead in leads:
        cr = sess.exec(select(ClientResearch).where(ClientResearch.lead_id == lead.id)).first()
        status = "Has Data" if cr and cr.email_agent_data else "No Data"
        if cr and cr.email_agent_data:
            has_markdown = "full_markdown_report" in cr.email_agent_data
            status += f" (Markdown: {has_markdown})"
        print(f"[{lead.id}] {lead.company_name} - {status}")
