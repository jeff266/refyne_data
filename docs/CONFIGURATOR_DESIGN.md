# Enrichment Switcher Backend Configurator Design

## Overview

This document outlines the architecture for a backend configurator system that enables administrators to:
1. Define and manage market segments
2. Configure provider cascades (waterfall logic) per segment
3. Set up field-level provider preferences
4. Define deduplication and merge strategies

The system is designed with JSON file storage for simplicity, with a clear migration path to database-backed storage.

---

## Table of Contents

1. [Data Structures & Schema](#1-data-structures--schema)
2. [Configuration Storage](#2-configuration-storage)
3. [Provider Cascade Execution](#3-provider-cascade-execution)
4. [Deduplication Logic](#4-deduplication-logic)
5. [Frontend Integration](#5-frontend-integration)
6. [Example Configuration](#6-example-configuration)
7. [Migration Path](#7-migration-path)

---

## 1. Data Structures & Schema

### 1.1 Master Configuration Schema

```python
# config/schema.py

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

class ProviderType(Enum):
    """Available enrichment providers"""
    SERPER = "serper"
    APOLLO = "apollo"
    ZOOMINFO = "zoominfo"
    GRAPHIQ = "graphiq"
    CLAY = "clay"

class MatchStrategy(Enum):
    """Deduplication matching strategies"""
    DOMAIN_EXACT = "domain_exact"           # Exact domain match
    DOMAIN_NORMALIZED = "domain_normalized"  # Normalized (strip www, subdomains)
    NAME_EXACT = "name_exact"                # Exact company name match
    NAME_FUZZY = "name_fuzzy"                # Fuzzy name matching (Levenshtein)
    COMPOSITE = "composite"                  # Domain + Name combined

class MergeStrategy(Enum):
    """How to merge results from multiple providers"""
    FIRST_WINS = "first_wins"        # Keep first non-null value
    LAST_WINS = "last_wins"          # Keep last non-null value
    PRIORITY = "priority"            # Use provider priority order
    MOST_COMPLETE = "most_complete"  # Keep record with most fields
    MANUAL = "manual"                # Flag for manual review


@dataclass
class SegmentDisplay:
    """Display configuration for a segment"""
    name: str                        # Display name (e.g., "SMB & Local")
    description: str                 # Description text
    icon: str = "building"           # Icon identifier (emoji or icon name)
    color: str = "#000000"           # Hex color for UI
    order: int = 0                   # Display order (lower = first)
    visible: bool = True             # Show/hide in frontend
    badge_text: Optional[str] = None # Optional badge (e.g., "Beta")


@dataclass
class FieldMapping:
    """Maps a standardized field to provider-specific fields"""
    standard_field: str              # Our normalized field name
    provider: ProviderType           # Which provider to pull from
    provider_field: str              # Provider's field name
    fallback_providers: list[ProviderType] = field(default_factory=list)
    transform: Optional[str] = None  # Optional transform function name


@dataclass
class ProviderConfig:
    """Configuration for a single provider in the cascade"""
    provider: ProviderType
    priority: int                    # Lower = higher priority
    enabled: bool = True
    timeout_ms: int = 30000          # Request timeout
    retry_count: int = 2
    fields_to_fetch: list[str] = field(default_factory=list)  # Empty = all fields
    conditions: dict = field(default_factory=dict)  # When to use this provider


@dataclass
class CascadeConfig:
    """Provider cascade (waterfall) configuration"""
    providers: list[ProviderConfig]
    stop_on_success: bool = False    # Stop after first successful provider
    parallel_execution: bool = False # Run providers in parallel
    merge_results: bool = True       # Merge results from all providers
    merge_strategy: MergeStrategy = MergeStrategy.PRIORITY


@dataclass
class DeduplicationConfig:
    """Configuration for deduplication logic"""
    enabled: bool = True
    match_strategy: MatchStrategy = MatchStrategy.DOMAIN_NORMALIZED
    fuzzy_threshold: float = 0.85    # For fuzzy matching (0-1)
    merge_duplicates: bool = True
    merge_strategy: MergeStrategy = MergeStrategy.MOST_COMPLETE
    manual_review_threshold: float = 0.7  # Below this, flag for review


@dataclass
class SegmentConfig:
    """Complete configuration for a market segment"""
    id: str                          # Unique identifier (e.g., "smb_local")
    display: SegmentDisplay
    cascade: CascadeConfig
    deduplication: DeduplicationConfig
    field_mappings: list[FieldMapping] = field(default_factory=list)
    input_fields: list[dict] = field(default_factory=list)  # UI input fields
    metadata: dict = field(default_factory=dict)


@dataclass
class EnrichmentConfig:
    """Root configuration object"""
    version: str = "1.0.0"
    segments: list[SegmentConfig] = field(default_factory=list)
    global_settings: dict = field(default_factory=dict)
```

### 1.2 Standardized Output Schema

All providers map to this normalized company schema:

```python
@dataclass
class EnrichedCompany:
    """Standardized company data structure"""
    # Identifiers
    id: Optional[str] = None
    domain: Optional[str] = None
    domain_normalized: Optional[str] = None

    # Basic Info
    name: str = ""
    legal_name: Optional[str] = None
    description: Optional[str] = None

    # Location
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None

    # Firmographics
    industry: Optional[str] = None
    naics_code: Optional[str] = None
    sic_code: Optional[str] = None
    employee_count: Optional[int] = None
    employee_range: Optional[str] = None
    revenue: Optional[float] = None
    revenue_range: Optional[str] = None
    founded_year: Optional[int] = None

    # Contact Info
    phone: Optional[str] = None
    website: Optional[str] = None
    linkedin_url: Optional[str] = None

    # Additional
    rating: Optional[float] = None          # For local businesses
    reviews_count: Optional[int] = None     # For local businesses
    capabilities: list[str] = field(default_factory=list)  # For GraphiqAI

    # Metadata
    source_provider: Optional[str] = None
    source_providers: list[str] = field(default_factory=list)
    enriched_at: Optional[str] = None
    confidence_score: Optional[float] = None


@dataclass
class EnrichedContact:
    """Standardized contact data structure"""
    id: Optional[str] = None
    name: str = ""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    title: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    direct_dial: Optional[str] = None
    linkedin_url: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    source_provider: Optional[str] = None
```

---

## 2. Configuration Storage

### 2.1 File-Based Storage (Initial Implementation)

Configuration stored in `config/enrichment_config.json`:

```
enrichment-switcher/
├── config/
│   ├── enrichment_config.json     # Main configuration
│   ├── enrichment_config.schema.json  # JSON Schema for validation
│   └── segments/                  # Optional: split configs per segment
│       ├── smb_local.json
│       ├── mid_market.json
│       └── enterprise.json
```

### 2.2 Configuration Loader

```python
# config/loader.py

import json
from pathlib import Path
from typing import Optional
from .schema import EnrichmentConfig, SegmentConfig

class ConfigLoader:
    """Load and manage enrichment configuration"""

    CONFIG_FILE = Path(__file__).parent / "enrichment_config.json"

    _instance: Optional['ConfigLoader'] = None
    _config: Optional[EnrichmentConfig] = None
    _loaded_at: Optional[float] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def load(self, force_reload: bool = False) -> EnrichmentConfig:
        """Load configuration from file"""
        if self._config and not force_reload:
            return self._config

        with open(self.CONFIG_FILE, 'r') as f:
            data = json.load(f)

        self._config = self._parse_config(data)
        self._loaded_at = time.time()
        return self._config

    def get_segment(self, segment_id: str) -> Optional[SegmentConfig]:
        """Get configuration for a specific segment"""
        config = self.load()
        for segment in config.segments:
            if segment.id == segment_id:
                return segment
        return None

    def get_visible_segments(self) -> list[SegmentConfig]:
        """Get all visible segments, ordered by display order"""
        config = self.load()
        visible = [s for s in config.segments if s.display.visible]
        return sorted(visible, key=lambda s: s.display.order)

    def _parse_config(self, data: dict) -> EnrichmentConfig:
        """Parse JSON data into typed config objects"""
        # Implementation converts dict to dataclass instances
        ...

    def save(self, config: EnrichmentConfig) -> None:
        """Save configuration back to file"""
        data = self._serialize_config(config)
        with open(self.CONFIG_FILE, 'w') as f:
            json.dump(data, f, indent=2)

    def validate(self, config: EnrichmentConfig) -> list[str]:
        """Validate configuration, return list of errors"""
        errors = []

        # Check for duplicate segment IDs
        ids = [s.id for s in config.segments]
        if len(ids) != len(set(ids)):
            errors.append("Duplicate segment IDs found")

        # Validate provider configurations
        for segment in config.segments:
            for provider_config in segment.cascade.providers:
                if not self._is_provider_available(provider_config.provider):
                    errors.append(
                        f"Provider {provider_config.provider} not available "
                        f"for segment {segment.id}"
                    )

        return errors
```

### 2.3 Hot Reload Support

```python
# config/watcher.py

import time
import threading
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

class ConfigWatcher:
    """Watch for configuration file changes and trigger reload"""

    def __init__(self, loader: ConfigLoader, callback=None):
        self.loader = loader
        self.callback = callback
        self._observer = None

    def start(self):
        """Start watching for config changes"""
        event_handler = ConfigChangeHandler(self.loader, self.callback)
        self._observer = Observer()
        self._observer.schedule(
            event_handler,
            str(self.loader.CONFIG_FILE.parent),
            recursive=False
        )
        self._observer.start()

    def stop(self):
        """Stop watching"""
        if self._observer:
            self._observer.stop()
            self._observer.join()


class ConfigChangeHandler(FileSystemEventHandler):
    def __init__(self, loader, callback):
        self.loader = loader
        self.callback = callback
        self._debounce_timer = None

    def on_modified(self, event):
        if event.src_path.endswith('enrichment_config.json'):
            # Debounce rapid changes
            if self._debounce_timer:
                self._debounce_timer.cancel()
            self._debounce_timer = threading.Timer(
                1.0,
                self._reload_config
            )
            self._debounce_timer.start()

    def _reload_config(self):
        self.loader.load(force_reload=True)
        if self.callback:
            self.callback()
```

---

## 3. Provider Cascade Execution

### 3.1 Cascade Executor

```python
# enrichment/executor.py

import asyncio
from typing import Optional
from dataclasses import dataclass
from config.schema import SegmentConfig, ProviderConfig, ProviderType

@dataclass
class ProviderResult:
    """Result from a single provider call"""
    provider: ProviderType
    success: bool
    data: Optional[dict] = None
    error: Optional[str] = None
    latency_ms: float = 0
    fields_populated: list[str] = None


class CascadeExecutor:
    """Execute provider cascade with waterfall/parallel logic"""

    def __init__(self, segment_config: SegmentConfig):
        self.config = segment_config
        self.cascade = segment_config.cascade

    async def execute(self, input_data: dict) -> dict:
        """
        Execute the provider cascade and return merged results.

        Args:
            input_data: Search criteria (domain, name, location, etc.)

        Returns:
            Merged enrichment results
        """
        results: list[ProviderResult] = []

        if self.cascade.parallel_execution:
            results = await self._execute_parallel(input_data)
        else:
            results = await self._execute_waterfall(input_data)

        # Merge results based on strategy
        if self.cascade.merge_results:
            return self._merge_results(results)
        else:
            # Return first successful result
            for result in results:
                if result.success and result.data:
                    return result.data
            return {}

    async def _execute_waterfall(self, input_data: dict) -> list[ProviderResult]:
        """Execute providers in sequence (waterfall)"""
        results = []

        # Sort by priority
        providers = sorted(
            self.cascade.providers,
            key=lambda p: p.priority
        )

        for provider_config in providers:
            if not provider_config.enabled:
                continue

            # Check conditions
            if not self._check_conditions(provider_config, input_data):
                continue

            result = await self._call_provider(provider_config, input_data)
            results.append(result)

            # Stop on first success if configured
            if self.cascade.stop_on_success and result.success:
                break

        return results

    async def _execute_parallel(self, input_data: dict) -> list[ProviderResult]:
        """Execute all providers in parallel"""
        providers = [
            p for p in self.cascade.providers
            if p.enabled and self._check_conditions(p, input_data)
        ]

        tasks = [
            self._call_provider(p, input_data)
            for p in providers
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Convert exceptions to error results
        return [
            r if isinstance(r, ProviderResult)
            else ProviderResult(
                provider=providers[i].provider,
                success=False,
                error=str(r)
            )
            for i, r in enumerate(results)
        ]

    async def _call_provider(
        self,
        config: ProviderConfig,
        input_data: dict
    ) -> ProviderResult:
        """Call a single provider with timeout and retry logic"""
        import time
        start = time.time()

        provider_map = {
            ProviderType.SERPER: self._call_serper,
            ProviderType.APOLLO: self._call_apollo,
            ProviderType.ZOOMINFO: self._call_zoominfo,
            ProviderType.GRAPHIQ: self._call_graphiq,
        }

        handler = provider_map.get(config.provider)
        if not handler:
            return ProviderResult(
                provider=config.provider,
                success=False,
                error=f"No handler for provider {config.provider}"
            )

        last_error = None
        for attempt in range(config.retry_count + 1):
            try:
                data = await asyncio.wait_for(
                    handler(input_data, config),
                    timeout=config.timeout_ms / 1000
                )

                latency = (time.time() - start) * 1000
                return ProviderResult(
                    provider=config.provider,
                    success=True,
                    data=data,
                    latency_ms=latency,
                    fields_populated=list(data.keys()) if data else []
                )

            except asyncio.TimeoutError:
                last_error = "Timeout"
            except Exception as e:
                last_error = str(e)

        return ProviderResult(
            provider=config.provider,
            success=False,
            error=last_error,
            latency_ms=(time.time() - start) * 1000
        )

    def _check_conditions(
        self,
        config: ProviderConfig,
        input_data: dict
    ) -> bool:
        """Check if provider should be used based on conditions"""
        conditions = config.conditions

        # Example conditions:
        # {"has_domain": true} - only if domain is provided
        # {"employee_count_min": 100} - only for larger companies
        # {"location_required": true} - only if location is provided

        if conditions.get("has_domain") and not input_data.get("domain"):
            return False

        if conditions.get("has_name") and not input_data.get("name"):
            return False

        if conditions.get("location_required") and not input_data.get("location"):
            return False

        return True

    def _merge_results(self, results: list[ProviderResult]) -> dict:
        """Merge results from multiple providers"""
        if not results:
            return {}

        successful = [r for r in results if r.success and r.data]
        if not successful:
            return {}

        strategy = self.cascade.merge_strategy

        if strategy == MergeStrategy.FIRST_WINS:
            return self._merge_first_wins(successful)
        elif strategy == MergeStrategy.LAST_WINS:
            return self._merge_last_wins(successful)
        elif strategy == MergeStrategy.PRIORITY:
            return self._merge_by_priority(successful)
        elif strategy == MergeStrategy.MOST_COMPLETE:
            return self._merge_most_complete(successful)
        else:
            return successful[0].data

    def _merge_by_priority(self, results: list[ProviderResult]) -> dict:
        """Merge with priority order - higher priority providers override"""
        # Sort by provider priority (lower number = higher priority)
        provider_priority = {
            p.provider: p.priority
            for p in self.cascade.providers
        }
        sorted_results = sorted(
            results,
            key=lambda r: provider_priority.get(r.provider, 999),
            reverse=True  # Lower priority first, so higher can override
        )

        merged = {}
        source_providers = []

        for result in sorted_results:
            for key, value in result.data.items():
                if value is not None and value != "":
                    merged[key] = value
            source_providers.append(result.provider.value)

        merged["_source_providers"] = source_providers
        return merged

    # Provider-specific call methods
    async def _call_serper(self, input_data: dict, config: ProviderConfig) -> dict:
        """Call Serper API"""
        from providers.serper import search_local_businesses

        results = search_local_businesses(
            industry=input_data.get("industry", ""),
            location=input_data.get("location", ""),
            num_results=input_data.get("num_results", 20)
        )
        return {"results": results, "count": len(results)}

    async def _call_apollo(self, input_data: dict, config: ProviderConfig) -> dict:
        """Call Apollo API"""
        from providers.apollo import enrich_company, search_contacts

        company = enrich_company(
            domain=input_data.get("domain"),
            name=input_data.get("name")
        )

        contacts = []
        if company and company.get("domain"):
            contacts = search_contacts(company["domain"], limit=5)

        return {"company": company, "contacts": contacts}

    async def _call_zoominfo(self, input_data: dict, config: ProviderConfig) -> dict:
        """Call ZoomInfo API"""
        from providers.zoominfo import enrich_company

        return enrich_company(domain=input_data.get("domain"))

    async def _call_graphiq(self, input_data: dict, config: ProviderConfig) -> dict:
        """Call GraphiqAI API"""
        from providers.graphiq import search_by_capabilities, search_organizations

        if input_data.get("capabilities"):
            results = search_by_capabilities(
                capabilities=input_data["capabilities"],
                limit=input_data.get("num_results", 20)
            )
        else:
            results = search_organizations(
                query=input_data.get("query"),
                industry=input_data.get("industry"),
                location=input_data.get("location"),
                limit=input_data.get("num_results", 20)
            )

        return {"results": results, "count": len(results)}
```

### 3.2 Cascade Flow Diagram

```
                    ┌─────────────────────────────────────┐
                    │           Input Request              │
                    │  (domain, name, location, etc.)      │
                    └─────────────────┬───────────────────┘
                                      │
                    ┌─────────────────▼───────────────────┐
                    │        Load Segment Config           │
                    │     (from enrichment_config.json)    │
                    └─────────────────┬───────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
              ▼                       ▼                       ▼
    ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
    │ WATERFALL MODE  │     │ PARALLEL MODE   │     │  SINGLE MODE    │
    │                 │     │                 │     │                 │
    │ P1 → P2 → P3    │     │ P1 ──┐          │     │     P1 only     │
    │ (stop on first  │     │ P2 ──┼──► Merge │     │                 │
    │  success if     │     │ P3 ──┘          │     │                 │
    │  configured)    │     │                 │     │                 │
    └────────┬────────┘     └────────┬────────┘     └────────┬────────┘
              │                       │                       │
              └───────────────────────┼───────────────────────┘
                                      │
                    ┌─────────────────▼───────────────────┐
                    │         Merge Strategy               │
                    │  ┌─────────────────────────────────┐│
                    │  │ FIRST_WINS: Keep first non-null ││
                    │  │ PRIORITY: Use provider order    ││
                    │  │ MOST_COMPLETE: Most fields wins ││
                    │  └─────────────────────────────────┘│
                    └─────────────────┬───────────────────┘
                                      │
                    ┌─────────────────▼───────────────────┐
                    │       Deduplication (if enabled)     │
                    │         (domain match, fuzzy name)   │
                    └─────────────────┬───────────────────┘
                                      │
                    ┌─────────────────▼───────────────────┐
                    │         Normalized Output            │
                    │      (EnrichedCompany schema)        │
                    └─────────────────────────────────────┘
```

---

## 4. Deduplication Logic

### 4.1 Deduplication Engine

```python
# enrichment/deduplication.py

import re
from difflib import SequenceMatcher
from typing import Optional
from urllib.parse import urlparse
from config.schema import DeduplicationConfig, MatchStrategy, MergeStrategy

class DeduplicationEngine:
    """Handle deduplication of enrichment results"""

    def __init__(self, config: DeduplicationConfig):
        self.config = config

    def deduplicate(self, records: list[dict]) -> list[dict]:
        """
        Deduplicate a list of records.

        Returns deduplicated list with merged records where appropriate.
        """
        if not self.config.enabled or len(records) <= 1:
            return records

        # Group records by match key
        groups = self._group_by_match(records)

        # Merge or select from each group
        result = []
        for group in groups.values():
            if len(group) == 1:
                result.append(group[0])
            else:
                merged = self._merge_group(group)
                result.append(merged)

        return result

    def find_duplicates(
        self,
        record: dict,
        existing_records: list[dict]
    ) -> list[tuple[dict, float]]:
        """
        Find potential duplicates of a record in existing records.

        Returns list of (record, confidence_score) tuples.
        """
        duplicates = []

        for existing in existing_records:
            score = self._calculate_match_score(record, existing)
            if score >= self.config.fuzzy_threshold:
                duplicates.append((existing, score))

        return sorted(duplicates, key=lambda x: x[1], reverse=True)

    def _group_by_match(self, records: list[dict]) -> dict[str, list[dict]]:
        """Group records by their match key"""
        groups = {}

        for record in records:
            key = self._get_match_key(record)
            if key not in groups:
                groups[key] = []
            groups[key].append(record)

        return groups

    def _get_match_key(self, record: dict) -> str:
        """Generate a match key for a record based on strategy"""
        strategy = self.config.match_strategy

        if strategy == MatchStrategy.DOMAIN_EXACT:
            return record.get("domain", "").lower()

        elif strategy == MatchStrategy.DOMAIN_NORMALIZED:
            return self._normalize_domain(record.get("domain", ""))

        elif strategy == MatchStrategy.NAME_EXACT:
            return record.get("name", "").lower().strip()

        elif strategy == MatchStrategy.NAME_FUZZY:
            # For fuzzy matching, we can't use exact grouping
            # Return a normalized version for initial grouping
            return self._normalize_name(record.get("name", ""))

        elif strategy == MatchStrategy.COMPOSITE:
            domain = self._normalize_domain(record.get("domain", ""))
            name = self._normalize_name(record.get("name", ""))
            return f"{domain}|{name}"

        return str(id(record))  # Fallback: no grouping

    def _normalize_domain(self, domain: str) -> str:
        """Normalize a domain for matching"""
        if not domain:
            return ""

        # Parse and extract main domain
        if not domain.startswith(('http://', 'https://')):
            domain = f"https://{domain}"

        try:
            parsed = urlparse(domain)
            host = parsed.netloc or parsed.path
        except:
            host = domain

        # Remove www prefix
        host = re.sub(r'^www\.', '', host.lower())

        # Remove common suffixes for matching
        # e.g., notion.com and notion.so should potentially match
        # This is configurable behavior

        return host

    def _normalize_name(self, name: str) -> str:
        """Normalize a company name for matching"""
        if not name:
            return ""

        name = name.lower().strip()

        # Remove common suffixes
        suffixes = [
            r'\s+(inc\.?|llc|ltd\.?|corp\.?|co\.?|company|corporation)$',
            r'\s+(incorporated|limited)$',
        ]
        for pattern in suffixes:
            name = re.sub(pattern, '', name, flags=re.IGNORECASE)

        # Remove special characters
        name = re.sub(r'[^\w\s]', '', name)

        # Collapse whitespace
        name = re.sub(r'\s+', ' ', name).strip()

        return name

    def _calculate_match_score(self, record1: dict, record2: dict) -> float:
        """Calculate similarity score between two records"""
        scores = []

        # Domain match (high weight)
        domain1 = self._normalize_domain(record1.get("domain", ""))
        domain2 = self._normalize_domain(record2.get("domain", ""))
        if domain1 and domain2:
            if domain1 == domain2:
                scores.append(1.0)
            else:
                scores.append(0.0)

        # Name match (fuzzy)
        name1 = self._normalize_name(record1.get("name", ""))
        name2 = self._normalize_name(record2.get("name", ""))
        if name1 and name2:
            name_score = SequenceMatcher(None, name1, name2).ratio()
            scores.append(name_score)

        # Location match (if available)
        loc1 = f"{record1.get('city', '')} {record1.get('state', '')}".strip()
        loc2 = f"{record2.get('city', '')} {record2.get('state', '')}".strip()
        if loc1 and loc2:
            loc_score = SequenceMatcher(None, loc1.lower(), loc2.lower()).ratio()
            scores.append(loc_score * 0.5)  # Lower weight

        return sum(scores) / len(scores) if scores else 0.0

    def _merge_group(self, records: list[dict]) -> dict:
        """Merge a group of duplicate records"""
        if len(records) == 1:
            return records[0]

        strategy = self.config.merge_strategy

        if strategy == MergeStrategy.FIRST_WINS:
            return self._merge_first_wins(records)

        elif strategy == MergeStrategy.LAST_WINS:
            return self._merge_last_wins(records)

        elif strategy == MergeStrategy.MOST_COMPLETE:
            return self._merge_most_complete(records)

        elif strategy == MergeStrategy.MANUAL:
            # Flag for manual review
            merged = self._merge_most_complete(records)
            merged["_needs_review"] = True
            merged["_duplicate_sources"] = [
                r.get("source_provider") for r in records
            ]
            return merged

        return records[0]

    def _merge_first_wins(self, records: list[dict]) -> dict:
        """Keep first non-null value for each field"""
        merged = {}
        for record in records:
            for key, value in record.items():
                if key not in merged and value is not None and value != "":
                    merged[key] = value
        return merged

    def _merge_last_wins(self, records: list[dict]) -> dict:
        """Keep last non-null value for each field"""
        merged = {}
        for record in records:
            for key, value in record.items():
                if value is not None and value != "":
                    merged[key] = value
        return merged

    def _merge_most_complete(self, records: list[dict]) -> dict:
        """Start with most complete record, fill gaps from others"""
        # Find most complete record
        def completeness(r):
            return sum(1 for v in r.values() if v is not None and v != "")

        sorted_records = sorted(records, key=completeness, reverse=True)

        merged = dict(sorted_records[0])
        for record in sorted_records[1:]:
            for key, value in record.items():
                if merged.get(key) in (None, "") and value not in (None, ""):
                    merged[key] = value

        return merged
```

---

## 5. Frontend Integration

### 5.1 Configuration API Endpoints

```python
# api/config_routes.py (FastAPI example)

from fastapi import APIRouter, HTTPException
from config.loader import ConfigLoader
from config.schema import SegmentConfig, SegmentDisplay

router = APIRouter(prefix="/api/config")
loader = ConfigLoader()

@router.get("/segments")
def get_segments():
    """Get all visible segments for frontend display"""
    segments = loader.get_visible_segments()
    return {
        "segments": [
            {
                "id": s.id,
                "display": {
                    "name": s.display.name,
                    "description": s.display.description,
                    "icon": s.display.icon,
                    "color": s.display.color,
                    "badge_text": s.display.badge_text,
                },
                "input_fields": s.input_fields,
            }
            for s in segments
        ]
    }

@router.get("/segments/{segment_id}")
def get_segment(segment_id: str):
    """Get full configuration for a specific segment"""
    segment = loader.get_segment(segment_id)
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    return segment

@router.get("/segments/{segment_id}/providers")
def get_segment_providers(segment_id: str):
    """Get provider status for a segment"""
    segment = loader.get_segment(segment_id)
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    from config import check_provider_configured

    providers = []
    for p in segment.cascade.providers:
        providers.append({
            "provider": p.provider.value,
            "priority": p.priority,
            "enabled": p.enabled,
            "configured": check_provider_configured(p.provider.value),
        })

    return {"providers": providers}
```

### 5.2 Frontend Integration (Streamlit Example)

```python
# app.py integration

from config.loader import ConfigLoader

config_loader = ConfigLoader()

def render_segment_selection():
    """Dynamically render segment cards from configuration"""
    segments = config_loader.get_visible_segments()

    cols = st.columns(len(segments))

    for col, segment in zip(cols, segments):
        with col:
            # Render card using config
            st.markdown(f"""
            <div class="result-card" style="border-left: 4px solid {segment.display.color}">
                <h3 style="margin-top:0">
                    {segment.display.icon} {segment.display.name}
                    {f'<span class="badge">{segment.display.badge_text}</span>'
                     if segment.display.badge_text else ''}
                </h3>
                <p style="color:#666; font-size:0.9rem">
                    {segment.display.description}
                </p>
                <p style="color:#999; font-size:0.8rem">
                    Data: {', '.join(p.provider.value for p in segment.cascade.providers[:2])}
                </p>
            </div>
            """, unsafe_allow_html=True)

            if st.button(f"Select {segment.display.name}", key=f"select_{segment.id}"):
                st.session_state.segment = segment.id
                st.session_state.step = 2
                st.rerun()

def render_dynamic_input_form(segment_id: str):
    """Render input form based on segment configuration"""
    segment = config_loader.get_segment(segment_id)

    input_values = {}

    for field in segment.input_fields:
        field_type = field.get("type", "text")
        field_key = field["key"]

        if field_type == "text":
            input_values[field_key] = st.text_input(
                field["label"],
                placeholder=field.get("placeholder", ""),
            )

        elif field_type == "select":
            input_values[field_key] = st.selectbox(
                field["label"],
                options=field.get("options", []),
            )

        elif field_type == "slider":
            input_values[field_key] = st.slider(
                field["label"],
                min_value=field.get("min", 1),
                max_value=field.get("max", 100),
                value=field.get("default", 20),
            )

        elif field_type == "textarea":
            input_values[field_key] = st.text_area(
                field["label"],
                placeholder=field.get("placeholder", ""),
            )

    return input_values
```

---

## 6. Example Configuration

### 6.1 Complete Configuration File

```json
{
  "version": "1.0.0",
  "global_settings": {
    "default_timeout_ms": 30000,
    "max_results_per_segment": 100,
    "cache_ttl_seconds": 3600,
    "enable_hot_reload": true
  },
  "segments": [
    {
      "id": "smb_local",
      "display": {
        "name": "SMB & Local",
        "description": "Search local businesses by industry and location. Ideal for brick-and-mortar prospects.",
        "icon": "storefront",
        "color": "#4CAF50",
        "order": 1,
        "visible": true,
        "badge_text": null
      },
      "cascade": {
        "providers": [
          {
            "provider": "serper",
            "priority": 1,
            "enabled": true,
            "timeout_ms": 30000,
            "retry_count": 2,
            "fields_to_fetch": [],
            "conditions": {
              "location_required": true
            }
          },
          {
            "provider": "apollo",
            "priority": 2,
            "enabled": true,
            "timeout_ms": 30000,
            "retry_count": 2,
            "fields_to_fetch": ["employee_count", "industry", "revenue_range"],
            "conditions": {
              "has_domain": true
            }
          }
        ],
        "stop_on_success": false,
        "parallel_execution": false,
        "merge_results": true,
        "merge_strategy": "priority"
      },
      "deduplication": {
        "enabled": true,
        "match_strategy": "domain_normalized",
        "fuzzy_threshold": 0.85,
        "merge_duplicates": true,
        "merge_strategy": "most_complete",
        "manual_review_threshold": 0.7
      },
      "field_mappings": [
        {
          "standard_field": "name",
          "provider": "serper",
          "provider_field": "title",
          "fallback_providers": ["apollo"]
        },
        {
          "standard_field": "address",
          "provider": "serper",
          "provider_field": "address",
          "fallback_providers": []
        },
        {
          "standard_field": "phone",
          "provider": "serper",
          "provider_field": "phoneNumber",
          "fallback_providers": ["apollo"]
        },
        {
          "standard_field": "website",
          "provider": "serper",
          "provider_field": "website",
          "fallback_providers": []
        },
        {
          "standard_field": "employee_count",
          "provider": "apollo",
          "provider_field": "estimated_num_employees",
          "fallback_providers": []
        }
      ],
      "input_fields": [
        {
          "key": "industry",
          "type": "select",
          "label": "Industry",
          "options_source": "industry_taxonomy",
          "required": true
        },
        {
          "key": "location",
          "type": "text",
          "label": "Location",
          "placeholder": "e.g., Austin, TX or 90210",
          "required": true
        },
        {
          "key": "num_results",
          "type": "slider",
          "label": "Number of results",
          "min": 5,
          "max": 50,
          "default": 20
        }
      ],
      "metadata": {
        "use_case": "brick_and_mortar",
        "typical_company_size": "1-50"
      }
    },
    {
      "id": "mid_market",
      "display": {
        "name": "Mid-Market",
        "description": "Enrich by company domain or name. Get employee count, industry, revenue, and contacts.",
        "icon": "business",
        "color": "#2196F3",
        "order": 2,
        "visible": true,
        "badge_text": null
      },
      "cascade": {
        "providers": [
          {
            "provider": "apollo",
            "priority": 1,
            "enabled": true,
            "timeout_ms": 30000,
            "retry_count": 2,
            "fields_to_fetch": [],
            "conditions": {}
          },
          {
            "provider": "graphiq",
            "priority": 2,
            "enabled": true,
            "timeout_ms": 30000,
            "retry_count": 1,
            "fields_to_fetch": ["capabilities", "industry"],
            "conditions": {
              "has_domain": true
            }
          }
        ],
        "stop_on_success": false,
        "parallel_execution": true,
        "merge_results": true,
        "merge_strategy": "priority"
      },
      "deduplication": {
        "enabled": true,
        "match_strategy": "domain_exact",
        "fuzzy_threshold": 0.9,
        "merge_duplicates": true,
        "merge_strategy": "priority",
        "manual_review_threshold": 0.8
      },
      "field_mappings": [
        {
          "standard_field": "name",
          "provider": "apollo",
          "provider_field": "name",
          "fallback_providers": ["graphiq"]
        },
        {
          "standard_field": "domain",
          "provider": "apollo",
          "provider_field": "primary_domain",
          "fallback_providers": ["graphiq"]
        },
        {
          "standard_field": "employee_count",
          "provider": "apollo",
          "provider_field": "estimated_num_employees",
          "fallback_providers": ["graphiq"]
        },
        {
          "standard_field": "revenue_range",
          "provider": "apollo",
          "provider_field": "annual_revenue",
          "transform": "format_revenue"
        },
        {
          "standard_field": "capabilities",
          "provider": "graphiq",
          "provider_field": "capabilities",
          "fallback_providers": []
        }
      ],
      "input_fields": [
        {
          "key": "input_type",
          "type": "radio",
          "label": "Search by",
          "options": ["Domain", "Company Name"],
          "default": "Domain"
        },
        {
          "key": "domain",
          "type": "text",
          "label": "Company Domain",
          "placeholder": "e.g., notion.com",
          "show_when": {"input_type": "Domain"}
        },
        {
          "key": "name",
          "type": "text",
          "label": "Company Name",
          "placeholder": "e.g., Notion",
          "show_when": {"input_type": "Company Name"}
        }
      ],
      "metadata": {
        "use_case": "firmographic_enrichment",
        "typical_company_size": "50-500"
      }
    },
    {
      "id": "enterprise",
      "display": {
        "name": "Enterprise",
        "description": "Enterprise-grade enrichment with verified direct dials and emails for key contacts.",
        "icon": "corporate_fare",
        "color": "#9C27B0",
        "order": 3,
        "visible": true,
        "badge_text": null
      },
      "cascade": {
        "providers": [
          {
            "provider": "zoominfo",
            "priority": 1,
            "enabled": true,
            "timeout_ms": 45000,
            "retry_count": 2,
            "fields_to_fetch": [],
            "conditions": {
              "has_domain": true
            }
          },
          {
            "provider": "apollo",
            "priority": 2,
            "enabled": true,
            "timeout_ms": 30000,
            "retry_count": 2,
            "fields_to_fetch": [],
            "conditions": {}
          }
        ],
        "stop_on_success": false,
        "parallel_execution": false,
        "merge_results": true,
        "merge_strategy": "priority"
      },
      "deduplication": {
        "enabled": true,
        "match_strategy": "composite",
        "fuzzy_threshold": 0.95,
        "merge_duplicates": true,
        "merge_strategy": "priority",
        "manual_review_threshold": 0.85
      },
      "field_mappings": [
        {
          "standard_field": "name",
          "provider": "zoominfo",
          "provider_field": "name",
          "fallback_providers": ["apollo"]
        },
        {
          "standard_field": "employee_count",
          "provider": "zoominfo",
          "provider_field": "employeeCount",
          "fallback_providers": ["apollo"]
        },
        {
          "standard_field": "revenue",
          "provider": "zoominfo",
          "provider_field": "revenue",
          "fallback_providers": ["apollo"],
          "transform": "format_revenue"
        },
        {
          "standard_field": "contacts",
          "provider": "zoominfo",
          "provider_field": "contacts",
          "fallback_providers": ["apollo"]
        }
      ],
      "input_fields": [
        {
          "key": "domain",
          "type": "text",
          "label": "Company Domain",
          "placeholder": "e.g., salesforce.com",
          "required": true
        }
      ],
      "metadata": {
        "use_case": "enterprise_enrichment",
        "typical_company_size": "500+"
      }
    },
    {
      "id": "capability_search",
      "display": {
        "name": "Capability Search",
        "description": "Find companies by what they do. Search by technical capabilities, products, or expertise.",
        "icon": "search",
        "color": "#FF9800",
        "order": 4,
        "visible": true,
        "badge_text": "Beta"
      },
      "cascade": {
        "providers": [
          {
            "provider": "graphiq",
            "priority": 1,
            "enabled": true,
            "timeout_ms": 30000,
            "retry_count": 2,
            "fields_to_fetch": [],
            "conditions": {}
          },
          {
            "provider": "apollo",
            "priority": 2,
            "enabled": true,
            "timeout_ms": 30000,
            "retry_count": 1,
            "fields_to_fetch": ["employee_count", "revenue_range", "industry"],
            "conditions": {
              "has_domain": true
            }
          }
        ],
        "stop_on_success": false,
        "parallel_execution": false,
        "merge_results": true,
        "merge_strategy": "priority"
      },
      "deduplication": {
        "enabled": true,
        "match_strategy": "domain_normalized",
        "fuzzy_threshold": 0.8,
        "merge_duplicates": true,
        "merge_strategy": "most_complete",
        "manual_review_threshold": 0.7
      },
      "field_mappings": [
        {
          "standard_field": "name",
          "provider": "graphiq",
          "provider_field": "name",
          "fallback_providers": ["apollo"]
        },
        {
          "standard_field": "capabilities",
          "provider": "graphiq",
          "provider_field": "capabilities",
          "fallback_providers": []
        },
        {
          "standard_field": "employee_count",
          "provider": "apollo",
          "provider_field": "estimated_num_employees",
          "fallback_providers": ["graphiq"]
        }
      ],
      "input_fields": [
        {
          "key": "capabilities",
          "type": "textarea",
          "label": "Capabilities",
          "placeholder": "Enter capabilities separated by commas\ne.g., CNC machining, precision manufacturing",
          "required": true
        },
        {
          "key": "num_results",
          "type": "slider",
          "label": "Number of results",
          "min": 5,
          "max": 50,
          "default": 20
        }
      ],
      "metadata": {
        "use_case": "capability_discovery",
        "typical_company_size": "any"
      }
    }
  ]
}
```

---

## 7. Migration Path

### 7.1 Phase 1: JSON File (Current Design)

- Configuration stored in `config/enrichment_config.json`
- Hot reload via file watcher
- Manual editing or simple admin UI
- Version control friendly

### 7.2 Phase 2: SQLite Database

```python
# Future: config/database.py

import sqlite3
from contextlib import contextmanager

class ConfigDatabase:
    """SQLite-backed configuration storage"""

    def __init__(self, db_path: str = "config/enrichment.db"):
        self.db_path = db_path
        self._init_schema()

    def _init_schema(self):
        with self._get_connection() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS segments (
                    id TEXT PRIMARY KEY,
                    display_json TEXT NOT NULL,
                    cascade_json TEXT NOT NULL,
                    dedup_json TEXT NOT NULL,
                    input_fields_json TEXT NOT NULL,
                    metadata_json TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS field_mappings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    segment_id TEXT NOT NULL,
                    standard_field TEXT NOT NULL,
                    provider TEXT NOT NULL,
                    provider_field TEXT NOT NULL,
                    fallback_providers_json TEXT,
                    transform TEXT,
                    FOREIGN KEY (segment_id) REFERENCES segments(id)
                );

                CREATE TABLE IF NOT EXISTS config_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    segment_id TEXT,
                    change_type TEXT NOT NULL,
                    old_value_json TEXT,
                    new_value_json TEXT,
                    changed_by TEXT,
                    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
```

### 7.3 Phase 3: Full Admin API

```python
# Future: api/admin_routes.py

@router.post("/admin/segments")
def create_segment(segment: SegmentConfig):
    """Create a new segment"""
    ...

@router.put("/admin/segments/{segment_id}")
def update_segment(segment_id: str, segment: SegmentConfig):
    """Update an existing segment"""
    ...

@router.delete("/admin/segments/{segment_id}")
def delete_segment(segment_id: str):
    """Delete a segment (soft delete)"""
    ...

@router.post("/admin/segments/{segment_id}/providers")
def add_provider_to_cascade(segment_id: str, provider: ProviderConfig):
    """Add a provider to a segment's cascade"""
    ...

@router.put("/admin/segments/{segment_id}/providers/{provider_id}/reorder")
def reorder_provider(segment_id: str, provider_id: str, new_priority: int):
    """Change provider priority in cascade"""
    ...
```

---

## Summary

This design provides:

1. **Flexible Segment Configuration**: Each segment can have unique display properties, provider cascades, and deduplication rules.

2. **Provider Cascade System**: Supports waterfall (sequential) and parallel execution with configurable merge strategies.

3. **Robust Deduplication**: Multiple matching strategies (domain, name, composite) with configurable merge behavior.

4. **Clean Separation**: Configuration is separate from code, enabling non-developer modifications.

5. **Migration Path**: Clear progression from JSON files to database-backed storage.

The architecture maintains backward compatibility with the existing provider implementations while adding the configurability layer on top.
