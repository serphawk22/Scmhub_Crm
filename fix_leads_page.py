import re

with open('frontend/src/app/leads/[id]/page.tsx', 'r') as f:
    content = f.read()

# Fix stragglers
content = content.replace("!client", "!lead")
content = content.replace("/clients/${id}", "/leads/${id}")
content = content.replace("client_id=", "lead_id=")
content = content.replace("client_id:", "lead_id:")
content = content.replace("clientRes", "leadRes")
content = content.replace("client_tabs.", "lead_tabs.")
content = content.replace("client={client}", "lead={lead}")

with open('frontend/src/app/leads/[id]/page.tsx', 'w') as f:
    f.write(content)

print("Fixed leads/[id]/page.tsx")
