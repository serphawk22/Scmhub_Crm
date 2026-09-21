import os, subprocess, re

roadmap_path = r'C:\Users\Dell\.gemini\antigravity\brain\9561ac0c-bdf9-44c5-86e5-04e6fdeacfe3\engineering_roadmap.md'
with open(roadmap_path, 'r', encoding='utf-8') as f:
    content = f.read()

sections = content.split('### ')[1:]
for sec in sections:
    lines = sec.strip().split('\n')
    header = lines[0]
    match = re.search(r'Branch:\s*`([^`]+)`', header)
    if not match: continue
    branch = match.group(1)
    
    ticket_content = '# ' + header + '\n\n' + '\n'.join(lines[1:]).strip()
    
    print(f'Processing {branch}...')
    subprocess.run(['git', 'checkout', branch], check=True)
    
    with open('TICKET.md', 'w', encoding='utf-8') as tf:
        tf.write(ticket_content)
        
    subprocess.run(['git', 'add', 'TICKET.md'], check=True)
    # Don't fail if nothing to commit
    subprocess.run(['git', 'commit', '-m', f'docs: add TICKET.md for {branch}'], check=False)
    subprocess.run(['git', 'push', 'origin', branch], check=True)

subprocess.run(['git', 'checkout', 'main'])
print('Done!')
