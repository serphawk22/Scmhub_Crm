import os
import json
from openai import OpenAI

def get_openai_client():
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        raise ValueError("OPENAI_API_KEY not found in environment variables")
    return OpenAI(api_key=api_key)

def extract_services(email_body: str) -> str:
    """
    Extracts services from email body using OpenAI.
    """
    if not email_body:
        return ""
    try:
        client = get_openai_client()
        prompt = f"Extract a comma-separated list of services from this email: {email_body}"
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}]
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Error extracting services: {e}")
        return ""
