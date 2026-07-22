import {
  buildSystemPrompt,
  gateQuestion,
  sanitizeHistory,
  sseText,
} from "./_shared/guardrails.mts";

const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
/** Prefer GLM; fall back to lighter hosted models when the key is not entitled for GLM. */
const PRIMARY_MODEL = (typeof process !== "undefined" && process.env?.CHAT_MODEL) || "z-ai/glm-5.2";
const FALLBACK_MODELS = [
  "meta/llama-3.1-8b-instruct",
  "nvidia/llama-3.1-nemotron-nano-8b-v1",
];

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allow =
    origin.endsWith(".github.io") ||
    origin.endsWith(".netlify.app") ||
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:")
      ? origin
      : "https://nivi-llc.github.io";

  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function jsonResponse(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(req) },
  });
}

function sseResponse(req: Request, text: string, status = 200) {
  return new Response(sseText(text), {
    status,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(req),
    },
  });
}

function normalizeAuth(header: string): string {
  let token = header.trim();
  if (/^bearer\s+/i.test(token)) token = token.replace(/^bearer\s+/i, "").trim();
  token = token.replace(/^["']+|["']+$/g, "").trim();
  return token ? `Bearer ${token}` : "";
}

async function callChat(
  auth: string,
  model: string,
  messages: { role: string; content: string }[]
): Promise<Response> {
  return fetch(NVIDIA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      Authorization: auth,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      top_p: 0.9,
      max_tokens: 2048,
      stream: true,
    }),
  });
}

export default async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, 405, { error: "Method not allowed" });
  }

  const auth = normalizeAuth(req.headers.get("Authorization") || "");
  if (!auth.startsWith("Bearer ") || auth.length < 20) {
    return jsonResponse(req, 401, { error: "Missing session key" });
  }

  let payload: {
    question?: unknown;
    history?: unknown;
    messages?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(req, 400, { error: "Invalid JSON body" });
  }

  let question = typeof payload.question === "string" ? payload.question.trim() : "";
  let history = sanitizeHistory(payload.history);

  if (!question && Array.isArray(payload.messages)) {
    const users = payload.messages.filter(
      (m: { role?: string; content?: string }) => m && m.role === "user" && m.content
    );
    const last = users[users.length - 1] as { content?: string } | undefined;
    question = String(last?.content || "").trim();
    history = sanitizeHistory(
      payload.messages.filter(
        (m: { role?: string }) => m && (m.role === "user" || m.role === "assistant")
      )
    );
    if (history.length && history[history.length - 1].role === "user") {
      history = history.slice(0, -1);
    }
  }

  if (!question) {
    return jsonResponse(req, 400, { error: "question required" });
  }

  const gated = gateQuestion(question, history.length > 0);
  if (!gated.ok) {
    return sseResponse(req, gated.refusal);
  }

  const messages = [
    { role: "system", content: buildSystemPrompt() },
    ...history,
    { role: "user", content: question },
  ];

  const models = [PRIMARY_MODEL, ...FALLBACK_MODELS.filter((m) => m !== PRIMARY_MODEL)];
  let upstream: Response | null = null;
  let lastErr = "";

  for (const model of models) {
    const res = await callChat(auth, model, messages);
    if (res.ok) {
      upstream = res;
      break;
    }
    lastErr = await res.text().catch(() => res.statusText);
    // Only cascade on auth/entitlement failures; other errors stop immediately
    if (res.status !== 403 && res.status !== 404) {
      upstream = res;
      break;
    }
  }

  if (!upstream || !upstream.ok) {
    let message = lastErr.slice(0, 280) || "Chat upstream error";
    try {
      const parsed = JSON.parse(lastErr);
      message = parsed.detail || parsed.title || parsed.error || message;
    } catch {
      /* keep */
    }
    const status = upstream?.status || 403;
    if (status === 403) {
      message =
        "Chat authorization failed for this key on all tried models. " +
        "On build.nvidia.com open any chat model → Get API Key (enable Public API Endpoints), " +
        "then Clear the chat session and paste that new key.";
    }
    return jsonResponse(req, status, { error: message });
  }

  const headers = new Headers(corsHeaders(req));
  headers.set("Content-Type", upstream.headers.get("Content-Type") || "text/event-stream; charset=utf-8");
  headers.set("Cache-Control", "no-store");

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
};

export const config = {
  path: "/api/ask",
};
