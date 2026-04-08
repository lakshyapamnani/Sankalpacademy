const PROXY_URL = import.meta.env.VITE_GEMINI_PROXY_URL || '/functions/geminiChat';

export async function sendPromptToGemini(prompt: string): Promise<string> {
  try {
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Proxy error: ${res.status} ${text}`);
    }

    const data = await res.json();
    return data.reply || '';
  } catch (error) {
    console.error('sendPromptToGemini error', error);
    throw error;
  }
}

export default sendPromptToGemini;
