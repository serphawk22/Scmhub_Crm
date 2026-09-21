"""
Google Maps Radar Analysis Engine
Wraps the Google Maps Places API for competitor intelligence.
"""
import math
import os
import httpx
import logging
import time
from typing import Optional
from modules.api_tracker import track_api_call, current_client_id, current_salesperson_id, current_endpoint

# Force the old API key because it has Places API (New) enabled.
# The user's environment variable has a new key that only has Maps JS API enabled.
GOOGLE_MAPS_API_KEY = "AIzaSyAJbAEbE5egi9y-adJ5G804u_vL64We_nc"
PLACES_NEW_BASE = "https://places.googleapis.com/v1/places"

SERVICE_KEYWORDS = {
    "SEO": ["seo", "search engine", "organic", "ranking", "serp"],
    "PPC": ["ppc", "google ads", "paid ads", "adwords", "paid search", "sem"],
    "Web Design": ["web design", "website", "web development", "wordpress", "ui/ux", "landing page"],
    "Branding": ["branding", "brand identity", "logo", "design", "graphic"],
    "Marketing": ["marketing", "digital marketing", "growth", "campaign", "advertising"],
    "Social Media": ["social media", "instagram", "facebook", "tiktok", "twitter", "social"],
    "Content": ["content", "blog", "copywriting", "content marketing", "writing"],
    "Automation": ["automation", "crm", "workflow", "ai", "chatbot"],
    "Development": ["app development", "mobile app", "software", "development", "custom"],
    "Consulting": ["consulting", "strategy", "advisory", "agency", "consulting"],
}

def _haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

def score_market_size(place):
    score = 0
    reviews = place.get("user_ratings_total", 0) or 0
    rating = place.get("rating", 0) or 0
    if reviews > 0:
        score += min(50, int(math.log(reviews + 1, 10) * 17))
    score += min(20, int(rating * 4))
    if place.get("website"):
        score += 10
    score += min(20, len(place.get("types", [])) * 3)
    return min(100, score)

def estimate_team_size(place):
    score = score_market_size(place)
    if score >= 80: return "101-250"
    elif score >= 65: return "51-100"
    elif score >= 50: return "26-50"
    elif score >= 35: return "11-25"
    else: return "1-10"

def calculate_service_overlap(target_category, competitor_types, competitor_name=""):
    combined = " ".join([target_category.lower(), " ".join(competitor_types).lower(), competitor_name.lower()])
    matched = [s for s, kws in SERVICE_KEYWORDS.items() if any(k in combined for k in kws)]
    missing = [s for s in SERVICE_KEYWORDS if s not in matched]
    overlap_pct = round((len(matched) / len(SERVICE_KEYWORDS)) * 100) if SERVICE_KEYWORDS else 0
    return {"overlap_pct": overlap_pct, "matched_services": matched, "missing_services": missing}

def get_competitor_color(overlap_pct):
    if overlap_pct >= 70: return "red"
    elif overlap_pct >= 50: return "orange"
    elif overlap_pct >= 30: return "yellow"
    else: return "green"

def calculate_market_density(competitor_count, radius_km):
    area = math.pi * (radius_km ** 2)
    return min(100, int((competitor_count / max(area, 1)) * 20))

async def find_place(query, location_hint=None):
    search_query = f"{query} {location_hint}" if location_hint else query
    async with httpx.AsyncClient(timeout=15.0) as client:
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
            "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.websiteUri,places.nationalPhoneNumber,places.rating,places.userRatingCount,places.types,places.businessStatus"
        }
        data = {"textQuery": search_query}
        start_time = time.time()
        status_code = 200
        success = True
        try:
            resp = await client.post(f"{PLACES_NEW_BASE}:searchText", headers=headers, json=data)
            resp.raise_for_status()
            data = resp.json()
            status_code = resp.status_code
        except Exception as e:
            success = False
            status_code = getattr(e, 'response', None)
            status_code = status_code.status_code if status_code else 500
            raise e
        finally:
            end_time = time.time()
            track_api_call(
                endpoint=current_endpoint.get(),
                model="places-search-text",
                input_tokens=0,
                output_tokens=0,
                response_time_ms=int((end_time - start_time) * 1000),
                salesperson_id=current_salesperson_id.get(),
                client_id=current_client_id.get(),
                status_code=status_code,
                success=success,
                content_type="external_api"
            )

        places = data.get("places", [])
        if not places:
            return None
            
        p = places[0]
        return {
            "place_id": p.get("id"),
            "name": p.get("displayName", {}).get("text"),
            "address": p.get("formattedAddress"),
            "lat": p.get("location", {}).get("latitude"),
            "lng": p.get("location", {}).get("longitude"),
            "website": p.get("websiteUri"),
            "phone": p.get("nationalPhoneNumber"),
            "rating": p.get("rating"),
            "reviews": p.get("userRatingCount"),
            "types": p.get("types", []),
            "business_status": p.get("businessStatus"),
            "maps_url": f"https://www.google.com/maps/place/?q=place_id:{p.get('id')}"
        }

async def get_place_details(place_id):
    # Backward compatibility: we don't strictly need this if we just use find_place, 
    # but radar_search endpoint supports passing place_id directly.
    # The New API allows GET /v1/places/{placeId}
    async with httpx.AsyncClient(timeout=15.0) as client:
        headers = {
            "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
            "X-Goog-FieldMask": "id,displayName,formattedAddress,location,websiteUri,nationalPhoneNumber,rating,userRatingCount,types,businessStatus"
        }
        start_time = time.time()
        success = True
        status_code = 200
        try:
            resp = await client.get(f"{PLACES_NEW_BASE}/{place_id}", headers=headers)
            status_code = resp.status_code
            if status_code != 200:
                success = False
        except Exception as e:
            success = False
            status_code = getattr(e, 'response', None)
            status_code = status_code.status_code if status_code else 500
            raise e
        finally:
            end_time = time.time()
            track_api_call(
                endpoint=current_endpoint.get(),
                model="places-details",
                input_tokens=0,
                output_tokens=0,
                response_time_ms=int((end_time - start_time) * 1000),
                salesperson_id=current_salesperson_id.get(),
                client_id=current_client_id.get(),
                status_code=status_code,
                success=success,
                content_type="external_api"
            )
            
        if status_code != 200:
            return None
        p = resp.json()
        return {
            "place_id": p.get("id"),
            "name": p.get("displayName", {}).get("text"),
            "address": p.get("formattedAddress"),
            "lat": p.get("location", {}).get("latitude"),
            "lng": p.get("location", {}).get("longitude"),
            "website": p.get("websiteUri"),
            "phone": p.get("nationalPhoneNumber"),
            "rating": p.get("rating"),
            "reviews": p.get("userRatingCount"),
            "types": p.get("types", []),
            "business_status": p.get("businessStatus"),
            "maps_url": f"https://www.google.com/maps/place/?q=place_id:{p.get('id')}"
        }

async def find_nearby_competitors(lat, lng, radius_m, keyword, target_name=""):
    import asyncio
    async with httpx.AsyncClient(timeout=30.0) as client:
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
            "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types,places.websiteUri"
        }
        data = {
            "textQuery": keyword,
            "locationBias": {
                "circle": {
                    "center": {"latitude": lat, "longitude": lng},
                    "radius": radius_m
                }
            }
        }
        
        start_time = time.time()
        success = True
        status_code = 200
        try:
            resp = await client.post(f"{PLACES_NEW_BASE}:searchText", headers=headers, json=data)
            resp.raise_for_status()
            resp_data = resp.json()
            status_code = resp.status_code
        except Exception as e:
            success = False
            status_code = getattr(e, 'response', None)
            status_code = status_code.status_code if status_code else 500
            raise e
        finally:
            end_time = time.time()
            track_api_call(
                endpoint=current_endpoint.get(),
                model="places-nearby",
                input_tokens=0,
                output_tokens=0,
                response_time_ms=int((end_time - start_time) * 1000),
                salesperson_id=current_salesperson_id.get(),
                client_id=current_client_id.get(),
                status_code=status_code,
                success=success,
                content_type="external_api"
            )
            
        results = resp_data.get("places", [])

    competitors = []
    for r in results:
        name = r.get("displayName", {}).get("text", "")
        if target_name and name.lower() == target_name.lower():
            continue
            
        r_lat = r.get("location", {}).get("latitude", lat)
        r_lng = r.get("location", {}).get("longitude", lng)
        dist = round(_haversine(lat, lng, r_lat, r_lng), 2)
        types = r.get("types", [])
        
        # Calculate scores using the old mock structure
        # Our old code expected keys like "user_ratings_total" to score market size
        legacy_format_r = {
            "user_ratings_total": r.get("userRatingCount"),
            "rating": r.get("rating"),
            "website": r.get("websiteUri"),
            "types": types
        }
        
        overlap = calculate_service_overlap(keyword, types, name)
        competitors.append({
            "place_id": r.get("id"),
            "name": name,
            "address": r.get("formattedAddress"),
            "lat": r_lat,
            "lng": r_lng,
            "rating": r.get("rating"),
            "reviews": r.get("userRatingCount"),
            "types": types,
            "category": types[0].replace("_", " ").title() if types else "Business",
            "distance_km": dist,
            "market_size_score": score_market_size(legacy_format_r),
            "team_size_estimate": estimate_team_size(legacy_format_r),
            "overlap_pct": overlap["overlap_pct"],
            "matched_services": overlap["matched_services"],
            "missing_services": overlap["missing_services"],
            "pin_color": get_competitor_color(overlap["overlap_pct"]),
            "maps_url": f"https://www.google.com/maps/place/?q=place_id:{r.get('id')}",
            "website": r.get("websiteUri"),
        })
    return competitors

def sort_nearest(competitors): return sorted(competitors, key=lambda c: c.get("distance_km", 999))[:5]
def sort_largest_market(competitors): return sorted(competitors, key=lambda c: c.get("market_size_score", 0), reverse=True)[:5]
def sort_largest_team(competitors):
    ORDER = {"500+": 7, "251-500": 6, "101-250": 5, "51-100": 4, "26-50": 3, "11-25": 2, "1-10": 1}
    return sorted(competitors, key=lambda c: ORDER.get(c.get("team_size_estimate", "1-10"), 0), reverse=True)[:5]
def sort_most_similar(competitors): return sorted(competitors, key=lambda c: c.get("overlap_pct", 0), reverse=True)[:5]
