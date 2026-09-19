import os
from dotenv import load_dotenv

load_dotenv()
print(f"OPENAI_API_KEY: {os.getenv('OPENAI_API_KEY')[:15]}...{os.getenv('OPENAI_API_KEY')[-15:] if os.getenv('OPENAI_API_KEY') else 'NONE'}")
print(f"File exists: {os.path.exists('.env')}")
if os.path.exists('.env'):
    with open('.env', 'r') as f:
        print("First line of .env:", f.readline())
