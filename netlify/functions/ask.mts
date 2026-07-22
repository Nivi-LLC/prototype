import {
  buildSystemPrompt,
  gateQuestion,
  sanitizeHistory,
  sseText,
} from "./_shared/guardrails.mts";

const CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const MODEL =
  (typeof process !== "undefined" && process.env?.CHAT_MODEL) || "meta/llama-3.1-8b-instruct";

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

function publicError(status: number): string {
  if (status === 401 || status === 403) {
    return "Session key was rejected. Clear the session, paste a valid key, and Start 10 min again.";
  }
  if (status === 429) {
    return "Too many requests right now. Wait a moment and try again.";
  }
  if (status >= 500) {
    return "The assistant is temporarily unavailable. Try again in a moment.";
  }
  return "Could not get an answer. Check your session key and try again.";
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

  // Matches hosted Llama 3.1 8B settings; stream kept on for the live chat UI.
  const upstream = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      Authorization: auth,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.2,
      top_p: 0.7,
      max_tokens: 1024,
      stream: true,
    }),
  });

  if (!upstream.ok) {
    return jsonResponse(req, upstream.status, { error: publicError(upstream.status) });
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
