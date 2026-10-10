// Universal proxy for the free LLM providers listed in mnfst/awesome-free-llm-apis.
// Browsers cannot call most of these APIs directly (no CORS header), so every
// request goes through here. The user's key arrives per request in the
// x-api-key header, is forwarded to the provider, and is never stored or logged.

// Each entry: where to send the request, which wire format it uses, and quirks.
// format: "openai" = POST {model, messages} to a chat/completions URL (Bearer auth)
//         "cohere" = Cohere native /v2/chat with a content-block reply
const PROVIDERS = {
  "aion-labs":             { url: "https://api.aionlabs.ai/v1/chat/completions", format: "openai" },
  "cohere":                { url: "https://api.cohere.com/v2/chat", format: "cohere" },
  "google-gemini":         { url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", format: "openai" },
  "mistral-ai":            { url: "https://api.mistral.ai/v1/chat/completions", format: "openai" },
  "z-ai":                  { url: "https://open.bigmodel.cn/api/paas/v4/chat/completions", format: "openai" },
  "cloudflare-workers-ai": { url: "https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1/chat/completions", format: "openai", needsAccount: true },
  "groq":                  { url: "https://api.groq.com/openai/v1/chat/completions", format: "openai", maxField: "max_completion_tokens" },
  "hugging-face":          { url: "https://router.huggingface.co/v1/chat/completions", format: "openai" },
  "ollama-cloud":          { url: "https://ollama.com/v1/chat/completions", format: "openai" },
  "openrouter":            { url: "https://openrouter.ai/api/v1/chat/completions", format: "openai", headers: { "X-OpenRouter-Title": "Roleplay Playground" } },
  "ovhcloud":              { url: "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions", format: "openai", keyOptional: true },
  "siliconflow":           { url: "https://api.siliconflow.cn/v1/chat/completions", format: "openai" },
  "kilo-code":             { url: "https://api.kilo.ai/api/gateway/chat/completions", format: "openai", keyOptional: true },
  "llm7":                  { url: "https://api.llm7.io/v1/chat/completions", format: "openai", keyOptional: true },
  "modelscope":            { url: "https://api-inference.modelscope.cn/v1/chat/completions", format: "openai" },
  "nvidia-nim":            { url: "https://integrate.api.nvidia.com/v1/chat/completions", format: "openai", extra: { chat_template_kwargs: { enable_thinking: false } } },
};

const MAX_MESSAGES = 40;
const MAX_TOKENS_CAP = 1024;
const UPSTREAM_TIMEOUT_MS = 50000; // stay under the 60s function limit

function fail(res, status, message, extra) {
  return res.status(status).json({ error: { message, ...(extra || {}) } });
}

// Pull the reply text out of whichever wire format the provider uses.
function extractReply(format, data) {
  if (format === "cohere") {
    const blocks = (data && data.message && Array.isArray(data.message.content)) ? data.message.content : [];
    const text = blocks.filter(b => b.type === "text").map(b => b.text).join("");
    return { text, finish: data && data.finish_reason };
  }
  const choice = data && data.choices && data.choices[0];
  const msg = (choice && choice.message) || {};
  // Reasoning models may put the answer in a separate field when content is empty.
  const text = msg.content || msg.reasoning_content || msg.reasoning || "";
  return { text, finish: choice && choice.finish_reason };
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return fail(res, 405, "Method not allowed");

  const body = req.body || {};
  const cfg = PROVIDERS[body.provider];
  if (!cfg) return fail(res, 400, "Unknown provider. Pick one from the list.");

  const apiKey = (req.headers["x-api-key"] || "").toString().trim();
  if (!apiKey && !cfg.keyOptional) {
    return fail(res, 401, "This provider needs an API key. Add it in Settings.", { code: "missing_key" });
  }

  let url = cfg.url;
  if (cfg.needsAccount) {
    const account = String(body.accountId || "").trim();
    if (!/^[a-f0-9]{32}$/i.test(account)) {
      return fail(res, 400, "Cloudflare needs your 32-character Account ID. Add it in Settings.", { code: "missing_account" });
    }
    url = url.replace("{account_id}", account);
  }

  const messages = Array.isArray(body.messages) ? body.messages.slice(-MAX_MESSAGES) : [];
  if (!messages.length) return fail(res, 400, "No messages to send.");
  const model = String(body.model || "").slice(0, 200);
  if (!model) return fail(res, 400, "Pick a model first.");
  const maxTokens = Math.min(Number(body.max_tokens) || 700, MAX_TOKENS_CAP);
  const temperature = Math.min(Math.max(Number(body.temperature) || 0.85, 0), 1.2);

  const headers = { "Content-Type": "application/json", ...(cfg.headers || {}) };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  let payload;
  if (cfg.format === "cohere") {
    payload = { model, messages, max_tokens: maxTokens, temperature, stream: false };
  } else {
    payload = { model, messages, temperature, top_p: 0.95, stream: false, [cfg.maxField || "max_tokens"]: maxTokens, ...(cfg.extra || {}) };
  }

  let upstream;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      return fail(res, 504, "The provider took too long to reply. Try again or pick a smaller model.", { code: "timeout" });
    }
    return fail(res, 502, "Could not reach the provider: " + err.message, { code: "network" });
  }

  const raw = await upstream.text();
  let data = null;
  try { data = JSON.parse(raw); } catch { /* non-JSON error page */ }

  if (!upstream.ok) {
    // Some providers (Gemini) wrap the error in an array, so unwrap the first item.
    const first = Array.isArray(data) ? data[0] : data;
    const upstreamMsg = (first && (first.error?.message || first.message || first.detail || first.error)) || raw.slice(0, 200);
    const detail = (typeof upstreamMsg === "string" ? upstreamMsg : JSON.stringify(upstreamMsg)).slice(0, 300);
    const keyProblem = /api[ _-]?key|invalid key|authoriz|authenticat|unauthori|credential/i.test(detail);
    const hints = {
      401: "The key was rejected. Check it in Settings.",
      403: "Access denied for this key or model.",
      404: "This model is not available on the provider right now. It may be retired.",
      429: "Rate limit reached for this provider. Wait a bit or switch model.",
    };
    let friendly = hints[upstream.status];
    if (!friendly && keyProblem) friendly = "The key was rejected. Check it in Settings.";
    if (!friendly) friendly = upstream.status >= 500 ? "The provider had an internal error. Try again." : "The provider returned an error.";
    const status = (upstream.status >= 400 && upstream.status < 600) ? upstream.status : 502;
    return res.status(status).json({ error: { message: `${friendly}${detail ? " (" + detail + ")" : ""}`, code: "upstream_" + upstream.status } });
  }

  if (!data) return fail(res, 502, "The provider sent an unreadable reply.", { code: "bad_json" });

  const { text, finish } = extractReply(cfg.format, data);
  if (!text) {
    const message = finish === "length"
      ? "The reply was cut off before any text. Raise the max tokens or pick a non-reasoning model."
      : "The provider returned an empty reply.";
    return fail(res, 502, message, { code: "empty_reply" });
  }

  // Normalised shape, so the browser handles every provider the same way.
  return res.status(200).json({
    model,
    choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: finish || "stop" }],
  });
};
