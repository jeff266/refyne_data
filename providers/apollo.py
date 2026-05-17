"""Apollo provider for Mid-Market firmographic enrichment."""

import requests
from config import APOLLO_API_KEY

APOLLO_BASE_URL = "https://api.apollo.io/v1"


def enrich_company(domain: str = None, name: str = None) -> dict | None:
    """
    Enrich a company using Apollo's organization enrichment API.

    Args:
        domain: Company domain (e.g., "notion.com")
        name: Company name (fallback if domain not provided)

    Returns:
        Company data dict or None if not found
    """
    if not APOLLO_API_KEY:
        raise ValueError("APOLLO_API_KEY not configured")

    if not domain and not name:
        raise ValueError("Must provide either domain or name")

    payload = {"api_key": APOLLO_API_KEY}
    if domain:
        payload["domain"] = domain
    else:
        payload["organization_name"] = name

    response = requests.post(
        f"{APOLLO_BASE_URL}/organizations/enrich",
        json=payload,
        timeout=30,
    )
    response.raise_for_status()

    data = response.json()
    org = data.get("organization")

    if not org:
        return None

    return {
        "name": org.get("name", ""),
        "domain": org.get("primary_domain", ""),
        "industry": org.get("industry", ""),
        "employee_count": org.get("estimated_num_employees"),
        "revenue_range": _format_revenue(org.get("annual_revenue")),
        "founded_year": org.get("founded_year"),
        "linkedin_url": org.get("linkedin_url", ""),
        "description": org.get("short_description", ""),
        "city": org.get("city", ""),
        "state": org.get("state", ""),
        "country": org.get("country", ""),
    }


def search_contacts(
    domain: str,
    titles: list[str] = None,
    limit: int = 5,
) -> list[dict]:
    """
    Search for contacts at a company using Apollo's people search.

    Args:
        domain: Company domain
        titles: List of job titles to filter by (optional)
        limit: Max contacts to return

    Returns:
        List of contact dicts
    """
    if not APOLLO_API_KEY:
        raise ValueError("APOLLO_API_KEY not configured")

    payload = {
        "api_key": APOLLO_API_KEY,
        "q_organization_domains": domain,
        "per_page": limit,
    }

    if titles:
        payload["person_titles"] = titles

    response = requests.post(
        f"{APOLLO_BASE_URL}/mixed_people/search",
        json=payload,
        timeout=30,
    )
    response.raise_for_status()

    data = response.json()
    people = data.get("people", [])

    results = []
    for person in people:
        results.append({
            "name": person.get("name", ""),
            "title": person.get("title", ""),
            "email": person.get("email", ""),
            "linkedin_url": person.get("linkedin_url", ""),
            "city": person.get("city", ""),
            "state": person.get("state", ""),
        })

    return results


def _format_revenue(revenue: int | None) -> str:
    """Format revenue as readable string."""
    if not revenue:
        return "Unknown"
    if revenue >= 1_000_000_000:
        return f"${revenue / 1_000_000_000:.1f}B"
    if revenue >= 1_000_000:
        return f"${revenue / 1_000_000:.0f}M"
    if revenue >= 1_000:
        return f"${revenue / 1_000:.0f}K"
    return f"${revenue}"
