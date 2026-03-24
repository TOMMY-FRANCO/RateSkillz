import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
 
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
 
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB for images
const MAX_GIF_SIZE = 300 * 1024;        // 300KB for GIFs
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/gif"];
 
function detectMimeFromBytes(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif"; // GIF87a / GIF89a
  return null;
}
 
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
 
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ valid: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
 
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
 
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ valid: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
 
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
 
    if (!file) {
      return new Response(JSON.stringify({ valid: false, error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
 
    // Size check — GIFs have a stricter limit
    const isGif = declaredType === "image/gif";
    const sizeLimit = isGif ? MAX_GIF_SIZE : MAX_FILE_SIZE;
    const sizeLimitLabel = isGif ? "300KB" : "2MB";

    if (file.size > sizeLimit) {
      return new Response(JSON.stringify({ valid: false, error: `File size must be under ${sizeLimitLabel}. Please compress your ${isGif ? "GIF" : "image"} and try again.` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Declared MIME type check
    if (!ALLOWED_MIME_TYPES.includes(declaredType)) {
      return new Response(
        JSON.stringify({ valid: false, error: "Only JPEG, PNG, and GIF images are allowed." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Magic bytes — read 6 bytes to cover GIF header (GIF89a is 6 bytes)
    const arrayBuffer = await file.slice(0, 6).arrayBuffer();
    const magicBytes = new Uint8Array(arrayBuffer);
    const detectedType = detectMimeFromBytes(magicBytes);

    if (!detectedType) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid image file. Only JPEG, PNG, and GIF images are allowed." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (detectedType !== declaredType) {
      return new Response(
        JSON.stringify({ valid: false, error: "File content does not match its declared type. Upload rejected." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
 
    return new Response(
      JSON.stringify({ valid: true, detectedType }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ valid: false, error: err.message || "Validation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});