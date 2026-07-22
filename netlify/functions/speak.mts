/**
 * NVIDIA Riva TTS via NVCF gRPC.
 *
 * Chatterbox (ddacc747-…) is not entitled on many NGC accounts (“Function … Not found for account”).
 * Default is Magpie Multilingual, which is the hosted TTS most build.nvidia.com keys can invoke.
 * Override with Netlify env: TTS_FUNCTION_ID, TTS_VOICE, TTS_LANGUAGE.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

const GRPC_HOST = "grpc.nvcf.nvidia.com:443";
const SAMPLE_RATE_HZ = 22050;
/**
 * Magpie max sequence is 400 chars; NVCF often needs ~10–20s per call.
 * Netlify sync functions cap at ~26s — speak one short opening only.
 */
const MAX_CHUNK_CHARS = 280;
const MAX_TOTAL_CHARS = 280;
const MAX_CHUNKS = 1;
const GRPC_DEADLINE_MS = 24000;

// Magpie Multilingual (hosted) — Chatterbox function-id often returns NotFound for the account
const DEFAULT_FUNCTION_ID = "877104f7-e885-42b9-8de8-f6e4c6303969";
const DEFAULT_VOICE = "Magpie-Multilingual.EN-US.Aria";
const DEFAULT_LANGUAGE = "en-US";

function env(name: string, fallback: string) {
  try {
    // Netlify Functions (Node): process.env; avoid Deno-only Netlify.env in this bundler path
    const v = typeof process !== "undefined" ? process.env?.[name] : undefined;
    return (v && String(v).trim()) || fallback;
  } catch {
    return fallback;
  }
}

const FUNCTION_ID = env("TTS_FUNCTION_ID", DEFAULT_FUNCTION_ID);
const VOICE = env("TTS_VOICE", DEFAULT_VOICE);
const LANGUAGE = env("TTS_LANGUAGE", DEFAULT_LANGUAGE);

const RIVA_TTS_PROTO = `
syntax = "proto3";
package nvidia.riva.tts;

enum AudioEncoding {
  ENCODING_UNSPECIFIED = 0;
  LINEAR_PCM = 1;
  FLAC = 2;
  MULAW = 3;
  OGGOPUS = 4;
  ALAW = 20;
}

message RequestId {
  string value = 1;
}

message ZeroShotData {
  bytes audio_prompt = 1;
  int32 sample_rate_hz = 2;
  AudioEncoding encoding = 3;
  int32 quality = 4;
  string transcript = 5;
}

message SynthesizeSpeechRequest {
  string text = 1;
  string language_code = 2;
  AudioEncoding encoding = 3;
  int32 sample_rate_hz = 4;
  string voice_name = 5;
  ZeroShotData zero_shot_data = 6;
  string custom_dictionary = 7;
  map<string, string> custom_configuration = 8;
  RequestId id = 100;
}

message SynthesizeSpeechResponseMetadata {
  string text = 1;
  string processed_text = 2;
  repeated float predicted_durations = 8;
}

message SynthesizeSpeechResponse {
  bytes audio = 1;
  SynthesizeSpeechResponseMetadata meta = 2;
  RequestId id = 100;
}

service RivaSpeechSynthesis {
  rpc Synthesize(SynthesizeSpeechRequest) returns (SynthesizeSpeechResponse) {}
}
`;

let ttsClient: any = null;

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

function getTtsClient() {
  if (ttsClient) return ttsClient;

  const dir = join(tmpdir(), "nivi-riva-proto");
  mkdirSync(dir, { recursive: true });
  const protoPath = join(dir, "riva_tts_flat.proto");
  writeFileSync(protoPath, RIVA_TTS_PROTO, "utf8");

  const packageDef = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const proto = grpc.loadPackageDefinition(packageDef) as any;
  const RivaSpeechSynthesis = proto.nvidia.riva.tts.RivaSpeechSynthesis;
  ttsClient = new RivaSpeechSynthesis(GRPC_HOST, grpc.credentials.createSsl(), {
    "grpc.max_receive_message_length": 16 * 1024 * 1024,
    "grpc.max_send_message_length": 4 * 1024 * 1024,
  });
  return ttsClient;
}

function pcmToWav(pcm: Buffer, sampleRate: number, channels = 1, bitDepth = 16): Buffer {
  const blockAlign = (channels * bitDepth) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm.length;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcm]);
}

/** Split for Magpie's 400-char limit; prefer sentence / clause boundaries. */
function chunkForTts(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim().slice(0, MAX_TOTAL_CHARS);
  if (!clean) return [];
  if (clean.length <= MAX_CHUNK_CHARS) return [clean];

  const parts = clean.split(/(?<=[.!?…])\s+|(?<=[;:])\s+|\n+/);
  const chunks: string[] = [];
  let buf = "";

  const pushBuf = () => {
    const t = buf.trim();
    if (t) chunks.push(t);
    buf = "";
  };

  const flushOverflow = (piece: string) => {
    let rest = piece.trim();
    while (rest.length > MAX_CHUNK_CHARS) {
      let cut = rest.lastIndexOf(" ", MAX_CHUNK_CHARS);
      if (cut < MAX_CHUNK_CHARS * 0.5) cut = MAX_CHUNK_CHARS;
      chunks.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    buf = rest;
  };

  for (const part of parts) {
    const next = part.trim();
    if (!next) continue;
    const candidate = buf ? `${buf} ${next}` : next;
    if (candidate.length <= MAX_CHUNK_CHARS) {
      buf = candidate;
      continue;
    }
    pushBuf();
    if (next.length <= MAX_CHUNK_CHARS) buf = next;
    else flushOverflow(next);
  }
  pushBuf();

  return chunks.slice(0, MAX_CHUNKS);
}

function synthesizeGrpc(authHeader: string, text: string): Promise<Buffer> {
  const client = getTtsClient();
  const metadata = new grpc.Metadata();
  metadata.add("function-id", FUNCTION_ID);
  metadata.add("authorization", authHeader);

  const request = {
    text,
    language_code: LANGUAGE,
    encoding: "LINEAR_PCM",
    sample_rate_hz: SAMPLE_RATE_HZ,
    voice_name: VOICE,
  };

  return new Promise((resolve, reject) => {
    client.Synthesize(
      request,
      metadata,
      { deadline: Date.now() + GRPC_DEADLINE_MS },
      (err: Error | null, res: any) => {
        if (err) {
          reject(err);
          return;
        }
        const audio = res?.audio;
        if (!audio || !audio.length) {
          reject(new Error("Empty audio from NVIDIA TTS"));
          return;
        }
        resolve(Buffer.isBuffer(audio) ? audio : Buffer.from(audio));
      }
    );
  });
}

async function synthesizeChunked(authHeader: string, text: string): Promise<Buffer> {
  const chunks = chunkForTts(text);
  if (!chunks.length) throw new Error("No speakable text");
  // One chunk only — stays inside Netlify’s ~26s function budget
  return synthesizeGrpc(authHeader, chunks[0]);
}

function friendlyError(err: any): string {
  const detail = String((err && (err.details || err.message)) || "Speak proxy failed");
  if (/Not found for account/i.test(detail) || err?.code === grpc.status.NOT_FOUND) {
    return (
      "This NVIDIA key cannot access the configured TTS model (function not found for your account). " +
      "Open the model page on build.nvidia.com, click Get API Key for that model, then paste the new key in Voice session. " +
      `Detail: ${detail.slice(0, 220)}`
    );
  }
  if (/Unauthenticated|Authentication failed/i.test(detail) || err?.code === grpc.status.UNAUTHENTICATED) {
    return "Voice key rejected. Paste a valid session key and click Start voice 10 min again.";
  }
  if (/Deadline exceeded/i.test(detail) || err?.code === grpc.status.DEADLINE_EXCEEDED) {
    return "Voice timed out (TTS is slow right now). Try Speak again — the first retry is usually faster.";
  }
  return detail.slice(0, 320);
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
    if (!text) return jsonResponse(req, 400, { error: "text required" });

    const pcm = await synthesizeChunked(auth, text);
    const wav = pcmToWav(pcm, SAMPLE_RATE_HZ);

    const headers = new Headers(corsHeaders(req));
    headers.set("Content-Type", "audio/wav");
    headers.set("Cache-Control", "no-store");
    headers.set("Access-Control-Expose-Headers", "Content-Type");

    return new Response(wav, { status: 200, headers });
  } catch (err: any) {
    const code = typeof err?.code === "number" ? err.code : null;
    const status =
      code === grpc.status.UNAUTHENTICATED || code === grpc.status.PERMISSION_DENIED
        ? 401
        : code === grpc.status.NOT_FOUND
          ? 404
          : code === grpc.status.INVALID_ARGUMENT
            ? 400
            : 502;
    return jsonResponse(req, status, { error: friendlyError(err) });
  }
};

export const config = {
  path: "/api/speak",
};
