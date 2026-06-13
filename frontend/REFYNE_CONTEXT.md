# Refyne Context

**Last updated:** 2026-06-12 (Session - Upgrade CTAs, Clickable Plan Badges, Signal Groups Fix)
**Status:** Active development
**Product name:** Refyne (working name, may change)

---

## What Refyne Is

Refyne is a HubSpot-native CRM data quality platform targeting Series A-C RevOps teams. It sits between B2B data providers and HubSpot, combining CRM cleaning (dedup, normalize, harmonize) with native enrichment via a managed Refyne Search pipeline (Serper + Jina + DeepSeek/Haiku) and a BYOK model for third-party providers (Apollo, GraphIQ). Competes directly with Insycle; positions against Openprise/Syncari as enterprise anchors for pricing conversations.

Tagline: "All your data providers. One clean CRM."

---

## Current Test Floor

**1,762 passing tests** across 84+ test files.
Never go below this. Fix code, never delete tests.

---

## Key Product Decisions (Do Not Revisit)

1. **TypeScript consolidation** - All provider adapters, normalization engine, pipeline logic in TypeScript. No Python runtime.
2. **BYOK model** - Apollo, ZoomInfo, Cognism, Clearbit use customer keys. GraphIQ, TinyFish, Serper use platform keys.
3. **HubSpot first, Salesforce later** - All test accounts are HubSpot.
4. **Dedup gate on every write** - Runs before every CRM write.
5. **Training pairs from onboarding calibration are read-only** - Written to dedup_decisions with source='onboarding_calibration' only.
6. **Org ID from session only** - Never from request body or query params.
7. **Build locally before pushing** - Always run npm run build to catch TypeScript errors before they fail in Vercel.
8. **Never a dead end** - Every blocked feature must show upgrade path with clickable links to billing page.

---

## Hard Rules (Non-Negotiable)

1. No em dashes anywhere in code, copy, or commits
2. No Tailwind utility classes in product app
3. No border-radius in product app (circle tier numbers excepted)
4. Dark mode only
5. No C.accent color (doesn't exist) - use C.indigo instead
6. Build locally before pushing to main - catch TypeScript errors early
7. Every blocked feature shows upgrade path - never a dead end
8. Never delete tests to pass - fix the code
9. RLS on every org-scoped table

---

*Full context available at /Users/jeffignacio/Downloads/REFYNE_CONTEXT (1).md - This is the single source of truth for Refyne architecture, product, and implementation decisions.*
