/**
 * Chatterbox Multilingual TTS via NVCF gRPC.
 * Docs path: grpc.nvcf.nvidia.com:443 + function-id metadata (HTTP invoke returns 404).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

const FUNCTION_ID = "ddacc747-1269-4fab-bfd9-8f593dead106";
const GRPC_HOST = "grpc.nvcf.nvidia.com:443";
const VOICE = "Chatterbox-Multilingual.en-US.Male";
const LANGUAGE = "en-US";
const SAMPLE_RATE_HZ = 22050;

/** Flattened Riva TTS protos (no filesystem include path issues on Netlify). */
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

message RivaSynthesisConfigRequest {
  string model_name = 1;
}

message RivaSynthesisConfigResponse {
  message Config {
    string model_name = 1;
    map<string, string> parameters = 2;
  }
  repeated Config model_config = 1;
}

service RivaSpeechSynthesis {
  rpc Synthesize(SynthesizeSpeechRequest) returns (SynthesizeSpeechResponse) {}
  rpc GetRivaSynthesisConfig(RivaSynthesisConfigRequest) returns (RivaSynthesisConfigResponse) {}
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
      { deadline: Date.now() + 25000 },
      (err: Error | null, res: any) => {
        if (err) {
          reject(err);
          return;
        }
        const audio = res?.audio;
        if (!audio || !audio.length) {
          reject(new Error("Empty audio from Chatterbox gRPC"));
          return;
        }
        resolve(Buffer.isBuffer(audio) ? audio : Buffer.from(audio));
      }
    );
  });
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

    const clipped = text.replace(/\s+/g, " ").slice(0, 900);
    const pcm = await synthesizeGrpc(auth, clipped);
    const wav = pcmToWav(pcm, SAMPLE_RATE_HZ);

    const headers = new Headers(corsHeaders(req));
    headers.set("Content-Type", "audio/wav");
    headers.set("Cache-Control", "no-store");
    headers.set("Access-Control-Expose-Headers", "Content-Type");

    return new Response(wav, { status: 200, headers });
  } catch (err: any) {
    const detail =
      (err && (err.details || err.message)) ||
      (err instanceof Error ? err.message : "Speak proxy failed");
    const code = typeof err?.code === "number" ? err.code : null;
    const status =
      code === grpc.status.UNAUTHENTICATED || code === grpc.status.PERMISSION_DENIED
        ? 401
        : code === grpc.status.NOT_FOUND
          ? 404
          : code === grpc.status.INVALID_ARGUMENT
            ? 400
            : 502;
    return jsonResponse(req, status, { error: String(detail).slice(0, 320) });
  }
};

export const config = {
  path: "/api/speak",
};
