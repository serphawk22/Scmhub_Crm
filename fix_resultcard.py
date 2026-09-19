import re

filepath = 'frontend/src/components/email-agent/ResultCard.tsx'
with open(filepath, 'r') as f:
    content = f.read()

# We need to remove:
# export default function EmailAgentPage() {
# ... down to just before export function ResultCard({
pattern = r'export default function EmailAgentPage\(\) \{.*?(?=export function ResultCard\()'
content = re.sub(pattern, '', content, flags=re.DOTALL)

with open(filepath, 'w') as f:
    f.write(content)

print("Fixed ResultCard.tsx!")
