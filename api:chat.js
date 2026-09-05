// Arquivo: /api/chat.js
// Usa a MESMA variável GEMINI_API_KEY que já está configurada no Vercel
// (a mesma chave usada pelo gerador de imagens)

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

  // Converte o histórico de mensagens para o formato do Gemini
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

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Erro na API do Gemini' });
    }

    const reply = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('\n').trim();
    return res.status(200).json({ reply: reply || 'Não consegui gerar uma resposta.' });

  } catch (err) {
    return res.status(500).json({ error: 'Falha ao conectar com a API do Gemini' });
  }
}
