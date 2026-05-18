# HubSpot OAuth App Setup

**Manual setup steps for creating the HubSpot public app.**

## 1. Create HubSpot Developer Account

1. Go to https://developers.hubspot.com/
2. Sign in with your HubSpot account (jeff@revopsimpact.us)
3. Navigate to "Apps" in the top menu

## 2. Create Public App

1. Click "Create app"
2. App details:
   - **App name:** Refyne
   - **Description:** HubSpot data quality platform with normalization, deduplication, and compliance monitoring
   - **Logo:** Upload Refyne logo (512x512px recommended)
   - **Support contact:** jeff@revopsimpact.us

## 3. Configure Auth Settings

Navigate to the "Auth" tab:

1. **Redirect URLs:** Add both:
   ```
   https://app.refynedata.com/api/hubspot/callback
   http://localhost:3000/api/hubspot/callback
   ```

2. **Scopes:** Select the following:
   - `crm.objects.companies.read` - Read company records
   - `crm.objects.companies.write` - Write normalized values
   - `crm.export` - Export portal for compliance scans
   - `oauth` - OAuth authentication

3. **Required scopes:** Mark all 4 scopes as required

## 4. Get Credentials

1. After creating the app, copy the **Client ID** and **Client Secret**
2. Add to environment variables:

   **Vercel (Production):**
   ```bash
   HUBSPOT_CLIENT_ID=your_client_id_here
   HUBSPOT_CLIENT_SECRET=your_client_secret_here
   NEXT_PUBLIC_APP_URL=https://app.refynedata.com
   ```

   **Local Development (.env.local):**
   ```bash
   HUBSPOT_CLIENT_ID=your_client_id_here
   HUBSPOT_CLIENT_SECRET=your_client_secret_here
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

   **Railway (Background Jobs):**
   ```bash
   HUBSPOT_CLIENT_ID=your_client_id_here
   HUBSPOT_CLIENT_SECRET=your_client_secret_here
   NEXT_PUBLIC_APP_URL=https://app.refynedata.com
   ```

## 5. Test OAuth Flow

1. Start local dev server: `npm run dev`
2. Navigate to `/connections`
3. Click "Connect HubSpot"
4. Authorize with a test portal
5. Verify callback redirects to `/connections?connected=true`

## 6. Marketplace Listing (After OAuth Testing)

Once OAuth is stable with 3 active installs:

1. Navigate to "Listing" tab in HubSpot Developer account
2. Complete marketplace listing form
3. Add screenshots, pricing, support info
4. Submit for HubSpot review
5. Address review feedback (10-60 day process)

## Notes

- Keep the app in **Development** mode until ready for marketplace submission
- Test with at least 3 different HubSpot portals before going live
- OAuth credentials are separate from Private App tokens (PAT)
- Do not rotate credentials without updating all environments
