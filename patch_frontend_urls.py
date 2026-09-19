import os
import re

files_to_patch = [
    "frontend/src/app/leads/page.tsx",
    "frontend/src/app/leads/[id]/page.tsx",
    "frontend/src/app/accounts/page.tsx",
    "frontend/src/app/contacts/page.tsx",
    "frontend/src/app/import/page.tsx"
]

import_statement = "import { API_BASE_URL } from \"@/config\";\n"

for filepath in files_to_patch:
    if os.path.exists(filepath):
        with open(filepath, "r") as f:
            content = f.read()
            
        if "API_BASE_URL" not in content:
            # add import statement after the first line (or after 'use client')
            content = content.replace('"use client";\n', '"use client";\n' + import_statement)
            
        # replace fetch calls
        content = content.replace('fetch("/api/leads"', 'fetch(`${API_BASE_URL}/leads`')
        content = content.replace('fetch(`/api/leads', 'fetch(`${API_BASE_URL}/leads')
        content = content.replace('fetch("/api/accounts"', 'fetch(`${API_BASE_URL}/accounts`')
        content = content.replace('fetch("/api/contacts"', 'fetch(`${API_BASE_URL}/contacts`')
        content = content.replace('fetch("/api/import/preview"', 'fetch(`${API_BASE_URL}/api/import/preview`')
        content = content.replace('fetch("/api/import/execute"', 'fetch(`${API_BASE_URL}/api/import/execute`')

        with open(filepath, "w") as f:
            f.write(content)
        print(f"Patched {filepath}")
    else:
        print(f"File not found: {filepath}")

