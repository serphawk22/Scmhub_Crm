page_path = 'frontend/src/app/email-agent/page.tsx'
with open(page_path, 'r') as f:
    lines = f.readlines()

def find_block(start_kw):
    start = -1
    for i, l in enumerate(lines):
        if l.startswith(start_kw):
            start = i
            break
    if start == -1: return -1, -1
    
    braces = 0
    end = -1
    for i in range(start, len(lines)):
        braces += lines[i].count('{')
        braces -= lines[i].count('}')
        if braces == 0 and '{' in ''.join(lines[start:i+1]):
            end = i
            break
    # specifically for type which has = {
    if braces == 0 and end == -1:
        # maybe it ended on same line or next line with ;
        for i in range(start, len(lines)):
            if ';' in lines[i]:
                end = i
                break
    return start, end

blocks_to_remove = []

# Find types
for t in ['interface SentEmail', 'interface ChatMessage', 'type RecommendedService', 'interface ResearchResultData', 'type SendEmailResult']:
    s, e = find_block(t)
    if s != -1: blocks_to_remove.append((s, e))

s, e = find_block('function CopyableEmailItem')
if s != -1: blocks_to_remove.append((s, e))

s, e = find_block('function ResultCard(')
if s != -1: blocks_to_remove.append((s, e))

# Sort by reverse so we don't mess up indices
blocks_to_remove.sort(key=lambda x: x[0], reverse=True)

for s, e in blocks_to_remove:
    print(f"Removing lines {s} to {e}")
    del lines[s:e+1]

# Add import
import_stmt = 'import { ResultCard, ResearchResultData, SendEmailResult } from "@/components/email-agent/ResultCard";\n'
for i, l in enumerate(lines):
    if 'import PageGuide' in l:
        lines.insert(i+1, import_stmt)
        break

with open(page_path, 'w') as f:
    f.writelines(lines)

