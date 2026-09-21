import re

page_path = 'frontend/src/app/email-agent/page.tsx'
result_path = 'frontend/src/components/email-agent/ResultCard.tsx'

with open(page_path, 'r') as f:
    page_content = f.read()

# Extract CopyButton
copy_btn_match = re.search(r'(function CopyButton.*?\}\n\n)', page_content, re.DOTALL)
if copy_btn_match:
    copy_btn_code = copy_btn_match.group(1)
    page_content = page_content.replace(copy_btn_code, '')
else:
    copy_btn_code = ''

# Extract buildProspectingPoints
# We need to find the full function.
prospect_match = re.search(r'(function buildProspectingPoints.*?\}\n\n)', page_content, re.DOTALL)
if prospect_match:
    prospect_code = prospect_match.group(1)
    page_content = page_content.replace(prospect_code, '')
else:
    prospect_code = ''

# Save page.tsx
with open(page_path, 'w') as f:
    f.write(page_content)

# Inject into ResultCard.tsx
with open(result_path, 'r') as f:
    result_content = f.read()

# Put them before `function CopyableEmailItem`
insertion_point = 'function CopyableEmailItem'
result_content = result_content.replace(insertion_point, f"{copy_btn_code}{prospect_code}\n{insertion_point}")

with open(result_path, 'w') as f:
    f.write(result_content)

print("Moved CopyButton and buildProspectingPoints")
