import contextvars
from functools import wraps

current_client_id = contextvars.ContextVar("current_client_id", default=None)
current_salesperson_id = contextvars.ContextVar("current_salesperson_id", default=None)
current_endpoint = contextvars.ContextVar("current_endpoint", default=None)

def track_api_call(service: str, endpoint: str):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            return func(*args, **kwargs)
        return wrapper
    return decorator

def patch_openai():
    pass
