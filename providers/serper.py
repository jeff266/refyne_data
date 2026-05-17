"""Serper provider for SMB Brick & Mortar enrichment via Google Maps."""

import requests
from config import SERPER_API_KEY

SERPER_MAPS_URL = "https://google.serper.dev/maps"


def search_local_businesses(
    industry: str,
    location: str,
    num_results: int = 20,
) -> list[dict]:
    """
    Search for local businesses using Serper's Google Maps API.

    Args:
        industry: Business type (e.g., "Fitness Centers", "Restaurants")
        location: City, state, or zip code
        num_results: Max results to return (default 20)

    Returns:
        List of business dicts with name, address, phone, website, rating
    """
    if not SERPER_API_KEY:
        raise ValueError("SERPER_API_KEY not configured")

    query = f"{industry} in {location}"

    response = requests.post(
        SERPER_MAPS_URL,
        headers={
            "X-API-KEY": SERPER_API_KEY,
            "Content-Type": "application/json",
        },
        json={
            "q": query,
            "num": num_results,
        },
        timeout=30,
    )
    response.raise_for_status()

    data = response.json()
    places = data.get("places", [])

    results = []
    for place in places:
        results.append({
            "name": place.get("title", ""),
            "address": place.get("address", ""),
            "phone": place.get("phoneNumber", ""),
            "website": place.get("website", ""),
            "rating": place.get("rating"),
            "reviews": place.get("ratingCount"),
            "category": place.get("category", ""),
        })

    return results
