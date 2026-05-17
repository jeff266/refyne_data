# PRD Addendum: Deduplication Engine
**Feature codename:** Dedupe  
**Addendum to:** Harmonies Normalization Engine PRD  
**Scope:** Company records only (Person dedup is a separate phase)  
**Status:** Draft

---

## Overview

The Deduplication Engine identifies company records that represent the
same real-world entity and either prevents them from entering the CRM or
merges them after the fact. It operates in two modes that serve distinct
jobs: Prevention (gate at point of write) and Cleanup (scan and merge
existing CRM records).

Prevention is the primary mode. Every time a normalized record is about
to be written to the CRM, the dedup gate checks whether a matching
company already exists. If it does, the record upserts the existing
company instead of creating a new one. The CRM never gets a duplicate in
the first place.

Cleanup is the secondary mode. It surfaces existing duplicates in the
CRM, queues them for review, and executes merges with full survivorship
control and an audit trail.

The underlying philosophy mirrors Ringlead more than Insycle: prevention
is cheaper and less risky than cleanup. Build the gate first.

---

## Primary User

**GTM systems lead** at a $20M to $100M ARR B2B SaaS company.

Their deduplication nightmare:
- Sales reps call the same company twice because it appears as two
  separate accounts in the CRM
- Forecast is overstated because the same deal appears under two company
  records
- Email campaigns send to the same contact at both company records
- Enrichment runs twice on the same company, consuming provider credits
- Account scoring is unreliable because the company's full deal history
  is split across two records
- They discovered the mess six months ago and have been too afraid to
  run a bulk merge because "what if I merge the wrong ones"

What they need: a system that prevents new duplicates from forming and
gives them a safe, audited path to clean up what already exists.

---

## Jobs to Be Done

1. **Prevent**: Stop new duplicates from entering the CRM automatically,
   with no manual intervention required once configured.

2. **Detect**: Identify existing duplicates across the full CRM company
   record set, ranked by confidence.

3. **Review and merge**: Compare potential duplicates side by side,
   select a master record, preview the merged result, and commit.

4. **Configure**: Set thresholds, waiting periods, survivorship rules,
   and notifications without requiring engineering support.

5. **Audit**: Maintain a complete record of every merge that was
   executed, what the records looked like before, and who or what
   triggered the merge.

---

## Core Concepts

**Duplicate cluster:** Two or more records that are candidates for
representing the same real-world company. May have two records (pair)
or more if multiple entries exist for the same entity.

**Confidence score:** A value from 0 to 1 indicating the probability
that two records represent the same company. Computed from weighted
field comparisons. 1.0 is a certain match.

**Match reason:** The primary signal that drove the confidence score.
Domain and external canonical ID matches are the highest-confidence
signals in B2B. Name similarity is a last-resort fallback only —
used exclusively when no definitive signal is available, with
conservative thresholds and vertical stopword filtering.

**Master record:** The surviving CRM record after a merge. It retains
its original CRM ID. All associations (deals, contacts, activities) from
the non-surviving record are reassigned to it. The non-surviving record
is archived in the audit log and retired in the CRM.

**Survivorship decision:** For each field in a merge, the rule that
determines which value survives. Defaults are configurable per field
type and per source trust ranking.

**Waiting period:** The window between a scheduled auto-merge and its
execution. During this window the user can review and cancel. After it
expires, the merge executes automatically.

**Prevention mode:** Dedup check that runs inside the `enrichment_apply`
pipeline before any write to the CRM. Transparent to the user unless
a potential duplicate is detected.

**Cleanup mode:** Batch scan of existing CRM records, typically run on
a schedule, that surfaces duplicate clusters for review.

---

## Confidence Bands

Three bands determine the automated behavior at each threshold.

| Band | Score Range | Default Behavior |
|------|-------------|-----------------|
| Auto-merge eligible | ≥ 0.90 | Queue for scheduled auto-merge (waiting period applies) or immediate merge if auto-merge is off |
| Review zone | 0.60 to 0.89 | Surface in review queue, hold any write, notify user |
| No match | < 0.60 | Proceed with insert or suppress entirely |

All thresholds are configurable per org. The defaults are conservative.

---

## Matching Architecture

### The Signal Cascade

The dedup gate resolves company identity by walking a seven-tier signal
cascade. Each tier either produces a definitive result (exit the
cascade) or falls through to the next tier. Tiers 1 through 4 are
exact-match signals that are treated as definitive — no scoring, no
thresholds, deterministic output. Tiers 5 through 7 are probabilistic
signals that produce a confidence score subject to the confidence bands.

| Tier | Signal | Method | Confidence | Behavior on match |
|------|--------|--------|-----------|------------------|
| 1 | CRM native ID | Exact (`_hubspot_id`) | Certain | Route to upsert immediately. Exit cascade. |
| 2 | Normalized domain | Exact (`acme.com`) | Certain | Score 1.0. Auto-merge eligible. Exit cascade. |
| 3 | LinkedIn company URL | Exact (canonical form) | Certain | Score 1.0. Auto-merge eligible. Exit cascade. |
| 4 | External canonical ID | Exact (Apollo org_id, Clearbit ID) | Certain | Score 1.0. Auto-merge eligible. Exit cascade. |
| 5 | Phone E.164 | Exact | High | Score 0.85. Review zone. Continue to score other available signals. |
| 6 | Address | Exact street + postal code | Medium | Score 0.70. Review zone. Combine with other signals. |
| 7 | Company name (fuzzy) | Levenshtein on stopword-filtered match key | Low | Score 0.00–0.60. Last resort. Conservative threshold of 0.85 to reach review. |

**Disqualifier:** If tiers 2, 3, or 4 are present on both records and
do not match, the pair scores 0.0 and exits the cascade immediately.
Two companies with different known domains are not duplicates — do not
proceed to name matching.

### Tier 7: Name fuzzy with vertical stopwords

Name similarity alone is not a reliable company matching signal in any
vertically-concentrated database. Healthcare companies share "Health"
and "Behavioral." Fintech companies share "Capital" and "Financial."
SaaS companies share "Solutions" and "Platform."

Tier 7 applies a stopwords filter before running the Levenshtein
comparison. Stopword tokens are stripped from both name strings before
similarity is calculated. A match between "Behavioral Concepts Inc."
and "LEARN Behavioral" becomes a match between "Concepts" and "LEARN"
after stripping "Behavioral" — similarity near zero, no false positive.

The Harmony spec supports a `stopwords` field on name matching rules:

```yaml
matching:
  - id: name-fuzzy
    field: company_name_normalized
    strategy: fuzzy
    weight: 1.0
    threshold: 0.85          # Conservative — only near-certain name matches
    stopwords:
      - Inc
      - LLC
      - Corp
      - Ltd
      - Group
      - Holdings
      - Partners
      - Services
      - Solutions
      - Technologies
      - Systems
```

The default stopwords cover structural terms (suffixes and generic
descriptors). Vertical-specific stopwords are added via the Harmony
Library's community-maintained stopwords sets:
`harmonies/stopwords/healthcare-behavioral.yaml`,
`harmonies/stopwords/fintech.yaml`, etc.

An org activating the healthcare behavioral set automatically gets
"Behavioral", "ABA", "Applied", "Behavior", "Therapy", "Clinical",
"Center", "Wellness" added to the name stopwords for their company
dedup Harmonies.

### Blocking

Records are not compared exhaustively. Blocking groups candidate pairs
using cheap keys before any comparison runs.

**Blocking keys:**
1. Normalized domain (primary). Builds a `Map<domain, hubspot_id>`
   pre-fetched from the CRM at batch start.
2. Canonical LinkedIn company URL. Builds a `Map<linkedin_url, hubspot_id>`.
3. External canonical ID (Apollo org_id, Clearbit ID). Builds a
   `Map<external_id, hubspot_id>`. Populated as enrichment runs.
4. Phone E.164 (first 10 digits). Fallback for records without tiers 1–3.
5. Name prefix (first 6 chars of stopword-filtered match key). Last
   resort. Only used when all other blocking keys are absent.
   **Note:** Name prefix blocking is intentionally restricted for
   vertically-concentrated databases. If more than 5% of records share
   the same name prefix block, that prefix is considered a vertical
   vocabulary term and is skipped in favor of a broader token.

The pre-fetch domain index from the batch performance fix covers tiers
1–3: one bulk CRM pull builds all three maps. The dedup gate checks
these maps (O(1) in-memory lookups) rather than making per-record API
calls.

### Classification

Tiers 1–4: binary exact match. Score is 1.0 or 0.0. No weighted sum.

Tiers 5–7: probabilistic. The combined score for probabilistic signals
uses a weighted sum of available signals:

| Signal | Weight (tiers 5–7 only) |
|--------|------------------------|
| Phone E.164 exact | 0.50 |
| Address exact (street + postal) | 0.30 |
| Name fuzzy (stopword-filtered) | 0.20 |

Weights apply only when the higher-priority tiers produced no match.
The threshold to enter the review zone from probabilistic signals is
0.85 (more conservative than the default 0.60 for deterministic
signals), reflecting the lower precision of these signals.

**V2: Probabilistic classifier.** After enough confirmed match and
non-match data accumulates from user reviews, a Fellegi-Sunter model
replaces the weighted sum. Abstracted behind a clean TypeScript
boundary — v2 is a drop-in replacement.

---

## External ID Infrastructure

Tiers 3 and 4 of the cascade depend on external canonical IDs flowing
through the pipeline. Two sources:

**LinkedIn company URL** is already present. The field-mapper.ts maps
HubSpot's `linkedin_company_page` property to `linkedin_url` in the
canonical record. It flows through normalization and is available to
the dedup gate today.

**Apollo org_id and other external IDs** are available on any record
that passed through the enrichment pipeline (the Prospect pillar). The
Apollo adapter returns `org_id` as part of the enriched company
response. This ID must be:
1. Stored in the canonical record's metadata envelope (alongside
   `_hubspot_id`, not as a canonical field)
2. Written back to a HubSpot custom property (`apollo_org_id`) so it
   persists and is available on future reads
3. Included in the domain index pre-fetch so the dedup gate can look
   it up in memory

The metadata envelope on the canonical record holds all source IDs:

```typescript
type CanonicalCompanyMeta = {
  hubspot_id?: string
  apollo_org_id?: string
  linkedin_company_url?: string
  clearbit_id?: string        // future
  duns_number?: string        // future
}
```

The dedup gate builds three maps at batch start:
- `domainIndex: Map<string, string>` — normalized domain → hubspot_id
- `linkedInIndex: Map<string, string>` — canonical LinkedIn URL → hubspot_id
- `apolloIndex: Map<string, string>` — Apollo org_id → hubspot_id

All three are populated from one paginated CRM pull. For new records
that have not yet been written to the CRM, the gate checks the incoming
record's metadata for these IDs and queries the index.

---

## Mode 1: Prevention

Prevention runs inside the `enrichment_apply` MCP tool before every CRM
write. It is the default behavior when a connected CRM is active.

### Flow

```
enrichment_apply is called with a normalized company record
                             ↓
              Dedup gate runs (before CRM write)
                             ↓
          Tier 1: _hubspot_id present?
          YES → route to upsert immediately ──────────────────────┐
          NO  ↓                                                    │
          Tier 2: domain present on both records?                  │
          MATCH → parent-child check:                             │
            Explicitly linked parent-child → suppress forever     │
            Different parent IDs → score 0.0, insert ────────────┤
            Same parent ID → score 1.0, review queue ────────────┤
            One has parent, one does not → score 0.75, review ───┤
            Neither has parent → score 1.0, auto-merge ──────────┤
          MISMATCH → score 0.0, insert ───────────────────────────┤
          ABSENT on either → fall through                         │
          Tier 3: LinkedIn URL present on both?                    │
          MATCH → parent-child check (same logic as Tier 2) ──────┤
          MISMATCH → score 0.0, insert ───────────────────────────┤
          ABSENT → fall through                                    │
          Tier 4: External canonical ID present on both?           │
          MATCH → score 1.0, auto-merge eligible ─────────────────┤
          MISMATCH → score 0.0, insert ───────────────────────────┤
          ABSENT → fall through                                    │
          Tiers 5–7: Score phone + address + name (fuzzy)          │
                             ↓                                     │
     ┌───────────────────────┼──────────────────────┐             │
     ↓                       ↓                      ↓             │
Score ≥ 0.90            0.85–0.89              score < 0.85       │
     ↓                       ↓                      ↓             │
Auto-merge eligible   Review queue           Proceed with insert  │
Upsert existing       Hold write             with provenance      │
record                Notify user            ◄────────────────────┘
```

### Upsert logic

When a high-confidence match is found, the incoming normalized record
enriches the existing CRM record rather than creating a new one. Field-
level survivorship rules apply: only overwrite an existing CRM field if
the incoming value is more recent or from a higher-trust source per the
ResolvedField provenance metadata.

Fields that the incoming record has and the existing CRM record lacks
are always written.

Fields that both records have: apply survivorship rules (see Survivorship
Logic section).

Fields that only the CRM record has: do not touch.

### Prevention notification

When a write is held for review, the user is notified:

- In-app: a banner in the next session ("3 records held for duplicate
  review before import")
- Optional: email and Slack notification

Held records appear in the Review Queue with context: "This record was
blocked because a potential match exists in your CRM."

---

## Mode 2: Cleanup

Cleanup scans existing CRM records to surface duplicate clusters. It
runs on a configurable schedule or on demand.

### Scan process

1. Pull all company records from CRM via paginated API
2. Build three blocking indexes: domain map, LinkedIn URL map,
   external ID map (Apollo org_id, etc.)
3. For each record, walk the cascade:
   - Tier 1 is not applicable in cleanup (all records have CRM IDs)
   - Tier 2: find all records sharing the same normalized domain
   - Tier 3: find all records sharing the same LinkedIn company URL
   - Tier 4: find all records sharing the same external canonical ID
   - Tiers 5–7: only reached when no definitive signal is present
4. Score each candidate pair per the cascade rules
5. Save clusters above 0.85 (probabilistic) or 1.0 (deterministic)
   to `dedup_clusters` table
6. Surface in Review Queue, grouped by confidence band and match reason

Large CRMs (10,000+ companies) run as a background job with progress
tracking. The UI shows last scan date and a "Scan Now" trigger.

---

## Review UI

### Cluster list

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Duplicates                                              [ Run Scan ]    │
├─────────────────────────────────────────────────────────────────────────┤
│  Review Queue (14)  ·  Pending Merges (6)  ·  History                   │
├─────────────────────────────────────────────────────────────────────────┤
│  [ All ] [ High Confidence ] [ Review Zone ]       [ Bulk Merge ▼ ]     │
│                                                                          │
│  ┌──────────────────────────────┬───────┬──────────┬───────────────┐    │
│  │ Records                      │ Score │ Signal   │               │    │
│  ├──────────────────────────────┼───────┼──────────┼───────────────┤    │
│  │ Acme Corp. · Acme Corp Inc.  │ 0.96  │ Domain   │ [ Review ]    │    │
│  │ Stripe Inc. · Stripe         │ 0.94  │ Domain   │ [ Review ]    │    │
│  │ Notion Labs · Notion HQ      │ 0.82  │ Name     │ [ Review ]    │    │
│  │ Plaid Inc. · Plaid Corp      │ 0.81  │ Domain   │ [ Review ]    │    │
│  │ Linear App · Linear          │ 0.78  │ Name     │ [ Review ]    │    │
│  └──────────────────────────────┴───────┴──────────┴───────────────┘    │
│  Page 1 of 3                                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

### Cluster detail: merge review

The merge review screen is the primary trust-building surface. The GTM
systems lead sees both records side by side, understands exactly what
the merged result will look like, and makes the final call.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Duplicates  /  Review: Acme Corp.                       Score: 0.96  │
├─────────────────────────────────────────────────────────────────────────┤
│  Both records appear to represent the same company (domain match).       │
│  Select master record, review the proposed merged result, then confirm.  │
├────────────────────────────┬────────────────────────────────────────────┤
│  RECORD A                  │  RECORD B                                   │
│  Created: Mar 2023         │  Created: Nov 2023                          │
│  ● Set as master           │  ○ Set as master                            │
├────────────────────────────┼────────────────────────────────────────────┤
│  company.name              │                                             │
│  Acme Corp.                │  Acme Corp Inc.                             │
│  ← survives (master)       │                                             │
├────────────────────────────┼────────────────────────────────────────────┤
│  company.domain            │                                             │
│  acme.com                  │  acme.com                                   │
│  ← survives (identical)    │                                             │
├────────────────────────────┼────────────────────────────────────────────┤
│  company.industry          │                                             │
│  Financial Services        │  —                                          │
│  ← survives (only value)   │                                             │
├────────────────────────────┼────────────────────────────────────────────┤
│  company.revenue           │                                             │
│  $45M · Apollo · 3mo ago   │  $52M · ZoomInfo · 1mo ago                 │
│                            │  ← survives (more recent, trusted source)  │
├────────────────────────────┼────────────────────────────────────────────┤
│  company.employee_band     │                                             │
│  201-500                   │  201-500                                    │
│  ← survives (identical)    │                                             │
├────────────────────────────┼────────────────────────────────────────────┤
│  Deals associated          │  Activities associated                      │
│  3 open · 2 closed         │  14 email · 3 calls                        │
│  ← preserved on master     │  ← reassigned to master                    │
├────────────────────────────┴────────────────────────────────────────────┤
│  [ Override field-level survivorship ]                                   │
│                                                                          │
│            [ Dismiss ]  [ Not a Duplicate ]  [ Merge into Record A → ]  │
└─────────────────────────────────────────────────────────────────────────┘
```

**Tier 1 (default):** Radio button selects which entire record is master.
Survivorship rules fill in the field-level detail automatically.

**Tier 2 (advanced, behind the "Override" link):** The user can override
any individual field's winner. A dropdown per field: "Use Record A" or
"Use Record B." Changes update the survivorship preview in real time.

**"Not a Duplicate" action:** Marks the cluster as a confirmed non-match.
Removes it from the queue permanently. The pair is suppressed from all
future scans. Logged in audit trail.

---

## Pending Auto-Merges

When auto-merge is enabled, high-confidence clusters enter a waiting
period before execution. The pending merges queue surfaces them.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Pending Merges (6)                           Merges in: 18h 42m  ⏱    │
├─────────────────────────────────────────────────────────────────────────┤
│  Auto-merge is on. 6 high-confidence pairs merge in 18 hours.            │
│  Review and cancel before the timer expires.          [ Cancel All ]     │
│                                                                          │
│  ┌──────────────────────────────┬───────┬────────────────┬────────────┐  │
│  │ Records                      │ Score │ Proposed Master│            │  │
│  ├──────────────────────────────┼───────┼────────────────┼────────────┤  │
│  │ Stripe Inc. · Stripe         │ 0.94  │ Stripe Inc.    │ [ Cancel ] │  │
│  │ Figma Inc. · Figma Corp.     │ 0.97  │ Figma Inc.     │ [ Cancel ] │  │
│  │ Loom · Loom Inc.             │ 0.99  │ Loom           │ [ Cancel ] │  │
│  │ Brex · Brex Inc.             │ 0.95  │ Brex           │ [ Cancel ] │  │
│  └──────────────────────────────┴───────┴────────────────┴────────────┘  │
│                                                                          │
│  Notification sent to: team@acmecorp.com · #gtm-systems                  │
└─────────────────────────────────────────────────────────────────────────┘
```

**Waiting period behavior:**

- When a cluster exceeds the auto-merge threshold, it is added to
  pending merges with a scheduled execution timestamp
- Notification fires immediately: "6 companies will be merged in 24
  hours. Review to cancel any."
- If not cancelled, the merge executes at the scheduled time
- If cancelled, the cluster moves to the Review Queue for manual action
- The waiting period is configurable: 1 hour to 7 days. Default: 24h.

---

## Field-Level Write Policy

When the dedup engine upserts an existing CRM record with incoming
enriched values, write policy governs what happens when a field already
has a value. This is configured per canonical field in the field mapping
UI and applies during every prevention-mode upsert.

### The three policies

**Policy 1: Overwrite if blank or if we last wrote it (default)**

The incoming value writes if the CRM field is empty OR if this tool was
the last to write that field. If a human or another tool wrote the field,
it is left alone.

This is smarter than plain "overwrite if blank." If this tool wrote a
field 8 months ago with stale data, plain "overwrite if blank" locks
the stale value in permanently because the field is not blank. "We last
wrote it" lets the tool refresh its own output with fresh data while
still protecting human edits.

The ResolvedField provenance layer already stores source and
retrieved_at on every field. The "we last wrote it" check reads the
stored source. No additional data model is required.

This is the Clearbit legacy model and the most defensible default.

**Policy 2: Always overwrite**

The incoming value always replaces whatever is in the CRM field. Use
for fields where enrichment data is more reliable and more current than
anything a human would enter: tech stack, LinkedIn URL, employee count,
domain.

**Policy 3: Never overwrite, route to secondary field**

The CRM field is fully protected. If an incoming value exists and a
secondary field is configured, the value is written there instead. If
no secondary field is configured, the incoming value is silently
discarded and logged.

Use for fields where rep-entered data must be preserved: phone for
accounts with active relationships, custom notes, manually assigned
segments.

### The source trust ranking interacts with policy 1

When policy 1 is active and the existing CRM value was written by
another enrichment source (not a human), the tool compares source trust
ranks. If the incoming source outranks the existing source, it
overwrites. If it is lower-ranked or equal, it routes to secondary if
configured.

Trust ranking is the configurable provider order set in Dedup Settings.

### Per-field policy configuration

Configured in the field mapping table. One row per canonical field.

```
┌─────────────────────┬──────────────────────┬─────────────────────────┬────────────────────┐
│ Canonical Field     │ Primary CRM Field    │ Secondary CRM Field     │ Write Policy       │
├─────────────────────┼──────────────────────┼─────────────────────────┼────────────────────┤
│ company.name        │ Company Name         │ —                       │ Blank or we wrote  │
│ company.domain      │ Website              │ —                       │ Always overwrite   │
│ company.revenue     │ Annual Revenue       │ Enriched Revenue (cust) │ Blank or we wrote  │
│ company.industry    │ Industry             │ CB Industry (custom)    │ Blank or we wrote  │
│ company.phone       │ Phone                │ Enriched Phone (custom) │ Never overwrite    │
│ company.employees   │ Number of Employees  │ —                       │ Always overwrite   │
│ company.tech_stack  │ Tech Stack (custom)  │ —                       │ Always overwrite   │
└─────────────────────┴──────────────────────┴─────────────────────────┴────────────────────┘
```

The secondary field is any CRM field the user has created. Standard
practice (per Clearbit's recommendation) is to create enrichment-
specific custom fields so native CRM fields are preserved. The product
supports this pattern natively without requiring manual copy/move
templates.

---

## Secondary Field Routing

When write policy is "Never overwrite" and a secondary field is
configured, the incoming enriched value routes to the secondary field
instead of being discarded. When write policy is "Blank or we wrote it"
and the field is protected by a higher-priority source, the value also
routes to secondary if configured.

**For phone and email fields specifically**, the secondary routing
follows Apollo's model: existing values stay in the primary field,
enriched values are appended as secondary phone or secondary email in
the CRM's native multi-value structure (HubSpot supports multiple phone
numbers and emails per record). No custom secondary field is required
for these field types.

**Append mode** (for text and notes fields): when the secondary field
is a text area type and the user has opted into append, the incoming
value is appended with a datestamp and source prefix rather than
overwriting the secondary field. This creates a running enrichment log
visible to reps inside the CRM.

Example append output in a Notes field:
```
[ZoomInfo · 2024-11-04] Revenue: $52M · Employees: 201-500 · Industry: Financial Services
[Apollo · 2024-08-12] Revenue: $45M · Employees: 201-500
```

Append is opt-in per field. It is not the default.

---

## Archive Fields on Merge

When a merge executes (whether manual or auto), the non-surviving
record may have field values that differ from the master and that
survivorship rules do not carry forward. By default, these values are
captured only in the audit log snapshot.

Optionally, an archive field can be configured per canonical field.
When a merge executes:
- The surviving field value writes to the primary CRM field per
  survivorship rules
- The non-surviving field value writes to the configured archive field
  on the master record before the non-surviving record is retired

This is the Ringlead "Archive Field Values Overwritten" model. It gives
the GTM systems lead a visible record of what was lost in the merge,
inside the CRM record itself, without needing to open the audit log.

Example: `company.revenue` archive field is `Merged Revenue Archived`.
After a merge, the master record has `Annual Revenue: $52M` (surviving)
and `Merged Revenue Archived: $45M` (retired record's value). Both are
visible in HubSpot.

Archive field configuration is optional and per canonical field.

---

## Survivorship Logic

When two records merge, field-level survivorship determines which value
survives. Rules are applied in this priority order.

**For fields present in both records:**

1. If one value is from a higher-trust source: prefer that source.
   Trust ranking (configurable per org): ZoomInfo > Apollo > Clay >
   Serper > Self-reported. Rationale: enterprise data vendors invest
   in accuracy for specific field types (ZoomInfo for revenue, Apollo
   for contact data). Defaults reflect this but can be overridden.

2. If sources have equal trust: prefer the more recently enriched value
   per the `retrieved_at` timestamp in ResolvedField provenance.

3. If both have the same source and recency: prefer the more complete
   value (non-null, longer string for text fields, more specific for
   taxonomy fields).

4. If all else is equal: prefer the master record's value.

**For fields present in only one record:** always use the non-null value.

**For fields present in neither record:** null in merged result.

**CRM metadata:** Always inherited from the master record (created date,
CRM owner, CRM record ID). Activities and associations from the non-
master record are reassigned to the master, not merged.

**The provenance layer makes this precise.** Because every field in a
normalized record carries its source and retrieval timestamp in
ResolvedField, survivorship is not a guess. It is a deterministic rule
applied to metadata that already exists.

---

## Dedup Settings

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Settings › Deduplication                                                │
├─────────────────────────────────────────────────────────────────────────┤
│  Prevention Mode                                                         │
│  [✓] Check CRM for duplicates before every write                        │
│                                                                          │
│  Block threshold (auto-upsert)        [ 0.90 ]                          │
│  Review threshold (hold and queue)    [ 0.60 ]                          │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│  Auto-Merge                                                              │
│  [ ] Enable auto-merge for high-confidence duplicates                   │
│                                                                          │
│  Confidence threshold   [ 0.95 ]                                        │
│  Waiting period         [ 24  ] hours before merge executes             │
│  Master record rule     [ Most recently enriched          ▼ ]           │
│                         [ Most recently created              ]           │
│                         [ Most recently modified             ]           │
│                         [ Most complete (fewest null fields) ]           │
│                                                                          │
│  Notify before merge:  [✓] Email    [✓] Slack  [ webhook URL... ]       │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│  Scheduled Cleanup Scan                                                  │
│  [ ] Run automatic duplicate scan                                       │
│  Frequency  [ Weekly ▼ ]   Day  [ Monday ▼ ]   Time  [ 9:00 AM ▼ ]     │
│                                                                          │
│  Source trust ranking (drag to reorder)                                 │
│  1. ZoomInfo  2. Apollo  3. Clay  4. Serper  5. Self-reported           │
│                                                             [ Save ]    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Audit Trail

Every merge, whether manual or automated, produces an immutable audit
record. This is non-negotiable: the merge operation retires a CRM record
permanently. The audit log is the recovery surface.

**What is logged per merge:**

- Timestamp of execution
- Trigger: manual (user email) or auto (threshold + waiting period)
- Confidence score at time of decision
- Master record ID (surviving CRM record)
- Retired record ID (non-surviving CRM record)
- Full JSON snapshot of both records at the moment of merge
- Field-level survivorship decisions: which record's value was taken for
  each field and why
- Associations reassigned: count and types

**Audit trail UI:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Merge History                                                           │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┬────────────┬────────────────────┬───────────────┐ │
│  │ Records          │ Date       │ Trigger            │               │ │
│  ├──────────────────┼────────────┼────────────────────┼───────────────┤ │
│  │ Stripe · Stripe  │ Nov 4      │ Auto (0.94, 24h)   │ [ View ]      │ │
│  │ Figma · Figma C. │ Nov 4      │ Auto (0.97, 24h)   │ [ View ]      │ │
│  │ Plaid · Plaid Co │ Nov 2      │ Manual — j@rev.us  │ [ View ]      │ │
│  └──────────────────┴────────────┴────────────────────┴───────────────┘ │
│                                                                          │
│  Note: Merged records cannot be unmerged through this interface.         │
│  The pre-merge snapshots below can be used to manually recreate a        │
│  record if a merge was made in error.                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

**No undo.** Merges are not reversible through the product. The audit
log provides the pre-merge snapshots that an admin can use to manually
recreate a record in the CRM if needed. This is documented clearly in
the UI. The waiting period is the undo mechanism — use it.

---

## Notifications

| Trigger | Message | Channel |
|---------|---------|---------|
| Review queue has new items | "N potential duplicates need review" | Email + Slack |
| Auto-merge scheduled | "N companies merge in X hours. Review to cancel." | Email + Slack |
| Auto-merge executed | "N companies were merged automatically." | Email |
| Prevention blocked a write | "A record was held: potential match exists in CRM." | In-app |
| Cleanup scan complete | "Scan found N potential duplicates." | Email + Slack |

---

## Data Model

### `dedup_settings`

```sql
create table dedup_settings (
  org_id                  text primary key,
  prevention_enabled      boolean default true,
  block_threshold         numeric default 0.90,
  review_threshold        numeric default 0.60,
  auto_merge_enabled      boolean default false,
  auto_merge_threshold    numeric default 0.95,
  waiting_period_hours    integer default 24,
  master_record_rule      text default 'most_recently_enriched',
  source_trust_ranking    text[] default array['zoominfo','apollo',
                            'clay','serper','self_reported'],
  notify_email            text,
  notify_slack_webhook    text,
  scan_enabled            boolean default false,
  scan_frequency          text default 'weekly',
  updated_at              timestamptz default now()
);
```

### `dedup_clusters`

```sql
create table dedup_clusters (
  id                    uuid primary key default gen_random_uuid(),
  org_id                text not null,
  object_type           text default 'company',
  record_a_crm_id       text not null,
  record_b_crm_id       text not null,
  record_a_snapshot     jsonb not null,
  record_b_snapshot     jsonb not null,
  confidence_score      numeric not null,
  match_reason          text not null,
  status                text default 'pending_review',
  proposed_master_id    text,
  merge_scheduled_at    timestamptz,
  reviewed_by           text,
  detected_at           timestamptz default now(),
  updated_at            timestamptz default now()
);

-- status values:
-- pending_review   awaiting manual review
-- pending_merge    scheduled auto-merge, in waiting period
-- merged           merge executed
-- dismissed        confirmed duplicate, no action
-- not_duplicate    confirmed not a match, suppressed from future scans

create index on dedup_clusters (org_id, status);
create index on dedup_clusters (org_id, record_a_crm_id);
create index on dedup_clusters (org_id, record_b_crm_id);
```

### `dedup_merge_log`

```sql
create table dedup_merge_log (
  id                          uuid primary key default gen_random_uuid(),
  org_id                      text not null,
  cluster_id                  uuid references dedup_clusters(id),
  master_crm_id               text not null,
  retired_crm_id              text not null,
  pre_merge_master_snapshot   jsonb not null,
  pre_merge_retired_snapshot  jsonb not null,
  survivorship_decisions      jsonb not null,
  confidence_score            numeric,
  merge_type                  text not null,
  executed_at                 timestamptz default now(),
  executed_by                 text
);

-- merge_type values: 'manual' | 'auto'
-- executed_by: user email for manual, 'system:auto-merge' for auto
```

---

## Corporate Hierarchy Awareness

Domain is a reliable definitive signal only when one domain maps to one
legal entity. Parent-child company structures break this assumption.
Multi-location health groups, franchise systems, and enterprise
subsidiaries may all share a parent brand's domain while being distinct
CRM records representing separate business relationships.

### The three parent-child cases

**Case 1: Explicitly linked parent-child records.**
Records are associated via the CRM's native parent company relationship
(HubSpot's Parent Company association, Salesforce's ParentId). These
are intentionally separate entities. They must be permanently suppressed
from dedup — never surfaced as duplicate candidates regardless of
domain, LinkedIn URL, or name similarity.

**Case 2: Sibling entities (same domain, different parents).**
Two records share a domain but have different parent company IDs in the
CRM. They are subsidiaries of different corporate families. Domain
match is misleading. Score 0.0. Proceed with insert.

**Case 3: Same domain, no parent company configured.**
The common case for Series A to C B2B SaaS customers. No corporate
hierarchy is configured. Domain match is a reliable definitive signal.
Original cascade behavior. Score 1.0, auto-merge eligible.

**Case 4: Same domain, same parent company.**
Two records share a domain and share the same parent company. Likely
duplicates within the same corporate group (entered twice). Score 1.0
but route to review queue — not auto-merge. The same-parent context
should be surfaced in the review UI.

**Case 5: One record has a parent, the other does not.**
Ambiguous. Could be a parent-child relationship or a true duplicate.
Score 0.75. Review queue only. Context displayed: "Possible parent or
subsidiary relationship — verify before merging."

### Parent association check at Tier 2 and Tier 3

The parent association check runs after a Tier 2 (domain) or Tier 3
(LinkedIn URL) match is found, before scoring. It reads from the
`parentIndex` built during the company index pre-fetch.

The `buildCompanyIndex` function is extended to pull parent company
associations alongside domain, LinkedIn URL, and Apollo org_id.

```typescript
type CompanyIndex = {
  domainIndex:   Map<string, string>   // domain → hubspot_id
  linkedInIndex: Map<string, string>   // linkedin_url → hubspot_id
  apolloIndex:   Map<string, string>   // apollo_org_id → hubspot_id
  parentIndex:   Map<string, string>   // hubspot_id → parent_hubspot_id
  childIndex:    Set<string>           // hubspot_ids that are children of any parent
}
```

### Suppression for parent-child pairs

When a pair is identified as explicitly parent-child linked (Case 1),
it is added to the suppression table with `reason: 'parent_child'`.
This suppression is permanent and is not reversible from the standard
"Not a Duplicate" UI. It requires a manual admin action to remove,
since removing it would re-surface parent-child pairs as duplicate
candidates.

### HubSpot API scope addition

Reading parent company associations requires the
`crm.objects.companies.read` scope (already in the spec) plus the
associations endpoint. The company index pre-fetch adds one additional
paginated call: fetch all company-to-company associations of type
`parent_company` for the portal.

---



**enrichment_apply MCP tool:** The prevention gate is called at the
start of every `enrichment_apply` execution. If the gate blocks a write,
`enrichment_apply` returns a `dedup_blocked` status with the matched
CRM record ID and confidence score instead of a success response.

**ResolvedField provenance:** The survivorship engine reads `source` and
`retrieved_at` from ResolvedField on every normalized record to make
field-level decisions. No manual field priority configuration is needed
when this data is present.

**Compliance dashboard:** The compliance dashboard's `normalized_records`
table records which Harmony versions normalized each field. The dedup
engine reads from this table as part of the blocking step — records
that share a normalized domain in `normalized_records` are natural
blocking candidates.

**HubSpot integration:** The merge executor calls the HubSpot Merge
Companies API. The master record's company ID is preserved. All
associated objects (contacts, deals, activities) are reassigned
automatically by HubSpot on merge. The CRM snapshot is taken before
the API call.

**Salesforce integration (future):** The Salesforce Merge sObject API
follows the same pattern. No changes to the dedup engine logic are
needed, only the merge executor implementation.

---

## Suppressions

Not all near-matching records are duplicates. A holding company and a
subsidiary may share a domain prefix. A franchise and its parent may
share a name. The user should be able to mark any cluster as "Not a
Duplicate" permanently.

Suppressed pairs are stored and excluded from all future scans. The
suppression list is viewable and reversible in settings.

---

## Competitive Differentiation

The following capabilities distinguish this product from Clearbit,
Apollo, Ringlead, and Insycle in the write policy and dedup space.

**External canonical ID cascade before name matching**

Every competitor that attempts company dedup falls back to name
similarity when domain is absent. Name similarity in a vertically-
concentrated database generates systematic false positives — healthcare
companies share "Health", fintech companies share "Capital", SaaS
companies share "Solutions." The weighted scoring model cannot
distinguish vertical vocabulary from differentiating terms.

This product's cascade inserts LinkedIn company URL and external
canonical IDs (Apollo org_id) as deterministic signals before name
matching is ever attempted. Two companies that enrich to the same
Apollo org_id are the same company with certainty, regardless of how
their names were typed. Name fuzzy matching is only reached when no
definitive signal exists, and even then it uses vertical stopword
filtering to suppress common industry terms.

No competitor implements this cascade. Insycle, Koalify, and Ringlead
all reach name matching as a primary or secondary signal.

**Provenance-aware survivorship**

Every competitor tracks "who last wrote this field" in a binary way:
this tool or not this tool. This product tracks field-level provenance
at a finer resolution: source name, retrieval timestamp, and confidence
score stored in ResolvedField on every normalized field.

This enables survivorship decisions no other tool can make:
- "Take ZoomInfo's revenue over Apollo's because ZoomInfo outranks
  Apollo on financial data in the configured source trust order"
- "Both sources agree on Financial Services as the industry
  (consensus). High-confidence write."
- "This field was enriched 9 months ago from a low-trust source. The
  incoming value is 3 months old from a higher-trust source. Overwrite."

Clearbit, Apollo, and Ringlead cannot replicate this without rebuilding
their data model. The provenance layer is the moat.

**The "blank or we last wrote it" default with source awareness**

The industry standard default is "overwrite if blank." Clearbit's
legacy product improved on this with "blank or we last wrote it." This
product improves further: "blank, or we last wrote it with a lower-
trust or older value." Fresh data from a higher-trust source updates
the field even if this tool wrote it previously. Stale enrichment from
a lower-trust source does not protect a field from a better value.

No current competitor implements this. It requires the provenance layer.

**Generalized secondary field routing**

Apollo implements secondary routing only for phone and email fields.
Clearbit's approach is a manual recommendation (create CB Industry
custom fields yourself) with no in-product routing logic. Insycle
requires a manual transformation template.

This product implements secondary field routing for every canonical
field through the field mapping configuration. One setup, consistent
behavior, no templates.

**Dedup gate inside the enrichment pipeline**

Ringlead prevents duplicates at point of manual entry, form submit, and
list import. Apollo prevents duplicates when contacts are created via
Apollo. Neither tool gates the CRM write-back from a third-party
enrichment pipeline.

This product's dedup gate runs inside `enrichment_apply` before every
CRM write regardless of source. A duplicate cannot enter through the
enrichment pipeline. No competitor implements this.

**Transparent, versioned, community-owned normalization rules**

Every competitor normalizes data using opaque internal logic. You
cannot see the rules, audit the decisions, override them per field, or
contribute improvements. Harmonies are YAML plus JSONata. Every rule is
readable, auditable, testable, and versionable. Users can author and
share Harmonies in the marketplace. The dbt model applied to data
normalization.

**BYOK orchestration model**

Every enrichment tool in the market either sells you their proprietary
database (Clearbit, Apollo, ZoomInfo) or cleans data from your own CRM
(Insycle). None of them work with the provider contracts you already
have. This product orchestrates your existing Apollo and ZoomInfo
access, normalizes the output, and writes back to your CRM. You pay
for orchestration, normalization, and dedup tooling. You do not pay
twice for data you already license.

**Continuous compliance monitoring**

Every competitor enriches records at a point in time. None monitor
whether enriched fields remain compliant with normalization rules as
Harmonies are updated and new data enters over time. The compliance
dashboard plus Harmony versioning creates a continuous data quality
operating system rather than a point-in-time enrichment job. The
compliance score is a maintained metric, not a one-time event.

---

## Out of Scope for v1

- **Person (contact) deduplication.** Different matching signals,
  different merge implications (contacts have deal and activity history
  per rep). Separate phase.
- **Cross-object dedup.** Contact deduped against a Lead, or a CRM
  Account matched against a HubSpot Company.
- **Probabilistic ML classifier.** The v1 weighted rule-based approach
  handles the majority of cases. The Fellegi-Sunter model requires
  confirmed match training data that does not exist until v1 has been
  in production. Designed as a drop-in classifier replacement.
- **Transitive clustering.** v1 only merges direct pairs that exceed
  the confidence threshold. If A matches B and B matches C but A does
  not directly match C, only A/B and B/C are surfaced as clusters. Full
  transitive closure comes in v2.
- **Bulk undo.** There is no automated rollback. The audit log and pre-
  merge snapshots are the recovery path.
- **Custom matching weights per org.** v1 uses global defaults. Per-org
  field weight configuration is v2.

---

## Open Questions

1. **Name prefix blocking in concentrated verticals.** The cascade
   restricts tier-7 name prefix blocking when more than 5% of records
   share the same prefix. The right threshold for this restriction
   needs validation against real customer databases. Is 5% the right
   cutoff, or should it be configurable per org?

2. **Merge executor for HubSpot free tier.** The HubSpot Merge Companies
   API requires a paid plan. How should the product handle orgs on the
   free tier — surface clusters for review but disable the merge action,
   or gate the feature entirely behind connected paid CRM?

3. **Multi-record clusters.** What happens when three or more records
   represent the same company? The v1 spec treats all clusters as pairs.
   Should three-way clusters be surfaced as multiple pair reviews or as
   a single multi-record merge screen?

4. **Survivorship for CRM-enriched fields.** When an existing CRM record
   has a field that was manually edited by a sales rep (no ResolvedField
   provenance, no source metadata), should it always win over an
   incoming enriched value? The assumption should be yes — human edits
   are intentional — but this needs to be a configurable setting.

5. **Duplicate suppression scope.** Should "Not a Duplicate" suppress
   the specific pair permanently, or should it suppress any future
   cluster involving either record? The latter is aggressive but
   appropriate for franchise/subsidiary structures.

---

*RevOps Impact, LLC — Internal Product Documentation*
