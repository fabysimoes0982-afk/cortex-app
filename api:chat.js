// Arquivo: /api/chat.js
// CONFIGURAÇÃO NECESSÁRIA no Vercel (Settings > Environment Variables):
//   ANTHROPIC_API_KEY = sua_chave_aqui (pegue em console.anthropic.com/settings/keys)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { messages, systemPrompt } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Mensagens inválidas' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Chave de API da Anthropic não configurada no servidor' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: systemPrompt || '',
        messages: messages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Erro na API da Anthropic' });
    }

    const reply = (data.content || []).map(b => b.text || '').join('\n').trim();
    return res.status(200).json({ reply: reply || 'Não consegui gerar uma resposta.' });

  } catch (err) {
    return res.status(500).json({ error: 'Falha ao conectar com a API da Anthropic' });
  }
}
