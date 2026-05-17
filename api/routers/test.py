"""Test router for sandbox/test mode operations.

Provides endpoints for testing enrichment cascades and getting mock data
without consuming API credits or requiring actual provider keys.
"""

from typing import Optional, Literal
from datetime import datetime

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from api.services.mock_data import (
    get_mock_smb_results,
    get_mock_company_results,
    get_mock_capability_results,
    get_mock_claygent_brief,
    get_mock_cascade_results,
    get_mock_provider_data,
)

router = APIRouter(prefix="/test", tags=["test"])


# Request/Response Models

class ProviderConfig(BaseModel):
    """Configuration for a provider in a cascade."""
    provider: str = Field(..., description="Provider name (apollo, zoominfo, graphiq, serper, clay)")
    test_scenario: Literal["success", "error", "partial", "timeout", "rate_limited"] = Field(
        default="success",
        description="Test scenario to simulate for this provider"
    )
    priority: int = Field(default=1, ge=1, le=10, description="Priority in cascade (1 = highest)")


class CascadeConfig(BaseModel):
    """Configuration for a provider cascade."""
    name: str = Field(..., description="Name of the cascade configuration")
    providers: list[ProviderConfig] = Field(..., description="List of providers in cascade order")
    stop_on_success: bool = Field(default=True, description="Stop cascade on first successful result")


class TestCase(BaseModel):
    """A test case for cascade execution."""
    name: str = Field(..., description="Test case name")
    domain: Optional[str] = Field(None, description="Company domain to test")
    company_name: Optional[str] = Field(None, description="Company name to test")
    industry: Optional[str] = Field(None, description="Industry for SMB search")
    location: Optional[str] = Field(None, description="Location for SMB search")
    expected_outcome: Optional[str] = Field(None, description="Expected result description")


class CascadeTestRequest(BaseModel):
    """Request model for cascade testing."""
    cascade_config: CascadeConfig
    test_cases: list[TestCase]


class CascadeResult(BaseModel):
    """Result from a single cascade execution."""
    test_case: str
    results: list[dict]
    final_status: str
    total_latency_ms: int
    providers_called: int


class CascadeTestResponse(BaseModel):
    """Response model for cascade testing."""
    cascade_name: str
    test_results: list[CascadeResult]
    summary: dict


class MockDataRequest(BaseModel):
    """Request for custom mock data generation."""
    count: int = Field(default=3, ge=1, le=20, description="Number of mock records")
    include_contacts: bool = Field(default=False, description="Include contact data")
    industry: Optional[str] = Field(None, description="Industry filter")
    location: Optional[str] = Field(None, description="Location filter")


# Endpoints

@router.post("/cascade", response_model=CascadeTestResponse)
async def test_cascade(request: CascadeTestRequest):
    """Run cascade through test cases and return results.

    This endpoint simulates cascade execution with mock data,
    allowing you to test cascade configurations without consuming
    actual API credits.

    Test scenarios available:
    - success: Provider returns complete data
    - error: Provider returns an error
    - partial: Provider returns incomplete data
    - timeout: Provider times out
    - rate_limited: Provider is rate limited
    """
    test_results = []

    for test_case in request.test_cases:
        # Build provider list in cascade order
        cascade = [
            {"provider": p.provider, "test_scenario": p.test_scenario}
            for p in sorted(request.cascade_config.providers, key=lambda x: x.priority)
        ]

        # Execute mock cascade
        results = get_mock_cascade_results(
            cascade=cascade,
            test_case=test_case.model_dump(),
        )

        # Calculate totals
        total_latency = sum(r.get("latency_ms", 0) for r in results)
        final_status = results[-1].get("status", "unknown") if results else "no_providers"

        test_results.append(CascadeResult(
            test_case=test_case.name,
            results=results,
            final_status=final_status,
            total_latency_ms=total_latency,
            providers_called=len(results),
        ))

    # Generate summary
    successful = sum(1 for r in test_results if r.final_status == "success")
    failed = sum(1 for r in test_results if r.final_status in ["error", "timeout", "rate_limited"])
    partial = sum(1 for r in test_results if r.final_status == "partial")

    return CascadeTestResponse(
        cascade_name=request.cascade_config.name,
        test_results=test_results,
        summary={
            "total_tests": len(test_results),
            "successful": successful,
            "failed": failed,
            "partial": partial,
            "avg_latency_ms": sum(r.total_latency_ms for r in test_results) // len(test_results) if test_results else 0,
            "avg_providers_called": sum(r.providers_called for r in test_results) / len(test_results) if test_results else 0,
        },
    )


@router.get("/mock-data/{provider}")
async def get_provider_mock_data(
    provider: str,
    scenario: Literal["success", "error", "partial", "timeout", "rate_limited", "empty"] = "success"
):
    """Get mock data for a specific provider and scenario.

    Use this to understand what mock responses look like for different
    providers and scenarios.

    Supported providers:
    - apollo: Company and contact enrichment
    - zoominfo: Enterprise company/contact data
    - graphiq: Capability-based search
    - serper: Local business search
    - clay: AI-generated briefs

    Scenarios:
    - success: Complete successful response
    - error: Error response
    - partial: Partial data response
    - timeout: Timeout response
    - rate_limited: Rate limit response
    - empty: No results found
    """
    valid_providers = ["apollo", "zoominfo", "graphiq", "serper", "clay"]

    if provider.lower() not in valid_providers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid provider. Must be one of: {', '.join(valid_providers)}",
        )

    return {
        "provider": provider,
        "scenario": scenario,
        "mock_data": get_mock_provider_data(provider.lower(), scenario),
        "note": "This is mock data for testing purposes",
    }


@router.post("/mock-data/smb")
async def generate_mock_smb_data(request: MockDataRequest):
    """Generate custom mock SMB/local business data.

    Use this to generate mock SMB search results with custom parameters.
    """
    industry = request.industry or "Restaurants"
    location = request.location or "New York, NY"

    results = get_mock_smb_results(
        industry=industry,
        location=location,
        limit=request.count,
    )

    return {
        "query": f"{industry} in {location}",
        "results": results,
        "count": len(results),
        "is_mock": True,
    }


@router.post("/mock-data/company")
async def generate_mock_company_data(
    domain: str = "example.com",
    include_contacts: bool = True,
    contact_limit: int = 3
):
    """Generate custom mock company enrichment data.

    Use this to generate mock company data with custom parameters.
    """
    result = get_mock_company_results(domain=domain, limit=contact_limit)

    if not include_contacts:
        result["contacts"] = []

    return {
        "domain": domain,
        "result": result,
        "is_mock": True,
    }


@router.post("/mock-data/capability")
async def generate_mock_capability_data(
    capabilities: list[str],
    limit: int = 3
):
    """Generate custom mock capability search data.

    Use this to generate mock capability search results.
    """
    if not capabilities:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide at least one capability",
        )

    results = get_mock_capability_results(capabilities=capabilities, limit=limit)

    return {
        "searched_capabilities": capabilities,
        "results": results,
        "count": len(results),
        "is_mock": True,
    }


@router.post("/mock-data/claygent")
async def generate_mock_claygent_data(
    company_name: str,
    domain: Optional[str] = None
):
    """Generate custom mock Claygent AI brief.

    Use this to generate mock AI-generated intelligence briefs.
    """
    result = get_mock_claygent_brief(company_name=company_name, domain=domain)

    return {
        "company_name": company_name,
        "domain": domain,
        "result": result,
        "is_mock": True,
    }


@router.get("/scenarios")
async def list_test_scenarios():
    """List all available test scenarios and their descriptions."""
    return {
        "scenarios": {
            "success": "Provider returns complete, valid data",
            "error": "Provider returns an error (API error, invalid response, etc.)",
            "partial": "Provider returns incomplete data (some fields missing)",
            "timeout": "Provider request times out (30s default)",
            "rate_limited": "Provider returns rate limit error (429)",
            "empty": "Provider returns success but with no results",
        },
        "providers": {
            "apollo": "Company and contact enrichment - good for mid-market",
            "zoominfo": "Enterprise-grade company and contact data",
            "graphiq": "Capability-based company search",
            "serper": "Local/SMB business search via Google Maps",
            "clay": "AI-generated intelligence briefs (Claygent)",
        },
        "usage": {
            "cascade_testing": "POST /test/cascade - Test cascade configurations",
            "mock_data": "GET /test/mock-data/{provider} - Get mock data for a provider",
            "custom_mock": "POST /test/mock-data/{type} - Generate custom mock data",
        },
    }
