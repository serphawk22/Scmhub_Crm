import sys
import re

with open("modules/llm_engine.py", "r", encoding="utf-8") as f:
    code = f.read()

replacement = '''def process_chatbot_command(message: str, client_context: dict = None, current_route: str = None):
    """
    Analyzes user message to determine CRM action intent for the chatbot.
    """
    import json
    try:
        client = get_openai_client()
        context_str = f"Client context: {json.dumps(client_context)}" if client_context else "No specific client context."
        route_str = f"User's current page route: {current_route}" if current_route else "Unknown route."
        
        prompt = f"""
        You are the highly advanced SERP Hawk CRM Assistant.
        The user has sent a message. Detect their intent and extract any parameters needed to perform the action.
        
        {route_str}
        {context_str}
        
        User message: "{message}"
        
        Return ONLY a JSON object with this exact structure:
        {{
            "intent": "create_client" | "create_project" | "search_marketplace" | "draft_email" | "add_note" | "log_conversation" | "navigate" | "general",
            "parameters": {{
                "company_name": "...",
                "email": "...",
                "phone": "...",
                "project_name": "...",
                "description": "...",
                "search_query": "...",
                "route": "...",
                "client_id": 123,
                "content": "...",
                "title": "...",
                "type": "..."
            }},
            "reply": "A friendly confirmation to send back to the user in the chat."
        }}
        
        Rules:
        - If the user asks to go somewhere or see something, intent is 'navigate'. (route should be things like '/admin', '/admin/clients', '/admin/marketplace')
        - If the user asks to add a client/company, intent is 'create_client'.
        - If the user asks to search for a service, intent is 'search_marketplace'.
        - If the user asks to draft an email, intent is 'draft_email'.
        - If you don't know the exact intent, use 'general' and just reply naturally.
        """
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"Error in chatbot command processing: {e}")
        return {
            "intent": "general",
            "reply": "I'm sorry, I encountered an error trying to process your request."
        }'''

new_code = re.sub(
    r"def process_chatbot_command\(message: str, client_context: dict = None\):.*?return \{\n\s+\"intent\": \"general\",\n\s+\"reply\": \"I'm sorry, I encountered an error trying to process your request\.\"\n\s+\}",
    replacement,
    code,
    flags=re.DOTALL
)

with open("modules/llm_engine.py", "w", encoding="utf-8") as f:
    f.write(new_code)
