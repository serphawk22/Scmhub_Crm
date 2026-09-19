import re

with open("main.py", "r") as f:
    content = f.read()

handler_code = """
from fastapi.responses import JSONResponse
from fastapi import Request
import traceback

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print("Unhandled Exception:", exc)
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"message": "Internal Server Error", "details": str(exc)},
        headers={"Access-Control-Allow-Origin": "*"}
    )
"""

if "global_exception_handler" not in content:
    content = content.replace("app.add_middleware(", handler_code + "\napp.add_middleware(")
    with open("main.py", "w") as f:
        f.write(content)
    print("Global exception handler added.")
else:
    print("Handler already exists.")
