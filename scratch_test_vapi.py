import urllib.request
import json

payload = {
    "entity_type": "lead",
    "entity_id": 1,
    "entity_name": "Test Lead",
    "phone_number": "+1234567890",
    "generated_pitch": "Test pitch",
    "transcript": "Hello? Yes this is a test.",
    "recording_url": "http://example.com/recording.mp3",
    "duration_seconds": 15,
    "call_status": "completed",
    "n8n_call_id": "test-id-123"
}

req = urllib.request.Request("http://127.0.0.1:8000/vapi-call-result", method="POST", data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'})
try:
    resp = urllib.request.urlopen(req)
    print("Success:", resp.read().decode())
except Exception as e:
    print("Error:", e)
    if hasattr(e, 'read'):
        print(e.read().decode())
