# World-Class Onboarding Implementation Status

## ✅ Completed (Committed to main)

### Core Infrastructure (Steps 1-5, 14)
- ✅ **Migration 024**: Added onboarding_progress columns + scan_progress_events table
- ✅ **POST /api/onboarding/profile**: Creates org, sets metadata, initializes onboarding
- ✅ **POST /api/onboarding/scan-trigger**: Triggers compliance scan
- ✅ **GET /api/onboarding/scan-progress**: Returns real-time scan events
- ✅ **POST /api/onboarding/complete**: Marks score revealed
- ✅ **GET /api/onboarding/welcome-data**: Returns invited user data
- ✅ **Middleware**: /onboarding routes already public (no org required)

### Pages (Steps 7-11)
- ✅ **/onboarding/profile**: 2-question signup (role + company size)
  - Pill button role selection
  - Company size selection
  - Company name input (agency: "first client")
  - Creates Clerk org + metadata

- ✅ **/onboarding/connect**: HubSpot connection step
  - Large connect button
  - Benefits checklist with Check icons
  - "Skip to dashboard" for existing connections

- ✅ **/onboarding/scanning**: Real-time progress story
  - Polls /api/onboarding/scan-progress every 3 seconds
  - Animated progress bar
  - Event feed with fade-in animations
  - Shows "Still working..." after 5 minutes

- ✅ **/onboarding/score**: Score reveal (the aha moment!)
  - Count-up animation using requestAnimationFrame
  - Score colors: green (80-100), amber (60-79), red (0-59)
  - Breakdown fade-in with issues found
  - Role-personalized CTA
  - Calls /api/onboarding/complete

- ✅ **/onboarding/welcome**: Invited users
  - Workspace initial/logo
  - Inviter name + role badge
  - Access permissions list
  - Current CRM health score
  - Role-specific landing page

### Delight Moments (Step 12 partial)
- ✅ **First merge**: API returns `isFirstMerge` flag
  - Marks onboarding_progress.first_merge_at
  - UI can show: "Duplicate removed. Your CRM just got cleaner."
- ⏳ **First normalize**: Pending (requires /api/normalize/apply endpoint)

### Additional Features
- ✅ **Friendly name for connections** (Step 16): Already implemented in previous commit

---

## 🚧 Remaining Work

### Scanner Integration (Step 6)
**File**: `lib/compliance/compliance-scanner.ts`

Add progress event emission throughout the scan:

```typescript
// At start
await emitProgress(orgId, runId, 'started',
  `Connected to Portal ${portalId}`)

await emitProgress(orgId, runId, 'started',
  `Found ${companyCount} companies`, companyCount)

// After dedup check
await emitProgress(orgId, runId, 'duplicate_found',
  `Found ${pairsFound} potential duplicate pairs`, pairsFound)

// After each harmony
await emitProgress(orgId, runId, 'harmony_checked',
  `Checked ${harmonyName} — ${failingCount} records need attention`,
  failingCount)

// Final
await emitProgress(orgId, runId, 'score_calculated',
  `Compliance score calculated: ${score}/100`)

await emitProgress(orgId, runId, 'completed',
  'Scan complete')
```

**Helper function to add**:
```typescript
async function emitProgress(
  orgId: string,
  runId: string,
  eventType: string,
  message: string,
  count?: number
) {
  await supabase.from('scan_progress_events').insert({
    org_id: orgId,
    run_id: runId,
    event_type: eventType,
    message,
    count,
  })
}
```

### Email Sequence (Step 13)
**Tool**: Resend

6 emails to implement:
1. **Score reveal** (T+0): "Your HubSpot health score: [N]/100"
2. **Duplicate nudge** (T+1 day): "[N] duplicates are waiting"
3. **Specific duplicate** (T+3 days): "Acme Corp has been a duplicate for 90+ days"
4. **Phone numbers** (T+7 days): "[N] phone numbers won't match caller ID"
5. **Trial ending** (T-7 days): "Your Refyne trial ends in 7 days"
6. **Trial expired**: "Your Refyne trial has ended"

**Files to create**:
- `lib/email/onboarding-emails.ts` - Email templates + send functions
- `app/api/email/onboarding/trigger/route.ts` - Webhook handler for Resend

### Sign-up Redirect (Step 15)
**Files to update**:
- Find Clerk sign-up callback/success handler
- Change redirect from `/onboarding` → `/onboarding/profile`
- OR update existing `/app/onboarding/page.tsx` to redirect

### Invited User Detection (Step 4)
**Logic to add**:
- In sign-up callback, detect if user joined via Clerk invitation
- If yes:
  - Set `signup_path = 'invited'` in onboarding_progress
  - Redirect to `/onboarding/welcome` instead of `/onboarding/profile`

### Testing & Polish
- Test full flow: signup → profile → connect → scan → score
- Test invited user flow
- Test agency variant (company name = "first client")
- Add error handling for scan failures
- Handle edge cases (no HubSpot data, scan timeout, etc.)

---

## 📊 Implementation Progress

| Step | Task | Status |
|------|------|--------|
| 1 | Migration | ✅ Done |
| 2 | POST /api/onboarding/profile | ✅ Done |
| 3 | POST /api/onboarding/scan-trigger | ✅ Done |
| 4 | GET /api/onboarding/scan-progress | ✅ Done |
| 5 | POST /api/onboarding/complete | ✅ Done |
| 6 | Scanner progress events | 🚧 TODO |
| 7 | /onboarding/profile page | ✅ Done |
| 8 | /onboarding/connect page | ✅ Done |
| 9 | /onboarding/scanning page | ✅ Done |
| 10 | /onboarding/score page | ✅ Done |
| 11 | /onboarding/welcome page | ✅ Done |
| 12 | Delight moments | 🟡 Partial (merge ✅, normalize ⏳) |
| 13 | Email sequence | 🚧 TODO |
| 14 | Middleware updates | ✅ Done |
| 15 | Sign-up redirect | 🚧 TODO |
| 16 | Friendly name | ✅ Done |
| 17 | Test suite | 🚧 TODO |
| 18 | Deploy | 🚧 TODO |

---

## 🎯 Next Actions

1. **Add scanner progress events** (Step 6)
   - Emit events at key points in compliance scan
   - Makes /onboarding/scanning show real data

2. **Implement email sequence** (Step 13)
   - Set up Resend integration
   - Create 6 email templates
   - Add triggers to API routes

3. **Update sign-up flow** (Step 15)
   - Redirect to /onboarding/profile
   - Detect invited users

4. **Test end-to-end**
   - Self-signup path
   - Agency variant
   - Invited user path

5. **Deploy & monitor**
   - Run migration 024 in production
   - Monitor onboarding funnel
   - Track time-to-aha (target: <3 minutes)

---

## 📝 Notes

- **Migration**: Apply `024_onboarding_experience.sql` before deploying
- **Real data**: Scanning page shows real events from scan_progress_events table
- **Score calculation**: TODO - integrate with actual compliance score from scanner
- **Agency flow**: Mostly complete, needs Clerk org switcher integration
- **API todos**: Several endpoints have `// TODO:` comments for BullMQ job enqueueing
