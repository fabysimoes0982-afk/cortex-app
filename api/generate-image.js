// Arquivo: /api/generate-image.js
// Usa o Stable Diffusion XL via Cloudflare Workers AI (modelo NATIVO, gratuito na cota diária, sem cartão)

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
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/stabilityai/stable-diffusion-xl-base-1.0`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt })
      }
    );

    const contentType = response.headers.get('content-type') || '';

    if (!response.ok || contentType.includes('application/json')) {
      const data = await response.json();
      const detail = JSON.stringify(data.errors || data.messages || data);
      return res.status(200).json({ error: `Cloudflare respondeu: ${detail}` });
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    return res.status(200).json({ image: `data:image/png;base64,${base64}` });

  } catch (err) {
    return res.status(500).json({ error: `Falha ao conectar com o Cloudflare: ${err.message}` });
  }
}
