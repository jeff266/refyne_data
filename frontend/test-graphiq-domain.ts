/**
 * Test GraphIQ API with website_url field
 *
 * Run with: npx tsx test-graphiq-domain.ts
 */

const GRAPHIQ_API_KEY = process.env.GRAPHIQ_API_KEY;

if (!GRAPHIQ_API_KEY) {
  console.error('❌ GRAPHIQ_API_KEY not set');
  process.exit(1);
}

async function testDomain(domain: string) {
  console.log(`\n🔍 Testing domain: ${domain}`);
  console.log('━'.repeat(50));

  try {
    const response = await fetch('https://app.graphiq.ai/api/v2/organizations/search', {
      method: 'POST',
      headers: {
        'X-API-Key': GRAPHIQ_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organization: {
          website_url: domain,
        },
        limit: 1,
      }),
    });

    console.log('Status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error response:', errorText);
      return;
    }

    const data = await response.json();
    console.log('✅ Response received');
    console.log('Entities found:', data.entities?.length || 0);

    if (data.entities && data.entities.length > 0) {
      const org = data.entities[0];
      console.log('\n📊 Organization data:');
      console.log('  Name:', org.name);
      console.log('  Website:', org.website_url);
      console.log('  Industry:', org.industry);
      console.log('  Employees:', org.employee_count || org.employees);
      console.log('  Revenue:', org.revenue);
      console.log('  LinkedIn:', org.linkedin_url);
    } else {
      console.log('⚠️  No entities found for this domain');
    }
  } catch (error) {
    console.error('❌ Exception:', error instanceof Error ? error.message : error);
  }
}

async function main() {
  console.log('GraphIQ API Test - website_url field');
  console.log('='.repeat(50));

  // Test with common domains from Frontera
  const testDomains = [
    'apple.com',
    'microsoft.com',
    'fronterahealth.com',
    'https://apple.com',  // Test with protocol
    'www.apple.com',      // Test with www
  ];

  for (const domain of testDomains) {
    await testDomain(domain);
    await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit
  }

  console.log('\n' + '='.repeat(50));
  console.log('Test complete');
}

main();
