import urllib.request
import json

try:
    req = urllib.request.Request("http://127.0.0.1:8000/leads", method="GET")
    resp = urllib.request.urlopen(req)
    data = json.loads(resp.read().decode())
    leads = data.get("leads", [])
    if leads:
        lead_id = leads[0]["id"]
        print(f"Found lead ID: {lead_id}")
        
        sim_req = urllib.request.Request(f"http://127.0.0.1:8000/leads/{lead_id}/simulate-call", method="POST")
        sim_resp = urllib.request.urlopen(sim_req)
        print("Simulate response:", sim_resp.read().decode())
    else:
        print("No leads found.")
except Exception as e:
    print(f"Error: {e}")
    if hasattr(e, 'read'):
        print(e.read().decode())
