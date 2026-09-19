import re

page_path = 'frontend/src/app/email-agent/page.tsx'
with open(page_path, 'r') as f:
    content = f.read()

# Remove types
content = re.sub(r'type RecommendedService = \{.*?\}\;\n\n', '', content, flags=re.DOTALL)
content = re.sub(r'interface ResearchResultData \{.*?\n\}\n\n', '', content, flags=re.DOTALL)
content = re.sub(r'type SendEmailResult = \{.*?\}\;\n\n', '', content, flags=re.DOTALL)

# Remove CopyableEmailItem
content = re.sub(r'function CopyableEmailItem.*?\}\n\n', '', content, flags=re.DOTALL)

# Remove ResultCard
content = re.sub(r'function ResultCard\(\{.*?\}\n\n(?=export default function EmailAgentPage)', '', content, flags=re.DOTALL)

# Add import
import_stmt = 'import { ResultCard, ResearchResultData, SendEmailResult } from "@/components/email-agent/ResultCard";\n'
content = content.replace('import GmailAgentLoop', import_stmt + 'import GmailAgentLoop')

with open(page_path, 'w') as f:
    f.write(content)

print("Fixed page.tsx properly")
