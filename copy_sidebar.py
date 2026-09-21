import re
import os

with open('frontend/src/app/admin/clients/[id]/components/ClientSidebarPanel.tsx', 'r') as f:
    content = f.read()

content = content.replace("ClientSidebarPanel", "LeadSidebarPanel")
content = content.replace("clientId", "leadId")
content = content.replace("`/clients/${leadId}`", "`/leads/${leadId}`")
content = content.replace("`/clients/${leadId}/research`", "`/leads/${leadId}/research`")
content = content.replace("`/clients/${leadId}/auto-research`", "`/leads/${leadId}/auto-research`")
content = content.replace("`/clients/${leadId}/extract-services`", "`/leads/${leadId}/extract-services`")
content = content.replace("client:", "lead:")
content = content.replace("client,", "lead,")
content = content.replace("client.", "lead.")
content = content.replace("companyName", "company_name")
content = content.replace("websiteUrl", "website")

with open('frontend/src/app/leads/[id]/components/LeadSidebarPanel.tsx', 'w') as f:
    f.write(content)

print("LeadSidebarPanel.tsx created.")
