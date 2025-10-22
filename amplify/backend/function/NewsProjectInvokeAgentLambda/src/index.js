// Lambda: gpBedrockProxy (Node.js 18+)
// Invokes AWS Bedrock Runtime with Qwen (chat schema).
// Input: { prompt, max_tokens?, temperature?, model_id? }

const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");

const REGION = process.env.AWS_REGION || "ap-northeast-1";
const DEFAULT_MODEL_ID = process.env.BEDROCK_MODEL_ID || "qwen.qwen3-32b-v1:0";
const DEFAULT_MAX_TOKENS = parseInt(process.env.MAX_TOKENS || "300", 10);
const DEFAULT_TEMPERATURE = Number(process.env.TEMPERATURE || "0.2");

const bedrock = new BedrockRuntimeClient({ region: REGION });

exports.handler = async (event) => {
  try {
    const payload = parseEvent(event);

    const prompt = payload.prompt || payload.inputText;
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return http(400, { error: "Missing 'prompt' or 'inputText'" });
    }

    const modelId     = payload.model_id   || DEFAULT_MODEL_ID;
    const maxTokens   = toInt(payload.max_tokens, DEFAULT_MAX_TOKENS);
    const temperature = isNum(payload.temperature) ? Number(payload.temperature) : DEFAULT_TEMPERATURE;
    const topP        = isNum(payload.top_p) ? Number(payload.top_p) : 0.9;

    // Qwen requires OpenAI-like chat schema
    const modelBody = {
      messages: [{ role: "user", content: String(prompt) }],
      max_tokens: maxTokens,
      temperature,
      top_p: topP
    };

    const cmd = new InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: Buffer.from(JSON.stringify(modelBody))
    });

    const res = await bedrock.send(cmd);
    const raw = await readBodyAny(res.body);       // raw string
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = raw; }

    const normalized = extractContent(parsed);
    return http(200, { model_response: normalized });
  } catch (err) {
    console.error("Lambda error:", err);
    return http(500, { error: String(err) });
  }
};

/* --------------------------- helpers --------------------------- */

function parseEvent(event) {
  if (event && typeof event === "object" && "body" in event) {
    try {
      return typeof event.body === "string" ? JSON.parse(event.body) : (event.body || {});
    } catch {
      return {};
    }
  }
  return event || {};
}

function http(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(body)
  };
}

function toInt(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}
function isNum(v) {
  return typeof v === "number" || (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v)));
}

async function readBodyAny(body) {
  if (!body) return "";
  if (typeof body === "string") return body;
  if (Buffer.isBuffer(body)) return body.toString("utf-8");
  if (body instanceof Uint8Array) return Buffer.from(body).toString("utf-8");
  if (typeof body.on === "function") {
    return await new Promise((resolve, reject) => {
      const chunks = [];
      body.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      body.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      body.on("error", reject);
    });
  }
  if (typeof body.getReader === "function") {
    const reader = body.getReader();
    const chunks = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks).toString("utf-8");
  }
  try { return JSON.stringify(body); } catch { return String(body); }
}

function stripCodeFence(s) {
  return s.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "");
}

function extractContent(data) {
  // OpenAI-style (Qwen returns this)
  const msg = data?.choices?.[0]?.message?.content;
  if (typeof msg === "string") {
    const cleaned = stripCodeFence(msg).trim();
    try { return JSON.parse(cleaned); } catch { return cleaned; }
  }
  // Bedrock chat-style
  const txt = data?.output?.message?.content?.find?.(c => typeof c?.text === "string")?.text;
  if (txt) {
    const cleaned = stripCodeFence(txt).trim();
    try { return JSON.parse(cleaned); } catch { return cleaned; }
  }
  return data;
}
