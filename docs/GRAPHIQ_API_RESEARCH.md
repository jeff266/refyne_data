# GraphiqAI API Research

> Research conducted: 2026-05-15
> Status: In Progress - Limited Public Documentation Available

## Executive Summary

GraphiqAI (graphiq.ai) is a B2B knowledge graph platform founded in 2023 by Jens Tellefsen (CEO) and Malcolm De Leo (CBO). The platform provides access to a massive knowledge graph containing organizational data across 280M+ companies and 940M+ professionals.

**Important Note:** GraphiqAI (graphiq.ai) is a **different company** from the original Graphiq (FindTheBest) that was acquired by Amazon in 2017 for ~$50M. The new GraphiqAI is an independent company founded in 2023.

This research documents findings from:
1. Analysis of the existing GraphiqAI provider implementation in this codebase
2. Web research on publicly available information
3. Reverse-engineering hypotheses based on UI filter categories mentioned by the user

---

## Table of Contents

1. [Known API Details](#1-known-api-details)
2. [UI Filter Categories Analysis](#2-ui-filter-categories-analysis)
3. [Natural Language Search API](#3-natural-language-search-api)
4. [Hypothesized Undocumented Endpoints](#4-hypothesized-undocumented-endpoints)
5. [Filter Parameter Hypotheses](#5-filter-parameter-hypotheses)
6. [Comparable API Patterns](#6-comparable-api-patterns)
7. [Recommendations for Further Research](#7-recommendations-for-further-research)

---

## 1. Known API Details

### 1.1 Base Configuration (from existing codebase)

```python
# Current implementation in providers/graphiq.py
GRAPHIQ_BASE_URL = "https://app.graphiq.ai/api/v2"

# Authentication
headers = {
    "X-API-Key": GRAPHIQ_API_KEY,
    "Content-Type": "application/json",
}
```

### 1.2 Documented Endpoint: Organizations Search

**Endpoint:** `POST /organizations/search`

**Known Request Payload Structure:**
```json
{
  "organization": {
    "capabilities": ["capability1", "capability2"],
    "query": "free text search",
    "industry": "industry filter",
    "location": "location filter"
  },
  "limit": 20
}
```

**Known Response Structure:**
```json
{
  "entities": [
    {
      "name": "Company Name",
      "website": "example.com",
      "domain": "example.com",
      "description": "Company description",
      "capabilities": ["cap1", "cap2"],
      "industry": "Software",
      "city": "Austin",
      "state": "TX",
      "country": "USA",
      "location": "Austin, TX",
      "employee_count": 500,
      "employees": 500,
      "revenue": "$10M-$50M"
    }
  ]
}
```

### 1.3 Known Filter Parameters

Based on the existing implementation, these filters are confirmed working:

| Parameter | Type | Description |
|-----------|------|-------------|
| `capabilities` | array[string] | Technical capabilities/expertise to search for |
| `query` | string | Free text search query |
| `industry` | string | Industry filter |
| `location` | string | Location filter (city, state, country) |
| `limit` | integer | Max results to return |

---

## 2. UI Filter Categories Analysis

The user reported these filter categories visible in the app.graphiq.ai UI:

| UI Category | Data Volume | Hypothesized API Parameter | Likely Values/Type |
|-------------|-------------|---------------------------|-------------------|
| Organizations | 295M | `organization` (object) | Root filter object |
| People | 366M | `person` or `people` (object) | Contact search filter |
| Capabilities | - | `capabilities` (array) | **CONFIRMED** - Free text array |
| Technologies | - | `technologies` or `tech_stack` | Array of technology names |
| Funding | - | `funding` or `funding_stage` | Object with stage/amount filters |
| Industries | - | `industry` or `industries` | **CONFIRMED** - String or array |
| Locations | - | `location` or `locations` | **CONFIRMED** - String or geo object |
| Revenue | - | `revenue` or `revenue_range` | Range object or enum string |
| Employees | - | `employee_count` or `employee_range` | Range object or enum string |
| Types | - | `organization_type` or `type` | Array of company types |
| Tags | - | `tags` | Array of categorical tags |
| News | - | `news_signals` or `news` | Object with event type filters |

---

## 3. Natural Language Search API

### 3.1 Hypothesis: AI Search Endpoint

Based on the UI description showing natural language queries like:
- "Find all VCs in Bay Area"
- "Show tech companies with 100-500 employees in Austin"
- "Find SaaS companies with revenue over $10M"

**Hypothesized Endpoint:** `POST /organizations/ai-search` or `POST /search/natural`

**Hypothesized Request Structure:**
```json
{
  "query": "Find SaaS companies with revenue over $10M in Austin",
  "limit": 20,
  "output_format": "organizations"
}
```

**Alternative Structure (query + structured filters):**
```json
{
  "natural_language_query": "tech companies with good funding",
  "filters": {
    "location": "Austin, TX",
    "employee_range": [100, 500]
  },
  "limit": 20
}
```

### 3.2 Research Notes

Many modern B2B data APIs in 2026 support natural language search interfaces:
- Native MCP server support for AI agents (Claude, ChatGPT, Cursor)
- Semantic search with 30+ structured filters
- AI-powered lookalike company discovery

GraphiqAI's founding team has expertise in NLP and knowledge graphs, making a natural language endpoint highly likely.

---

## 4. Hypothesized Undocumented Endpoints

Based on UI features and common B2B data API patterns:

### 4.1 Organization Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/organizations/search` | POST | **CONFIRMED** - Search/filter organizations |
| `/organizations/{id}` | GET | Get single organization details |
| `/organizations/enrich` | POST | Enrich by domain/name |
| `/organizations/lookalike` | POST | Find similar companies |
| `/organizations/ai-search` | POST | Natural language search |

### 4.2 People/Contacts Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/people/search` | POST | Search contacts by filters |
| `/people/{id}` | GET | Get single person details |
| `/people/enrich` | POST | Enrich contact by email/LinkedIn |

### 4.3 News/Signals Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/news/search` | POST | Search news articles |
| `/signals/company/{id}` | GET | Get signals for a company |
| `/signals/search` | POST | Search by signal type |

### 4.4 Relationship/Graph Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/organizations/{id}/subsidiaries` | GET | Get child companies |
| `/organizations/{id}/parent` | GET | Get parent company |
| `/organizations/{id}/relationships` | GET | Get all relationships |
| `/graph/explore` | POST | Knowledge graph traversal |

---

## 5. Filter Parameter Hypotheses

### 5.1 Extended Organization Filter Schema

Based on UI categories and industry-standard patterns:

```json
{
  "organization": {
    // Text Search
    "query": "string - free text search",
    "name": "string - company name filter",

    // Capabilities (CONFIRMED)
    "capabilities": ["array", "of", "capabilities"],

    // Technologies (HYPOTHESIZED)
    "technologies": ["Salesforce", "AWS", "React"],
    "tech_stack": {
      "includes": ["Salesforce"],
      "excludes": ["HubSpot"]
    },

    // Funding (HYPOTHESIZED)
    "funding": {
      "stage": ["seed", "series_a", "series_b", "series_c", "ipo"],
      "total_raised_min": 1000000,
      "total_raised_max": 50000000,
      "last_funding_date_after": "2024-01-01"
    },

    // Industry (CONFIRMED base filter)
    "industry": "string or array",
    "industries": ["Software", "SaaS", "FinTech"],
    "naics_codes": ["5112", "5415"],
    "sic_codes": ["7372"],

    // Location (CONFIRMED base filter)
    "location": "string - city, state, country",
    "locations": {
      "countries": ["USA", "Canada"],
      "states": ["TX", "CA"],
      "cities": ["Austin", "San Francisco"],
      "metro_areas": ["Bay Area", "Austin-Round Rock"],
      "exclude": ["New York"]
    },
    "headquarters_only": true,

    // Revenue (HYPOTHESIZED)
    "revenue": {
      "min": 1000000,
      "max": 100000000,
      "range": "$10M-$50M"
    },
    "revenue_range": ["$1M-$10M", "$10M-$50M"],

    // Employee Count (HYPOTHESIZED)
    "employee_count": {
      "min": 50,
      "max": 500
    },
    "employee_range": ["51-200", "201-500"],

    // Organization Type (HYPOTHESIZED)
    "type": ["private", "public", "subsidiary", "non_profit"],
    "organization_type": "private",

    // Tags (HYPOTHESIZED)
    "tags": ["saas", "b2b", "enterprise", "startup"],

    // News/Signals (HYPOTHESIZED)
    "news_signals": {
      "types": ["funding", "acquisition", "hiring", "product_launch"],
      "date_after": "2024-01-01"
    }
  },
  "limit": 20,
  "offset": 0,
  "sort_by": "relevance",
  "sort_order": "desc"
}
```

### 5.2 People Filter Schema (Hypothesized)

```json
{
  "person": {
    "query": "string - name or keyword search",
    "title": "VP Sales",
    "titles": ["VP Sales", "Director of Sales", "CRO"],
    "function": ["sales", "marketing", "engineering"],
    "level": ["c_level", "vp", "director", "manager"],
    "seniority": "senior",
    "skills": ["salesforce", "enterprise sales"],

    // Company association
    "organization_id": "string",
    "organization_domain": "example.com",

    // Location
    "location": "Austin, TX",
    "locations": {
      "countries": ["USA"],
      "states": ["TX", "CA"]
    }
  },
  "limit": 20,
  "include_contact_info": true
}
```

---

## 6. Comparable API Patterns

### 6.1 People Data Labs Schema (Reference)

PDL uses these field names which may inform GraphiqAI's schema:

```
Core: id, name, display_name, website, headline, summary
Industry: industry, naics, sic
Financials: total_funding_raised, funding_stages, latest_funding_stage, inferred_revenue
Size: employee_count, size (range enum)
Location: location (object with locality, region, country, coordinates)
Tags: tags (array of categorical labels)
Type: type (public/private/subsidiary)
```

### 6.2 Crustdata Filter Pattern (Reference)

Uses structured filter objects:
```json
{
  "filters": [
    {
      "filter_type": "COMPANY_HEADCOUNT",
      "type": "between",
      "value": [50, 500]
    },
    {
      "filter_type": "ANNUAL_REVENUE",
      "type": "in",
      "value": ["$10M-$50M", "$50M-$100M"]
    }
  ]
}
```

### 6.3 Apollo.io Filter Pattern (Reference)

Uses direct field names:
```json
{
  "organization_num_employees_ranges": ["11-50", "51-200"],
  "organization_latest_funding_stage_cd": ["seed", "series_a"],
  "q_organization_keyword_tags": ["saas", "b2b"]
}
```

---

## 7. Recommendations for Further Research

### 7.1 Network Traffic Analysis

To discover undocumented endpoints, inspect browser network traffic:

1. Open app.graphiq.ai in Chrome DevTools
2. Go to Network tab, filter by XHR/Fetch
3. Perform various searches and filter selections
4. Document all API calls with full request/response

**Key interactions to capture:**
- [ ] AI search box submission
- [ ] Each filter category selection
- [ ] Pagination
- [ ] Organization detail view
- [ ] People search
- [ ] News/signals tab

### 7.2 JavaScript Bundle Analysis

Search for API patterns in JS bundles:

```bash
# Download and search main JS bundle
curl -s "https://app.graphiq.ai/_next/static/chunks/main.js" | grep -o '/api/v[0-9]*/[a-z/]*'
```

Look for:
- API endpoint strings
- Filter parameter names
- Request payload builders
- Response type definitions

### 7.3 OpenAPI/Swagger Discovery

Common documentation URLs to check:
- `https://app.graphiq.ai/api/docs`
- `https://app.graphiq.ai/api/swagger`
- `https://app.graphiq.ai/api/openapi.json`
- `https://api.graphiq.ai/docs`
- `https://docs.graphiq.ai`

### 7.4 Contact GraphiqAI

For official documentation:
- Book a demo: https://graphiq.ai/book-a-demo
- Contact: https://graphiq.ai/contact
- Request API documentation access

---

## Appendix A: Current Implementation Code

Location: `/Users/jeffignacio/enrichment-switcher/providers/graphiq.py`

```python
"""GraphiqAI provider for capability-based company search."""

import requests
from config import GRAPHIQ_API_KEY

GRAPHIQ_BASE_URL = "https://app.graphiq.ai/api/v2"


def search_by_capabilities(
    capabilities: list[str],
    limit: int = 20,
) -> list[dict]:
    """Search for organizations by their capabilities/expertise."""
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
    return data.get("entities", [])


def search_organizations(
    query: str = None,
    industry: str = None,
    location: str = None,
    limit: int = 20,
) -> list[dict]:
    """General organization search with multiple filters."""
    # Implementation supports: query, industry, location
    pass
```

---

## Appendix B: Hypothesized Extended Implementation

```python
"""Extended GraphiqAI provider with hypothesized additional filters."""

def search_organizations_extended(
    # Text search
    query: str = None,
    name: str = None,

    # CONFIRMED filters
    capabilities: list[str] = None,
    industry: str = None,
    location: str = None,

    # HYPOTHESIZED filters
    technologies: list[str] = None,
    funding_stage: list[str] = None,
    funding_min: int = None,
    funding_max: int = None,
    revenue_range: list[str] = None,
    employee_min: int = None,
    employee_max: int = None,
    organization_type: list[str] = None,
    tags: list[str] = None,
    news_signal_types: list[str] = None,

    # Pagination
    limit: int = 20,
    offset: int = 0,
) -> list[dict]:
    """Extended organization search with all hypothesized filters."""

    org_filter = {}

    # Text search
    if query:
        org_filter["query"] = query
    if name:
        org_filter["name"] = name

    # Confirmed filters
    if capabilities:
        org_filter["capabilities"] = capabilities
    if industry:
        org_filter["industry"] = industry
    if location:
        org_filter["location"] = location

    # Hypothesized filters - try these to validate
    if technologies:
        org_filter["technologies"] = technologies

    if funding_stage or funding_min or funding_max:
        org_filter["funding"] = {}
        if funding_stage:
            org_filter["funding"]["stage"] = funding_stage
        if funding_min:
            org_filter["funding"]["total_raised_min"] = funding_min
        if funding_max:
            org_filter["funding"]["total_raised_max"] = funding_max

    if revenue_range:
        org_filter["revenue_range"] = revenue_range

    if employee_min or employee_max:
        org_filter["employee_count"] = {}
        if employee_min:
            org_filter["employee_count"]["min"] = employee_min
        if employee_max:
            org_filter["employee_count"]["max"] = employee_max

    if organization_type:
        org_filter["type"] = organization_type

    if tags:
        org_filter["tags"] = tags

    if news_signal_types:
        org_filter["news_signals"] = {"types": news_signal_types}

    payload = {
        "organization": org_filter,
        "limit": limit,
        "offset": offset,
    }

    # Make request...
    pass


def ai_search(
    natural_language_query: str,
    limit: int = 20,
    entity_type: str = "organizations",  # or "people"
) -> list[dict]:
    """
    Natural language search endpoint (HYPOTHESIZED).

    Examples:
        - "Find all VCs in Bay Area"
        - "Show tech companies with 100-500 employees in Austin"
        - "Find SaaS companies with revenue over $10M"
    """
    payload = {
        "query": natural_language_query,
        "limit": limit,
        "output_format": entity_type,
    }

    # Hypothesized endpoint
    response = requests.post(
        f"{GRAPHIQ_BASE_URL}/search/natural",  # or /organizations/ai-search
        headers=headers,
        json=payload,
        timeout=30,
    )

    return response.json().get("entities", [])
```

---

## Appendix C: Testing Strategy

### Validate Hypothesized Filters

```python
# Test each hypothesized filter one at a time
test_cases = [
    # Technologies filter
    {"organization": {"technologies": ["Salesforce"]}, "limit": 5},

    # Funding filter (object style)
    {"organization": {"funding": {"stage": ["series_a"]}}, "limit": 5},

    # Funding filter (array style)
    {"organization": {"funding_stage": ["series_a"]}, "limit": 5},

    # Revenue filter (range style)
    {"organization": {"revenue_range": ["$10M-$50M"]}, "limit": 5},

    # Revenue filter (min/max style)
    {"organization": {"revenue": {"min": 10000000, "max": 50000000}}, "limit": 5},

    # Employee filter (range style)
    {"organization": {"employee_range": ["51-200"]}, "limit": 5},

    # Employee filter (min/max style)
    {"organization": {"employee_count": {"min": 50, "max": 200}}, "limit": 5},

    # Type filter
    {"organization": {"type": ["private"]}, "limit": 5},

    # Tags filter
    {"organization": {"tags": ["saas", "b2b"]}, "limit": 5},
]

# Test AI search endpoint variations
ai_endpoints = [
    "/search/natural",
    "/organizations/ai-search",
    "/ai/search",
    "/search/ai",
]
```

---

## References

- GraphiqAI Website: https://graphiq.ai/
- GraphiqAI About: https://graphiq.ai/about
- LinkedIn: https://www.linkedin.com/company/graphiq-ai
- People Data Labs Schema: https://docs.peopledatalabs.com/docs/company-schema
- Common B2B Data API Patterns: Industry research 2026
