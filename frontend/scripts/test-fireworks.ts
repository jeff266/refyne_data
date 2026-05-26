const FIREWORKS_API_KEY = process.env.REFYNE_FIREWORKS_KEY
const FIREWORKS_ENDPOINT = 'https://api.fireworks.ai/inference/v1/chat/completions'
const DEEPSEEK_MODEL = 'accounts/fireworks/models/deepseek-v4-flash'

async function test() {
  console.log('API key present:', !!FIREWORKS_API_KEY)
  console.log('API key prefix:', FIREWORKS_API_KEY?.slice(0, 8))
  console.log('Model:', DEEPSEEK_MODEL)

  const response = await fetch(FIREWORKS_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${FIREWORKS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'user', content: 'Reply with just the word CONNECTED' }
      ],
      max_tokens: 10,
      temperature: 0,
    }),
  })

  console.log('Status:', response.status)
  const data = await response.json()
  console.log('Response:', JSON.stringify(data, null, 2))
}

test().catch(console.error)
