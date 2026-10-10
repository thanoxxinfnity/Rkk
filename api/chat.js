// Vercel serverless proxy for NVIDIA NIM chat completions.
// NIM does not send CORS headers, so browsers cannot call it directly.
// The user's key is forwarded per request and never stored or logged.
const NIM_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const MODEL = "meta/llama-3.2-90b-vision-instruct";

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "Method not allowed" } });
  }

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: { message: "Missing API key" } });
  }

  const body = req.body || {};
  const payload = {
    model: MODEL,                                   // fixed model: not an open proxy
    messages: Array.isArray(body.messages) ? body.messages.slice(-40) : [],
    temperature: Math.min(Number(body.temperature) || 0.85, 1.2),
    top_p: 0.95,
    max_tokens: Math.min(Number(body.max_tokens) || 700, 1000),
    stream: false
  };

  try {
    const upstream = await fetch(NIM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify(payload)
    });
    const text = await upstream.text();
    res.setHeader("Content-Type", "application/json");
    return res.status(upstream.status).send(text);
  } catch (err) {
    return res.status(502).json({ error: { message: "Could not reach NVIDIA NIM: " + err.message } });
  }
};
