import re, os

src_dir = 'frontend/src'
exts = ('.tsx', '.ts', '.jsx')

replacements = [
    (r"background: '#ffffff'", "background: 'var(--bg-card)'"),
    (r"background: '#f8fafc'", "background: 'var(--bg-secondary)'"),
    (r"background: '#fff'",    "background: 'var(--bg-card)'"),
    (r"background: '#f1f5f9'", "background: 'var(--bg-hover)'"),
    (r"background: '#eef2ff'", "background: 'var(--accent-subtle)'"),
    (r"background: '#F8FAFC'", "background: 'var(--bg-secondary)'"),
    (r"background: '#FFFFFF'", "background: 'var(--bg-card)'"),
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
    (r"\.style\.background = '#f8fafc'",".style.background = 'var(--bg-hover)'"),
    (r"\.style\.background = '#f1f5f9'",".style.background = 'var(--bg-hover)'"),
    (r"color: hexText",        "color: 'var(--text-primary)'"),
    # minHeight with hardcoded background
    (r"background: '#f8fafc', minHeight", "background: 'var(--bg-secondary)', minHeight"),
    (r"background: '#f1f5f9', minHeight", "background: 'var(--bg-secondary)', minHeight"),
]

total_modified = 0
for root, dirs, files in os.walk(src_dir):
    dirs[:] = [d for d in dirs if d not in ('node_modules', '.next', '.git')]
    for fn in files:
        if not fn.endswith(exts):
            continue
        fp = os.path.join(root, fn)
        with open(fp, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        original = content
        for pattern, replacement in replacements:
            content = re.sub(pattern, replacement, content)
        if content != original:
            with open(fp, 'w', encoding='utf-8') as f:
                f.write(content)
            total_modified += 1
            print(f'Updated: {fp}')

print(f'\nTotal files modified: {total_modified}')
