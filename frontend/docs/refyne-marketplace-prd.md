# Refyne — Marketplace Readiness PRD

**Status:** Planned — implement after core product is stable
**Execution order:** SPEC 2 (pages) → SPEC 3 (Always On) → SPEC 1 (OAuth, last)
**Note:** OAuth is deferred — PAT-based testing continues until marketplace submission

---

# SPEC 1: HubSpot OAuth Migration
*Implement last — required for HubSpot Marketplace listing submission*

## Context

HubSpot requires OAuth as the sole authorization method for listed apps. Currently Refyne uses private app tokens (PAT). This migration replaces the PAT connection flow with OAuth across the entire stack.

**Do not implement until:**
- Core product is stable
- Always On is shipped
- Ready to collect 3 active OAuth installs for marketplace submission

## 1. Data model

```sql
-- Migration: 013_hubspot_oauth.sql

ALTER TABLE hubspot_connections
  ADD COLUMN hub_id              text,
  ADD COLUMN access_token        text,
  ADD COLUMN refresh_token       text,
  ADD COLUMN token_expires_at    timestamptz,
  ADD COLUMN oauth_scopes        text[],
  ADD COLUMN connection_status   text NOT NULL DEFAULT 'active'
    CHECK (connection_status IN ('active','expired','disconnected','error')),
  ADD COLUMN disconnected_at     timestamptz,
  ADD COLUMN last_active_at      timestamptz;

-- DO NOT DROP private_app_token — keep for rollback safety
COMMENT ON COLUMN hubspot_connections.private_app_token
  IS 'DEPRECATED as of migration 013. Use access_token + refresh_token.';

-- CSRF protection for OAuth state
CREATE TABLE hubspot_oauth_states (
  state          text PRIMARY KEY,
  org_id         text NOT NULL,
  created_by     text NOT NULL,  -- clerk user_id
  created_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL DEFAULT now() + interval '10 minutes',
  used           boolean NOT NULL DEFAULT false
);
```

## 2. API routes

```
GET /api/hubspot/connect
  Auth: admin only
  Behavior:
    - Generate cryptographically random state (32 bytes hex)
    - Insert into hubspot_oauth_states
    - Redirect to HubSpot OAuth URL:
        https://app.hubspot.com/oauth/authorize
          ?client_id={HUBSPOT_CLIENT_ID}
          &redirect_uri={NEXT_PUBLIC_APP_URL}/api/hubspot/callback
          &scope=crm.objects.companies.read
                 crm.objects.companies.write
                 crm.export
                 oauth
          &state={state}

GET /api/hubspot/callback
  Auth: public (called by HubSpot)
  Query params: code, hub_id, state
  Validation:
    - state exists, not used, not expired
    - Mark state used immediately
  Behavior:
    - Exchange code for tokens via POST to HubSpot token endpoint
    - Upsert hubspot_connections with hub_id, access_token,
      refresh_token, token_expires_at, connection_status = 'active'
    - Redirect to /connections?connected=true
  On error: redirect to /connections?error={reason}

DELETE /api/hubspot/connections/:id
  Auth: admin only
  - Revoke token at HubSpot
  - Set connection_status = 'disconnected', zero out tokens
  - Do not delete the row
  Response: { success: true }

Internal: lib/hubspot/get-access-token.ts
  - Checks token_expires_at < now() + 5 minutes
  - If expiring: refresh via HubSpot token endpoint
  - Update row with new access_token + expiry
  - On refresh failure: set connection_status = 'error', throw
  - Replaces every instance of reading private_app_token globally

ENV vars required (Vercel + Railway):
  HUBSPOT_CLIENT_ID
  HUBSPOT_CLIENT_SECRET
  NEXT_PUBLIC_APP_URL
```

## 3. UI behavior

```
Connections page:
  Remove: "Paste private app token" input
  Add: "Connect HubSpot" button → GET /api/hubspot/connect

  Per portal row — add connection_status badge:
    active       → green dot "Connected"
    expired      → amber dot "Token expired — reconnect"
    disconnected → gray dot "Disconnected"
    error        → red dot "Error — reconnect"

  Non-active portals show "Reconnect" button (same flow, upserts row)

  Disconnect button confirm dialog:
    "Disconnect {portal name}?
     This will stop all syncs and scans.
     Your data in Refyne is preserved."
    [Cancel]  [Disconnect]

OAuth callback states:
  ?connected=true → success toast, refresh portals
  ?error=access_denied → toast "Connection cancelled"
  ?error=* → toast "Connection failed — try again"
```

## DO NOT BUILD
```
- PKCE flow
- Multi-portal connect in single OAuth flow
- Token encryption at rest (post-SOC2 task)
- Salesforce OAuth
- Automatic reconnect retries
- Removing private_app_token column
```

---

# SPEC 2: Marketplace Readiness Pages
*Static pages required for HubSpot listing submission*

## 1. Data model

```sql
-- No schema changes for static pages.

-- Unsubscribe token validation only:
-- Token = HMAC-SHA256(email + orgId, UNSUBSCRIBE_SECRET)
-- Stored nowhere — validated on-the-fly
```

## 2. API routes

```
GET /api/unsubscribe?token={token}
  Public
  Validates HMAC token
  Removes email from always_on_config.email_recipients
  Redirects to /unsubscribed

POST /api/unsubscribe/token  (internal)
  Called by Always On email job
  Body: { email, orgId }
  Returns: { token: string }
  Used to build unsubscribe URLs in digest emails
```

## 3. Pages

```
/pricing
  Two sections: Base plans + Always On add-on

  Base plans:
    Starter    $149/mo   up to 25,000 records
    Growth     $249/mo   up to 75,000 records    ← highlighted
    Scale      $399/mo   up to 200,000 records
    Enterprise Contact   200,000+

  Always On add-on:
    +$79/mo on any plan
    Nightly monitoring, digest email, Slack alerts,
    auto-merge Grade A pairs

  All plans include:
    Normalize, Dedup, Harmonies, Compliance dashboard,
    HubSpot integration, up to 3 active portals

  Billing toggle: Monthly / Annual (Annual = 20% off)
  Annual: Starter $119, Growth $199, Scale $319

  CTA: "Get started" → /connections
  Note: "Per workspace, not per seat"

  Must match exactly what is entered in the HubSpot listing.

/privacy
  Static page. Sections (placeholder legal copy — Jeff provides final):
    1. What data we collect
    2. How we use your data
    3. Data from HubSpot (scopes, what we read/write)
    4. Data retention
    5. Data deletion
    6. Cookies
    7. Third-party services (Supabase, Vercel, Railway, Resend, Stripe)
    8. Contact
  Effective date + Last updated at top
  Single column, max-width 720px
  Sticky TOC sidebar on desktop

/terms
  Static page. Sections (placeholder legal copy — Jeff provides final):
    1. Acceptance of terms
    2. Service description
    3. Account registration
    4. Acceptable use
    5. Data ownership (customer owns their HubSpot data)
    6. Payment terms
    7. Cancellation
    8. Limitation of liability
    9. Governing law
    10. Contact
  Same layout as /privacy

/docs  (HubSpot setup guide — required for listing)
  Title: "Connect Refyne to HubSpot"

  Step 1: Create a Refyne account
    Sign up at refyne.io
    [Screenshot placeholder]

  Step 2: Connect your HubSpot portal
    Connections → "Connect HubSpot"
    Approve HubSpot OAuth screen
    Scopes requested and why:
      crm.objects.companies.read  — read company records for scanning
      crm.objects.companies.write — write normalized values back to HubSpot
      crm.export                  — export full portal for compliance scan
      oauth                       — authenticate your account
    [Screenshot placeholder]

  Step 3: Configure Harmonies
    Harmonies → enable recommended set
    [Screenshot placeholder]

  Step 4: Run your first compliance scan
    Dashboard → "Run scan"
    View compliance score
    [Screenshot placeholder]

  Step 5: Review dedup queue
    Dedup → filter Grade A → bulk approve or accordion review
    [Screenshot placeholder]

  Step 6 (optional): Enable Always On
    Settings → Always On → toggle on, add email recipients
    [Screenshot placeholder]

  Support: jeff@revopsimpact.us

/unsubscribed
  "You've been unsubscribed from Refyne digest emails."
  "Re-enable in Settings → Always On."
  Link to /settings if authenticated
```

## 4. UI behavior

```
All four pages:
  Minimal marketing header: Refyne logo + "Sign in" link
  Footer: © 2026 Refyne · Privacy · Terms · Support

/pricing:
  Card layout, indigo highlight on Growth plan
  Always On shown as separate callout below plan cards
  Monthly/Annual toggle — Annual shows strikethrough monthly price

/privacy and /terms:
  Single column, 720px max-width
  TOC sidebar sticky on desktop
  Anchor links per section heading

/docs:
  Numbered step cards
  Screenshot placeholders: gray box with label and dimensions
  "Next step" link at bottom of each card
```

## DO NOT BUILD
```
- CMS for legal content
- Cookie consent banner
- Changelog or blog
- Full searchable documentation site
- Video embeds
- Localization
- Stripe checkout on pricing page — CTA only
```

---

# SPEC 3: Always On
*Proactive nightly monitoring with digest email and Slack alerts*

## 1. Data model

```sql
-- Migration: 014_always_on.sql

CREATE TABLE workspace_entitlements (
  org_id              text PRIMARY KEY,
  always_on_enabled   boolean NOT NULL DEFAULT false,
  always_on_since     timestamptz,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE always_on_config (
  org_id                  text PRIMARY KEY,
  scan_time_utc           time NOT NULL DEFAULT '06:00:00',
  digest_enabled          boolean NOT NULL DEFAULT true,
  email_recipients        text[] NOT NULL DEFAULT '{}',
  slack_enabled           boolean NOT NULL DEFAULT false,
  slack_webhook_url       text,
  send_on_no_change       boolean NOT NULL DEFAULT false,
  score_delta_threshold   int NOT NULL DEFAULT 3
                          CHECK (score_delta_threshold BETWEEN 0 AND 100),
  auto_merge_grade_a      boolean NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE digest_runs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              text NOT NULL,
  connection_id       uuid,
  portal_name         text,
  run_at              timestamptz NOT NULL DEFAULT now(),
  triggered_by        text NOT NULL DEFAULT 'schedule'
                      CHECK (triggered_by IN ('schedule','manual')),
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN (
                        'pending','running','completed','failed','skipped'
                      )),
  score_before        numeric(5,2),
  score_after         numeric(5,2),
  score_delta         numeric(5,2),
  new_pairs_detected  int NOT NULL DEFAULT 0,
  new_insights        int NOT NULL DEFAULT 0,
  records_scanned     int NOT NULL DEFAULT 0,
  digest_sent         boolean NOT NULL DEFAULT false,
  slack_sent          boolean NOT NULL DEFAULT false,
  skipped_reason      text,
  error_message       text,
  digest_payload      jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX digest_runs_org_run_at ON digest_runs (org_id, run_at DESC);

ALTER TABLE workspace_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE always_on_config       ENABLE ROW LEVEL SECURITY;
ALTER TABLE digest_runs            ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON workspace_entitlements
  FOR ALL USING (org_id = current_setting('app.org_id', true));
CREATE POLICY "org_isolation" ON always_on_config
  FOR ALL USING (org_id = current_setting('app.org_id', true));
CREATE POLICY "org_isolation" ON digest_runs
  FOR ALL USING (org_id = current_setting('app.org_id', true));
```

## 2. API routes

```
GET /api/always-on/status
  Auth: any role
  Returns: {
    enabled: boolean,
    config: AlwaysOnConfig | null,
    lastRun: DigestRun | null,
    nextRunAt: string
  }

GET /api/always-on/config
  Auth: any role
  Creates default row if none exists
  Response: { config: AlwaysOnConfig }

PUT /api/always-on/config
  Auth: admin only
  Body: Partial<AlwaysOnConfig>
  Validation:
    - email_recipients: valid email format, max 10
    - slack_webhook_url: must start with https://hooks.slack.com/
    - score_delta_threshold: 0–100
  Response: { config: AlwaysOnConfig }

POST /api/always-on/toggle
  Auth: admin only
  Body: { enabled: boolean }
  Upserts workspace_entitlements
  If enabling: set always_on_since = now()
  Response: { enabled: boolean }

POST /api/always-on/trigger
  Auth: admin only
  Body: { connectionId?: string }
  Enqueues BullMQ digest job, triggered_by = 'manual'
  Response: { jobId: string, runId: string }

POST /api/always-on/test-email
  Auth: admin only
  Sends test digest to requesting user's email
  Uses last digest_payload if available, else synthetic payload
  Response: { sent: boolean, recipient: string }

POST /api/always-on/test-slack
  Auth: admin only
  Posts test message to configured webhook URL
  Response: { sent: boolean }

GET /api/always-on/runs
  Auth: any role
  Query: page, per_page (default 20)
  Response: { runs: DigestRun[], total: number }

GET /api/always-on/runs/:id
  Auth: any role
  Response: { run: DigestRun }
```

## 3. Background job

```
File: lib/jobs/always-on-digest.ts
Queue: BullMQ (existing infrastructure)
Job input: { orgId, connectionId, triggeredBy }

Execution:

  1.  Create digest_run row, status = 'running'

  2.  Fetch last completed digest_run for this org + connection
      (score_before = last run's score_after)

  3.  Run compliance scan via existing scan logic
      Store result as score_after

  4.  Run incremental dedup scan
      Count new pairs by grade since last run

  5.  Compute delta: score_delta = score_after - score_before
      If abs(score_delta) < config.score_delta_threshold
        AND config.send_on_no_change = false:
          status = 'skipped', skipped_reason = 'below_threshold'
          Exit

  6.  Compute top 3 remediation items:
      Rank by: (records_affected × weight_impact) DESC
      weight_impact multipliers:
        has_existing_harmony_fix → 1.5x
        new_this_run             → 1.2x
      Each item: { harmony_id, issue, records_affected,
                   action_label, action_url }

  7.  Fetch harmony breakdown (active harmonies + current scores)

  8.  Store digest_payload on digest_run

  9.  If digest_enabled AND email_recipients non-empty:
        Render React Email template
        Send via Resend to all recipients
        digest_run.digest_sent = true

  10. If slack_enabled AND slack_webhook_url:
        POST Slack block kit payload to webhook
        digest_run.slack_sent = true

  11. If auto_merge_grade_a:
        POST /api/dedup/pairs/bulk-approve
          { pairIds: [new Grade A pair ids from this run] }

  12. Update digest_run: status = 'completed', all counts

  On unhandled error:
    digest_run.status = 'failed', error_message = error.message

Cron (Railway — extend existing nightly sync):
  For each org where always_on_enabled = true:
    For each active HubSpot connection:
      Enqueue digest job at org's scan_time_utc
```

## 4. Email template

```
File: emails/always-on-digest.tsx  (React Email)

Props:
  portalName, digestDate, score, scoreDelta,
  remediationItems: { rank, harmony, issue, recordsAffected,
                      actionLabel, actionUrl }[],
  harmonyBreakdown: { name, score, delta }[],
  newPairsDetected, gradeACount, newInsightsCount,
  dashboardUrl, settingsUrl, unsubscribeUrl

Layout:
  Header:    Refyne logo | portalName · digestDate
  Score:     Large {score}%  ↑/↓ {delta}pts
  Remediation (max 3 items):
             Rank | harmony | issue | records affected | CTA link
  Harmonies: name | score bar | % | delta
  Dedup:     "{N} new pairs · {A} Grade A ready" | CTA
  Footer:    Dashboard · Settings · Unsubscribe

Styling:
  Inline styles only (email client compatibility)
  Indigo #6366F1 for CTAs
  System font stack — no Google Fonts
  600px max-width
```

## 5. Slack block kit payload

```typescript
// lib/always-on/slack-payload.ts
{
  blocks: [
    { type: "header",
      text: { type: "plain_text", text: `Refyne · ${portalName}` } },
    { type: "section",
      text: { type: "mrkdwn",
        text: `*${score}%* ${deltaIcon} ${Math.abs(delta)}pts  ·  ${date}` } },
    { type: "divider" },
    // One section per remediation item (max 3)
    { type: "section",
      text: { type: "mrkdwn",
        text: `• *${harmony}*: ${issue} — ${records} records` } },
    // Dedup summary if pairs > 0
    { type: "section",
      text: { type: "mrkdwn",
        text: `• *${newPairs} new duplicate pairs* — ${gradeA} Grade A ready` } },
    { type: "divider" },
    { type: "actions", elements: [
        { type: "button", text: { type: "plain_text", text: "View dashboard" },
          url: dashboardUrl },
        { type: "button", text: { type: "plain_text", text: "Review dedup" },
          url: dedupUrl }
    ]}
  ]
}
```

## 6. UI behavior

```
Location: Settings → "Always On" section
Access: admin configures, any role views status

Always On toggle row:
  Label: "Always On monitoring"
  Sublabel: "Nightly scan, digest email, and Slack alerts"
  If not entitled: toggle disabled, badge "Add-on"
    Clicking shows: "Contact jeff@revopsimpact.us to enable Always On"
    (No Stripe flow — manual enablement by Jeff for now)

Config panel (visible when enabled):

  Scan schedule:
    Time picker (UTC), default 06:00
    Sublabel: "Runs nightly across all connected portals"

  Email digest toggle:
    When on: multi-value email input (comma-separated, max 10)
    [Send test email] → POST /api/always-on/test-email

  Slack toggle:
    When on: webhook URL input
    [Send test message] → POST /api/always-on/test-slack
    "How to create a Slack webhook →" (external link)

  Advanced (collapsed by default):
    "Only send when score changes by ≥ N pts"
      Number input [3] · 0 = always send
    "Auto-approve Grade A dedup pairs"
      Toggle + warning: "Merges execute automatically"
    "Send digest even when nothing changed"
      Toggle

  Save behavior: sticky footer bar (same as dedup configurator)

Run history (below config):
  Columns: Date | Portal | Score | Delta | Pairs | Status | Actions
  Status badges: completed (green) | skipped (muted) | failed (red)
  [View] → slide-over with digest_payload detail
  [Trigger now] → POST /api/always-on/trigger
    Polls run status every 3s, shows result in toast
```

## DO NOT BUILD
```
- Stripe subscription flow — always_on_enabled manually set
  in workspace_entitlements by Jeff for now
- Per-portal scan schedules — one schedule per org
- Custom email template editor
- Digest A/B testing
- Per-Harmony digest filtering
- Webhook retry for Slack
- SMS notifications
- In-app digest preview (use test-email instead)
```

---

## Marketplace submission checklist

Complete these before submitting to HubSpot:

- [ ] SPEC 1 (OAuth) implemented and tested
- [ ] Three portals connected via OAuth with active API activity in past 30 days
  - [ ] Frontera Health
  - [ ] GrowthBook
  - [ ] GrowthX
- [ ] /pricing live and matches listing exactly
- [ ] /privacy live with final legal content (not placeholder)
- [ ] /terms live with final legal content (not placeholder)
- [ ] /docs live with real screenshots (not placeholders)
- [ ] support@refyne.io or equivalent support contact live
- [ ] HubSpot brand compliance audit (capitalize "HubSpot", no "HubSpot" in product name)
- [ ] Scope audit: only requested scopes are actually used
- [ ] Private app token from credential exposure incident confirmed rotated
- [ ] Shared data table in listing matches actual scopes
- [ ] HubSpot developer account created, public app configured
- [ ] Redirect URI registered in HubSpot developer app
- [ ] All listing URLs return 200 (HubSpot crawls these)
- [ ] At least one demo video or screenshot in listing
- [ ] Review and sign Technology Partner Program Agreement

Submit via HubSpot Developer Platform.
Initial review: 10 business days.
Full feedback cycle: up to 60 days.

---

*RevOps Impact LLC — Confidential*
*Last updated: May 2026*
