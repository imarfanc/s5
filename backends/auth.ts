/**
 * Simple site-wide password auth.
 *
 * One shared password lives in the `T1_PASSWORD` environment variable. A
 * successful login sets a signed, expiring cookie; every other request is
 * gated on that cookie. No user records, no database.
 */

const COOKIE_NAME = "s5_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const encoder = new TextEncoder();

/** The configured password, or null when the env var is unset. */
function configuredPassword(): string | null {
  return Deno.env.get("T1_PASSWORD") || null;
}

function cookieValue(request: Request, name: string): string | null {
  const cookies = request.headers.get("cookie") || "";
  const match = cookies.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match?.[1] || null;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

/** Length-independent comparison so a wrong guess leaks no timing signal. */
function equalText(left: string, right: string): boolean {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  let different = leftBytes.length ^ rightBytes.length;
  const longest = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < longest; index += 1) {
    different |= (leftBytes[index] || 0) ^ (rightBytes[index] || 0);
  }
  return different === 0;
}

/** HMAC of the expiry, keyed by the password, so cookies cannot be forged. */
async function signature(expiresAt: number, password: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(String(expiresAt))),
  );
  return toBase64Url(bytes);
}

function loginPage(error?: string): Response {
  const message = error ? `<p class="error" role="alert">${error}</p>` : "";
  return new Response(
    `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>s5 login</title>
<link rel="icon" href="https://cdn.midjourney.com/bdd9a963-94a2-404e-8d9d-86e6712e79d4/0_0.png">
<style>
:root{color-scheme:dark;font-family:ui-sans-serif,system-ui,sans-serif;background:#0c1513;color:#eef7f4}
body{min-height:100vh;margin:0;display:grid;place-items:center;background:radial-gradient(circle at top,#173a32,#0c1513 56%)}
main{width:min(25rem,calc(100% - 2rem));padding:2.4rem;border:1px solid #42645c;border-radius:1.25rem;background:#13211e;box-shadow:0 1.5rem 5rem #0008}
h1{margin:0 0 .45rem;font-size:2rem}p{color:#b9cfca}
label{display:block;margin-bottom:.5rem;font-weight:700}
input,button{box-sizing:border-box;width:100%;border-radius:.7rem;font:inherit}
input{padding:.85rem;border:1px solid #66867e;background:#09110f;color:inherit}
button{margin-top:1rem;padding:.85rem;border:0;background:#56c2aa;color:#07110e;font-weight:800;cursor:pointer}
.hint{margin:1.5rem 0;color:#77d6c0;font-family:ui-monospace,monospace}
.error{color:#ff9b92}
</style></head><body><main><h1>Welcome back</h1><p>Enter the site password to continue.</p>${message}<form method="post" action="/auth/login"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required autofocus><p class="hint">Hint: ZY_j_3cT</p><button type="submit">Log in</button></form></main></body></html>`,
    {
      status: error ? 401 : 200,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    },
  );
}

function unavailable(): Response {
  return new Response("T1_PASSWORD is not configured.\n", {
    status: 503,
    headers: { "cache-control": "no-store" },
  });
}

function sessionCookie(value: string, request: Request): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${value}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; SameSite=Lax${secure}`;
}

/** Claim `/login`, `/auth/login`, and `/auth/logout`; return null otherwise. */
export async function handleAuth(request: Request): Promise<Response | null> {
  const { pathname } = new URL(request.url);

  if (pathname === "/login" && request.method === "GET") {
    return configuredPassword() ? loginPage() : unavailable();
  }
  if (pathname === "/auth/logout" && request.method === "POST") {
    return new Response(null, {
      status: 303,
      headers: {
        location: "/login",
        "set-cookie": `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
      },
    });
  }
  if (pathname !== "/auth/login" || request.method !== "POST") return null;

  const password = configuredPassword();
  if (!password) return unavailable();

  const form = await request.formData();
  const attempt = typeof form.get("password") === "string" ? String(form.get("password")) : "";
  if (!equalText(attempt, password)) return loginPage("Incorrect password.");

  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const token = `${expiresAt}.${await signature(expiresAt, password)}`;
  return new Response(null, {
    status: 303,
    headers: {
      location: "/",
      "set-cookie": sessionCookie(token, request),
      "cache-control": "no-store",
    },
  });
}

/** True when the request carries a cookie we signed and that has not expired. */
export async function isAuthenticated(request: Request): Promise<boolean> {
  const password = configuredPassword();
  if (!password) return false;

  const token = cookieValue(request, COOKIE_NAME);
  if (!token) return false;

  const [expires, signed, extra] = token.split(".");
  const expiresAt = Number(expires);
  if (
    extra || !Number.isSafeInteger(expiresAt) ||
    expiresAt <= Math.floor(Date.now() / 1000) || !signed
  ) return false;

  return equalText(signed, await signature(expiresAt, password));
}

/** JSON 401 for API calls, redirect to the login page for everything else. */
export function authenticationRequired(request: Request): Response {
  const { pathname } = new URL(request.url);
  if (pathname.startsWith("/api/")) {
    return Response.json({ error: "Authentication required" }, {
      status: 401,
      headers: { "cache-control": "no-store" },
    });
  }
  return new Response(null, {
    status: 302,
    headers: { location: "/login", "cache-control": "no-store" },
  });
}

export function authenticationUnavailable(): Response {
  return unavailable();
}
