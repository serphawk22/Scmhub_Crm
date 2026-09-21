import requests

url = "http://localhost:8000/quotes/1/pdf?download=1"
# We don't have a quote, but we can at least check if it errors.
# Let's just run it via grep in main.py for how download handles it.
