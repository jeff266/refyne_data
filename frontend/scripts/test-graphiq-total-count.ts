#!/usr/bin/env npx tsx
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env.local') });

const GRAPHIQ_BASE_URL = 'https://app.graphiq.ai/api/v2';

async function testTotalCount() {
  const apiKey = process.env.GRAPHIQ_API_KEY;
  if (!apiKey) {
    console.error('GRAPHIQ_API_KEY not set');
    return;
  }

  console.log('Checking total_count field\n');

  const payload = {
    organization: {
      industries: ['Technology'],
      min_employees: 20,
      max_employees: 1000,
      country: 'United States',
    },
    limit: 100, // Request 100 but expect 10
  };

  const response = await fetch(`${GRAPHIQ_BASE_URL}/organizations/search`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (response.ok) {
    const data: any = await response.json();

    console.log('Response metadata:');
    console.log(`  count: ${data.count} (results in response)`);
    console.log(`  total_count: ${data.total_count} (total available)`);
    console.log(`  entities.length: ${data.entities?.length}`);
    console.log('');

    if (data.total_count > data.count) {
      console.log(`✅ More results available: ${data.total_count - data.count} additional companies`);
      console.log('\nTrying offset to get next batch:\n');

      // Try to get next 10 with offset
      const payload2 = { ...payload, offset: 10 };

      const response2 = await fetch(`${GRAPHIQ_BASE_URL}/organizations/search`, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload2),
      });

      if (response2.ok) {
        const data2: any = await response2.json();
        console.log(`Offset=10 results: ${data2.entities?.length}`);

        if (data2.entities?.length > 0) {
          console.log('\nFirst 3 from offset batch:');
          data2.entities.slice(0, 3).forEach((org: any, i: number) => {
            console.log(`${i + 1}. ${org.name} - ${org.num_employees} employees`);
          });

          // Check if different from first batch
          const firstBatchNames = data.entities.map((e: any) => e.name);
          const secondBatchNames = data2.entities.map((e: any) => e.name);
          const overlap = secondBatchNames.filter((n: string) => firstBatchNames.includes(n));

          console.log(`\nOverlap with first batch: ${overlap.length}/${data2.entities.length}`);

          if (overlap.length === 0) {
            console.log('✅ Offset pagination works - different companies returned');
          } else {
            console.log('❌ Offset returns same companies');
          }
        }
      }
    } else {
      console.log('❌ Query only has 10 total results (no pagination needed)');
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // Try broader query to see if we get more results
    console.log('Testing broader query (no employee filter):\n');

    const broadPayload = {
      organization: {
        industries: ['Technology'],
        country: 'United States',
      },
      limit: 100,
    };

    const response3 = await fetch(`${GRAPHIQ_BASE_URL}/organizations/search`, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(broadPayload),
    });

    if (response3.ok) {
      const data3: any = await response.json();
      console.log(`Broader query - total_count: ${data3.total_count}`);
      console.log(`Broader query - count: ${data3.count}`);
    }
  }
}

testTotalCount();
