import re

result_path = 'frontend/src/components/email-agent/ResultCard.tsx'
with open(result_path, 'r') as f:
    content = f.read()

content = content.replace('function CopyButton', 'export function CopyButton')

with open(result_path, 'w') as f:
    f.write(content)

page_path = 'frontend/src/app/email-agent/page.tsx'
with open(page_path, 'r') as f:
    page_content = f.read()

# Update import in page.tsx
page_content = page_content.replace(
    'import { ResultCard, ResearchResultData, SendEmailResult } from "@/components/email-agent/ResultCard";',
    'import { ResultCard, ResearchResultData, SendEmailResult, CopyButton } from "@/components/email-agent/ResultCard";'
)

with open(page_path, 'w') as f:
    f.write(page_content)

print("Exported and imported CopyButton")
