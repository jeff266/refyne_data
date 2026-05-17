"""ZoomInfo provider for Enterprise contact enrichment."""

import requests
from config import ZOOMINFO_CLIENT_ID, ZOOMINFO_CLIENT_SECRET

ZOOMINFO_AUTH_URL = "https://api.zoominfo.com/authenticate"
ZOOMINFO_ENRICH_URL = "https://api.zoominfo.com/enrich/company"
ZOOMINFO_CONTACTS_URL = "https://api.zoominfo.com/search/contact"

_access_token = None


def _get_access_token() -> str:
    """Get or refresh ZoomInfo access token."""
    global _access_token

    if not ZOOMINFO_CLIENT_ID or not ZOOMINFO_CLIENT_SECRET:
        raise ValueError("ZOOMINFO_CLIENT_ID and ZOOMINFO_CLIENT_SECRET not configured")

    if _access_token:
        return _access_token

    response = requests.post(
        ZOOMINFO_AUTH_URL,
        json={
            "username": ZOOMINFO_CLIENT_ID,
            "password": ZOOMINFO_CLIENT_SECRET,
        },
        timeout=30,
    )
    response.raise_for_status()

    data = response.json()
    _access_token = data.get("jwt")
    return _access_token


def enrich_company(domain: str) -> dict | None:
    """
    Enrich a company and get contacts using ZoomInfo.

    Args:
        domain: Company domain (e.g., "salesforce.com")

    Returns:
        Dict with company info and contacts, or None if not found
    """
    token = _get_access_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    # Enrich company
    company_response = requests.post(
        ZOOMINFO_ENRICH_URL,
        headers=headers,
        json={
            "matchCompanyInput": [{"companyWebsite": domain}],
            "outputFields": [
                "id", "name", "website", "industry", "employeeCount",
                "revenue", "city", "state", "country", "description"
            ],
        },
        timeout=30,
    )
    company_response.raise_for_status()

    company_data = company_response.json()
    companies = company_data.get("data", {}).get("result", [])

    if not companies:
        return None

    company = companies[0].get("data", [{}])[0] if companies[0].get("data") else {}

    # Search for contacts at this company
    contacts_response = requests.post(
        ZOOMINFO_CONTACTS_URL,
        headers=headers,
        json={
            "companyWebsite": [domain],
            "jobFunction": ["C-Level", "VP-Level", "Director"],
            "rpp": 10,
            "outputFields": [
                "id", "firstName", "lastName", "jobTitle", "email",
                "phone", "directPhoneNumber", "linkedinUrl"
            ],
        },
        timeout=30,
    )
    contacts_response.raise_for_status()

    contacts_data = contacts_response.json()
    contact_results = contacts_data.get("data", {}).get("result", [])

    contacts = []
    for contact in contact_results:
        contacts.append({
            "name": f"{contact.get('firstName', '')} {contact.get('lastName', '')}".strip(),
            "title": contact.get("jobTitle", ""),
            "email": contact.get("email", ""),
            "phone": contact.get("phone", ""),
            "direct_dial": contact.get("directPhoneNumber", ""),
            "linkedin_url": contact.get("linkedinUrl", ""),
        })

    return {
        "company": {
            "name": company.get("name", ""),
            "domain": company.get("website", domain),
            "industry": company.get("industry", ""),
            "employee_count": company.get("employeeCount"),
            "revenue": _format_revenue(company.get("revenue")),
            "city": company.get("city", ""),
            "state": company.get("state", ""),
            "country": company.get("country", ""),
            "description": company.get("description", ""),
        },
        "contacts": contacts,
    }


def _format_revenue(revenue) -> str:
    """Format revenue as readable string."""
    if not revenue:
        return "Unknown"
    try:
        revenue = float(revenue)
        if revenue >= 1_000_000_000:
            return f"${revenue / 1_000_000_000:.1f}B"
        if revenue >= 1_000_000:
            return f"${revenue / 1_000_000:.0f}M"
        if revenue >= 1_000:
            return f"${revenue / 1_000:.0f}K"
        return f"${revenue:.0f}"
    except (ValueError, TypeError):
        return str(revenue)
