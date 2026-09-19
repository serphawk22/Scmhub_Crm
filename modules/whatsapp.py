import os
import requests
from requests.auth import HTTPBasicAuth

def send_whatsapp_message(message: str, to_number: str = None):
    """
    Sends a WhatsApp message using the Twilio API.
    If keys are missing, falls back to logging to the console.
    """
    account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
    twilio_number = os.environ.get("TWILIO_WHATSAPP_NUMBER")
    admin_number = os.environ.get("ADMIN_WHATSAPP_NUMBER")

    recipient = to_number or admin_number

    if not account_sid or not auth_token or not twilio_number or not recipient:
        print("====== WHATSAPP NOTIFICATION (MOCK) ======")
        print(f"To: {recipient or '[ADMIN_WHATSAPP_NUMBER MISSING]'}")
        print(f"Message:\n{message}")
        print("==========================================")
        return

    # Twilio requires whatsapp: prefix
    recipient = recipient.replace(" ", "").replace("-", "")
    if not recipient.startswith("whatsapp:"):
        recipient = f"whatsapp:{recipient}"
    twilio_number = twilio_number.replace(" ", "").replace("-", "")
    if not twilio_number.startswith("whatsapp:"):
        twilio_number = f"whatsapp:{twilio_number}"

    url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
    
    payload = {
        "From": twilio_number,
        "To": recipient,
        "Body": message
    }
    
    try:
        response = requests.post(
            url, 
            data=payload, 
            auth=HTTPBasicAuth(account_sid, auth_token)
        )
        resp_json = {}
        try:
            resp_json = response.json()
        except Exception:
            pass
        if response.ok:
            sid = resp_json.get("sid", "?")
            status = resp_json.get("status", "?")
            error_code = resp_json.get("error_code")
            error_msg = resp_json.get("error_message")
            print(f"Twilio WhatsApp message sent to {recipient} | SID={sid} | status={status}" + 
                  (f" | error_code={error_code} | error_msg={error_msg}" if error_code else ""))
        else:
            print(f"Twilio returned non-2xx {response.status_code}: {response.text}")
            response.raise_for_status()
    except Exception as e:
        print(f"Failed to send Twilio WhatsApp message: {e}")
        if isinstance(e, requests.exceptions.HTTPError):
            print(f"Response: {e.response.text}")

def send_ai_polished_whatsapp_message(event_type: str, raw_data: dict, link: str = None):
    import json
    import openai
    import threading

    def _send():
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            print("Missing OPENAI_API_KEY. Falling back to basic formatting.")
            # Basic fallback formatting
            info_lines = [f"- {str(k).replace('_', ' ').title()}: {v}" for k, v in raw_data.items() if v and k not in ["id", "created_at", "updated_at"]]
            info_str = "\n".join(info_lines)
            msg = f"🚨 *{event_type}*\n\n{info_str}"
            if link:
                msg += f"\n\n🔗 Link: {link}"
            send_whatsapp_message(msg)
            return

        client = openai.OpenAI(api_key=api_key)
        
        prompt = f"""
        An event of type '{event_type}' just occurred in the CRM.
        Here is the raw JSON data associated with the event:
        {json.dumps(raw_data, indent=2, default=str)}
        
        Your task:
        Write a SHORT, STRAIGHTFORWARD WhatsApp message to alert the business owner.
        - Give exactly the relevant details for the action that happened.
        - DO NOT include extra fluff like "Actionable items", "Next steps", "We have a fresh potential opportunity", or "Executive Assistant" sign-offs.
        - DO NOT greet the owner or say "Hello".
        - Just format the raw data cleanly with some emojis and bold text, and give the summary.
        - DO NOT include the link in your output. I will append the link manually at the end.
        - Just output the message directly. No preamble.
        """
        
        try:
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=500
            )
            ai_message = response.choices[0].message.content.strip()
            if link:
                ai_message += f"\n\n🔗 Link: {link}"
            
            send_whatsapp_message(ai_message)
        except Exception as e:
            print("Failed to polish message with AI:", e)
            # Fallback
            info_lines = [f"- {str(k).replace('_', ' ').title()}: {v}" for k, v in raw_data.items() if v and k not in ["id", "created_at", "updated_at"]]
            msg = f"🚨 *{event_type}*\n\n" + "\n".join(info_lines)
            if link: msg += f"\n\n🔗 Link: {link}"
            send_whatsapp_message(msg)
            
    threading.Thread(target=_send).start()


def transcribe_voice_message(media_url: str, account_sid: str, auth_token: str) -> str:
    """
    Downloads a WhatsApp voice note from Twilio and transcribes it using
    OpenAI Whisper.

    Args:
        media_url:   The Twilio MediaUrl0 value from the webhook POST.
        account_sid: Twilio Account SID (required for authenticated download).
        auth_token:  Twilio Auth Token.

    Returns:
        The transcribed text string.

    Raises:
        RuntimeError: If OPENAI_API_KEY is missing.
        requests.HTTPError: If the audio download fails.
    """
    import tempfile
    import openai

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set — cannot transcribe voice message.")

    # 1. Download the audio from Twilio (requires HTTP Basic Auth)
    print(f"[Voice] Downloading audio from: {media_url}")
    audio_response = requests.get(
        media_url,
        auth=HTTPBasicAuth(account_sid, auth_token),
        timeout=30
    )
    audio_response.raise_for_status()

    # 2. Detect content type to pick the right file extension
    content_type = audio_response.headers.get("Content-Type", "audio/ogg")
    ext_map = {
        "audio/ogg": ".ogg",
        "audio/mpeg": ".mp3",
        "audio/mp4": ".mp4",
        "audio/wav": ".wav",
        "audio/webm": ".webm",
        "audio/amr": ".amr",
    }
    ext = ext_map.get(content_type.split(";")[0].strip(), ".ogg")

    # 3. Save to a temp file — Whisper needs a seekable file object
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(audio_response.content)
        tmp_path = tmp.name

    try:
        print(f"[Voice] Saved audio to {tmp_path} ({len(audio_response.content)} bytes)")

        # 4. Transcribe via OpenAI Whisper
        openai_client = openai.OpenAI(api_key=api_key)
        with open(tmp_path, "rb") as audio_file:
            transcript_obj = openai_client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="text"
            )

        # response_format="text" returns a plain string
        transcript_text = transcript_obj.strip() if isinstance(transcript_obj, str) else str(transcript_obj).strip()
        print(f"[Voice] Transcript: {transcript_text}")
        return transcript_text

    finally:
        # 5. Always clean up the temp file
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
