import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function b64url(data: string): string {
  return btoa(data)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlObject(obj: unknown): string {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return b64url(binary);
}

async function getGoogleAccessToken(serviceAccountRaw: string): Promise<{ token: string; projectId: string }> {
  console.log("[FCM][SA] Raw secret length:", serviceAccountRaw.length);
  console.log("[FCM][SA] First 50 chars:", serviceAccountRaw.substring(0, 50));

  let sa: Record<string, string>;
  try {
    sa = JSON.parse(serviceAccountRaw);
    console.log("[FCM][SA] JSON.parse succeeded");
  } catch (parseErr) {
    console.error("[FCM][SA] JSON.parse FAILED:", String(parseErr));
    console.error("[FCM][SA] Attempting double-parse (string-wrapped JSON)...");
    try {
      const unwrapped = JSON.parse(JSON.parse(serviceAccountRaw));
      sa = unwrapped;
      console.log("[FCM][SA] Double-parse succeeded");
    } catch (doubleErr) {
      console.error("[FCM][SA] Double-parse also FAILED:", String(doubleErr));
      throw new Error(`Cannot parse FIREBASE_SERVICE_ACCOUNT as JSON: ${String(parseErr)}`);
    }
  }

  console.log("[FCM][SA] Keys present:", Object.keys(sa).join(", "));
  console.log("[FCM][SA] project_id:", sa.project_id ?? "(MISSING)");
  console.log("[FCM][SA] client_email:", sa.client_email ?? "(MISSING)");
  console.log("[FCM][SA] private_key present:", !!sa.private_key);
  console.log("[FCM][SA] private_key length:", sa.private_key?.length ?? 0);

  if (!sa.project_id) throw new Error("FIREBASE_SERVICE_ACCOUNT missing project_id field");
  if (!sa.client_email) throw new Error("FIREBASE_SERVICE_ACCOUNT missing client_email field");
  if (!sa.private_key) throw new Error("FIREBASE_SERVICE_ACCOUNT missing private_key field");

  const projectId = sa.project_id;
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    sub: sa.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  };

  console.log("[FCM][JWT] Building JWT for iss:", sa.client_email);
  const signingInput = `${b64urlObject(header)}.${b64urlObject(payload)}`;

  const pemKey = sa.private_key;
  const pemContents = pemKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  console.log("[FCM][JWT] PEM contents length after strip:", pemContents.length);

  let binaryKey: Uint8Array;
  try {
    binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
    console.log("[FCM][JWT] atob decode succeeded, byte length:", binaryKey.length);
  } catch (atobErr) {
    throw new Error(`Failed to base64-decode private key: ${String(atobErr)}`);
  }

  let cryptoKey: CryptoKey;
  try {
    cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      binaryKey.buffer,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );
    console.log("[FCM][JWT] CryptoKey import succeeded");
  } catch (keyErr) {
    throw new Error(`Failed to import private key via SubtleCrypto: ${String(keyErr)}`);
  }

  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  let sigBinary = "";
  for (const byte of new Uint8Array(signatureBuffer)) {
    sigBinary += String.fromCharCode(byte);
  }
  const signature = b64url(sigBinary);
  const jwt = `${signingInput}.${signature}`;

  console.log("[FCM][OAuth] Requesting Google OAuth token...");
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const tokenBody = await tokenRes.text();
  console.log("[FCM][OAuth] Response status:", tokenRes.status);
  console.log("[FCM][OAuth] Response body:", tokenBody);

  if (!tokenRes.ok) {
    throw new Error(`Google OAuth token request failed (${tokenRes.status}): ${tokenBody}`);
  }

  let tokenData: Record<string, string>;
  try {
    tokenData = JSON.parse(tokenBody);
  } catch {
    throw new Error(`Google OAuth response is not valid JSON: ${tokenBody}`);
  }

  if (!tokenData.access_token) {
    throw new Error(`Google OAuth response missing access_token. Full response: ${tokenBody}`);
  }

  console.log("[FCM][OAuth] Access token obtained, token_type:", tokenData.token_type);
  return { token: tokenData.access_token, projectId };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    console.log("[FCM] send-push-notification invoked, method:", req.method);

    let body: { user_id?: string; badge_count?: unknown; title?: string; notification_body?: string };
    try {
      body = await req.json();
    } catch (parseErr) {
      console.error("[FCM] Failed to parse request body:", String(parseErr));
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { user_id, badge_count, title, notification_body } = body;
    console.log("[FCM] user_id:", user_id, "| badge_count:", badge_count, "| title:", title, "| body:", notification_body);

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const firebaseServiceAccount = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");

    console.log("[FCM] SUPABASE_URL present:", !!supabaseUrl);
    console.log("[FCM] SUPABASE_SERVICE_ROLE_KEY present:", !!serviceRoleKey);
    console.log("[FCM] FIREBASE_SERVICE_ACCOUNT present:", !!firebaseServiceAccount);

    if (!firebaseServiceAccount) {
      console.error("[FCM] FIREBASE_SERVICE_ACCOUNT secret is not set");
      return new Response(
        JSON.stringify({ error: "FIREBASE_SERVICE_ACCOUNT secret not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const client = createClient(supabaseUrl!, serviceRoleKey!);

    console.log("[FCM] Fetching FCM token for user:", user_id);
    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("fcm_token")
      .eq("id", user_id)
      .maybeSingle();

    if (profileError) {
      console.error("[FCM] Profile fetch error:", JSON.stringify(profileError));
      throw profileError;
    }

    const fcmToken: string | null = profile?.fcm_token ?? null;
    console.log("[FCM] FCM token from DB:", fcmToken ? `${fcmToken.substring(0, 20)}...` : "(null/empty)");

    if (!fcmToken) {
      console.log("[FCM] No FCM token for user", user_id, "— skipping push");
      return new Response(
        JSON.stringify({ success: true, message: "No FCM token for user, skipping" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const count = typeof badge_count === "number"
      ? badge_count
      : parseInt(String(badge_count ?? "0"), 10);

    console.log("[FCM] Resolved badge_count:", count);

    const { token: accessToken, projectId } = await getGoogleAccessToken(firebaseServiceAccount);
    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
    console.log("[FCM] FCM endpoint:", fcmEndpoint);

    const notifTitle = (title && String(title).trim()) || "RatingSkill";
    const notifBody = (notification_body && String(notification_body).trim()) || "You have new activity";

    console.log("[FCM] Notification title:", notifTitle, "| body:", notifBody);

    const fcmPayload = {
      message: {
        token: fcmToken,
        data: {
          badge_count: String(count),
          title: notifTitle,
          body: notifBody,
        },
        android: {
          priority: "high",
        },
        webpush: {
          headers: {
            Urgency: "high",
            TTL: "86400",
          },
        },
        apns: {
          headers: {
            "apns-priority": "10",
          },
          payload: {
            aps: {
              "content-available": 1,
              badge: count,
              sound: "default",
            },
          },
        },
      },
    };

    console.log("[FCM] Sending FCM message...");
    const fcmRes = await fetch(fcmEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(fcmPayload),
    });

    const fcmBody = await fcmRes.text();
    console.log("[FCM] FCM response status:", fcmRes.status);
    console.log("[FCM] FCM response body:", fcmBody);

    if (!fcmRes.ok) {
      console.error("[FCM] Send FAILED — status:", fcmRes.status, "| body:", fcmBody);
      return new Response(
        JSON.stringify({ error: "FCM send failed", status: fcmRes.status, detail: fcmBody }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[FCM] Send SUCCESS");
    return new Response(
      JSON.stringify({ success: true, fcm_response: JSON.parse(fcmBody) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[FCM] Unhandled exception:", String(err));
    if (err instanceof Error && err.stack) {
      console.error("[FCM] Stack:", err.stack);
    }
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
