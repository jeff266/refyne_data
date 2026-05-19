# Onboarding Checklist Implementation

## Overview

An in-app onboarding checklist that appears on the Dashboard for new workspaces, tracking 5 key activation steps. The checklist shows progress, provides quick links to complete steps, and automatically hides when all steps are complete (after 24 hours) or when manually dismissed.

## Database Schema

### Migration: `019_onboarding_progress.sql`

**Location:** `/lib/db/migrations/019_onboarding_progress.sql`

```sql
CREATE TABLE onboarding_progress (
  org_id              text PRIMARY KEY,
  connected_hubspot   boolean NOT NULL DEFAULT false,
  viewed_dashboard    boolean NOT NULL DEFAULT false,
  viewed_dedup        boolean NOT NULL DEFAULT false,
  applied_harmony     boolean NOT NULL DEFAULT false,
  ran_normalize       boolean NOT NULL DEFAULT false,
  completed_at        timestamptz,
  dismissed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);
```

**Row Level Security:** Enforced using `org_id = current_setting('app.org_id', true)` policy.

## Onboarding Steps

The checklist tracks these 5 steps in order:

1. **Connect HubSpot** — Complete when `hubspot_connections` has at least one active row for the org
2. **View your compliance score** — Complete when user visits `/dashboard` at least once post-connection
3. **Review dedup pairs** — Complete when user visits `/dedup` at least once
4. **Apply your first Harmony** — Complete when `normalization_settings` has at least one active harmony
5. **Run your first normalize** — Complete when `normalization_runs` has at least one completed row

## API Routes

### `GET /api/onboarding/status`

**Location:** `/app/api/onboarding/status/route.ts`

**Behavior:**
- Returns current onboarding progress for the authenticated org
- Auto-creates row if missing (first time access)
- Checks actual database state to update step completion:
  - `connected_hubspot`: Checks `hubspot_connections` table
  - `applied_harmony`: Checks `normalization_settings` table
  - `ran_normalize`: Checks `normalization_runs` table with `status='completed'`
- Auto-sets `completed_at` when all 5 steps are done
- Returns full progress object

**Response:**
```json
{
  "org_id": "org_xxx",
  "connected_hubspot": true,
  "viewed_dashboard": true,
  "viewed_dedup": false,
  "applied_harmony": false,
  "ran_normalize": false,
  "completed_at": null,
  "dismissed_at": null,
  "created_at": "2024-05-18T20:00:00Z"
}
```

### `POST /api/onboarding/step/:step`

**Location:** `/app/api/onboarding/step/[step]/route.ts`

**Parameters:**
- `step`: One of `connected_hubspot`, `viewed_dashboard`, `viewed_dedup`, `applied_harmony`, `ran_normalize`

**Behavior:**
- Marks specific step as complete
- Creates progress row if missing
- Auto-sets `completed_at` if all steps are now complete
- Idempotent (safe to call multiple times)

**Valid step names:**
- `connected_hubspot`
- `viewed_dashboard`
- `viewed_dedup`
- `applied_harmony`
- `ran_normalize`

### `POST /api/onboarding/dismiss`

**Location:** `/app/api/onboarding/dismiss/route.ts`

**Behavior:**
- Sets `dismissed_at` to current timestamp
- Hides checklist permanently
- User can dismiss at any point (even before completion)

## UI Components

### `OnboardingChecklist` Component

**Location:** `/components/refyne/OnboardingChecklist.tsx`

**Props:**
```typescript
interface OnboardingChecklistProps {
  progress: {
    connected_hubspot: boolean;
    viewed_dashboard: boolean;
    viewed_dedup: boolean;
    applied_harmony: boolean;
    ran_normalize: boolean;
    completed_at: string | null;
    dismissed_at: string | null;
  };
  onDismiss: () => void;
}
```

**Features:**
- Progress bar showing N of 5 steps complete with percentage
- Each step displays:
  - ✓ checkmark icon (green) if complete
  - ○ circle icon (gray) if pending
  - Step name with strike-through when complete
  - Short description
  - "Go to [step]" link if incomplete
- Dismiss button in top-right
- **Completion State:** Shows green "Setup complete" message for 24 hours after all steps done
- Auto-hides after 24 hours or when dismissed

**Design System:**
- Uses Refyne design tokens (`C` colors, `F` fonts)
- Card-based layout with consistent padding/spacing
- Responsive and accessible

### `OnboardingWrapper` Component

**Location:** `/app/(dashboard)/dashboard/OnboardingWrapper.tsx`

**Behavior:**
- Client component that fetches onboarding status on mount
- Tracks dashboard page visit automatically
- Handles dismiss action
- Conditionally renders `OnboardingChecklist` based on:
  - Progress exists
  - Not dismissed (`dismissed_at === null`)
  - Not completed more than 24h ago

**Visibility Rules:**
```typescript
// Don't show if:
if (isLoading || !progress || progress.dismissed_at) return null;

// Don't show if completed more than 24h ago
if (progress.completed_at) {
  const hoursSinceCompletion = (Date.now() - completedTime) / (1000 * 60 * 60);
  if (hoursSinceCompletion > 24) return null;
}
```

## Page Visit Tracking

### Dashboard Page

**Location:** `/app/(dashboard)/dashboard/OnboardingWrapper.tsx`

**Implementation:**
```typescript
useEffect(() => {
  if (!hasTrackedVisit.current && progress && !progress.viewed_dashboard) {
    hasTrackedVisit.current = true;
    fetch('/api/onboarding/step/viewed_dashboard', { method: 'POST' });
  }
}, [progress]);
```

**Notes:**
- Uses `useRef` to prevent duplicate calls in React Strict Mode
- Only tracks if step not already complete
- Fires on first render after progress loads

### Dedup Page

**Location:** `/app/(dashboard)/dedup/page.tsx`

**Implementation:**
```typescript
const hasTrackedVisit = useRef(false);

useEffect(() => {
  if (!hasTrackedVisit.current) {
    hasTrackedVisit.current = true;
    fetch('/api/onboarding/step/viewed_dedup', { method: 'POST' });
  }
}, []);
```

**Notes:**
- Uses `useRef` to prevent duplicate calls
- Fires once on page mount
- Fire-and-forget (errors logged to console)

## Integration Points

### Dashboard Page Layout

**Location:** `/app/(dashboard)/dashboard/page.tsx`

The `OnboardingWrapper` is inserted between StatCards and the main grid:

```tsx
<Suspense fallback={<StatCardsSkeleton />}>
  <StatCards />
</Suspense>

{/* Onboarding Checklist */}
<OnboardingWrapper />

<div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
  {/* ... rest of dashboard ... */}
</div>
```

**Position:** Appears below the 4 stat cards and above the compliance score card.

## Step Completion Logic

### Auto-Detected Steps

Some steps are automatically detected by querying database state:

1. **connected_hubspot**: Checks for any row in `hubspot_connections` for the org
2. **applied_harmony**: Checks for any row in `normalization_settings` for the org
3. **ran_normalize**: Checks for any row in `normalization_runs` with `status='completed'` for the org

These checks run on every `GET /api/onboarding/status` call and update the progress automatically.

### Manual Tracking Steps

These require explicit page visit tracking:

1. **viewed_dashboard**: Tracked via `POST /api/onboarding/step/viewed_dashboard` on dashboard mount
2. **viewed_dedup**: Tracked via `POST /api/onboarding/step/viewed_dedup` on dedup page mount

## Database Types

**Location:** `/lib/db/database.types.ts`

Added TypeScript types for `onboarding_progress` table:

```typescript
onboarding_progress: {
  Row: {
    org_id: string
    connected_hubspot: boolean
    viewed_dashboard: boolean
    viewed_dedup: boolean
    applied_harmony: boolean
    ran_normalize: boolean
    completed_at: string | null
    dismissed_at: string | null
    created_at: string
  }
  Insert: {
    org_id: string
    connected_hubspot?: boolean
    viewed_dashboard?: boolean
    viewed_dedup?: boolean
    applied_harmony?: boolean
    ran_normalize?: boolean
    completed_at?: string | null
    dismissed_at?: string | null
    created_at?: string
  }
  Update: { ... }
  Relationships: []
}
```

## Testing Checklist

### Manual Testing Steps

1. **New Workspace Setup:**
   - Create a new org/workspace
   - Visit `/dashboard` — checklist should appear with 0/5 steps
   - Step 2 should auto-complete (viewed_dashboard)

2. **Connect HubSpot:**
   - Connect a HubSpot portal
   - Refresh dashboard — Step 1 should be checked

3. **Visit Dedup:**
   - Navigate to `/dedup`
   - Return to dashboard — Step 3 should be checked

4. **Apply Harmony:**
   - Create a normalization setting/harmony
   - Refresh dashboard — Step 4 should be checked

5. **Run Normalize:**
   - Execute a normalization run to completion
   - Refresh dashboard — Step 5 should be checked
   - Progress bar should show 5/5 (100%)
   - `completed_at` should be set

6. **Completion State:**
   - After all steps complete, checklist shows green "Setup complete" message
   - Wait 24 hours — checklist should auto-hide

7. **Dismiss:**
   - Click "Dismiss" button
   - Checklist should disappear immediately
   - Should not reappear on refresh

### API Testing

```bash
# Get status
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/onboarding/status

# Mark step complete
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/onboarding/step/viewed_dashboard

# Dismiss
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/onboarding/dismiss
```

## Edge Cases Handled

1. **React Strict Mode:** Uses `useRef` to prevent duplicate tracking calls
2. **Missing Progress Row:** Auto-creates on first `GET /api/onboarding/status`
3. **Already Complete Steps:** API endpoints are idempotent
4. **Dismissed State:** Checklist never reappears once dismissed
5. **24h Auto-Hide:** Client-side calculation to hide after completion grace period
6. **Database Not Configured:** API gracefully returns errors without crashing

## Files Modified/Created

### New Files

1. `/lib/db/migrations/019_onboarding_progress.sql`
2. `/app/api/onboarding/status/route.ts`
3. `/app/api/onboarding/step/[step]/route.ts`
4. `/app/api/onboarding/dismiss/route.ts`
5. `/components/refyne/OnboardingChecklist.tsx`
6. `/app/(dashboard)/dashboard/OnboardingWrapper.tsx`

### Modified Files

1. `/components/refyne/index.ts` — Added `OnboardingChecklist` export
2. `/app/(dashboard)/dashboard/page.tsx` — Added `OnboardingWrapper` integration
3. `/app/(dashboard)/dedup/page.tsx` — Added visit tracking
4. `/lib/db/database.types.ts` — Added `onboarding_progress` table types

## Next Steps

### Deployment

1. **Run Migration:**
   ```bash
   # Apply migration 019 to database
   psql $DATABASE_URL -f lib/db/migrations/019_onboarding_progress.sql
   ```

2. **Verify RLS Policies:**
   - Confirm `current_setting('app.org_id', true)` is set in middleware
   - Test that orgs can only see their own progress

3. **Deploy Application:**
   ```bash
   npm run build
   npm start
   ```

### Future Enhancements

1. **Analytics:** Track step completion rates and time-to-complete
2. **Admin Override:** Allow admins to reset onboarding for testing
3. **Custom Steps:** Make steps configurable per deployment
4. **Onboarding Email:** Send email when user gets stuck on a step
5. **Video Tutorials:** Embed short videos for each step
6. **Gamification:** Award badges or points for completion

## Notes

- The normalize page was intentionally **not modified** as per requirements (another agent is working on it)
- Step completion is tracked via a combination of database queries and client-side page visits
- The component uses the existing Refyne design system for consistency
- All API routes follow the existing auth/error handling patterns in the codebase
