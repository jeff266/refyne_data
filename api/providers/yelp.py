"""
Yelp GraphQL API Provider

Uses Yelp's GraphQL API for local business search and enrichment.
Better rate limits than REST API (25,000 points/day vs 500 calls/day).

API Docs: https://docs.developer.yelp.com/docs/graphql-overview
"""

import os
import httpx
from typing import Optional

YELP_GRAPHQL_URL = "https://api.yelp.com/v3/graphql"


def get_api_key() -> str:
    """Get Yelp API key from environment."""
    key = os.getenv("YELP_API_KEY")
    if not key:
        raise ValueError("YELP_API_KEY environment variable not set")
    return key


async def search_businesses(
    term: str,
    location: str,
    limit: int = 20,
    categories: Optional[str] = None,
) -> dict:
    """
    Search for businesses using Yelp GraphQL API.

    Args:
        term: Search term (e.g., "fitness centers", "restaurants")
        location: Location string (e.g., "Austin, TX" or "90210")
        limit: Number of results (max 50)
        categories: Optional Yelp category filter

    Returns:
        Dict with businesses array and total count
    """
    api_key = get_api_key()

    # GraphQL query for business search
    query = """
    query SearchBusinesses($term: String!, $location: String!, $limit: Int, $categories: String) {
        search(term: $term, location: $location, limit: $limit, categories: $categories) {
            total
            business {
                id
                name
                url
                phone
                display_phone
                rating
                review_count
                price
                is_closed
                categories {
                    title
                    alias
                }
                coordinates {
                    latitude
                    longitude
                }
                location {
                    address1
                    address2
                    city
                    state
                    zip_code
                    country
                    formatted_address
                }
                hours {
                    is_open_now
                    open {
                        day
                        start
                        end
                    }
                }
                photos
            }
        }
    }
    """

    variables = {
        "term": term,
        "location": location,
        "limit": min(limit, 50),
    }

    if categories:
        variables["categories"] = categories

    async with httpx.AsyncClient() as client:
        response = await client.post(
            YELP_GRAPHQL_URL,
            json={"query": query, "variables": variables},
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=15.0,
        )
        response.raise_for_status()
        data = response.json()

    if "errors" in data:
        raise Exception(f"Yelp GraphQL error: {data['errors']}")

    return transform_response(data.get("data", {}).get("search", {}))


async def get_business_details(business_id: str) -> dict:
    """
    Get detailed information about a specific business.

    Args:
        business_id: Yelp business ID

    Returns:
        Dict with business details
    """
    api_key = get_api_key()

    query = """
    query GetBusiness($id: String!) {
        business(id: $id) {
            id
            name
            url
            phone
            display_phone
            rating
            review_count
            price
            is_closed
            categories {
                title
                alias
            }
            coordinates {
                latitude
                longitude
            }
            location {
                address1
                address2
                city
                state
                zip_code
                country
                formatted_address
            }
            hours {
                is_open_now
                open {
                    day
                    start
                    end
                }
            }
            photos
            reviews(limit: 3) {
                id
                rating
                text
                time_created
                user {
                    name
                }
            }
        }
    }
    """

    async with httpx.AsyncClient() as client:
        response = await client.post(
            YELP_GRAPHQL_URL,
            json={"query": query, "variables": {"id": business_id}},
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=15.0,
        )
        response.raise_for_status()
        data = response.json()

    if "errors" in data:
        raise Exception(f"Yelp GraphQL error: {data['errors']}")

    business = data.get("data", {}).get("business", {})
    return transform_business(business) if business else {}


def transform_response(search_data: dict) -> dict:
    """Transform Yelp GraphQL response to standard format."""
    businesses = search_data.get("business", []) or []

    return {
        "total": search_data.get("total", 0),
        "results": [transform_business(b) for b in businesses],
        "provider": "yelp",
    }


def transform_business(business: dict) -> dict:
    """Transform a single business to standard format."""
    location = business.get("location", {}) or {}

    # Build formatted address
    address_parts = [
        location.get("address1"),
        location.get("address2"),
        f"{location.get('city', '')}, {location.get('state', '')} {location.get('zip_code', '')}".strip(", "),
    ]
    address = ", ".join(filter(None, address_parts))

    # Format hours
    hours_data = business.get("hours", [])
    hours_formatted = None
    if hours_data and len(hours_data) > 0:
        hours_formatted = format_hours(hours_data[0].get("open", []))

    # Extract categories
    categories = [c.get("title") for c in (business.get("categories") or [])]

    return {
        "name": business.get("name"),
        "address": address or location.get("formatted_address"),
        "phone": business.get("display_phone") or business.get("phone"),
        "website": None,  # Yelp doesn't provide business websites directly
        "yelp_url": business.get("url"),
        "yelp_rating": business.get("rating"),
        "yelp_review_count": business.get("review_count"),
        "price_level": business.get("price"),
        "categories": categories,
        "hours": hours_formatted,
        "is_closed": business.get("is_closed", False),
        "photos": business.get("photos", []),
        "coordinates": business.get("coordinates"),
        "yelp_id": business.get("id"),
        "_source": "yelp",
    }


def format_hours(hours_list: list) -> str:
    """Format Yelp hours array to readable string."""
    if not hours_list:
        return None

    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    formatted = []

    for entry in hours_list:
        day_idx = entry.get("day", 0)
        start = entry.get("start", "")
        end = entry.get("end", "")

        if start and end:
            start_fmt = f"{start[:2]}:{start[2:]}"
            end_fmt = f"{end[:2]}:{end[2:]}"
            formatted.append(f"{days[day_idx]}: {start_fmt}-{end_fmt}")

    return "; ".join(formatted) if formatted else None


# Category mapping for common industries
YELP_CATEGORIES = {
    "fitness": "fitness,gyms",
    "restaurants": "restaurants",
    "auto_repair": "autorepair",
    "beauty": "beautysvc",
    "medical": "health",
    "legal": "lawyers",
    "accounting": "accountants",
    "real_estate": "realestate",
    "home_services": "homeservices",
    "pet_services": "pets",
}


def get_category_alias(industry: str) -> Optional[str]:
    """Map common industry names to Yelp category aliases."""
    industry_lower = industry.lower().replace(" ", "_").replace("-", "_")
    return YELP_CATEGORIES.get(industry_lower)
