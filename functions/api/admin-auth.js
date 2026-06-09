export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const { setupCode } = await request.json();

    if (!env.ADMIN_SETUP_CODE) {
      return json({ error: "ADMIN_SETUP_CODE is not configured in Cloudflare." }, 500);
    }

    if (!setupCode) {
      return json({ error: "Setup code is required." }, 400);
    }

    if (setupCode !== env.ADMIN_SETUP_CODE) {
      return json({ error: "Invalid admin setup code." }, 401);
    }

    return json({ ok: true });
  } catch (error) {
    return json({ error: error.message || "Admin authentication failed." }, 500);
  }
}

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: corsHeaders()
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}
