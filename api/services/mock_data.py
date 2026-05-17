"""Mock data service for sandbox/test mode.

Provides realistic mock data for testing enrichment operations
without consuming API credits or requiring actual provider keys.
"""

from typing import Optional
from datetime import datetime


def get_mock_smb_results(industry: str, location: str, limit: int = 3) -> list:
    """Return realistic mock SMB results for testing.

    Args:
        industry: Business type (e.g., 'Fitness Centers')
        location: City, state, or zip code
        limit: Maximum number of results to return

    Returns:
        List of mock SMB business results
    """
    mock_results = [
        {
            "name": f"Test {industry} 1",
            "address": f"123 Main St, {location}",
            "phone": "555-0001",
            "website": "test1.com",
            "rating": 4.2,
            "reviews": 127,
            "category": industry,
        },
        {
            "name": f"Test {industry} 2",
            "address": f"456 Oak Ave, {location}",
            "phone": "555-0002",
            "website": "test2.com",
            "rating": 3.8,
            "reviews": 89,
            "category": industry,
        },
        {
            "name": f"Test {industry} 3",
            "address": f"789 Pine Rd, {location}",
            "phone": None,
            "website": None,
            "rating": 4.5,
            "reviews": 203,
            "category": industry,
        },
        {
            "name": f"Premier {industry}",
            "address": f"100 Business Park Dr, {location}",
            "phone": "555-0004",
            "website": f"premier-{industry.lower().replace(' ', '-')}.com",
            "rating": 4.8,
            "reviews": 342,
            "category": industry,
        },
        {
            "name": f"{industry} Express",
            "address": f"250 Commerce Blvd, {location}",
            "phone": "555-0005",
            "website": None,
            "rating": 3.5,
            "reviews": 56,
            "category": industry,
        },
    ]
    return mock_results[:limit]


def get_mock_company_results(domain: str, limit: int = 3) -> dict:
    """Return mock company enrichment for testing.

    Args:
        domain: Company domain (e.g., 'notion.com')
        limit: Maximum number of contacts to include

    Returns:
        Dict with company data and contacts
    """
    company_name = domain.split('.')[0].title() if domain else "Test Company"

    return {
        "company": {
            "name": f"{company_name} Inc.",
            "domain": domain,
            "industry": "Software & Technology",
            "employee_count": 250,
            "revenue_range": "$10M - $50M",
            "revenue": "$25M",
            "founded_year": 2015,
            "linkedin_url": f"https://linkedin.com/company/{company_name.lower()}",
            "description": f"{company_name} is a leading provider of innovative solutions in the technology sector.",
            "city": "San Francisco",
            "state": "CA",
            "country": "United States",
        },
        "contacts": [
            {
                "name": "Jane Smith",
                "title": "CEO",
                "email": f"jane.smith@{domain}",
                "phone": "555-1001",
                "direct_dial": "555-1001-ext1",
                "linkedin_url": "https://linkedin.com/in/janesmith",
                "city": "San Francisco",
                "state": "CA",
            },
            {
                "name": "John Doe",
                "title": "VP of Sales",
                "email": f"john.doe@{domain}",
                "phone": "555-1002",
                "direct_dial": None,
                "linkedin_url": "https://linkedin.com/in/johndoe",
                "city": "San Francisco",
                "state": "CA",
            },
            {
                "name": "Sarah Johnson",
                "title": "Director of Marketing",
                "email": f"sarah.johnson@{domain}",
                "phone": None,
                "direct_dial": None,
                "linkedin_url": "https://linkedin.com/in/sarahjohnson",
                "city": "New York",
                "state": "NY",
            },
        ][:limit],
    }


def get_mock_capability_results(capabilities: list, limit: int = 3) -> list:
    """Return mock capability search results for testing.

    Args:
        capabilities: List of capabilities to search for
        limit: Maximum number of results to return

    Returns:
        List of mock companies matching capabilities
    """
    capability_str = ", ".join(capabilities[:2])

    mock_results = [
        {
            "name": "TechCorp Solutions",
            "domain": "techcorp.com",
            "description": f"Leading provider of {capability_str} solutions for enterprise customers.",
            "capabilities": capabilities,
            "industry": "Software",
            "location": "Austin, TX",
            "employee_count": 500,
            "revenue": "$50M",
        },
        {
            "name": "Innovation Labs",
            "domain": "innovationlabs.io",
            "description": f"Startup specializing in {capabilities[0] if capabilities else 'technology'} with cutting-edge approaches.",
            "capabilities": capabilities[:2] if len(capabilities) > 1 else capabilities,
            "industry": "Technology",
            "location": "Boston, MA",
            "employee_count": 75,
            "revenue": "$8M",
        },
        {
            "name": "Enterprise Systems Inc",
            "domain": "enterprisesystems.com",
            "description": f"Enterprise-grade {capability_str} for Fortune 500 companies.",
            "capabilities": capabilities,
            "industry": "Enterprise Software",
            "location": "Seattle, WA",
            "employee_count": 1200,
            "revenue": "$150M",
        },
    ]
    return mock_results[:limit]


def get_mock_claygent_brief(company_name: str, domain: Optional[str] = None) -> dict:
    """Return mock Claygent AI brief for testing.

    Args:
        company_name: Name of the company
        domain: Optional company domain

    Returns:
        Dict with mock AI-generated brief
    """
    return {
        "status": "success",
        "company_name": company_name,
        "domain": domain,
        "brief": {
            "summary": f"{company_name} is a growing company in their industry, showing strong indicators of expansion and innovation.",
            "recent_news": [
                f"{company_name} announced Q3 expansion plans",
                f"New partnership between {company_name} and major industry player",
                f"{company_name} recognized for workplace innovation",
            ],
            "competitive_positioning": f"{company_name} positions themselves as an innovative challenger in their market segment, competing on product quality and customer service.",
            "potential_pain_points": [
                "Scaling infrastructure to meet growing demand",
                "Integrating new technology stack",
                "Improving operational efficiency",
            ],
            "recommended_approach": f"Lead with ROI-focused messaging. {company_name} is likely evaluating solutions that can demonstrate clear cost savings or revenue impact.",
        },
        "note": "This is mock data for testing purposes",
    }


def get_mock_cascade_results(cascade: list, test_case: dict) -> list:
    """Simulate cascade execution with mock data.

    Args:
        cascade: List of provider configurations in the cascade
        test_case: Test case input data

    Returns:
        List of results from simulated cascade execution
    """
    results = []

    for i, provider_config in enumerate(cascade):
        provider_name = provider_config.get("provider", f"provider_{i}")
        scenario = provider_config.get("test_scenario", "success")

        if scenario == "success":
            results.append({
                "provider": provider_name,
                "status": "success",
                "data": {
                    "name": test_case.get("name", "Test Company"),
                    "domain": test_case.get("domain", "test.com"),
                    "enriched_by": provider_name,
                    "timestamp": datetime.utcnow().isoformat(),
                },
                "latency_ms": 150 + (i * 50),
            })
            break  # Cascade stops on first success
        elif scenario == "partial":
            results.append({
                "provider": provider_name,
                "status": "partial",
                "data": {
                    "name": test_case.get("name", "Test Company"),
                    "enriched_by": provider_name,
                    "timestamp": datetime.utcnow().isoformat(),
                },
                "latency_ms": 200 + (i * 50),
            })
            # Continue to next provider for missing data
        elif scenario == "error":
            results.append({
                "provider": provider_name,
                "status": "error",
                "error": f"Mock error from {provider_name}",
                "latency_ms": 100,
            })
            # Continue to next provider on error
        elif scenario == "timeout":
            results.append({
                "provider": provider_name,
                "status": "timeout",
                "error": f"Request to {provider_name} timed out after 30s",
                "latency_ms": 30000,
            })
            # Continue to next provider on timeout
        elif scenario == "rate_limited":
            results.append({
                "provider": provider_name,
                "status": "rate_limited",
                "error": f"Rate limit exceeded for {provider_name}",
                "latency_ms": 50,
            })
            # Continue to next provider on rate limit

    return results


def get_mock_provider_data(provider: str, scenario: str = "success") -> dict:
    """Get mock data for a specific provider and scenario.

    Args:
        provider: Provider name (apollo, zoominfo, graphiq, serper, clay)
        scenario: Test scenario (success, error, partial, timeout, rate_limited, empty)

    Returns:
        Dict with mock provider response
    """
    base_data = {
        "apollo": {
            "success": {
                "company": {
                    "name": "Apollo Test Company",
                    "domain": "apollo-test.com",
                    "industry": "Software",
                    "employee_count": 150,
                    "revenue": "$15M",
                },
                "contacts": [
                    {"name": "Test Contact", "title": "CEO", "email": "test@apollo-test.com"}
                ],
            },
            "partial": {
                "company": {
                    "name": "Apollo Test Company",
                    "domain": "apollo-test.com",
                },
                "contacts": [],
            },
        },
        "zoominfo": {
            "success": {
                "company": {
                    "name": "ZoomInfo Test Company",
                    "domain": "zi-test.com",
                    "industry": "Enterprise Software",
                    "employee_count": 500,
                    "revenue": "$75M",
                },
                "contacts": [
                    {"name": "ZI Contact", "title": "VP Sales", "email": "contact@zi-test.com"}
                ],
            },
            "partial": {
                "company": {
                    "name": "ZoomInfo Test Company",
                    "domain": "zi-test.com",
                },
                "contacts": [],
            },
        },
        "graphiq": {
            "success": {
                "results": [
                    {
                        "name": "GraphIQ Test Company",
                        "domain": "graphiq-test.com",
                        "capabilities": ["AI/ML", "Data Analytics"],
                        "industry": "Technology",
                    }
                ],
            },
            "partial": {
                "results": [
                    {
                        "name": "GraphIQ Test Company",
                        "capabilities": ["AI/ML"],
                    }
                ],
            },
        },
        "serper": {
            "success": {
                "results": [
                    {
                        "name": "Serper Test Business",
                        "address": "123 Test St",
                        "phone": "555-0000",
                        "rating": 4.5,
                    }
                ],
            },
            "partial": {
                "results": [
                    {
                        "name": "Serper Test Business",
                        "address": "123 Test St",
                    }
                ],
            },
        },
        "clay": {
            "success": {
                "status": "success",
                "brief": {
                    "summary": "Clay test company summary",
                    "recent_news": ["Test news item"],
                    "potential_pain_points": ["Test pain point"],
                },
            },
            "partial": {
                "status": "partial",
                "brief": {
                    "summary": "Clay test company summary",
                },
            },
        },
    }

    error_responses = {
        "error": {
            "status": "error",
            "error": f"Mock error from {provider}",
            "code": "MOCK_ERROR",
        },
        "timeout": {
            "status": "timeout",
            "error": f"Request to {provider} timed out",
            "code": "TIMEOUT",
        },
        "rate_limited": {
            "status": "rate_limited",
            "error": f"Rate limit exceeded for {provider}",
            "code": "RATE_LIMIT",
            "retry_after": 60,
        },
        "empty": {
            "status": "success",
            "data": None,
            "message": "No results found",
        },
    }

    if scenario in error_responses:
        return error_responses[scenario]

    provider_data = base_data.get(provider, {})
    return provider_data.get(scenario, provider_data.get("success", {"status": "unknown_provider"}))
