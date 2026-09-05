// Arquivo: /api/generate-image.js
// Usa o Grok Imagine Image 2.0 via Cloudflare Workers AI (Unified Billing)
// Usa as MESMAS credenciais CF_ACCOUNT_ID e CF_API_TOKEN já configuradas
// ATENÇÃO: este modelo é PAGO por imagem (cobrado na sua conta Cloudflare, se o faturamento estiver ativo)

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
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/xai/grok-imagine-image-2.0`,
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

    // A imagem pode vir como URL (result.image) ou base64, dependendo do formato de retorno
    const imageUrl = data.result?.image || data.image;
    if (!imageUrl) {
      const detail = JSON.stringify(data.errors || data);
      return res.status(200).json({ error: `Cloudflare respondeu: ${detail}` });
    }

    // Se já vier como URL completa, usa direto; se vier em base64, monta o data URI
    const finalImage = imageUrl.startsWith('http') ? imageUrl : `data:image/jpeg;base64,${imageUrl}`;
    return res.status(200).json({ image: finalImage });

  } catch (err) {
    return res.status(500).json({ error: `Falha ao conectar com o Cloudflare: ${err.message}` });
  }
}
