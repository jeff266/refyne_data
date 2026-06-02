/**
 * Update GrowthBook HubSpot Token
 *
 * Updates the access_token for portal 8863617 with a fresh PAT token.
 */

import { supabaseAdmin } from '../lib/db/admin-client';
import { encryptToken } from '../lib/crypto/token-encryption';

const GROWTHBOOK_PORTAL_ID = '8863617';
const GROWTHBOOK_PAT = 'pat-na1-7817798e-3dfc-426d-aaa9-f9ed91d90b32';

async function updateToken() {
  console.log('Updating GrowthBook token...');

  // Encrypt the token
  const encryptedToken = encryptToken(GROWTHBOOK_PAT);

  // Update in database
  const { error } = await supabaseAdmin
    .from('hubspot_connections')
    .update({ access_token: encryptedToken })
    .eq('portal_id', GROWTHBOOK_PORTAL_ID);

  if (error) {
    console.error('❌ Failed to update token:', error);
    process.exit(1);
  }

  console.log('✓ Token updated successfully');
  process.exit(0);
}

updateToken();
