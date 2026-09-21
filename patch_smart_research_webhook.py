import sys

# Patch main.py
with open("main.py", "r", encoding="utf-8") as f:
    content = f.read()

start_marker = 'async def smart_research(body: SmartResearchRequest):'
end_marker = '    }\n\n# --- Send Manual'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker, start_idx)

if start_idx == -1 or end_idx == -1:
    print("Could not find markers in main.py")
    sys.exit(1)

new_func = '''async def smart_research(body: SmartResearchRequest):
    """
    Takes a company name (and optional URL) and forwards the request to the N8N webhook.
    Returns the exact JSON response from N8N.
    """
    import os
    import httpx

    webhook_url = os.getenv("N8N_EMAIL_WEBHOOK_URL", "http://localhost:5678/webhook-test/your-webhook-id")

    payload = {
        "event": "research",
        "company_name": body.company_name,
        "company_url": body.company_url,
        "client_id": body.client_id,
        "owner_name": body.owner_name
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(webhook_url, json=payload, timeout=60.0)
            response.raise_for_status()
            return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Research via webhook failed: {e}")
'''

new_content = content[:start_idx] + new_func + content[end_idx:]

with open("main.py", "w", encoding="utf-8") as f:
    f.write(new_content)

print("Patched main.py successfully.")

# Patch .env
with open(".env", "a", encoding="utf-8") as f:
    f.write("\n# N8N Webhook URL\nN8N_EMAIL_WEBHOOK_URL=http://localhost:5678/webhook-test/your-webhook-id\n")

print("Patched .env successfully.")
