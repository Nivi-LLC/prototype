const RIVA_URL =
  "https://877104f7-e885-42b9-8de8-f6e4c6303969.invocation.api.nvcf.nvidia.com/v1/audio/synthesize";
const VOICE = "Magpie-Multilingual.EN-US.Aria";
const LANGUAGE = "en-US";

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

export default async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, 405, { error: "Method not allowed" });
  }

  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ") || auth.length < 20) {
    return jsonResponse(req, 401, { error: "Missing voice session key" });
  }

  let text = "";
  try {
    const payload = await req.json();
    text = String(payload?.text || "").trim();
  } catch {
    return jsonResponse(req, 400, { error: "Invalid JSON body" });
  }

  if (!text) {
    return jsonResponse(req, 400, { error: "text required" });
  }

  // Keep TTS payloads short for demo latency
  const clipped = text.replace(/\s+/g, " ").slice(0, 1600);

  const form = new FormData();
  form.append("text", clipped);
  form.append("language", LANGUAGE);
  form.append("voice", VOICE);
  form.append("encoding", "LINEAR_PCM");
  form.append("sample_rate_hz", "44100");

  const upstream = await fetch(RIVA_URL, {
    method: "POST",
    headers: {
      Authorization: auth,
    },
    body: form,
  });

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => "");
    return jsonResponse(req, upstream.status, {
      error: errText.slice(0, 240) || upstream.statusText,
    });
  }

  const headers = new Headers(corsHeaders(req));
  headers.set("Content-Type", upstream.headers.get("Content-Type") || "audio/wav");
  headers.set("Cache-Control", "no-store");

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
};

export const config = {
  path: "/api/speak",
};
