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

function buildMultipart(fields: Record<string, string>): { body: Uint8Array; contentType: string } {
  const boundary = `----niviSpeak${Date.now().toString(16)}`;
  const chunks: string[] = [];
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(`--${boundary}\r\n`);
    chunks.push(`Content-Disposition: form-data; name="${name}"\r\n\r\n`);
    chunks.push(`${value}\r\n`);
  }
  chunks.push(`--${boundary}--\r\n`);
  const body = new TextEncoder().encode(chunks.join(""));
  return {
    body,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

export default async (req: Request) => {
  try {
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

    const clipped = text.replace(/\s+/g, " ").slice(0, 1200);
    const multipart = buildMultipart({
      text: clipped,
      language: LANGUAGE,
      voice: VOICE,
      encoding: "LINEAR_PCM",
      sample_rate_hz: "44100",
    });

    const upstream = await fetch(RIVA_URL, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": multipart.contentType,
        Accept: "audio/*, application/octet-stream",
      },
      body: multipart.body,
    });

    const audioBytes = await upstream.arrayBuffer();

    if (!upstream.ok) {
      const errText = new TextDecoder().decode(audioBytes).slice(0, 240);
      return jsonResponse(req, upstream.status, {
        error: errText || upstream.statusText || "TTS upstream error",
      });
    }

    if (!audioBytes.byteLength) {
      return jsonResponse(req, 502, { error: "Empty audio response from TTS" });
    }

    const headers = new Headers(corsHeaders(req));
    headers.set("Content-Type", upstream.headers.get("Content-Type") || "audio/wav");
    headers.set("Cache-Control", "no-store");
    headers.set("Access-Control-Expose-Headers", "Content-Type");

    return new Response(audioBytes, {
      status: 200,
      headers,
    });
  } catch (err) {
    return jsonResponse(req, 500, {
      error: err instanceof Error ? err.message : "Speak proxy failed",
    });
  }
};

export const config = {
  path: "/api/speak",
};
