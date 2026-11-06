// GET /api/print-file/NAME?token=...  — hands a high-resolution print file to Prodigi.
// The files live in a private R2 bucket (bound as PRINT_FILES), so visitors cannot download them;
// only a request carrying the secret PRINT_FILE_TOKEN gets the file.
export async function onRequestGet({ params, request, env }) {
  const token = new URL(request.url).searchParams.get("token") || "";
  if (!env.PRINT_FILE_TOKEN || token !== env.PRINT_FILE_TOKEN) return new Response("Not found", { status: 404 });
  if (!env.PRINT_FILES) return new Response("Print file storage is not set up", { status: 503 });

  const obj = await env.PRINT_FILES.get(params.name);
  if (!obj) return new Response("Not found", { status: 404 });
  return new Response(obj.body, {
    headers: {
      "Content-Type": obj.httpMetadata?.contentType || "image/jpeg",
      "Cache-Control": "private, no-store",
    },
  });
}
