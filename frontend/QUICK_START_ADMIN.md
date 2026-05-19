# Quick Start: Admin Workspaces Route

## Step 1: Get Your Clerk User ID

Sign in to your app, open browser console (F12), and run:

```javascript
console.log(window.Clerk.user?.id);
```

Copy the output (starts with `user_`).

## Step 2: Add to Vercel

Go to your Vercel project → Settings → Environment Variables:

- **Name:** `ADMIN_USER_ID`
- **Value:** `user_xxxxxxxxxxxxxxxxxx` (paste your ID)
- **Environments:** ✅ Production ✅ Preview ✅ Development

Click **Save**.

## Step 3: Redeploy

Vercel will prompt you to redeploy. Click **Redeploy**.

## Step 4: Access the Dashboard

Navigate to: `https://yourapp.com/admin/workspaces`

You should see:
- Summary bar with key metrics
- Table of all workspaces
- Click any row for details

## What You'll See

### Main Dashboard
- **Total Workspaces** - All orgs in system
- **Active Subscriptions** - Paid customers
- **Trialing** - Trial users
- **Records Monitored** - Total normalized records
- **Digests This Month** - Emails sent

### Workspace Table
Each row shows:
- Org name & record count
- Subscription plan
- Compliance score
- Last scan time
- HubSpot portals connected
- Always On status
- Credits used/limit
- Join date

### Drill-Down View
Click any workspace to see:
- Recent digest runs (last 30)
- Compliance trend chart (30 days)
- Dedup pair history (last 100)
- Detailed subscription info

## Troubleshooting

**"Not found" 404 error?**
- ✅ Verify `ADMIN_USER_ID` is set in Vercel
- ✅ Confirm you're signed in with the admin account
- ✅ Check the env var matches your Clerk user ID exactly
- ✅ Redeploy after adding the env var

**Empty tables?**
- This is normal if no data exists yet
- Create test workspaces to populate

## Security

- Only the user with matching Clerk ID can access
- Returns 404 (not 403) to hide route from others
- Read-only - no write operations
- Uses service role key with explicit org filters

## Local Development

Add to `frontend/.env.local`:

```bash
ADMIN_USER_ID=user_xxxxxxxxxxxxxxxxxx
```

Restart your dev server:

```bash
npm run dev
```

Navigate to: `http://localhost:3000/admin/workspaces`

---

**Full documentation:** See `ADMIN_ROUTE_IMPLEMENTATION.md` for complete details.
