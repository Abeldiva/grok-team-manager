export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.XAI_API_KEY) {
      return json({ error: "Missing XAI_API_KEY secret in Cloudflare." }, 500);
    }

    const input = await request.json();
    const prompt = String(input.prompt || "").trim();

    if (!prompt) {
      return json({ error: "Prompt is required." }, 400);
    }

    const duration = clamp(Number(input.duration || 10), 1, 15);
    const payload = {
      model: "grok-imagine-video",
      prompt,
      duration,
      aspect_ratio: input.aspect_ratio || "16:9",
      resolution: input.resolution || "480p"
    };

    if (input.image?.dataUrl) {
      payload.image = input.image.dataUrl;
    } else if (input.image_url) {
      payload.image = input.image_url;
    }

    const createResponse = await fetch("https://api.x.ai/v1/videos/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.XAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!createResponse.ok) {
      return json({ error: await createResponse.text() }, createResponse.status);
    }

    const created = await createResponse.json();
    const requestId = created.request_id || created.id;

    if (!requestId) {
      return json(created);
    }

    for (let attempt = 0; attempt < 90; attempt += 1) {
      await sleep(5000);
      const pollResponse = await fetch(`https://api.x.ai/v1/videos/${requestId}`, {
        headers: {
          "Authorization": `Bearer ${env.XAI_API_KEY}`
        }
      });

      if (!pollResponse.ok) {
        return json({ error: await pollResponse.text(), request_id: requestId }, pollResponse.status);
      }

      const result = await pollResponse.json();
      const status = result.status || result.state;

      if (status === "done" || status === "succeeded" || result.video || result.url) {
        return json({ ...result, request_id: requestId });
      }

      if (status === "failed" || status === "expired" || status === "cancelled") {
        return json({ error: `Video request ${status}.`, request_id: requestId, result }, 502);
      }
    }

    return json({ error: "Video generation timed out.", request_id: requestId }, 504);
  } catch (error) {
    return json({ error: error.message || "Video generation failed." }, 500);
  }
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return max;
  return Math.max(min, Math.min(max, value));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
