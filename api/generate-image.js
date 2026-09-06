// Arquivo: /api/generate-image.js
// Usa o Grok Imagine Image via Cloudflare Workers AI (Unified Billing)
// Usa as MESMAS credenciais CF_ACCOUNT_ID e CF_API_TOKEN já configuradas

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt inválido' });
  }

  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_API_TOKEN;
  if (!accountId || !apiToken) {
    return res.status(500).json({ error: 'Credenciais do Cloudflare não configuradas no servidor' });
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'xai/grok-imagine-image',
          input: { prompt }
        })
      }
    );

    const data = await response.json();

    const imageUrl = data.result?.image || data.image;
    if (!imageUrl) {
      const detail = JSON.stringify(data.errors || data);
      return res.status(200).json({ error: `Cloudflare respondeu: ${detail}` });
    }

    const finalImage = imageUrl.startsWith('http') ? imageUrl : `data:image/jpeg;base64,${imageUrl}`;
    return res.status(200).json({ image: finalImage });

  } catch (err) {
    return res.status(500).json({ error: `Falha ao conectar com o Cloudflare: ${err.message}` });
  }
}
