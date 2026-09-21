import re

with open('frontend/src/app/admin/clients/[id]/components/AiCopilotPanel.tsx', 'r') as f:
    content = f.read()

content = content.replace("AiCopilotPanel", "AiCopilotPanelLead")
content = content.replace("clientId", "leadId")
content = content.replace("`/clients/${leadId}/ai-insights`", "`/leads/${leadId}/ai-insights`")

with open('frontend/src/app/leads/[id]/components/AiCopilotPanelLead.tsx', 'w') as f:
    f.write(content)

print("AiCopilotPanelLead.tsx created.")
