export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB) {
      return json({ error: "Missing D1 binding. Add a DB binding to your Pages project." }, 500);
    }

    if (!env.ADMIN_SETUP_CODE) {
      return json({ error: "Missing ADMIN_SETUP_CODE secret in Cloudflare." }, 500);
    }

    const { username, password, setupCode } = await request.json();

    if (!username || !password || !setupCode) {
      return json({ error: "username, password, and setupCode are required." }, 400);
    }

    if (setupCode !== env.ADMIN_SETUP_CODE) {
      return json({ error: "Invalid admin setup code." }, 401);
    }

    const existingAdmin = await env.DB
      .prepare("SELECT id FROM users WHERE role = ? LIMIT 1")
      .bind("admin")
      .first();

    if (existingAdmin) {
      return json({ error: "An admin account already exists. Use admin login instead." }, 409);
    }

    const cleanUsername = String(username).trim().toLowerCase();

    if (cleanUsername.length < 3) {
      return json({ error: "Admin username must be at least 3 characters." }, 400);
    }

    if (String(password).length < 8) {
      return json({ error: "Admin password must be at least 8 characters." }, 400);
    }

    const passwordHash = await hashPassword(password);

    await env.DB
      .prepare(
        `INSERT INTO users (username, password_hash, role, email, videos_per_day, max_video_seconds)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(cleanUsername, passwordHash, "admin", null, 10, 15)
      .run();

    return json({
      ok: true,
      message: "Admin account created.",
      user: {
        username: cleanUsername,
        role: "admin"
      }
    });
  } catch (error) {
    return json({ error: error.message || "Admin setup failed." }, 500);
  }
}

async function hashPassword(password) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = toBase64(saltBytes);
  const iterations = 100000;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: saltBytes,
      iterations
    },
    key,
    256
  );

  return `pbkdf2_sha256$${iterations}$${salt}$${toBase64(new Uint8Array(bits))}`;
}

function toBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
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
