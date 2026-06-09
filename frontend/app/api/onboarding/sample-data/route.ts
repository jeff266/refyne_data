import { NextResponse } from "next/server";
import { getOrgContext, authError } from "@/lib/auth/clerk-helpers";
import { getConnection, HubSpotClient } from "@/lib/hubspot";
import { getAccessToken } from "@/lib/hubspot/get-access-token";
import { captureWithOrgContext } from "@/lib/monitoring/sentry";
import { Redis } from "@upstash/redis";

// Initialize Redis from URL (extracts token from URL automatically)
const redis = process.env.UPSTASH_REDIS_URL ? Redis.fromEnv() : null;

interface SampleDataResponse {
  names: string[];
  phones: string[];
  urls: string[];
  countries: string[];
  states: string[];
  industries: string[];
  employee_counts: string[];
  linkedin_urls: string[];

  // Field presence flags
  has_phones: boolean;
  has_urls: boolean;
  has_countries: boolean;
  has_states: boolean;
  has_industries: boolean;
  has_employee_counts: boolean;
  has_linkedin_urls: boolean;
}

/**
 * GET /api/onboarding/sample-data
 *
 * Fetches 50 random companies from HubSpot to show as examples in the calibration wizard.
 * Results are cached in Redis for 10 minutes.
 *
 * Auth: All authenticated users (no admin requirement)
 */
export async function GET() {
  let ctx;
  try {
    ctx = await getOrgContext();
  } catch (e) {
    return (
      authError(e) ??
      NextResponse.json({ error: "Server error" }, { status: 500 })
    );
  }

  try {
    // Check Redis cache first
    if (redis) {
      const cacheKey = `onboarding:sample:${ctx.orgId}`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        console.log("[Sample Data] Cache hit");
        // Upstash Redis automatically deserializes JSON, no need to parse
        return NextResponse.json(cached);
      }
    }

    // Get HubSpot connection
    const connection = await getConnection(ctx.orgId);
    if (!connection) {
      return NextResponse.json(
        { error: "HubSpot not connected" },
        { status: 400 },
      );
    }

    // Get access token and create client
    const accessToken = await getAccessToken(ctx.orgId);
    const client = new HubSpotClient(accessToken, connection.portalId);

    // Properties to fetch
    const properties = [
      "name",
      "phone",
      "website",
      "country",
      "state",
      "industry",
      "numberofemployees",
      "linkedin_company_page",
    ];

    // Fetch up to 50 random companies using search API
    // Use a filter that matches most companies and rely on HubSpot's pagination
    const response = await client.searchCompanies(
      [
        {
          filters: [
            {
              propertyName: "createdate",
              operator: "HAS_PROPERTY",
            },
          ],
        },
      ],
      properties,
      50,
    );

    // Filter out records with all empty fields
    const validCompanies = response.filter((company) => {
      const props = company.properties;
      return (
        props.name ||
        props.phone ||
        props.website ||
        props.country ||
        props.state ||
        props.industry ||
        props.numberofemployees ||
        props.linkedin_company_page
      );
    });

    // Extract and deduplicate field values (up to 8 samples each)
    const nameSet = new Set<string>();
    const phoneSet = new Set<string>();
    const urlSet = new Set<string>();
    const countrySet = new Set<string>();
    const stateSet = new Set<string>();
    const industrySet = new Set<string>();
    const employeeCountSet = new Set<string>();
    const linkedinUrlSet = new Set<string>();

    for (const company of validCompanies) {
      const props = company.properties;

      if (props.name && nameSet.size < 8) nameSet.add(props.name);
      if (props.phone && phoneSet.size < 8) phoneSet.add(props.phone);
      if (props.website && urlSet.size < 8) urlSet.add(props.website);
      if (props.country && countrySet.size < 8) countrySet.add(props.country);
      if (props.state && stateSet.size < 8) stateSet.add(props.state);
      if (props.industry && industrySet.size < 8)
        industrySet.add(props.industry);
      if (props.numberofemployees && employeeCountSet.size < 8) {
        employeeCountSet.add(props.numberofemployees);
      }
      if (props.linkedin_company_page && linkedinUrlSet.size < 8) {
        linkedinUrlSet.add(props.linkedin_company_page);
      }

      // Stop early if we have 8 samples for all fields
      if (
        nameSet.size >= 8 &&
        phoneSet.size >= 8 &&
        urlSet.size >= 8 &&
        countrySet.size >= 8 &&
        stateSet.size >= 8 &&
        industrySet.size >= 8 &&
        employeeCountSet.size >= 8 &&
        linkedinUrlSet.size >= 8
      ) {
        break;
      }
    }

    // Build response
    const responseData: SampleDataResponse = {
      names: Array.from(nameSet),
      phones: Array.from(phoneSet),
      urls: Array.from(urlSet),
      countries: Array.from(countrySet),
      states: Array.from(stateSet),
      industries: Array.from(industrySet),
      employee_counts: Array.from(employeeCountSet),
      linkedin_urls: Array.from(linkedinUrlSet),

      has_phones: phoneSet.size > 0,
      has_urls: urlSet.size > 0,
      has_countries: countrySet.size > 0,
      has_states: stateSet.size > 0,
      has_industries: industrySet.size > 0,
      has_employee_counts: employeeCountSet.size > 0,
      has_linkedin_urls: linkedinUrlSet.size > 0,
    };

    // Cache in Redis for 10 minutes (600 seconds)
    if (redis) {
      const cacheKey = `onboarding:sample:${ctx.orgId}`;
      await redis.setex(cacheKey, 600, JSON.stringify(responseData));
      console.log("[Sample Data] Cached for 10 minutes");
    }

    return NextResponse.json(responseData);
  } catch (error) {
    captureWithOrgContext(error, ctx.orgId, {
      route: "/api/onboarding/sample-data",
    });
    console.error("[Sample Data] Error:", error);

    if (error instanceof Error && error.message.includes("401")) {
      return NextResponse.json(
        { error: "HubSpot token expired or invalid. Please reconnect." },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch sample data from HubSpot" },
      { status: 500 },
    );
  }
}
