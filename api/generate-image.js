// Arquivo: /api/generate-image.js
// Fluxo: 1) usa o Gemini para transformar o pedido (curto, em português) numa
// descrição detalhada em inglês, que os modelos de imagem entendem muito melhor;
// 2) manda essa descrição para o Stable Diffusion XL via Cloudflare Workers AI.

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
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!accountId || !apiToken) {
    return res.status(500).json({ error: 'Credenciais do Cloudflare não configuradas no servidor' });
  }

  let enhancedPrompt = prompt;

  // Etapa 1: melhorar o prompt com o Gemini (se a chave estiver configurada)
  if (geminiKey) {
    try {
      const enhanceResponse = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': geminiKey
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            systemInstruction: {
              parts: [{
                text: 'Você transforma pedidos curtos e vagos (geralmente em português, para trabalhos escolares ou material educativo) em um prompt detalhado em INGLÊS para um gerador de imagens de IA. Descreva a cena com objetos, composição, cores e estilo concretos. Não interprete palavras de forma literal/brincalhona nem crie trocadilhos visuais — pense no que a pessoa realmente quer ilustrar (ex.: "importância da água" deve virar algo como uma cena educativa mostrando pessoas bebendo água, plantas sendo regadas, um planeta com oceanos, etc., não um brinquedo aquático). Responda APENAS com o prompt final em inglês, sem aspas, sem explicações, sem comentários.'
              }]
            }
          })
        }
      );
      const enhanceData = await enhanceResponse.json();
      const suggested = (enhanceData.candidates?.[0]?.content?.parts || [])
        .map(p => p.text || '')
        .join(' ')
        .trim();
      if (suggested) enhancedPrompt = suggested;
    } catch (err) {
      // Se der erro no Gemini, seguimos com o prompt original mesmo
      console.error('Falha ao melhorar o prompt com o Gemini:', err.message);
    }
  }

  // Etapa 2: gerar a imagem com o prompt (melhorado ou original)
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/stabilityai/stable-diffusion-xl-base-1.0`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt: enhancedPrompt })
      }
    );

    const contentType = response.headers.get('content-type') || '';

    if (!response.ok || contentType.includes('application/json')) {
      const data = await response.json();
      const detail = JSON.stringify(data.errors || data.messages || data);
      return res.status(200).json({ error: `Cloudflare respondeu: ${detail}`, promptUsado: enhancedPrompt });
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    return res.status(200).json({
      image: `data:image/png;base64,${base64}`,
      promptUsado: enhancedPrompt // devolvido só para depuração; o front-end pode ignorar
    });

  } catch (err) {
    return res.status(500).json({ error: `Falha ao conectar com o Cloudflare: ${err.message}` });
  }
}
