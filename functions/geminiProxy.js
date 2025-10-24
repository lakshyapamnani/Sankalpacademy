const functions = require('firebase-functions');
const fetch = global.fetch || require('node-fetch');

// HTTP function that forwards prompt to Google Generative Language (Gemini) API
exports.geminiChat = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send({ error: 'Method not allowed' });
    return;
  }

  const { prompt } = req.body || {};
  if (!prompt) {
    res.status(400).send({ error: 'Missing prompt' });
    return;
  }

  // Prefer functions config, fall back to env var (do NOT commit your key)
  const apiKey = functions.config && functions.config().gemini && functions.config().gemini.key || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).send({ error: 'Gemini API key not configured' });
    return;
  }

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1/models/text-bison-001:generateText?key=${apiKey}`;

    const body = {
      prompt: {
        text: prompt,
      },
      // you can tune temperature, maxOutputTokens etc. as needed
      temperature: 0.2,
      maxOutputTokens: 512,
    };

    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const text = await r.text();
      console.error('Gemini API error', r.status, text);
      res.status(502).send({ error: 'Upstream API error', details: text });
      return;
    }

    const data = await r.json();
    // The response shape contains candidates; extract text
    const reply = data?.candidates?.[0]?.output?.[0]?.content?.[0]?.text || data?.candidates?.[0]?.content || JSON.stringify(data);

    res.json({ reply });
  } catch (error) {
    console.error('geminiChat error', error);
    res.status(500).send({ error: 'Internal server error' });
  }
});
