"""GraphiqAI provider for capability-based company search."""

import requests
from config import GRAPHIQ_API_KEY

GRAPHIQ_BASE_URL = "https://app.graphiq.ai/api/v2"


def search_by_capabilities(
    capabilities: list[str],
    limit: int = 20,
) -> list[dict]:
    """
    Search for organizations by their capabilities/expertise.

    Args:
        capabilities: List of capabilities to search for (e.g., ["ball bearing", "CNC machining"])
        limit: Max results to return

    Returns:
        List of organization dicts
    """
    if not GRAPHIQ_API_KEY:
        raise ValueError("GRAPHIQ_API_KEY not configured")

    headers = {
        "X-API-Key": GRAPHIQ_API_KEY,
        "Content-Type": "application/json",
    }

    payload = {
        "organization": {
            "capabilities": capabilities,
        },
        "limit": limit,
    }

    response = requests.post(
        f"{GRAPHIQ_BASE_URL}/organizations/search",
        headers=headers,
        json=payload,
        timeout=30,
    )
    response.raise_for_status()

    data = response.json()
    entities = data.get("entities", [])

    results = []
    for org in entities:
        results.append({
            "name": org.get("name", ""),
            "domain": org.get("website") or org.get("domain", ""),
            "description": org.get("description", ""),
            "capabilities": org.get("capabilities", []),
            "industry": org.get("industry", ""),
            "location": _format_location(org),
            "employee_count": org.get("employee_count") or org.get("employees"),
            "revenue": org.get("revenue", ""),
        })

    return results


def search_organizations(
    query: str = None,
    industry: str = None,
    location: str = None,
    limit: int = 20,
) -> list[dict]:
    """
    General organization search with multiple filters.

    Args:
        query: Free text search query
        industry: Industry filter
        location: Location filter (city, state, or country)
        limit: Max results to return

    Returns:
        List of organization dicts
    """
    if not GRAPHIQ_API_KEY:
        raise ValueError("GRAPHIQ_API_KEY not configured")

    headers = {
        "X-API-Key": GRAPHIQ_API_KEY,
        "Content-Type": "application/json",
    }

    # Build filter payload
    org_filter = {}
    if query:
        org_filter["query"] = query
    if industry:
        org_filter["industry"] = industry
    if location:
        org_filter["location"] = location

    payload = {
        "organization": org_filter,
        "limit": limit,
    }

    response = requests.post(
        f"{GRAPHIQ_BASE_URL}/organizations/search",
        headers=headers,
        json=payload,
        timeout=30,
    )
    response.raise_for_status()

    data = response.json()
    entities = data.get("entities", [])

    results = []
    for org in entities:
        results.append({
            "name": org.get("name", ""),
            "domain": org.get("website") or org.get("domain", ""),
            "description": org.get("description", ""),
            "capabilities": org.get("capabilities", []),
            "industry": org.get("industry", ""),
            "location": _format_location(org),
            "employee_count": org.get("employee_count") or org.get("employees"),
            "revenue": org.get("revenue", ""),
        })

    return results


def _format_location(org: dict) -> str:
    """Format organization location from various fields."""
    parts = []
    for field in ["city", "state", "country"]:
        if org.get(field):
            parts.append(org[field])
    return ", ".join(parts) if parts else org.get("location", "")
