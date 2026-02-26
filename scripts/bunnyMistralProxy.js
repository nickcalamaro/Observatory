/**
 * Bunny.net Edge Script — Mistral AI Proxy
 *
 * Deploy this to Bunny.net Edge Scripting.
 * The Mistral API key lives ONLY here, never in the browser.
 *
 * Endpoint:
 *   POST /v1/chat/completions
 *     Body: { model, messages, temperature?, max_tokens?, stream? }
 *     → Proxied to Mistral API with the server-side key
 *     → Response streamed back to the client
 *
 * Setup:
 *   1. Create a new Edge Script in Bunny.net
 *   2. Paste this file's contents
 *   3. Set the MISTRAL_API_KEY secret in Bunny.net Edge Script settings
 *      (Edge Script → Settings → Environment Variables / Secrets)
 *   4. Deploy and note the script URL (e.g. https://observatory-ai-xxxxx.b-cdn.net)
 *   5. Update PROXY_URL in chart-ai.js to match
 */

/// <reference types="@bunny.net/edgescript-sdk" />

import * as BunnySDK from "@bunny.net/edgescript-sdk";

// ── Configuration ────────────────────────────────────────────
// The API key is read from Bunny Edge Script environment secrets.
// Set it via: Edge Script → Settings → Environment Variables
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";

// ── Helpers ──────────────────────────────────────────────────
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// ── Request handler ──────────────────────────────────────────
BunnySDK.net.http.serve(async (request) => {
  const url = new URL(request.url);

  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // GET / — health check (handy for testing in a browser)
  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "")) {
    return jsonResponse({
      status: "ok",
      service: "Observatory Mistral AI Proxy",
      keyConfigured: !!MISTRAL_API_KEY,
    });
  }

  // Only accept POST to /v1/chat/completions
  if (request.method !== "POST" || url.pathname !== "/v1/chat/completions") {
    return jsonResponse({ error: "Not found" }, 404);
  }

  // Validate API key is configured
  if (!MISTRAL_API_KEY) {
    return jsonResponse(
      { error: "Server misconfiguration: MISTRAL_API_KEY not set" },
      500
    );
  }

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.messages || !Array.isArray(body.messages)) {
      return jsonResponse({ error: "messages array is required" }, 400);
    }

    // Build the proxied request — only forward safe fields
    const proxyBody = {
      model: body.model || "mistral-large-latest",
      messages: body.messages,
      temperature: body.temperature ?? 0.4,
      max_tokens: body.max_tokens ?? 8192,
      stream: body.stream ?? true,
    };

    const mistralResponse = await fetch(MISTRAL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
      },
      body: JSON.stringify(proxyBody),
    });

    if (!mistralResponse.ok) {
      const errText = await mistralResponse.text();
      return jsonResponse(
        { error: `Mistral API error: ${mistralResponse.status}`, details: errText.substring(0, 500) },
        mistralResponse.status
      );
    }

    // Stream the response through to the client
    if (proxyBody.stream) {
      return new Response(mistralResponse.body, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Non-streaming: return JSON
    const result = await mistralResponse.json();
    return jsonResponse(result, 200);
  } catch (error) {
    console.error("Proxy error:", error);
    return jsonResponse(
      { error: "Proxy error", details: error instanceof Error ? error.message : String(error) },
      500
    );
  }
});
