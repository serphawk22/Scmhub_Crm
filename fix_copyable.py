import re

page_path = 'frontend/src/app/email-agent/page.tsx'
result_path = 'frontend/src/components/email-agent/ResultCard.tsx'

with open(page_path, 'r') as f:
    page_content = f.read()

# Find the CopyableEmailItem function
copyable_match = re.search(r'function CopyableEmailItem.*?\}\s*\}', page_content, re.DOTALL)
if copyable_match:
    copyable_code = copyable_match.group(0)
    
    # Remove from page.tsx
    new_page = page_content.replace(copyable_code, '')
    with open(page_path, 'w') as f:
        f.write(new_page)
        
    # Add to ResultCard.tsx
    with open(result_path, 'r') as f:
        result_content = f.read()
        
    # Insert right before export function ResultCard
    new_result = result_content.replace('export function ResultCard', copyable_code + '\n\nexport function ResultCard')
    with open(result_path, 'w') as f:
        f.write(new_result)
        
    print("Fixed CopyableEmailItem!")
else:
    print("Could not find CopyableEmailItem in page.tsx")
