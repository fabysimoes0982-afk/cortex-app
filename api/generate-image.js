// Arquivo: /api/generate-image.js
// Fluxo:
// 1) usa o Gemini para transformar o pedido (curto, em português) numa descrição
//    detalhada em inglês;
// 2a) se houver uma imagem de referência anexada E a variável POLLINATIONS_API_KEY
//     estiver configurada, tenta editar/gerar a partir dela com o modelo "kontext";
// 2b) se não houver referência, ou se a etapa acima falhar por qualquer motivo
//     (o modelo kontext tem um bug conhecido e às vezes recusa a imagem), cai de
//     volta para gerar só a partir do texto com o modelo Flux — sempre gratuito,
//     sem chave, sem limite diário.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { prompt, referenceImage } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt inválido' });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const pollinationsKey = process.env.POLLINATIONS_API_KEY; // opcional, só necessário para usar imagem de referência
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
                text: 'Você transforma pedidos curtos e vagos (geralmente em português, para trabalhos escolares ou material educativo) em um prompt detalhado em INGLÊS para um gerador de imagens de IA. Descreva a cena com objetos, composição, cores e estilo concretos. Não interprete palavras de forma literal/brincalhona nem crie trocadilhos visuais — pense no que a pessoa realmente quer ilustrar. Se o pedido mencionar "baseado nessa imagem" ou algo parecido, mantenha isso implícito (não repita a frase), só descreva a transformação desejada. Responda APENAS com o prompt final em inglês, sem aspas, sem explicações, sem comentários.'
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
      console.error('Falha ao melhorar o prompt com o Gemini:', err.message);
    }
  }

  let imageBuffer = null;
  let referenceUsed = false;

  // Etapa 2a: tentar usar a imagem de referência com o modelo "kontext"
  if (referenceImage && referenceImage.data && pollinationsKey) {
    try {
      const boundary = '----cortexBoundary' + Date.now();
      const imgBuffer = Buffer.from(referenceImage.data, 'base64');
      const CRLF = '\r\n';
      const bodyParts = [
        Buffer.from(`--${boundary}${CRLF}Content-Disposition: form-data; name="prompt"${CRLF}${CRLF}${enhancedPrompt}${CRLF}`),
        Buffer.from(`--${boundary}${CRLF}Content-Disposition: form-data; name="model"${CRLF}${CRLF}kontext${CRLF}`),
        Buffer.from(`--${boundary}${CRLF}Content-Disposition: form-data; name="image"; filename="reference.jpg"${CRLF}Content-Type: ${referenceImage.mimeType || 'image/jpeg'}${CRLF}${CRLF}`),
        imgBuffer,
        Buffer.from(`${CRLF}--${boundary}--${CRLF}`)
      ];
      const multipartBody = Buffer.concat(bodyParts);

      const editResponse = await fetch('https://gen.pollinations.ai/v1/images/edits', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${pollinationsKey}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`
        },
        body: multipartBody
      });

      if (editResponse.ok) {
        const editData = await editResponse.json();
        const b64 = editData?.data?.[0]?.b64_json;
        const url = editData?.data?.[0]?.url;
        if (b64) {
          imageBuffer = Buffer.from(b64, 'base64');
          referenceUsed = true;
        } else if (url) {
          const fetched = await fetch(url);
          if (fetched.ok) {
            imageBuffer = Buffer.from(await fetched.arrayBuffer());
            referenceUsed = true;
          }
        }
      }
      // Se a resposta não for OK, simplesmente cai no fallback abaixo — sem travar.
    } catch (err) {
      console.error('Falha ao usar a imagem de referência (modelo kontext):', err.message);
    }
  }

  // Etapa 2b: gerar (ou cair de volta) com o modelo Flux, sempre gratuito e sem chave
  if (!imageBuffer) {
    try {
      const seed = Math.floor(Math.random() * 1000000);
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?model=flux&width=1024&height=768&nologo=true&seed=${seed}`;
      const response = await fetch(url);

      if (!response.ok) {
        return res.status(200).json({
          error: `O serviço de geração de imagem respondeu com erro (status ${response.status}). Tente novamente em alguns segundos.`,
          promptUsado: enhancedPrompt
        });
      }

      imageBuffer = Buffer.from(await response.arrayBuffer());
    } catch (err) {
      return res.status(500).json({ error: `Falha ao conectar com o serviço de geração de imagem: ${err.message}` });
    }
  }

  const base64 = imageBuffer.toString('base64');
  return res.status(200).json({
    image: `data:image/jpeg;base64,${base64}`,
    referenceUsed, // false quando havia referência mas ela não pôde ser usada (o front-end avisa o aluno nesse caso)
    promptUsado: enhancedPrompt
  });
}
