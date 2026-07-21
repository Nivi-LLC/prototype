import {
  REFUSAL,
  buildSystemPrompt,
  gateAnswer,
  gateQuestion,
  sanitizeHistory,
  sseText,
} from "./_shared/guardrails.mts";

const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const MODEL = "z-ai/glm-5.2";

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

async function readUpstreamText(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n");
    buffer = parts.pop() || "";
    for (const line of parts) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload);
        const delta = json?.choices?.[0]?.delta?.content;
        if (typeof delta === "string") full += delta;
        const message = json?.choices?.[0]?.message?.content;
        if (typeof message === "string") full += message;
      } catch {
        /* ignore partial */
      }
    }
  }
  return full;
}

export default async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, 405, { error: "Method not allowed" });
  }

  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ") || auth.length < 20) {
    return jsonResponse(req, 401, { error: "Missing session key" });
  }

  let payload: {
    question?: unknown;
    history?: unknown;
    // legacy clients may still send messages — ignore system from client
    messages?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(req, 400, { error: "Invalid JSON body" });
  }

  let question = typeof payload.question === "string" ? payload.question.trim() : "";
  let history = sanitizeHistory(payload.history);

  // Backward compatible: extract last user message if question omitted
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
    // Drop the trailing user turn from history — it is the current question
    if (history.length && history[history.length - 1].role === "user") {
      history = history.slice(0, -1);
    }
  }

  if (!question) {
    return jsonResponse(req, 400, { error: "question required" });
  }

  const gated = gateQuestion(question, history.length > 0);
  if (!gated.ok) {
    return sseResponse(req, REFUSAL);
  }

  // Server owns system prompt + passport context. Client cannot override.
  const messages = [
    { role: "system", content: buildSystemPrompt() },
    ...history,
    { role: "user", content: question },
  ];

  const upstream = await fetch(NVIDIA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: auth,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.2,
      top_p: 0.9,
      max_tokens: 2048,
      stream: true,
    }),
  });

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => "");
    return jsonResponse(req, upstream.status, {
      error: errText.slice(0, 240) || upstream.statusText,
    });
  }

  const raw = await readUpstreamText(upstream);
  const safe = gateAnswer(raw || REFUSAL);
  return sseResponse(req, safe);
};

export const config = {
  path: "/api/ask",
};
