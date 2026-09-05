// Arquivo: /api/generate-image.js
// Deploy: Vercel (ou adapte para Cloudflare Workers / Netlify Functions)
//
// CONFIGURAÇÃO NECESSÁRIA:
// No painel do Vercel, vá em Settings > Environment Variables e adicione:
//   GEMINI_API_KEY = sua_chave_aqui
// NUNCA coloque a chave direto neste arquivo.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt inválido' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Chave de API não configurada no servidor' });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE'] }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Erro na API do Gemini' });
    }

    // Extrai a imagem em base64 da resposta
    const parts = data.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(p => p.inlineData);

    if (!imagePart) {
      return res.status(502).json({ error: 'Nenhuma imagem foi retornada. Tente reformular o prompt.' });
    }

    return res.status(200).json({
      image: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`
    });

  } catch (err) {
    return res.status(500).json({ error: 'Falha ao conectar com a API do Gemini' });
  }
}
