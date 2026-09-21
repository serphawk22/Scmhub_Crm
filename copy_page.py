import re

with open('frontend/src/app/admin/clients/[id]/page.tsx', 'r') as f:
    content = f.read()

content = content.replace("ClientHeader", "LeadHeader")
content = content.replace("ClientSidebarPanel", "LeadSidebarPanel")
content = content.replace("AiCopilotPanel", "AiCopilotPanelLead")
content = content.replace("client={client}", "lead={lead}")
content = content.replace("client={client", "lead={lead")
content = content.replace("client?.companyName", "lead?.company_name")
content = content.replace("client?", "lead?")
content = content.replace("client.", "lead.")
content = content.replace("clientId", "leadId")
content = content.replace("setClient(", "setLead(")
content = content.replace("client, setClient", "lead, setLead")
content = content.replace("Client ", "Lead ")
content = content.replace("const client = ", "const lead = ")
content = content.replace("`/clients/${leadId}`", "`/leads/${leadId}`")
content = content.replace("refresh-client-data", "refresh-lead-data")
content = content.replace("AdminClientDetailPage", "LeadDetailsPage")

with open('frontend/src/app/leads/[id]/page.tsx', 'w') as f:
    f.write(content)

print("leads/[id]/page.tsx rewritten.")
