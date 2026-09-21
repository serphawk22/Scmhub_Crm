import re
import os

with open('frontend/src/app/admin/clients/[id]/components/ClientHeader.tsx', 'r') as f:
    content = f.read()

# Replace interface ClientHeaderProps with LeadHeaderProps
content = content.replace("ClientHeaderProps", "LeadHeaderProps")
content = content.replace("client: any", "lead: any")
content = content.replace("ClientHeader(", "LeadHeader(")
content = content.replace("client,", "lead,")
content = content.replace("client?", "lead?")

# Replace property mapping
content = content.replace("lead?.assignedEmployeeId", "lead?.owner_id")
content = content.replace("lead?.contact_person", "null") # leads don't usually have contact_person field, wait, they have none
content = content.replace("lead?.websiteUrl", "lead?.website")
content = content.replace("lead?.companyName", "lead?.company_name")
content = content.replace("Back to Clients", "Back to Leads")

if not os.path.exists('frontend/src/app/leads/[id]/components'):
    os.makedirs('frontend/src/app/leads/[id]/components')

with open('frontend/src/app/leads/[id]/components/LeadHeader.tsx', 'w') as f:
    f.write(content)

print("LeadHeader.tsx created.")
