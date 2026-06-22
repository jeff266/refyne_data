# HubSpot OAuth Debug Checklist

## Issue
HubSpot OAuth returns "connection failed" after reaching permission screen

## Most Likely Causes

### 1. Redirect URI Mismatch (MOST COMMON)
Your HubSpot app must have this EXACT redirect URI:
```
https://refynedata.com/api/hubspot/callback
```

**Check:**
1. Go to https://app.hubspot.com/
2. Settings → Integrations → Private Apps (or Public Apps if you created a public app)
3. Find your app
4. Check "Redirect URLs" section
5. Must match EXACTLY (no trailing slash, correct domain)

### 2. Missing Environment Variables
**Required in Vercel:**
- `HUBSPOT_CLIENT_ID` - Your HubSpot app client ID
- `HUBSPOT_CLIENT_SECRET` - Your HubSpot app client secret
- `NEXT_PUBLIC_APP_URL=https://refynedata.com` (no trailing slash)

**Check:**
1. Go to Vercel Dashboard → refyne-data-platform-ui → Settings → Environment Variables
2. Verify all three are set for Production
3. If you change them, redeploy

### 3. OAuth State Expiration
If you took >10 minutes on the HubSpot permission screen, the state expired.

**Fix:** Try again immediately after clicking "Connect HubSpot"

### 4. HubSpot App Scopes
Your app needs these scopes:
- crm.objects.companies.read
- crm.objects.companies.write
- crm.schemas.companies.read
- crm.schemas.companies.write
- crm.objects.contacts.read
- crm.objects.contacts.write
- crm.schemas.contacts.read
- crm.export
- crm.lists.write
- crm.objects.owners.read
- oauth

## Debug Steps

### Step 1: Check Vercel Logs
1. Go to Vercel Dashboard → Logs
2. Filter for `/api/hubspot/callback`
3. Try connecting again
4. Watch for error messages in real-time

Look for:
- `[OAuth Callback] Invalid OAuth state:` → state expired or not found
- `[OAuth Callback] Token exchange failed:` → wrong client ID/secret or redirect URI
- `[OAuth Callback] Missing required params` → HubSpot didn't send code back

### Step 2: Verify Environment Variables
```bash
# In Vercel Dashboard, check:
HUBSPOT_CLIENT_ID=<your_client_id>
HUBSPOT_CLIENT_SECRET=<your_client_secret>
NEXT_PUBLIC_APP_URL=https://refynedata.com
```

### Step 3: Test the Flow Again
1. Clear cookies/session
2. Go to https://refynedata.com/connections
3. Click "Connect HubSpot"
4. IMMEDIATELY approve on HubSpot (don't wait)
5. Check Vercel logs

### Step 4: Check HubSpot App Status
Some HubSpot apps need approval before OAuth works. Check app status in HubSpot developer console.

## Expected Flow
1. User clicks "Connect HubSpot" → `/api/hubspot/connect`
2. Creates OAuth state in database, redirects to HubSpot
3. User approves → HubSpot redirects to `/api/hubspot/callback?code=XXX&state=YYY`
4. Callback validates state, exchanges code for tokens, saves to database
5. Redirects to `/connections?connected=true`

## Common Error Codes
- `?error=state_expired` - Took too long to approve (>10 min)
- `?error=invalid_state` - State not found in database
- `?error=token_exchange_failed` - Wrong credentials or redirect URI
- `?error=save_failed` - Database error
