/**
 * Test GraphIQ API to see all available fields
 */

const GRAPHIQ_API_KEY = process.env.GRAPHIQ_API_KEY;

async function testFields() {
  const response = await fetch('https://app.graphiq.ai/api/v2/organizations/search', {
    method: 'POST',
    headers: {
      'X-API-Key': GRAPHIQ_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      organization: {
        website_url: 'apple.com',
      },
      limit: 1,
    }),
  });

  const data = await response.json();

  if (data.entities && data.entities.length > 0) {
    console.log('All available fields in GraphIQ response:');
    console.log(JSON.stringify(data.entities[0], null, 2));
  }
}

testFields();
