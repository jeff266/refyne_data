/**
 * Update Frontera Health HubSpot Token
 *
 * Updates the access_token for portal 49169539 with a fresh PAT token.
 */

import { supabaseAdmin } from '../lib/db/admin-client';
import { encryptToken } from '../lib/crypto/token-encryption';

const FRONTERA_PORTAL_ID = '49169539';
const FRONTERA_PAT = 'pat-na1-9fbd00e9-d997-4cc0-a567-c96095476522';

async function updateToken() {
  console.log('Updating Frontera Health token...');

  // Encrypt the token
  const encryptedToken = encryptToken(FRONTERA_PAT);

  // Update in database
  const { error } = await supabaseAdmin
    .from('hubspot_connections')
    .update({ access_token: encryptedToken })
    .eq('portal_id', FRONTERA_PORTAL_ID);

  if (error) {
    console.error('❌ Failed to update token:', error);
    process.exit(1);
  }

  console.log('✓ Token updated successfully');
  process.exit(0);
}

updateToken();
