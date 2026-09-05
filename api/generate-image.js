// Arquivo: /api/generate-image.js
// Usa o Cloudflare Workers AI (modelo gratuito flux-1-schnell)
// A API do Cloudflare sempre responde em JSON, com a imagem em base64 dentro de result.image

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
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt })
      }
    );

    const data = await response.json();

    if (!data.success || !data.result || !data.result.image) {
      const detail = JSON.stringify(data.errors || data);
      return res.status(200).json({ error: `Cloudflare respondeu com erro: ${detail}` });
    }

    // A imagem já vem em base64 (JPEG) dentro de result.image
    return res.status(200).json({ image: `data:image/jpeg;base64,${data.result.image}` });

  } catch (err) {
    return res.status(500).json({ error: `Falha ao conectar com o Cloudflare: ${err.message}` });
  }
}
