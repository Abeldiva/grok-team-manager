export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const payload = await request.json();
    const { to, name, activationUrl, limits } = payload;

    if (!env.RESEND_API_KEY) {
      return json({ error: "Missing RESEND_API_KEY environment variable." }, 500);
    }

    if (!to || !activationUrl) {
      return json({ error: "Missing required fields: to and activationUrl." }, 400);
    }

    const from = env.EMAIL_FROM || "Grok Team <onboarding@resend.dev>";
    const displayName = escapeHtml(name || "there");
    const safeActivationUrl = escapeHtml(activationUrl);
    const videosPerDay = Number(limits?.videosPerDay || 10);
    const maxVideoSeconds = Number(limits?.maxVideoSeconds || 15);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to,
        subject: "Activate your Grok video team account",
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111318;max-width:560px">
            <h2 style="margin:0 0 12px">You have been invited to join a Grok video team</h2>
            <p>Hi ${displayName},</p>
            <p>Your account has been invited to create Grok videos.</p>
            <p>
              <a href="${safeActivationUrl}" style="background:#146ef5;color:#fff;padding:12px 16px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:700">
                Activate account
              </a>
            </p>
            <p>This activation link expires immediately after your first successful activation.</p>
            <p><strong>Your creator limits:</strong></p>
            <ul>
              <li>${videosPerDay} videos per day</li>
              <li>Up to ${maxVideoSeconds} seconds per video</li>
            </ul>
            <p>Your creator account cannot view billing information or other team members.</p>
          </div>
        `
      })
    });

    if (!emailResponse.ok) {
      return json({ error: await emailResponse.text() }, 502);
    }

    return json({ ok: true, sentTo: to });
  } catch (error) {
    return json({ error: error.message || "Email trigger failed." }, 500);
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
