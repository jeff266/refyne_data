/**
 * Provider API key validation
 * Each function makes the cheapest possible API call to confirm the key is valid
 */

export async function validateApollo(key: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch('https://api.apollo.io/api/v1/auth/health', {
      headers: { 'X-Api-Key': key },
    });
    return { valid: res.ok, error: res.ok ? undefined : 'Apollo rejected the key' };
  } catch (error) {
    return { valid: false, error: 'Failed to connect to Apollo API' };
  }
}

export async function validateZoomInfo(key: string): Promise<{ valid: boolean; error?: string }> {
  try {
    // ZoomInfo uses JWT — validate by calling /lookup/outputfields
    const res = await fetch('https://api.zoominfo.com/lookup/outputfields?objectType=company', {
      headers: { Authorization: `Bearer ${key}` },
    });
    return { valid: res.ok, error: res.ok ? undefined : 'ZoomInfo rejected the key' };
  } catch (error) {
    return { valid: false, error: 'Failed to connect to ZoomInfo API' };
  }
}

export async function validateClearbit(key: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch('https://person.clearbit.com/v2/combined/find?email=test@clearbit.com', {
      headers: { Authorization: `Bearer ${key}` },
    });
    // 401 = invalid key, 402/404 = valid key but no result (acceptable)
    return {
      valid: res.status !== 401,
      error: res.status === 401 ? 'Clearbit rejected the key' : undefined,
    };
  } catch (error) {
    return { valid: false, error: 'Failed to connect to Clearbit API' };
  }
}

export async function validateCognism(key: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch('https://api.cognism.com/v1/lead', {
      headers: { Authorization: key },
    });
    return {
      valid: res.status !== 401,
      error: res.status === 401 ? 'Cognism rejected the key' : undefined,
    };
  } catch (error) {
    return { valid: false, error: 'Failed to connect to Cognism API' };
  }
}

export async function validateProxyCurl(key: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch('https://nubela.co/proxycurl/api/v2/linkedin', {
      headers: { Authorization: `Bearer ${key}` },
    });
    // 401 = invalid, 400 = valid key but missing params (acceptable)
    return {
      valid: res.status !== 401,
      error: res.status === 401 ? 'ProxyCurl rejected the key' : undefined,
    };
  } catch (error) {
    return { valid: false, error: 'Failed to connect to ProxyCurl API' };
  }
}

/**
 * Main validation dispatcher
 */
export async function validateProviderKey(
  provider: string,
  key: string
): Promise<{ valid: boolean; error?: string }> {
  switch (provider) {
    case 'apollo':
      return validateApollo(key);
    case 'zoominfo':
      return validateZoomInfo(key);
    case 'clearbit':
      return validateClearbit(key);
    case 'cognism':
      return validateCognism(key);
    case 'proxycurl':
      return validateProxyCurl(key);
    default:
      return { valid: false, error: 'Unknown provider' };
  }
}
