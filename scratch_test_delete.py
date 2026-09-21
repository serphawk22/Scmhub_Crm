import urllib.request
import json

try:
    req = urllib.request.Request("http://127.0.0.1:8000/sent-emails", method="GET")
    resp = urllib.request.urlopen(req)
    data = json.loads(resp.read().decode())
    emails = data.get("emails", [])
    if emails:
        first_id = emails[0]["id"]
        print(f"Found email ID: {first_id}")
        
        del_req = urllib.request.Request(f"http://127.0.0.1:8000/sent-emails/{first_id}", method="DELETE")
        del_resp = urllib.request.urlopen(del_req)
        print("Delete response:", del_resp.read().decode())
        
        req2 = urllib.request.Request("http://127.0.0.1:8000/sent-emails", method="GET")
        resp2 = urllib.request.urlopen(req2)
        data2 = json.loads(resp2.read().decode())
        emails2 = data2.get("emails", [])
        
        found = any(e["id"] == first_id for e in emails2)
        print(f"Is email still present after delete? {found}")
    else:
        print("No emails found.")
except Exception as e:
    print(f"Error: {e}")
    if hasattr(e, 'read'):
        print(e.read().decode())
