import re

with open('main.py', 'r') as f:
    content = f.read()

# 1. Add /leads/{lead_id}/auto-research
if '@app.post("/leads/{lead_id}/auto-research")' not in content:
    auto_research_client = re.search(r'(@app\.post\("/clients/\{client_id\}/auto-research"\).*?def auto_research_client\(.*?return \{"status": "success", "research": research\}\n)', content, re.DOTALL)
    if auto_research_client:
        lead_auto_research = auto_research_client.group(1)
        lead_auto_research = lead_auto_research.replace('/clients/{client_id}', '/leads/{lead_id}')
        lead_auto_research = lead_auto_research.replace('auto_research_client', 'auto_research_lead')
        lead_auto_research = lead_auto_research.replace('client_id: int', 'lead_id: int')
        lead_auto_research = lead_auto_research.replace('ClientProfile', 'Lead')
        lead_auto_research = lead_auto_research.replace('client_id == client_id', 'id == lead_id')
        lead_auto_research = lead_auto_research.replace('client.websiteUrl', 'client.website')
        
        # fix variable name issues inside
        # we need to be careful with "client = session.exec". Let's just do text replace
        lead_auto_research = lead_auto_research.replace('client = session.exec', 'lead_obj = session.exec')
        lead_auto_research = lead_auto_research.replace('if not client:', 'if not lead_obj:')
        lead_auto_research = lead_auto_research.replace('client.websiteUrl', 'lead_obj.website')
        lead_auto_research = lead_auto_research.replace('client.id', 'lead_obj.id')
        
        content = content.replace(auto_research_client.group(1), auto_research_client.group(1) + "\n" + lead_auto_research)


# 2. Add /leads/{lead_id}/ai-insights
if '@app.post("/leads/{lead_id}/ai-insights")' not in content:
    ai_insights_client = re.search(r'(@app\.post\("/clients/\{client_id\}/ai-insights"\).*?def generate_client_insights\(.*?return \{"status": "success", "insights": insights_data\}\n)', content, re.DOTALL)
    if ai_insights_client:
        lead_ai_insights = ai_insights_client.group(1)
        lead_ai_insights = lead_ai_insights.replace('/clients/{client_id}', '/leads/{lead_id}')
        lead_ai_insights = lead_ai_insights.replace('generate_client_insights', 'generate_lead_insights')
        lead_ai_insights = lead_ai_insights.replace('client_id: int', 'lead_id: int')
        lead_ai_insights = lead_ai_insights.replace('ClientProfile', 'Lead')
        lead_ai_insights = lead_ai_insights.replace('client_id == client_id', 'id == lead_id')
        
        lead_ai_insights = lead_ai_insights.replace('client = session.exec', 'lead_obj = session.exec')
        lead_ai_insights = lead_ai_insights.replace('if not client:', 'if not lead_obj:')
        lead_ai_insights = lead_ai_insights.replace('client.id', 'lead_obj.id')
        lead_ai_insights = lead_ai_insights.replace('client.companyName', 'lead_obj.company_name')
        
        content = content.replace(ai_insights_client.group(1), ai_insights_client.group(1) + "\n" + lead_ai_insights)


# 3. Add /leads/{lead_id}/extract-services
if '@app.post("/leads/{lead_id}/extract-services")' not in content:
    extract_services = re.search(r'(@app\.post\("/clients/\{client_id\}/extract-services"\).*?def extract_services_client\(.*?return \{"status": "success", "services": services\}\n)', content, re.DOTALL)
    if extract_services:
        lead_extract = extract_services.group(1)
        lead_extract = lead_extract.replace('/clients/{client_id}', '/leads/{lead_id}')
        lead_extract = lead_extract.replace('extract_services_client', 'extract_services_lead')
        lead_extract = lead_extract.replace('client_id: int', 'lead_id: int')
        lead_extract = lead_extract.replace('ClientProfile', 'Lead')
        lead_extract = lead_extract.replace('client_id == client_id', 'id == lead_id')
        
        lead_extract = lead_extract.replace('client = session.exec', 'lead_obj = session.exec')
        lead_extract = lead_extract.replace('if not client:', 'if not lead_obj:')
        lead_extract = lead_extract.replace('client.id', 'lead_obj.id')
        lead_extract = lead_extract.replace('client.websiteUrl', 'lead_obj.website')
        lead_extract = lead_extract.replace('client.services_offered =', 'lead_obj.services_offered =')
        lead_extract = lead_extract.replace('session.add(client)', 'session.add(lead_obj)')
        
        content = content.replace(extract_services.group(1), extract_services.group(1) + "\n" + lead_extract)


with open('main.py', 'w') as f:
    f.write(content)

print("Patched main.py with Lead endpoints.")
