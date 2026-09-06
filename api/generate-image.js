// Arquivo: /api/generate-image.js
// Usa o Nano Banana 2 Lite (Gemini 3.1 Flash Lite Image) via Google AI Studio
// Usa a MESMA variável GEMINI_API_KEY já configurada no Vercel (tem tier gratuito)

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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-image:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE'] }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(200).json({ error: `Gemini respondeu (status ${response.status}): ${JSON.stringify(data)}` });
    }

    const parts = data.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(p => p.inlineData);

    if (!imagePart) {
      return res.status(200).json({ error: `Nenhuma imagem retornada. Resposta: ${JSON.stringify(data)}` });
    }

    return res.status(200).json({
      image: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`
    });

  } catch (err) {
    return res.status(500).json({ error: `Falha ao conectar com o Gemini: ${err.message}` });
  }
}
