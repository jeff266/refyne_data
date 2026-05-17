# Provider Onboarding Guide

This document outlines the standard process for adding a new data provider to the Enrichment Switcher.

## Quick Start Checklist

```
[ ] 1. Authentication & Setup
[ ] 2. Field Normalization
[ ] 3. Provider-Specific Fields
[ ] 4. Cost & Rate Limits
[ ] 5. Data Quality Config
[ ] 6. Error Handling
[ ] 7. Monitoring
[ ] 8. Documentation
```

---

## 1. Authentication & Setup

### API Key Configuration

Add the provider to `config/segments.json`:

```json
{
  "providers": {
    "new_provider": {
      "name": "New Provider",
      "type": "enrichment",
      "env_key": "NEW_PROVIDER_API_KEY",
      "description": "Brief description of what this provider does"
    }
  }
}
```

For OAuth providers with multiple credentials:

```json
{
  "new_provider": {
    "name": "New Provider",
    "type": "enrichment",
    "env_keys": ["NEW_PROVIDER_CLIENT_ID", "NEW_PROVIDER_CLIENT_SECRET"]
  }
}
```

### Environment Variables

Add to `.env.example`:

```bash
# New Provider - https://docs.newprovider.com
NEW_PROVIDER_API_KEY=your_api_key_here
```

### Connection Test

Implement a health check in `api/providers/{provider}.py`:

```python
async def test_connection() -> bool:
    """Test API connection with minimal quota usage."""
    try:
        # Make lightweight API call
        response = await client.get("/health")
        return response.status_code == 200
    except Exception:
        return False
```

---

## 2. Field Normalization

### Canonical Field Mapping

Map provider-specific field names to our standard schema:

```python
FIELD_MAPPING = {
    # Provider field -> Canonical field
    "business_name": "name",
    "company_name": "name",
    "organization": "name",
    "phone_number": "phone",
    "telephone": "phone",
    "street_address": "address",
    "website_url": "website",
    "url": "website",
    "num_employees": "employee_count",
    "headcount": "employee_count",
}
```

### NAICS Industry Mapping

If the provider has industry data, map to NAICS codes:

```python
# In lib/industry_taxonomy.py

PROVIDER_INDUSTRY_TO_NAICS = {
    "new_provider": {
        "Technology": "51",      # Information
        "Software": "5112",      # Software Publishers
        "SaaS": "5112",
        "Healthcare": "62",      # Health Care
        "Finance": "52",         # Finance and Insurance
        "Retail": "44-45",       # Retail Trade
        "Manufacturing": "31-33", # Manufacturing
        # ... add all mappings
    }
}
```

### Data Type Coercion

Handle type conversions in the transform function:

```python
def transform_response(data: dict) -> dict:
    return {
        "name": str(data.get("name", "")),
        "employee_count": safe_int(data.get("employees")),
        "revenue": safe_float(data.get("revenue")),
        "founded_year": safe_int(data.get("year_founded")),
        "is_public": safe_bool(data.get("public_company")),
    }

def safe_int(value) -> Optional[int]:
    try:
        return int(value) if value else None
    except (ValueError, TypeError):
        return None
```

---

## 3. Provider-Specific Fields

### Define Unique Fields

Add to `frontend/lib/providerFields.ts`:

```typescript
export const PROVIDER_OUTPUT_FIELDS: Record<string, ProviderField[]> = {
  new_provider: [
    // Standard fields (available from multiple providers)
    { key: 'name', label: 'Company Name', type: 'string', description: 'Business name' },
    { key: 'phone', label: 'Phone', type: 'string', description: 'Contact phone' },

    // UNIQUE fields only this provider offers
    { key: 'proprietary_score', label: 'Provider Score', type: 'number', description: 'Proprietary quality score (1-100)' },
    { key: 'unique_data_point', label: 'Special Data', type: 'string', description: 'Data only this provider has' },
  ],
};
```

### Update Provider Costs

```typescript
export const PROVIDER_COSTS: ProviderCost[] = [
  // ... existing providers
  { id: 'new_provider', name: 'New Provider', costPerRecord: 0.008, avgResponseMs: 1000 },
];
```

---

## 4. Cost & Rate Limits

### Rate Limit Configuration

```python
# In api/providers/{provider}.py

RATE_LIMITS = {
    "requests_per_second": 10,
    "requests_per_day": 10000,
    "points_per_day": None,  # If using point-based system
}

# Implement rate limiting
from asyncio import Semaphore
rate_limiter = Semaphore(RATE_LIMITS["requests_per_second"])

async def make_request(endpoint: str):
    async with rate_limiter:
        return await client.get(endpoint)
```

### Retry Logic

```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10)
)
async def fetch_with_retry(url: str):
    response = await client.get(url)
    response.raise_for_status()
    return response.json()
```

### Timeout Settings

```python
TIMEOUT_CONFIG = {
    "connect": 5.0,    # Connection timeout
    "read": 30.0,      # Read timeout
    "total": 45.0,     # Total request timeout
}
```

---

## 5. Data Quality Configuration

### Deduplication Keys

Define what makes a record unique:

```python
DEDUP_CONFIG = {
    "primary_key": "domain",           # Best identifier
    "fallback_keys": ["phone", "name"], # If domain unavailable
    "fuzzy_match_fields": ["name"],     # Fields to fuzzy match
    "fuzzy_threshold": 0.85,            # Match threshold (0-1)
}
```

### Coverage & Confidence

```python
def assess_record_quality(record: dict) -> dict:
    """Calculate quality metrics for a record."""

    must_have_fields = ["name", "phone", "address"]
    nice_to_have_fields = ["website", "employee_count", "revenue"]

    must_have_filled = sum(1 for f in must_have_fields if record.get(f))
    nice_to_have_filled = sum(1 for f in nice_to_have_fields if record.get(f))

    return {
        "fill_rate": (must_have_filled + nice_to_have_filled) /
                     (len(must_have_fields) + len(nice_to_have_fields)),
        "must_have_complete": must_have_filled == len(must_have_fields),
        "confidence": record.get("_confidence", 1.0),
        "last_verified": record.get("_last_verified"),
    }
```

---

## 6. Error Handling

### Error Code Mapping

```python
ERROR_MAPPING = {
    400: "invalid_request",
    401: "authentication_failed",
    403: "forbidden",
    404: "not_found",
    429: "rate_limited",
    500: "provider_error",
    503: "provider_unavailable",
}

class ProviderError(Exception):
    def __init__(self, code: str, message: str, retryable: bool = False):
        self.code = code
        self.message = message
        self.retryable = retryable
```

### Graceful Degradation

```python
async def enrich_with_fallback(record: dict) -> dict:
    """Try primary provider, fall back on failure."""
    try:
        return await primary_provider.enrich(record)
    except ProviderError as e:
        if e.retryable:
            raise  # Let retry logic handle it

        # Log and continue without this provider's data
        logger.warning(f"Provider failed, skipping: {e.message}")
        return record  # Return original record unchanged
```

---

## 7. Monitoring & Observability

### Usage Tracking

```python
from dataclasses import dataclass
from datetime import datetime

@dataclass
class ProviderMetrics:
    provider_id: str
    calls_today: int = 0
    calls_total: int = 0
    cost_today: float = 0.0
    avg_response_ms: float = 0.0
    error_rate: float = 0.0
    last_call: datetime = None

# Track in Redis or database
async def track_call(provider_id: str, duration_ms: float, success: bool, cost: float):
    metrics = await get_metrics(provider_id)
    metrics.calls_today += 1
    metrics.calls_total += 1
    metrics.cost_today += cost
    metrics.avg_response_ms = (metrics.avg_response_ms + duration_ms) / 2
    metrics.last_call = datetime.utcnow()
    if not success:
        metrics.error_rate = (metrics.error_rate + 1) / metrics.calls_today
    await save_metrics(metrics)
```

### Health Check Endpoint

```python
@router.get("/providers/{provider_id}/health")
async def provider_health(provider_id: str):
    """Check provider health status."""
    provider = get_provider(provider_id)

    start = time.time()
    is_healthy = await provider.test_connection()
    latency_ms = (time.time() - start) * 1000

    return {
        "provider": provider_id,
        "healthy": is_healthy,
        "latency_ms": latency_ms,
        "last_checked": datetime.utcnow().isoformat(),
    }
```

---

## 8. Documentation

### Provider Card Info

Add to `config/segments.json`:

```json
{
  "new_provider": {
    "name": "New Provider",
    "type": "enrichment",
    "description": "Brief description for admin UI",
    "docs_url": "https://docs.newprovider.com",
    "coverage": {
      "regions": ["US", "EU", "APAC"],
      "company_types": ["B2B", "B2C"],
      "data_freshness": "Updated weekly"
    },
    "best_for": ["Mid-market companies", "Tech industry"],
    "limitations": ["Limited international coverage"]
  }
}
```

### Sample Response

Include example data for testing:

```python
# In api/services/mock_data.py

MOCK_NEW_PROVIDER_RESPONSE = {
    "results": [
        {
            "name": "Acme Corp",
            "domain": "acme.com",
            "phone": "+1-555-123-4567",
            "employee_count": 150,
            "revenue": "$10M-$50M",
            "industry": "Technology",
            "proprietary_score": 87,
            "_source": "new_provider",
            "_confidence": 0.95,
        }
    ],
    "total": 1,
    "provider": "new_provider",
}
```

---

## File Checklist

When adding a new provider, create/update these files:

```
├── api/providers/{provider}.py          # Provider implementation
├── config/segments.json                  # Add to providers section
├── frontend/lib/providerFields.ts        # Add fields and costs
├── frontend/lib/industry_taxonomy.ts     # NAICS mappings (if applicable)
├── api/services/mock_data.py             # Test data
├── .env.example                          # Document env vars
└── tests/providers/test_{provider}.py    # Unit tests
```

---

## Testing New Providers

### Unit Tests

```python
# tests/providers/test_new_provider.py

import pytest
from api.providers.new_provider import search, transform_response

@pytest.mark.asyncio
async def test_search_returns_results():
    results = await search(query="test company", location="San Francisco")
    assert "results" in results
    assert len(results["results"]) > 0

def test_transform_normalizes_fields():
    raw = {"business_name": "Test", "phone_number": "555-1234"}
    transformed = transform_response(raw)
    assert transformed["name"] == "Test"
    assert transformed["phone"] == "555-1234"
```

### Integration Test

```python
@pytest.mark.integration
async def test_provider_in_cascade():
    """Test provider works in full cascade flow."""
    cascade = [
        {"providerId": "new_provider", "trigger": "always"},
        {"providerId": "apollo", "trigger": "on_missing_field", "triggerConfig": {"field": "email"}},
    ]

    results = await run_cascade(cascade, {"query": "software companies", "location": "Austin, TX"})
    assert results["provider"] == "new_provider"
```
