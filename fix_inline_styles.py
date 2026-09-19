import re

fp = 'frontend/src/app/admin/clients/[id]/page.tsx'

with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

original = content

# Generic regex replacements for hardcoded inline colors
replacements = [
    (r"background: '#ffffff'", "background: 'var(--bg-card)'"),
    (r"background: '#f8fafc'", "background: 'var(--bg-secondary)'"),
    (r"background: '#fff'",    "background: 'var(--bg-card)'"),
    (r"background: '#f1f5f9'", "background: 'var(--bg-hover)'"),
    (r"background: '#eef2ff'", "background: 'var(--accent-subtle)'"),
    (r"color: '#1e293b'",      "color: 'var(--text-primary)'"),
    (r"color: '#0f172a'",      "color: 'var(--text-primary)'"),
    (r"color: '#64748b'",      "color: 'var(--text-secondary)'"),
    (r"color: '#94a3b8'",      "color: 'var(--text-muted)'"),
    (r"color: '#4f46e5'",      "color: 'var(--accent)'"),
    (r"borderColor: '#e2e8f0'","borderColor: 'var(--border)'"),
    (r"border: '1px solid #e2e8f0'",  "border: '1px solid var(--border)'"),
    (r"border: '1\.5px solid #e2e8f0'","border: '1.5px solid var(--border)'"),
    (r"borderTop: '1px solid #f1f5f9'","borderTop: '1px solid var(--border)'"),
    (r"borderTop: '1px solid #e2e8f0'","borderTop: '1px solid var(--border)'"),
    (r"borderBottom: '1px solid #e2e8f0'","borderBottom: '1px solid var(--border)'"),
    (r"borderBottom: '1px solid #f1f5f9'","borderBottom: '1px solid var(--border)'"),
    (r"e\.currentTarget\.style\.background = '#f8fafc'","e.currentTarget.style.background = 'var(--bg-hover)'"),
    (r"e\.currentTarget\.style\.background = '#f1f5f9'","e.currentTarget.style.background = 'var(--bg-hover)'"),
    # hexText color usage
    (r"color: hexText",        "color: 'var(--text-primary)'"),
]

for pattern, replacement in replacements:
    new_content = re.sub(pattern, replacement, content)
    if new_content != content:
        print(f'Replaced: {pattern}')
        content = new_content

if content != original:
    with open(fp, 'w', encoding='utf-8') as f:
        f.write(content)
    print('File updated successfully')
else:
    print('No changes made')
