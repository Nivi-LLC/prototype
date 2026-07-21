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

export default async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ") || auth.length < 20) {
    return new Response(JSON.stringify({ error: "Missing session key" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  let payload: {
    messages?: unknown;
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
  };
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
    return new Response(JSON.stringify({ error: "messages required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders(req) },
    });
  }

  const upstream = await fetch(NVIDIA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: auth,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: payload.messages,
      temperature: typeof payload.temperature === "number" ? payload.temperature : 0.2,
      top_p: typeof payload.top_p === "number" ? payload.top_p : 0.9,
      max_tokens: typeof payload.max_tokens === "number" ? payload.max_tokens : 2048,
      stream: true,
    }),
  });

  const headers = new Headers(corsHeaders(req));
  headers.set("Content-Type", upstream.headers.get("Content-Type") || "text/event-stream");
  headers.set("Cache-Control", "no-store");

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
};

export const config = {
  path: "/api/ask",
};
