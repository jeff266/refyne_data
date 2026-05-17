"""Search router for enrichment and search operations."""

from typing import Optional, Literal

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, Field
import requests

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from api.dependencies import (
    inject_provider_keys,
    is_provider_available,
    get_serper_key,
    get_apollo_key,
    get_graphiq_key,
    get_clay_key,
)
from api.services.mock_data import (
    get_mock_smb_results,
    get_mock_company_results,
    get_mock_capability_results,
    get_mock_claygent_brief,
)
from providers import (
    search_local_businesses,
    apollo_enrich,
    apollo_contacts,
    zoominfo_enrich,
    search_by_capabilities,
    graphiq_search,
    generate_claygent_brief,
)

router = APIRouter(tags=["search"])


# Request/Response Models

class SMBSearchRequest(BaseModel):
    """Request model for SMB/local business search."""
    industry: str = Field(..., description="Business type (e.g., 'Fitness Centers')")
    location: str = Field(..., description="City, state, or zip code")
    num_results: int = Field(default=20, ge=1, le=100)
    test_mode: bool = Field(default=False, description="Enable test/sandbox mode with mock data")
    test_limit: int = Field(default=3, ge=1, le=10, description="Max results in test mode")


class SMBSearchResult(BaseModel):
    """Single SMB search result."""
    name: str
    address: str
    phone: Optional[str] = None
    website: Optional[str] = None
    rating: Optional[float] = None
    reviews: Optional[int] = None
    category: Optional[str] = None


class SMBSearchResponse(BaseModel):
    """Response model for SMB search."""
    results: list[SMBSearchResult]
    count: int
    query: str


class CompanySearchRequest(BaseModel):
    """Request model for company search/enrichment."""
    domain: Optional[str] = Field(None, description="Company domain (e.g., 'notion.com')")
    name: Optional[str] = Field(None, description="Company name")
    provider: Literal["apollo", "zoominfo", "graphiq"] = Field(
        default="apollo",
        description="Which provider to use for enrichment"
    )
    include_contacts: bool = Field(default=False, description="Include contact search")
    contact_titles: Optional[list[str]] = Field(
        None, description="Filter contacts by titles"
    )
    test_mode: bool = Field(default=False, description="Enable test/sandbox mode with mock data")
    test_limit: int = Field(default=3, ge=1, le=10, description="Max contacts in test mode")


class CompanyResult(BaseModel):
    """Company enrichment result."""
    name: str
    domain: Optional[str] = None
    industry: Optional[str] = None
    employee_count: Optional[int] = None
    revenue_range: Optional[str] = None
    revenue: Optional[str] = None
    founded_year: Optional[int] = None
    linkedin_url: Optional[str] = None
    description: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None


class ContactResult(BaseModel):
    """Contact search result."""
    name: str
    title: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    direct_dial: Optional[str] = None
    linkedin_url: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None


class CompanySearchResponse(BaseModel):
    """Response model for company search."""
    company: Optional[CompanyResult] = None
    contacts: list[ContactResult] = []
    provider: str


class CapabilitySearchRequest(BaseModel):
    """Request model for capability-based search."""
    capabilities: list[str] = Field(
        ..., description="List of capabilities to search for"
    )
    limit: int = Field(default=20, ge=1, le=100)
    test_mode: bool = Field(default=False, description="Enable test/sandbox mode with mock data")
    test_limit: int = Field(default=3, ge=1, le=10, description="Max results in test mode")


class CapabilityResult(BaseModel):
    """Capability search result."""
    name: str
    domain: Optional[str] = None
    description: Optional[str] = None
    capabilities: list[str] = []
    industry: Optional[str] = None
    location: Optional[str] = None
    employee_count: Optional[int] = None
    revenue: Optional[str] = None


class CapabilitySearchResponse(BaseModel):
    """Response model for capability search."""
    results: list[CapabilityResult]
    count: int
    searched_capabilities: list[str]


class ClaygentRequest(BaseModel):
    """Request model for Claygent AI brief generation."""
    company_name: str = Field(..., description="Name of the company")
    domain: Optional[str] = Field(None, description="Company domain")
    webhook_url: Optional[str] = Field(
        None, description="Custom Clay webhook URL (optional)"
    )
    test_mode: bool = Field(default=False, description="Enable test/sandbox mode with mock data")


class ClaygentBrief(BaseModel):
    """AI-generated intelligence brief."""
    summary: Optional[str] = None
    recent_news: Optional[list[str]] = None
    competitive_positioning: Optional[str] = None
    potential_pain_points: Optional[list[str]] = None
    recommended_approach: Optional[str] = None


class ClaygentResponse(BaseModel):
    """Response model for Claygent brief."""
    status: str
    company_name: str
    domain: Optional[str] = None
    brief: Optional[ClaygentBrief] = None
    note: Optional[str] = None


# Endpoints

@router.post("/search/smb", response_model=SMBSearchResponse)
async def search_smb(request: SMBSearchRequest):
    """Search for local/SMB businesses using Serper (Google Maps).

    Ideal for brick-and-mortar business prospecting.

    Set test_mode=True to return mock data without consuming API credits.
    """
    # Return mock data in test mode
    if request.test_mode:
        mock_results = get_mock_smb_results(
            industry=request.industry,
            location=request.location,
            limit=request.test_limit,
        )
        return SMBSearchResponse(
            results=mock_results,
            count=len(mock_results),
            query=f"{request.industry} in {request.location} (TEST MODE)",
        )

    # Inject keys before calling provider
    inject_provider_keys()

    if not is_provider_available("serper"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serper API key not configured",
        )

    try:
        results = search_local_businesses(
            industry=request.industry,
            location=request.location,
            num_results=request.num_results,
        )

        return SMBSearchResponse(
            results=results,
            count=len(results),
            query=f"{request.industry} in {request.location}",
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )
    except requests.RequestException as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Serper API error: {str(e)}",
        )


@router.post("/search/company", response_model=CompanySearchResponse)
async def search_company(request: CompanySearchRequest):
    """Enrich company data using Apollo, ZoomInfo, or GraphIQ.

    Choose provider based on your needs:
    - apollo: Good for mid-market, includes contact search
    - zoominfo: Enterprise-grade with verified contacts
    - graphiq: Capability-focused enrichment

    Set test_mode=True to return mock data without consuming API credits.
    """
    if not request.domain and not request.name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide either domain or name",
        )

    # Return mock data in test mode
    if request.test_mode:
        domain = request.domain or f"{request.name.lower().replace(' ', '')}.com"
        mock_data = get_mock_company_results(domain=domain, limit=request.test_limit)

        contacts = mock_data["contacts"] if request.include_contacts else []

        return CompanySearchResponse(
            company=CompanyResult(**mock_data["company"]) if mock_data.get("company") else None,
            contacts=[ContactResult(**c) for c in contacts],
            provider=f"{request.provider} (TEST MODE)",
        )

    # Inject keys before calling provider
    inject_provider_keys()

    provider = request.provider

    if not is_provider_available(provider):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"{provider.title()} API key not configured",
        )

    try:
        if provider == "apollo":
            company_data = apollo_enrich(
                domain=request.domain,
                name=request.name,
            )

            contacts = []
            if request.include_contacts and request.domain:
                contacts = apollo_contacts(
                    domain=request.domain,
                    titles=request.contact_titles,
                    limit=5,
                )

            return CompanySearchResponse(
                company=CompanyResult(**company_data) if company_data else None,
                contacts=[ContactResult(**c) for c in contacts],
                provider="apollo",
            )

        elif provider == "zoominfo":
            result = zoominfo_enrich(domain=request.domain)

            if result:
                company = result.get("company", {})
                contacts = result.get("contacts", [])
                return CompanySearchResponse(
                    company=CompanyResult(**company) if company else None,
                    contacts=[ContactResult(**c) for c in contacts],
                    provider="zoominfo",
                )
            else:
                return CompanySearchResponse(
                    company=None,
                    contacts=[],
                    provider="zoominfo",
                )

        elif provider == "graphiq":
            # GraphIQ general search
            results = graphiq_search(
                query=request.name,
                limit=1,
            )

            if results:
                company = results[0]
                return CompanySearchResponse(
                    company=CompanyResult(
                        name=company.get("name", ""),
                        domain=company.get("domain"),
                        industry=company.get("industry"),
                        employee_count=company.get("employee_count"),
                        revenue=company.get("revenue"),
                        description=company.get("description"),
                    ),
                    contacts=[],
                    provider="graphiq",
                )
            else:
                return CompanySearchResponse(
                    company=None,
                    contacts=[],
                    provider="graphiq",
                )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )
    except requests.RequestException as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"{provider.title()} API error: {str(e)}",
        )


@router.post("/search/capability", response_model=CapabilitySearchResponse)
async def search_by_capability(request: CapabilitySearchRequest):
    """Search for companies by their capabilities using GraphIQ.

    Great for finding vendors, suppliers, or partners with specific
    technical capabilities or expertise.

    Set test_mode=True to return mock data without consuming API credits.
    """
    # Return mock data in test mode
    if request.test_mode:
        mock_results = get_mock_capability_results(
            capabilities=request.capabilities,
            limit=request.test_limit,
        )
        return CapabilitySearchResponse(
            results=[CapabilityResult(**r) for r in mock_results],
            count=len(mock_results),
            searched_capabilities=request.capabilities,
        )

    # Inject keys before calling provider
    inject_provider_keys()

    if not is_provider_available("graphiq"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GraphIQ API key not configured",
        )

    try:
        results = search_by_capabilities(
            capabilities=request.capabilities,
            limit=request.limit,
        )

        return CapabilitySearchResponse(
            results=[CapabilityResult(**r) for r in results],
            count=len(results),
            searched_capabilities=request.capabilities,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )
    except requests.RequestException as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"GraphIQ API error: {str(e)}",
        )


@router.post("/enrich/claygent", response_model=ClaygentResponse)
async def enrich_with_claygent(request: ClaygentRequest):
    """Generate an AI intelligence brief using Clay's Claygent.

    Returns AI-generated insights including:
    - Company summary
    - Recent news and developments
    - Competitive positioning
    - Potential pain points
    - Recommended outreach approach

    Set test_mode=True to return mock data without consuming API credits.
    """
    # Return mock data in test mode
    if request.test_mode:
        mock_result = get_mock_claygent_brief(
            company_name=request.company_name,
            domain=request.domain,
        )
        brief_data = mock_result.get("brief", {})
        return ClaygentResponse(
            status=mock_result.get("status", "success"),
            company_name=mock_result.get("company_name", request.company_name),
            domain=mock_result.get("domain"),
            brief=ClaygentBrief(
                summary=brief_data.get("summary"),
                recent_news=brief_data.get("recent_news"),
                competitive_positioning=brief_data.get("competitive_positioning"),
                potential_pain_points=brief_data.get("potential_pain_points"),
                recommended_approach=brief_data.get("recommended_approach"),
            ) if brief_data else None,
            note="TEST MODE: This is mock data for testing purposes",
        )

    # Inject keys before calling provider
    inject_provider_keys()

    if not is_provider_available("clay"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Clay API key not configured",
        )

    try:
        result = generate_claygent_brief(
            company_name=request.company_name,
            domain=request.domain,
            webhook_url=request.webhook_url,
        )

        # Transform the result to match our response model
        brief_data = result.get("brief", {})
        return ClaygentResponse(
            status=result.get("status", "unknown"),
            company_name=result.get("company_name", request.company_name),
            domain=result.get("domain"),
            brief=ClaygentBrief(
                summary=brief_data.get("summary"),
                recent_news=brief_data.get("recent_news"),
                competitive_positioning=brief_data.get("competitive_positioning"),
                potential_pain_points=brief_data.get("potential_pain_points"),
                recommended_approach=brief_data.get("recommended_approach"),
            ) if brief_data else None,
            note=result.get("note"),
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )
    except requests.RequestException as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Clay API error: {str(e)}",
        )
