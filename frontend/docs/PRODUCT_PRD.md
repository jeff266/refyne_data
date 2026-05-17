# Product PRD
**Product:** [NAME TBD]
**Author:** Jeff Ignacio, RevOps Impact LLC
**Version:** 1.0 — Draft
**Status:** Active

> The product name is outstanding. All other strategic decisions in this
> document are locked. Naming is the only open item before public launch.

---

## Overview

A four-stage data quality pipeline that sits between your B2B data providers
and your CRM. Every record is enriched through your own provider accounts,
cleaned, normalized to canonical form, and checked for duplicates before it
lands. The CRM receives clean, consistent, provenance-tracked data rather
than becoming the place where data quality problems accumulate.

**Positioning statement:**
We are the quality infrastructure layer between your data providers and your
CRM. Not a data vendor. Not a cleanup tool. Infrastructure.

**The one-sentence description for different audiences:**

- For the RevOps lead: "Every record gets enriched, cleaned, and deduplicated
  before it touches your CRM."
- For the founder: "We prevent the data quality wall that kills CRM
  reliability at $20M ARR."
- For the technical buyer: "dbt for your GTM data — transparent, versioned
  normalization rules, multi-source conflict resolution, and a continuous
  compliance score."

---

## Problem

Most B2B SaaS companies hit a data quality wall between $15M and $30M ARR.
By that point the CRM contains: duplicate company records from two years of
uncoordinated imports, inconsistent industry classifications across three
enrichment tools, phone numbers in seven different formats, and company names
that have never been standardized. Forecasting is unreliable. Territory
design is impossible. Personalization at scale fails because the data is wrong.

The existing tool landscape solves part of this:

- **Apollo, ZoomInfo, Clearbit** sell enrichment data. They do not clean,
  normalize, or deduplicate it.
- **Clay** orchestrates enrichment waterfalls. It marks up provider credits,
  does not normalize output, and has no dedup gate.
- **Insycle** cleans and normalizes CRM data. It has no enrichment layer and
  no dedup prevention at point of write.
- **Ringlead/ZoomInfo Operations** has dedup and normalization. It starts at
  $25,000 annually. Series A companies cannot buy it.

No tool in the market does all four cleanly, with transparent auditable rules,
at a price accessible to a Series A startup.

---

## Target Market

**Primary:** RevOps and GTM systems leads at Series A to C B2B SaaS companies.

| Stage | ARR Range | CRM Size | Profile |
|-------|-----------|----------|---------|
| Series A | $2M–$15M | 5K–30K records | 1 RevOps person, often the founder |
| Series B | $15M–$50M | 30K–150K records | RevOps team of 2–4 forming |
| Series C | $50M–$100M | 150K–500K records | Established RevOps, often considering Salesforce |

**The buyer persona:** The GTM systems lead at a Series A or B company.
Already paying for Apollo or ZoomInfo. Using HubSpot (Series A–B) or
transitioning to Salesforce (Series C). Has experienced the data quality wall
or is approaching it. Cannot buy Ringlead. Does not have the engineering
resources to build this themselves.

**What they already have:** At least one enrichment provider contract, a CRM
instance, and a growing problem they do not yet have the tools to solve.

**What they want from a tool:** controllability, visibility, reliability,
uptime, integrations, speed. See Customer Dimensions section.

---

## Product Architecture

### The four-stage pipeline

```
Data Providers          This Product              CRM            Analytics
──────────────          ────────────              ───            ─────────
Apollo                  1. Enrich                 HubSpot        Looker
ZoomInfo       →        2. Clean          →       Salesforce  →  Cube
Clay                    3. Normalize               
Luma                    4. Dedupe + Monitor
```

The CRM is downstream of the pipeline. Records arrive already processed.
The CRM never accumulates quality debt in normal operation.

### Architecture placement

This product is infrastructure, not a feature. Features sit on top of a CRM.
Infrastructure sits between the data layer and the CRM.

The closest architectural analog in the modern data stack is **dbt** — a
transformation layer with transparent, versioned, community-owned rules, a
quality gate, and a lineage layer. dbt does this for analytical data. This
product does it for GTM data.

| Modern data stack layer | This product |
|------------------------|--------------|
| Ingestion + Enrichment | Prospect (BYOK orchestration) |
| Transformation | Harmonies (Clean + Normalize) |
| Quality gate | Dedup prevention + write policy |
| Observability | Compliance dashboard + provenance |

### The BYOK model

BYOK (Bring Your Own Keys) is the architectural decision that creates the
product's structural advantages:

- The customer uses their own Apollo, ZoomInfo, and Clay accounts. No provider
  contracts run through this product.
- Data COGS are zero. No third-party data costs hit this product's P&L.
- Gross margins are 88–92% (pure software economics).
- Legal positioning is data orchestration, not data redistribution.
- The customer owns their data relationships from day one.

### The provenance layer

Every normalized field carries source, retrieval timestamp, and the Harmony
version that transformed it, stored as a ResolvedField. This field-level
metadata powers survivorship decisions, write policies, compliance monitoring,
and audit trails. No competitor has this. It requires a data model decision
made at the start, which means it cannot be retrofitted by existing tools.

---

## The Four Pillars

### 1. Enrich

Orchestrates calls to the customer's own configured providers. Fan-out to
all active providers in parallel, aggregate results, apply source-of-truth
resolution across candidates. The customer pays their provider bills. This
product charges for the orchestration, normalization, and quality layer.

**Supported providers (built):** Apollo, ZoomInfo, Clay, Serper, GraphIQ, Yelp.

**Resolution strategies:** priority (ordered source list), recency (most
recently retrieved wins), consensus (most common value wins), conservative
(lowest/safest value for financial estimates).

### 2. Clean

Fixes data hygiene before records land in the CRM. Cleaning Harmonies in the
library handle bad encoding, HTML entities, malformed values, test records,
null handling, and format-level errors. Clean is distinct from Normalize:
clean fixes what is broken, normalize standardizes what is variable.

### 3. Normalize

The Harmonies engine. YAML + JSONata transformation rules, versioned, tested,
community-owned. See the Harmony Library section.

Every Harmony has:
- Declared applies_to fields
- Named JSONata rules with conditions
- Embedded test cases (required, not optional)
- A version following semver
- A source trust ranking for survivorship

The default Harmony Library ships with production Harmonies for: company name
(with Option C suffix normalization), company domain, company industry
(canonical taxonomy), company revenue, company employee band, person name,
person title (6 canonical roles), phone (E.164), email, address country,
address state, LinkedIn URL.

### 4. Dedupe

Two modes:

**Prevention (primary):** A gate inside enrichment_apply. Before writing to
the CRM, the engine checks whether a matching company already exists. High
confidence (≥0.90): upsert existing record. Review zone (0.60–0.89): hold
write, notify user. No match (<0.60): insert.

**Cleanup (secondary):** Batch scan of existing CRM records. Surfaces
duplicate clusters ranked by confidence. Review queue with side-by-side
comparison, radio-button master record selection, field-level survivorship
preview. Waiting period before auto-merge executes.

See the **Deduplication Engine PRD Addendum** for full specification.

### Compliance monitoring

Continuous monitoring of whether CRM records conform to the current Harmony
Library. Compliance score, breakdown by Harmony and field, insight cards for
detected gaps, re-normalize actions.

See the **Data Compliance Dashboard PRD Addendum** for full specification.

---

## Input Pipelines

Six sources across two categories.

### Acquisition — finding new records

| Pipeline | Description | Notes |
|----------|-------------|-------|
| Prospect search | Query providers for new companies and contacts matching ICP criteria | Direct provider search API |
| Chrome extension | Capture from LinkedIn and LinkedIn Sales Navigator while browsing | One-click add to CRM via the full pipeline |
| Event apps | Ingest registrant data from Luma, Eventbrite, Zoom Webinars | Luma adapter built. Self-reported identity enriched via providers before write |

### Maintenance — cleaning existing records

| Pipeline | Description | Notes |
|----------|-------------|-------|
| CRM batch monitoring | Scheduled scan: normalize and enrich on a defined cadence | Nightly default. Incremental: only process what changed |
| CRM one-time pull | Ad hoc query via SOQL or HubSpot list filter | Preview-before-apply via Phase 9 UI |
| CSV import | Upload a file, map columns to canonical fields, run the pipeline | Output: enriched CSV or direct CRM write |
| Webhook / real-time trigger | On CRM record create or update, run the pipeline immediately | HubSpot webhooks, HTTP API for integrations |

---

## The Harmony Library

### Open-source on GitHub

The default Harmony Library is published as a public GitHub repository:
`[org]/harmonies`.

Structure:
```
harmonies/
  CONTRIBUTING.md
  README.md
  /business-entities/
    us-company-name/
      harmony.yaml
      README.md
  /geography/
  /industry/
  /contact/
```

Each Harmony is a directory with a self-contained YAML spec, embedded test
cases, and a README explaining the normalization logic and edge cases handled.

### Versioning and consumption

The library uses semver. The platform pins to tagged releases, not main.
Customers who upgrade see a changelog and can preview the updated Harmonies
against their own records before promoting.

Customers who need custom Harmonies fork the public repo, maintain a private
fork, and connect it to the platform. Custom Harmonies follow the same spec
and test requirements as public ones.

### The community flywheel

RevOps practitioners find Harmonies via GitHub search. Some become customers.
Some contribute Harmonies back. The library grows. Contributors cover edge
cases the default library does not: LATAM entity formats, German GmbH, UK Ltd,
Japanese KK, unusual NAICS sector mappings. Each contributed Harmony reduces
customer acquisition friction for companies with that specific need.

Every Harmony is a piece of demonstrable expertise. "US Business Entity
Normalization" with 15 suffix patterns and 40 test cases is more credible than
a blog post about the same topic. The GitHub repo is the content strategy.

This is the dbt packages model: the library is community-owned, the platform
is commercial.

---

## Customer Dimensions

The six dimensions the target buyer evaluates, and the product decisions that
maximize each.

### Controllability

- Harmonies are readable YAML rules, not opaque logic
- Preview before apply (Phase 9 diff table and commit gate)
- Waiting period before auto-merge executes
- Per-field write policy: always overwrite, overwrite if blank or we last wrote
  it (default), never overwrite and route to secondary field
- Kill switch: pause all automated pipelines instantly
- Configuration export: all Harmonies, field mappings, and pipeline configs
  exportable as YAML. Customers own their configuration.
- Role-based access: who can edit, approve, and apply

### Visibility

- Compliance dashboard: continuous health score with breakdown by Harmony,
  field, and source
- Per-record data lineage: every field shows source, timestamp, and which
  Harmony version last touched it
- Pipeline run logs: records processed, records changed, errors by type,
  provider hit rates, duration
- Pre-run preview: before any batch operation, see exactly what will change
- Post-run summary: what changed, what errored, what was blocked
- Provider health indicators: flag when a provider is returning low coverage

### Reliability

- Idempotent Harmonies: same input, same output, always
- Test cases per Harmony: regression prevention baked in
- Version pinning: customers lock to a Harmony version, no surprise behavior
  changes
- Circuit breakers: if a provider is down, the pipeline continues with
  available providers and flags the gap
- Failed records surface to an admin view, never silently dropped
- Error handling policy per Harmony: fail-loud, fail-silent-log, fail-default

### Uptime

- Infrastructure: Railway (workers), Vercel (frontend), Supabase (Postgres),
  Upstash Redis (job queue)
- BullMQ job queue with retry logic and dead-letter handling
- Jobs persist through failures. Failed jobs resurface for retry or
  investigation.
- Status page (Betterstack or Statuspage.io): real-time component health
- Target: 99.9% uptime
- Graceful degradation: pipeline completes with available providers when one
  is down

### Integrations

**CRM:** HubSpot (primary, Series A–B), Salesforce (Series B–C)
**Providers:** Apollo, ZoomInfo, Clay, Serper, GraphIQ, Yelp (all built)
**Event apps:** Luma (built), Eventbrite, Zoom Webinars (roadmap)
**Notifications:** Slack, email
**Automation:** Webhook (generic), Zapier, Make, n8n
**AI/agent:** MCP tools (enrichment_pull, enrichment_normalize, harmonies_preview,
harmonies_apply, harmony_list, harmony_test)
**Browser:** Chrome extension for LinkedIn capture (roadmap)
**Files:** CSV, Google Sheets

### Speed

Critical design decisions:
- Compiled expression cache: compile each JSONata expression once per Harmony
  version, cache and reuse. Evaluation time drops from ~5ms to under 1ms.
- Worker thread parallelism: normalization is embarrassingly parallel. 8
  threads process 50K records in under 20 seconds.
- Incremental processing: skip records where nothing changed and the Harmony
  version matches. A nightly run on a 50K-record CRM with 5K daily changes
  completes in seconds.
- Database-indexed blocking for dedup: blocking keys are indexed Postgres
  columns. Candidate pair generation is a SQL join, not in-memory iteration.
- Streaming: never load the full record set in memory. Process in chunks.

**Target performance:**

| Operation | Target |
|-----------|--------|
| Single-record normalization | < 50ms |
| Batch normalize 50K records (first run) | Under 30 seconds |
| Batch normalize 50K records (incremental, 10% changed) | Under 5 seconds |
| Full dedup scan, 100K records | Under 15 minutes |
| Incremental dedup (daily new records) | Seconds |
| Phase 9 UI preview, 500 records | Under 3 seconds |
| Compliance score refresh | Under 10 seconds |

---

## Competitive Positioning

### Landscape comparison

| | Enrich | Clean | Normalize | Dedupe | BYOK | Transparent rules | Entry price |
|--|--------|-------|-----------|--------|------|-------------------|-------------|
| This product | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | $299/mo |
| Apollo | ✓ | — | Partial | — | — | — | $49/user |
| Clay | ✓ | — | — | — | Partial | — | $185/mo |
| Insycle | — | ✓ | ✓ | ✓ | — | — | $25/mo |
| Ringlead/OperationsOS | Partial | ✓ | ✓ | ✓ | — | — | $25K/yr |
| ZoomInfo | ✓ | — | Partial | — | — | — | Custom |
| Clearbit/Breeze | ✓ | — | Partial | — | — | — | Bundled |

### Key differentiators

**Provenance-aware survivorship.** Field-level source attribution with
timestamps. "Take ZoomInfo's revenue over Apollo's because ZoomInfo is
higher-trust for financial data and the value is more recent." No competitor
has this. Requires the data model to be built in from day one.

**Dedup gate inside the enrichment pipeline.** The dedup check runs before
every CRM write, not in a separate cleanup step. No competitor implements
this inside an enrichment workflow.

**Transparent, community-owned normalization rules.** Harmonies are readable
YAML, version-controlled, tested, and open-source on GitHub. Every competitor
normalizes with opaque internal logic.

**BYOK model with software gross margins.** No data COGS. 88–92% gross margin
vs. 65–75% for credit-based tools with provider markup.

**Continuous compliance monitoring.** No enrichment tool monitors whether
enriched data stays compliant as Harmonies are updated and new records come in.
The compliance score is a continuous metric, not a one-time event.

### Gross margin analysis

ZoomInfo 2023 10-K: $1.24B revenue, $139M cost of service, $39M amortization
of acquired technology. Gross margin: 85.6%.

This product under the BYOK model carries no data acquisition costs. COGS =
hosting, compute, and support only. Expected gross margin: 88–92% at scale.
Structurally better than any data vendor in the competitive set.

---

## Pricing

### Model

Flat monthly fee based on CRM record count. No per-record variable charges.
No credit system. Predictable billing.

### Structure

**Core tier** (Enrich + Clean + Normalize + Dedupe + Compliance Dashboard)

| Tier | CRM Records | Monthly | Annual |
|------|-------------|---------|--------|
| Starter | Up to 25K | $299 | $2,868 |
| Growth | Up to 100K | $599 | $5,748 |
| Scale | Up to 500K | $1,199 | $11,508 |
| Enterprise | 500K+ | Custom | Custom |

Annual plans are 20% below monthly billing. Dynamic: price adjusts at renewal
based on actual record count. Grows with the customer, shrinks if they clean.

**Prospect add-on** (BYOK enrichment orchestration)

| | Price |
|--|-------|
| Per connected provider | $49/month |
| Per enrichment run (up to 100 records) | $0.50 |

A Series A company with one Apollo key and 15K records pays $299 + $49 = $348
per month.

### Free trial

14-day trial. Connect HubSpot read-only. Run a normalization assessment on up
to 1,000 records from the default Harmony Library. See a real compliance score
and the top five data quality issues before any payment. No provider connection
required for the trial. Time to first value: under 15 minutes.

---

## Build Status

### Completed

**Core normalization engine** — Phases 1–9 complete. 629 tests passing.

| Component | Description |
|-----------|-------------|
| Canonical entities | CanonicalCompany and CanonicalPerson with ResolvedField provenance |
| Spec parser | YAML Harmony validation with Zod and JSONata expression validation |
| JSONata runner | Expression caching, timeout, context binding, 9 builtin functions |
| Execution engine | Rule matching, error policies, embedded test execution |
| Pipeline + Resolver | Normalize-then-resolve ordering (locked), 4 resolution strategies |
| Provider adapters | Apollo, ZoomInfo, Clay, Serper, GraphIQ, Yelp (TS ports, 50 tests) |
| Harmony Library | 12 production Harmonies with Option C suffix normalization (59 tests) |
| MCP tools | enrichment_pull, enrichment_normalize, harmony_list, harmony_test,
              harmonies_preview, harmonies_apply |
| Settings UI (Phase 9) | Mode toggle, pipeline selector, record source, diff table, commit gate |
| Supabase layer | Database schema, migrations, normalization_settings, pipelines tables |

**PRD addenda written:** Data Compliance Dashboard, Deduplication Engine.

### Immediate next steps (in priority order)

1. Finish Phase 9 (Settings UI) — directive, in progress
2. Dedup PRD sign-off — written, awaiting review
3. HubSpot private app integration — use Frontera, GrowthBook, GrowthX as
   test accounts. Private app auth first, public OAuth app second.
4. Compliance dashboard build — PRD complete, kickoff when HubSpot integration
   is live and real records are flowing
5. Dedup engine build — after PRD is locked

### Roadmap (next phases)

| Feature | Priority | Dependencies |
|---------|----------|-------------|
| HubSpot private app integration | P0 | Phase 9 complete |
| Compliance dashboard | P0 | HubSpot integration |
| Dedup engine | P0 | HubSpot integration + PRD sign-off |
| HubSpot OAuth public app | P1 | Private app validated |
| Salesforce integration | P1 | HubSpot validated |
| Chrome extension (LinkedIn) | P1 | HubSpot integration |
| Luma event adapter | P2 | Jeff has existing script |
| Eventbrite / Zoom Webinars | P2 | Luma validated |
| Harmonies on GitHub | P1 | Can begin now |
| Person dedup | P2 | Company dedup shipped |
| Probabilistic dedup classifier | P3 | Company dedup production data |
| BullMQ job queue at scale | P1 | Before 10K records batch |
| SOC2 Type II | P2 | Before Series B outreach |

---

## Feature PRD Addenda

The following documents contain detailed specifications for individual features.
This master PRD defines strategy and positioning. The addenda define implementation.

| Document | Feature | Status |
|----------|---------|--------|
| HARMONIES_README.md | Normalization engine specification for engineering | Complete |
| DATA_COMPLIANCE_PRD_ADDENDUM.md | Compliance dashboard | Complete |
| DEDUPE_PRD_ADDENDUM.md | Deduplication engine | Complete |
| HubSpot Integration Brief | TBD | Not written |
| Chrome Extension Brief | TBD | Not written |

---

## Open Questions

1. **Product name.** All other decisions are locked. Name is outstanding.

2. **GitHub organization name.** The Harmonies open-source repo needs a home.
   Options: `revopsimpact/harmonies`, a standalone org for the library, or
   named after the product once the name is decided.

3. **Salesforce vs HubSpot sequencing.** The three test accounts (Frontera,
   GrowthBook, GrowthX) are all HubSpot. Salesforce integration follows.
   Decision point: when to build Salesforce and for which customer tier.

4. **Person dedup timing.** Company dedup ships first. Person dedup has
   different matching signals and merge implications. Sequencing depends on
   customer demand after company dedup ships.

5. **Agency and consultant tier.** RevOps agencies (like RevOps Impact) who
   manage multiple client HubSpot instances would benefit from a multi-workspace
   tier. This is not designed yet but the distribution channel is obvious.

---

*RevOps Impact, LLC — Confidential*
*revopsimpact.us · jeff@revopsimpact.us*
