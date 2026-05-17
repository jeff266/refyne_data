# PRD Addendum: Contact Deduplication Engine
**Feature codename:** Contact Dedupe
**Extends:** DEDUPE_PRD_ADDENDUM.md (company dedup)
**Scope:** Contact and person records only
**Status:** Draft

> This document extends the company dedup PRD. Read that document first.
> Shared concepts (confidence bands, waiting period, audit trail,
> survivorship, write policies) are not repeated here. This document
> covers what is different about contact dedup.

---

## Overview

Contact deduplication is materially harder than company deduplication.
Domain is a near-deterministic signal for companies: one domain equals
one company with very high confidence. Contacts have no equivalent
anchor. The same person can have multiple email addresses, use
nicknames, change their name, change jobs, and appear in the CRM
through multiple entry paths with no shared identifier.

The central design decision: contact dedup matching rules are
implemented as Harmonies. This extends the Harmony spec with
`type: dedup`, allowing the same Harmony Library, marketplace, GitHub
repository, and community model to govern both normalization rules and
dedup matching rules. Users browse, apply, and author dedup Harmonies
the same way they work with normalization Harmonies.

---

## How Contact Dedup Differs from Company Dedup

| Dimension | Company | Contact |
|-----------|---------|---------|
| Primary definitive signal | Domain (near-certain) | Email OR LinkedIn URL (each ~90% coverage) |
| Signal persistence across change | Domain is stable | Email changes on job change; LinkedIn URL persists |
| Nickname problem | Minimal | Significant (Jennifer/Jen/Jenny/Jenn) |
| Identity change | Rare | Marriage name changes, preferred name updates |
| Same entity, two records | Usually a data error | Often intentional (person at two companies) |
| Auto-merge threshold | Conservative | More conservative — higher false positive risk |
| Job change case | Not applicable | Requires its own action type, not a standard merge |

The job change case is the most important structural difference. When
the same LinkedIn URL appears on contact records associated with two
different companies, that is not necessarily a duplicate. It may be:
- A true duplicate (accidentally created twice)
- A job change (person moved companies, new record created correctly)
- A current role plus a former employer association

No existing tool handles this distinction. All current tools either
merge these records or surface them as standard review candidates.
This product introduces a dedicated `flag_job_change` action type.

---

## The Harmony Extension: type: dedup

Normalization Harmonies are `type: normalize`. They transform field
values. Dedup Harmonies are `type: dedup`. They define matching rules
that identify candidate duplicate pairs, score them, and prescribe
an action.

### Dedup Harmony YAML spec

```yaml
id: contact-exact-email
version: 1.0.0
name: Contact Dedup — Exact Email Match
description: Identifies duplicate contacts sharing the same email address.
  Email exact match is the highest-confidence contact signal.
type: dedup
object: contact
category: contact-dedup
recommended: true

# Blocking groups candidate pairs efficiently.
# Only records within the same block are compared.
blocking:
  - field: email_domain       # Block on email domain (fast index lookup)
    strategy: exact

# Matching scores a pair field by field.
# Weights sum to 1.0. Missing fields are excluded and weights redistributed.
matching:
  - id: email-exact
    field: email
    strategy: exact
    weight: 1.0

# Confidence thresholds determine the action taken.
thresholds:
  auto_merge: 1.0             # Exact email match is definitive
  review: 0.80

# What happens at each threshold.
action:
  at_auto_merge: merge
  at_review: queue
  master_rule: most_recently_modified

# Embedded test cases. All must pass. Blocking save if any fail.
tests:
  - name: Exact email match
    record_a: { email: john.smith@acme.com }
    record_b: { email: john.smith@acme.com }
    expected_score: 1.0
    expected_action: merge

  - name: Different email, no match
    record_a: { email: john.smith@acme.com }
    record_b: { email: jane.smith@acme.com }
    expected_score: 0.0
    expected_action: none

  - name: Same email, different case
    record_a: { email: John.Smith@Acme.com }
    record_b: { email: john.smith@acme.com }
    expected_score: 1.0
    expected_action: merge
```

### Dedup Harmony spec fields

| Field | Description |
|-------|-------------|
| `type: dedup` | Identifies this as a matching rule, not a transformation |
| `object` | `contact` or `company` |
| `blocking` | How to group candidate pairs for comparison. Array of field + strategy pairs. |
| `matching` | Ordered array of field comparisons with weights. Weights sum to 1.0. |
| `thresholds.auto_merge` | Confidence score at or above which the Harmony triggers an automatic merge (subject to waiting period). |
| `thresholds.review` | Confidence score above which the pair is surfaced in the review queue. |
| `action.at_auto_merge` | `merge`, `review`, or `flag_job_change` |
| `action.at_review` | `queue` or `flag_job_change` |
| `action.master_rule` | Survivorship rule: `most_recently_modified`, `most_recently_enriched`, `most_complete` |

### Matching strategies

| Strategy | Description | Use for |
|----------|-------------|---------|
| `exact` | Exact string match after normalization (lowercase, trim) | Email, phone, LinkedIn URL |
| `fuzzy` | Levenshtein similarity with configurable threshold | Name, company name |
| `domain_extract` | Extract and compare email domain | Email domain matching |
| `prefix` | First N characters exact match | Blocking key construction |
| `phonetic` | Soundex/Metaphone for name comparison | Nickname variations |

---

## Matching Signal Hierarchy for Contacts

| Signal | Confidence | Coverage | Notes |
|--------|-----------|----------|-------|
| Email exact | Definitive | ~85% | Missing on ~15% of imported contacts |
| LinkedIn URL canonical | Definitive | ~90% | Persists across job changes. Highest cross-company confidence. |
| Phone E.164 exact | Very high | ~60% | Personal mobile is stable; work numbers change |
| First + Last + Company domain | High | ~80% | Catches within-company duplicates cleanly |
| First + Last + Email domain | High | ~75% | Handles personal vs work email variation |
| First + Last + Phone | High | ~70% | Good when no email available |
| Name (fuzzy) alone | Low | — | Too broad — never use without a second signal |

---

## Two-Tier Blocking Strategy

### Tier 1: Within-company blocking

Block candidate pairs by associated company record. Compare only
contacts associated with the same company. This handles the "same
person, same employer, two records" case — typically a data entry
error or integration duplicate.

Within this tier, matching is higher confidence and auto-merge
thresholds can be applied more aggressively.

### Tier 2: Cross-company blocking

Block candidate pairs by LinkedIn URL canonical form, email, or
phone. These candidates may represent the same person at different
companies (job change) or true duplicates that happened to be
entered under different company associations.

Within this tier, auto-merge is never triggered. All matches go to
the review queue or the job change queue depending on whether
associated companies differ.

---

## Recommended Starter Harmonies

Seven Harmonies covering the primary contact dedup scenarios. All are
marked `recommended: true`. The UI surfaces these as a one-click
"Apply All Recommended" option in the Dedup Harmonies selector.

### 1. `contact-exact-email`
**Signal:** Email exact match
**Block by:** Email domain
**Threshold:** Auto-merge at 1.0 (definitive)
**Notes:** Core Harmony. Should always be active. Handles the majority
of true duplicates (same person, same email, entered twice).

---

### 2. `contact-linkedin-exact`
**Signal:** LinkedIn URL canonical match
**Block by:** LinkedIn URL prefix
**Threshold:** Never auto-merge. Review queue at 1.0.
**Action at review:** Standard merge queue (not job change queue)
if associated companies are the same. Job change queue if associated
companies differ.
**Notes:** LinkedIn URL is the person-equivalent of company domain.
Definitive identity signal that persists across job changes.

---

### 3. `contact-same-company-name-email-domain`
**Signal:** Same company + fuzzy name + same email domain
**Block by:** Associated company ID
**Matching:** Name fuzzy (0.60) + email domain exact (0.40)
**Threshold:** Review at 0.70. No auto-merge.
**Notes:** Catches nickname variations within a company. "Jennifer
Smith" and "Jen Smith" at the same company with the same email domain
(@acme.com) are very likely the same person.

---

### 4. `contact-same-company-name-phone`
**Signal:** Same company + fuzzy name + exact phone
**Block by:** Associated company ID
**Matching:** Name fuzzy (0.60) + phone E.164 exact (0.40)
**Threshold:** Review at 0.70. No auto-merge.
**Notes:** Fallback for within-company dedup when email is absent.
Phone as the second signal is strong enough for a high-confidence
review candidate.

---

### 5. `contact-phone-exact`
**Signal:** Phone E.164 exact match (cross-company)
**Block by:** Phone prefix (first 6 digits)
**Matching:** Phone exact (1.0)
**Threshold:** Review at 1.0. No auto-merge.
**Notes:** Exact phone match cross-company is a strong signal,
especially for mobile numbers. Surfaces as review, not auto-merge,
because different people occasionally share work phone lines.

---

### 6. `contact-job-change-detection`
**Signal:** Same LinkedIn URL, different associated companies
**Block by:** LinkedIn URL prefix
**Matching:** LinkedIn URL exact (1.0)
**Threshold:** Never auto-merge.
**Action:** `flag_job_change` (see Job Change Detection section)
**Notes:** This Harmony does not merge records. It surfaces them as
a job change event for the GTM systems lead to act on.

---

### 7. `contact-name-phone-cross-company`
**Signal:** Fuzzy name + exact phone (no company constraint)
**Block by:** Phone prefix
**Matching:** Name fuzzy (0.60) + phone exact (0.40)
**Threshold:** Review only at 0.80. Never auto-merge.
**Notes:** Lower confidence. Manual review only. The comparison space
can be large without a company blocking key, so use with rate limiting
on the scan frequency.

---

## The Job Change Detection Case

### The problem

Same LinkedIn profile on two contact records at different companies:

```
Contact A: John Smith | john@acme.com | Acme Corp | linkedin.com/in/jsmith
Contact B: John Smith | john@globex.com | Globex Corp | linkedin.com/in/jsmith
```

This is not necessarily a data error. It may be:
- **True duplicate**: Someone created John at Globex without knowing
  Acme already had him. Merge is correct.
- **Job change**: John left Acme and joined Globex. Both records are
  correct. Merge may destroy historical context.
- **Current + past relationship**: John is a current customer at
  Globex and a former contact at Acme. Keep both.

### The action type: `flag_job_change`

When a Dedup Harmony's action is `flag_job_change`, matched pairs go
to a dedicated **Job Change Queue**, separate from the standard merge
queue. The UI prompt is distinct:

```
┌────────────────────────────────────────────────────────────────────────┐
│  Same person detected at two companies                                  │
├────────────────────────────────────────────────────────────────────────┤
│  John Smith appears in two company records with the same LinkedIn       │
│  profile. This may be a duplicate or a job change.                     │
│                                                                         │
│  Contact A: john@acme.com · Acme Corp (created Mar 2022)               │
│  Contact B: john@globex.com · Globex Corp (created Nov 2024)           │
│                                                                         │
│  What would you like to do?                                             │
│                                                                         │
│  [ Merge into one record ]                                              │
│  [ Keep separate, mark as same person ]                                 │
│  [ Not the same person — dismiss ]                                      │
└────────────────────────────────────────────────────────────────────────┘
```

**Keep separate, mark as same person** creates a relationship link
between the two contact records (a `same_person_link` in the database)
without merging them. Deal and activity history stays on each
respective record. The CRM card on each contact shows "Same person
also exists at [other company]."

---

## Pre-processing: Role Address Filtering

Before any contact dedup runs, filter out shared-inbox email addresses
that are not personal contacts. These addresses generate false positives
if matched on email:

- Prefixes to suppress: info@, hello@, sales@, support@, admin@,
  contact@, enquiries@, billing@, accounts@, team@, noreply@,
  no-reply@
- Any email at a free consumer domain that is suspiciously generic

This filter runs before the blocking step. Contacts with suppressed
emails proceed to name-based matching only.

---

## Survivorship Logic for Contacts

Extends the company survivorship rules with contact-specific fields.

**Title and role:** Prefer the most recently updated value. Titles
change with job changes. The ResolvedField provenance timestamp
determines recency.

**Associated company:** Do not change company association during a
contact merge unless explicitly chosen by the user. Merging John
Smith's two records should not silently move his open deals to the
wrong company.

**Activity history:** All activities, emails, and notes from both
records are preserved on the surviving record. HubSpot's merge API
handles this; verify it fires correctly.

**Email addresses:** The non-surviving record's email is added as a
secondary email on the surviving record (not discarded). A person's
old work email is still valuable for matching future inbound.

---

## The Recommended Badge in the UI

The Dedup Harmonies selector shows a **Recommended** section at the
top containing the seven Harmonies above. A single button — "Apply
All Recommended" — activates all seven with their default thresholds.

New users can go from zero to a fully configured contact dedup setup
in under two minutes. This is the onboarding activation moment for
the dedup feature.

Users who want to customize clone a recommended Harmony and modify
the YAML. The original recommended Harmony remains unchanged.

---

## Open-Source on GitHub

Dedup Harmonies live in the same GitHub repository as normalization
Harmonies, in a `/contact-dedup/` subdirectory:

```
harmonies/
  /business-entities/          (normalization)
  /geography/                  (normalization)
  /contact-dedup/              (dedup matching rules)
    contact-exact-email/
      harmony.yaml
      README.md
    contact-linkedin-exact/
    contact-job-change-detection/
    ...
```

The same contribution model applies: PRs from the community, version
pinning, platform reads from tagged releases.

---

## Data Model

### `dedup_harmony_configs`

Stores which dedup Harmonies are active per org and their threshold
overrides.

```sql
create table dedup_harmony_configs (
  id              uuid primary key default gen_random_uuid(),
  org_id          text not null,
  harmony_id      text not null,          -- e.g. 'contact-exact-email'
  harmony_version text not null,          -- e.g. '1.0.0'
  enabled         boolean default true,
  threshold_overrides jsonb,              -- override auto_merge/review
  created_at      timestamptz default now()
);
```

### `same_person_links`

Stores "same person, different company" relationships created by the
job change detection flow.

```sql
create table same_person_links (
  id              uuid primary key default gen_random_uuid(),
  org_id          text not null,
  contact_a_crm_id text not null,
  contact_b_crm_id text not null,
  link_type       text default 'job_change',  -- 'job_change' | 'confirmed_same'
  confidence      numeric,
  created_at      timestamptz default now(),
  created_by      text                        -- user email or 'system'
);
```

---

## Integration Points

**Same pipeline gate as company dedup.** Before writing a contact
record to the CRM, the dedup gate runs all active contact Dedup
Harmonies for the org. High-confidence matches upsert. Review-zone
matches queue. Job change detections go to the job change queue.

**Dedup settings.** Contact dedup uses the same `dedup_settings`
table and `org.dedup_settings` weights as company dedup. One config.

**Audit trail.** Same `dedup_merge_log` table structure as company
dedup. Job change links log to `same_person_links`, not to the merge
log.

---

## Out of Scope for v1

- **Cross-object dedup.** Salesforce has separate Lead and Contact
  objects. Contacts appearing as both a Lead and a Contact in Salesforce
  is a separate problem (Lead-to-Contact conversion). HubSpot does not
  have this problem natively.
- **Automatic job change processing.** Detecting a job change and
  automatically updating the contact's company association, creating
  new records at the new company, or archiving the old association.
  This is a data enrichment workflow, not a dedup workflow.
- **Probabilistic ML for name matching.** The v1 fuzzy matching
  uses Levenshtein distance. A trained model for nickname resolution
  (Jennifer/Jen/Jenny) is v2.
- **Person dedup across custom objects.** HubSpot custom objects
  are a separate phase.

---

## Open Questions

1. **"Keep separate, mark as same person" in HubSpot.** HubSpot does
   not natively support a "related person" association between two
   contact records. The `same_person_links` table stores this
   relationship in the product's database. Does a HubSpot custom
   property need to be created to surface it in the CRM natively?

2. **Role address suppression list.** The prefix list above is a
   starting point. Should this be a configurable suppression list per
   org, or a shared Harmony?

3. **Fuzzy name threshold.** Levenshtein similarity of 0.80 is the
   default for "fuzzy" name matching. Is this aggressive enough for
   nicknames (Jennifer/Jen = 0.54 similarity), or does phonetic
   matching need to be the default for name fields?

4. **Email dedup across secondary emails.** If Contact A's primary
   email is john@acme.com and Contact B has john@acme.com as a
   secondary email, should this trigger a match? Currently the
   spec only matches on primary email.

---

*RevOps Impact, LLC — Internal Product Documentation*
