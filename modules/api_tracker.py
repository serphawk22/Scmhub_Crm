import json
import time
from datetime import datetime
from sqlmodel import Session
from contextvars import ContextVar

from database import engine, ApiRequest

PRICING = {
    "gpt-4o": {"input": 5.0, "output": 15.0},
    "gpt-4-turbo": {"input": 10.0, "output": 30.0},
    "gpt-3.5-turbo": {"input": 0.5, "output": 1.5},
    "claude-3-opus": {"input": 15.0, "output": 75.0},
    "claude-3-5-sonnet": {"input": 3.0, "output": 15.0},
    "claude-3-haiku": {"input": 0.25, "output": 1.25},
    "gemini-1.5-pro": {"input": 3.5, "output": 10.5},
    "gemini-1.5-flash": {"input": 0.075, "output": 0.3},
}

# Context variables to hold current request context
current_client_id: ContextVar[int] = ContextVar("current_client_id", default=None)
current_salesperson_id: ContextVar[int] = ContextVar("current_salesperson_id", default=None)
current_endpoint: ContextVar[str] = ContextVar("current_endpoint", default="background_task")

def calculate_cost(model: str, input_tokens: int, output_tokens: int) -> tuple[float, float, float]:
    model_lower = model.lower()
    rates = PRICING.get(model_lower)
    if not rates:
        if "gpt-4o" in model_lower:
            rates = PRICING["gpt-4o"]
        elif "sonnet" in model_lower:
            rates = PRICING["claude-3-5-sonnet"]
        elif "opus" in model_lower:
            rates = PRICING["claude-3-opus"]
        elif "haiku" in model_lower:
            rates = PRICING["claude-3-haiku"]
        elif "gemini-1.5-pro" in model_lower:
            rates = PRICING["gemini-1.5-pro"]
        elif "gemini-1.5-flash" in model_lower:
            rates = PRICING["gemini-1.5-flash"]
        elif "gpt-4" in model_lower:
            rates = PRICING["gpt-4-turbo"]
        else:
            rates = {"input": 0.0, "output": 0.0}

    if "places" in model_lower:
        return 0.0, 0.0, 0.032  # Flat rate for Places API
    if "serper" in model_lower:
        return 0.0, 0.0, 0.001  # Flat rate for Serper API

    in_cost = (input_tokens / 1_000_000) * rates["input"]
    out_cost = (output_tokens / 1_000_000) * rates["output"]
    return in_cost, out_cost, in_cost + out_cost

def determine_provider(model: str) -> str:
    model_lower = model.lower()
    if "gpt" in model_lower or "openai" in model_lower or "o1" in model_lower:
        return "openai"
    if "claude" in model_lower or "anthropic" in model_lower:
        return "anthropic"
    if "gemini" in model_lower or "google" in model_lower:
        return "gemini"
    if "mistral" in model_lower or "mixtral" in model_lower:
        return "mistral"
    if "groq" in model_lower or "llama" in model_lower:
        return "groq"
    if "deepseek" in model_lower:
        return "deepseek"
    if "places" in model_lower:
        return "google_maps"
    if "serper" in model_lower:
        return "serper"
    return "custom"

def track_api_call(
    endpoint: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    response_time_ms: int,
    salesperson_id: int = None,
    client_id: int = None,
    reasoning_tokens: int = 0,
    status_code: int = 200,
    success: bool = True,
    content_type: str = "general",
    request_meta: dict = None
):
    in_cost, out_cost, total_cost = calculate_cost(model, input_tokens, output_tokens)
    provider = determine_provider(model)
    total_tokens = input_tokens + output_tokens + reasoning_tokens
    
    req = ApiRequest(
        salesperson_id=salesperson_id,
        client_id=client_id,
        endpoint=endpoint,
        model=model,
        provider=provider,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        reasoning_tokens=reasoning_tokens,
        total_tokens=total_tokens,
        input_cost=in_cost,
        output_cost=out_cost,
        total_cost=total_cost,
        response_time_ms=response_time_ms,
        status_code=status_code,
        success=success,
        content_type=content_type,
        request_meta=request_meta,
        timestamp=datetime.utcnow()
    )
    
    try:
        with Session(engine) as session:
            session.add(req)
            session.commit()
    except Exception as e:
        print(f"Failed to track API call: {e}")

_original_create = None

def _patched_chat_completions_create(*args, **kwargs):
    global _original_create
    start_time = time.time()
    model_used = kwargs.get("model", "gpt-4o-mini")
    endpoint = current_endpoint.get()
    client_id = current_client_id.get()
    salesperson_id = current_salesperson_id.get()
    
    success = True
    status_code = 200
    try:
        response = _original_create(*args, **kwargs)
    except Exception as e:
        success = False
        status_code = getattr(e, 'status_code', 500)
        track_api_call(
            endpoint=endpoint,
            model=model_used,
            input_tokens=0,
            output_tokens=0,
            response_time_ms=int((time.time() - start_time) * 1000),
            salesperson_id=salesperson_id,
            client_id=client_id,
            success=False,
            status_code=status_code
        )
        raise e
        
    end_time = time.time()
    
    if hasattr(response, 'usage') and response.usage:
        track_api_call(
            endpoint=endpoint,
            model=model_used,
            input_tokens=response.usage.prompt_tokens or 0,
            output_tokens=response.usage.completion_tokens or 0,
            response_time_ms=int((end_time - start_time) * 1000),
            salesperson_id=salesperson_id,
            client_id=client_id,
            success=True,
            status_code=200
        )
    return response

def patch_openai():
    """Monkey-patch the OpenAI client to globally track tokens."""
    global _original_create
    import openai.resources.chat.completions
    if _original_create is None:
        _original_create = openai.resources.chat.completions.Completions.create
        openai.resources.chat.completions.Completions.create = _patched_chat_completions_create
        print("OpenAI client globally patched for API Intelligence Tracking.")
