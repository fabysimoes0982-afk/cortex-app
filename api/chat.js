// Arquivo: /api/chat.js
// Usa a variável GEMINI_API_KEY já configurada no Vercel

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { messages, systemPrompt } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Mensagens inválidas' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Chave de API não configurada no servidor' });
  }

  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: systemPrompt || '' }] }
        })
      }
    );

    const data = await response.json();

    // Mostra a resposta completa do Gemini se algo der errado, pra diagnosticar
    if (!response.ok || data.error) {
      return res.status(200).json({ error: `Gemini respondeu (status ${response.status}): ${JSON.stringify(data)}` });
    }

    const reply = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('\n').trim();

    if (!reply) {
      return res.status(200).json({ error: `Resposta vazia do Gemini. Resposta completa: ${JSON.stringify(data)}` });
    }

    return res.status(200).json({ reply });

  } catch (err) {
    return res.status(500).json({ error: `Falha ao conectar com o Gemini: ${err.message}` });
  }
}
