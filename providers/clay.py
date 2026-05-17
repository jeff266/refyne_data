"""Clay provider for Claygent AI-generated intelligence briefs."""

import requests
from config import CLAY_API_KEY

CLAY_BASE_URL = "https://api.clay.com/v3/sources/webhook"


def generate_claygent_brief(
    company_name: str,
    domain: str = None,
    webhook_url: str = None,
) -> dict:
    """
    Trigger a Claygent run to generate an AI intelligence brief.

    This uses Clay's webhook API to add a row that triggers a Claygent table.
    You'll need to set up a Clay table with Claygent enrichment columns.

    Args:
        company_name: Name of the company
        domain: Company domain (optional but recommended)
        webhook_url: Clay webhook URL (uses CLAY_WEBHOOK_URL env var if not provided)

    Returns:
        Dict with status and any immediate response data
    """
    if not CLAY_API_KEY:
        raise ValueError("CLAY_API_KEY not configured")

    # For the PoC, we'll use Clay's HTTP API to trigger enrichment
    # In production, you'd have a dedicated Claygent table set up

    payload = {
        "company_name": company_name,
    }
    if domain:
        payload["domain"] = domain

    # If a specific webhook URL is provided, use it
    # Otherwise, use the standard Clay API to create a table row
    if webhook_url:
        response = requests.post(
            webhook_url,
            json=payload,
            timeout=30,
        )
        response.raise_for_status()
        return {"status": "triggered", "data": response.json()}

    # Alternative: Use Clay's direct API (requires table setup)
    # This is a placeholder that shows the expected brief structure
    return _generate_mock_brief(company_name, domain)


def _generate_mock_brief(company_name: str, domain: str = None) -> dict:
    """
    Generate a mock Claygent brief for demo purposes.
    Replace this with actual Clay API integration.
    """
    return {
        "status": "complete",
        "company_name": company_name,
        "domain": domain or "unknown",
        "brief": {
            "summary": f"AI-generated intelligence brief for {company_name}. "
                      "In production, this would contain Claygent's analysis.",
            "recent_news": [
                "Recent funding, product launches, or leadership changes would appear here.",
            ],
            "competitive_positioning": "Analysis of market position and competitive landscape.",
            "potential_pain_points": [
                "Scaling challenges identified from public information",
                "Technology modernization needs",
                "Market expansion opportunities",
            ],
            "recommended_approach": "Personalized outreach strategy based on company context.",
        },
        "note": "This is a mock response. Configure CLAY_WEBHOOK_URL to connect to your Claygent table.",
    }


def check_claygent_status(run_id: str) -> dict:
    """
    Check the status of a Claygent run.

    Args:
        run_id: The ID returned from generate_claygent_brief

    Returns:
        Status dict with completion state and results if ready
    """
    # Placeholder for async status checking
    # Clay's API would be polled here in production
    return {
        "status": "complete",
        "run_id": run_id,
    }
