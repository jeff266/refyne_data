# Get Your Clerk User ID

## Method 1: Browser Console (Easiest)

1. Sign in to your application
2. Open browser DevTools (F12 or Cmd+Option+I)
3. Go to Console tab
4. Paste this code and press Enter:

```javascript
console.log('Your Clerk User ID:', window.Clerk.user?.id);
```

5. Copy the user ID (starts with `user_`)

## Method 2: Clerk Dashboard

1. Go to https://dashboard.clerk.com
2. Select your application
3. Navigate to Users
4. Find your user account
5. Copy the User ID from the user details

## Method 3: Network Tab

1. Sign in to your application
2. Open browser DevTools → Network tab
3. Reload the page
4. Look for requests to Clerk API
5. Check the response for `userId` field

## Setting the Environment Variable

### For Local Development

Add to `frontend/.env.local`:

```bash
ADMIN_USER_ID=user_xxxxxxxxxxxxxxxxxx
```

### For Vercel Production

Option 1: Vercel CLI
```bash
cd frontend
vercel env add ADMIN_USER_ID
# Enter your user ID when prompted
# Select: Production, Preview, Development
```

Option 2: Vercel Dashboard
1. Go to your project on Vercel
2. Settings → Environment Variables
3. Add new variable:
   - Name: `ADMIN_USER_ID`
   - Value: `user_xxxxxxxxxxxxxxxxxx`
   - Environments: Production, Preview, Development
4. Redeploy your application

## Verifying Access

1. Navigate to `/admin/workspaces`
2. If you see the dashboard, you're authorized
3. If you see a 404 page, check:
   - `ADMIN_USER_ID` is set correctly
   - You're signed in with the correct account
   - You've redeployed after adding the env var

## Security Note

The admin route returns 404 (not 403) for unauthorized users to hide its existence. This means:
- No hints that the route exists
- No authentication error messages
- Appears as a regular "page not found"
