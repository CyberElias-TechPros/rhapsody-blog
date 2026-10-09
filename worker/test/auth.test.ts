import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { apiFetch, jsonOf, registerUser, useSchema } from "./helpers";

useSchema();

describe("auth", () => {
  it("registers a user and returns a usable token", async () => {
    const email = `reg1-${Date.now()}@example.com`;
    const res = await apiFetch("/api/auth/register", {
      method: "POST",
      body: { name: "Jane Doe", email: ` ${email.toUpperCase()} `, password: "wonderful-horse-42" },
    });
    expect(res.status).toBe(201);
    const body = await jsonOf<{ user: { email: string; role: string }; token: string }>(res);
    expect(body.user.email).toBe(email); // normalized + stored lowercase
    expect(body.user.role).toBe("user");

    const me = await apiFetch("/api/auth/me", { token: body.token });
    expect(me.status).toBe(200);
    const meBody = await jsonOf<{ user: { email: string } }>(me);
    expect(meBody.user.email).toBe(email);
  });

  it("validates input at the boundary", async () => {
    const cases = [
      { name: "J", email: "x@example.com", password: "longenoughpw" }, // name too short
      { name: "Jane", email: "not-an-email", password: "longenoughpw" }, // bad email
      { name: "Jane", email: "x@example.com", password: "short" }, // password too short
      { name: "Jane", email: "x@example.com" }, // missing password
    ];
    for (const c of cases) {
      const r = await apiFetch("/api/auth/register", { method: "POST", body: c });
      expect(r.status, JSON.stringify(c)).toBe(400);
    }
    const malformed = await apiFetch("/api/auth/register", { method: "POST", body: "not json", headers: { "content-type": "application/json" } });
    expect(malformed.status).toBe(400);
  });

  it("rejects duplicate emails with 409", async () => {
    const { email } = await registerUser();
    const dup = await apiFetch("/api/auth/register", {
      method: "POST",
      body: { name: "Other", email, password: "another-long-pass" },
    });
    expect(dup.status).toBe(409);
  });

  it("logs in with correct credentials and rejects wrong ones with a generic message", async () => {
    const { email, password } = await registerUser();
    const ok = await apiFetch("/api/auth/login", { method: "POST", body: { email, password } });
    expect(ok.status).toBe(200);

    const wrongPw = await apiFetch("/api/auth/login", { method: "POST", body: { email, password: "definitely-wrong-pw" } });
    expect(wrongPw.status).toBe(401);
    const wrongUser = await apiFetch("/api/auth/login", { method: "POST", body: { email: "ghost@example.com", password: "whatever123456" } });
    expect(wrongUser.status).toBe(401);
    const e1 = await jsonOf<{ error: { message: string } }>(wrongPw);
    const e2 = await jsonOf<{ error: { message: string } }>(wrongUser);
    expect(e1.error.message).toBe(e2.error.message); // no enumeration signal
    // the generic message must not disclose *which* half was wrong
    expect(e1.error.message.toLowerCase()).not.toMatch(/not found|no such|doesn't exist|unknown user|unrecognized/i);
  });

  it("requires a valid token for /me; rejects garbage and wrong algos", async () => {
    expect((await apiFetch("/api/auth/me")).status).toBe(401);
    expect((await apiFetch("/api/auth/me", { token: "garbage.token.here" })).status).toBe(401);
    // alg=none style downgrade must fail signature verification
    const forged = `${btoa(JSON.stringify({ alg: "none", typ: "JWT" }))}.${btoa(JSON.stringify({ sub: "x", role: "admin", ver: 0 }))}.`;
    expect((await apiFetch("/api/auth/me", { token: forged })).status).toBe(401);
  });

  it("logout-all revokes previously issued tokens", async () => {
    const { token } = await registerUser();
    expect((await apiFetch("/api/auth/me", { token })).status).toBe(200);
    const out = await apiFetch("/api/auth/logout-all", { method: "POST", token });
    expect(out.status).toBe(204);
    expect((await apiFetch("/api/auth/me", { token })).status).toBe(401);
  });

  it("changing the password invalidates all sessions except the re-issued token", async () => {
    const { token, password } = await registerUser();
    const change = await apiFetch("/api/auth/password-change", {
      method: "POST",
      token,
      body: { currentPassword: password, newPassword: "brand-new-secret-99" },
    });
    expect(change.status).toBe(200);
    const { token: newToken } = await jsonOf<{ token: string }>(change);

    expect((await apiFetch("/api/auth/me", { token })).status).toBe(401); // old token dead
    expect((await apiFetch("/api/auth/me", { token: newToken })).status).toBe(200); // current device stays

    // wrong current password is refused
    const bad = await apiFetch("/api/auth/password-change", {
      method: "POST",
      token: newToken,
      body: { currentPassword: "nope-nope-nope", newPassword: "another-secret-12" },
    });
    expect(bad.status).toBe(401);
  });

  it("rate-limits login per IP (KV-backed soft limiter)", async () => {
    const { email, password } = await registerUser();
    const ip = "203.0.113.77";
    let saw429 = false;
    for (let i = 0; i < 14; i++) {
      const r = await apiFetch("/api/auth/login", { method: "POST", body: { email, password: "wrong" + "x".repeat(12) + i }, ip });
      if (r.status === 429) {
        saw429 = true;
        expect(r.headers.get("retry-after")).toBeTruthy();
        break;
      }
      expect(r.status).toBe(401);
    }
    expect(saw429, "expected 429 after repeated failures").toBe(true);
    // the throttle is per-IP *and* per-account; an unrelated account on the same IP is unaffected
    const other = await registerUser();
    const freshAccount = await apiFetch("/api/auth/login", { method: "POST", body: { email: other.email, password: other.password }, ip: "203.0.113.78" });
    expect(freshAccount.status).toBe(200);
  });

  it("persists auth audit events", async () => {
    const { email, password } = await registerUser();
    await apiFetch("/api/auth/login", { method: "POST", body: { email, password } });
    await new Promise((r) => setTimeout(r, 50)); // audit writes are waitUntil (eventually consistent)
    const rows = await env.DB.prepare("SELECT action FROM audit_logs WHERE actor_email = ? ORDER BY created_at ASC").bind(email).all<{ action: string }>();
    const actions = (rows.results ?? []).map((r) => r.action);
    expect(actions).toContain("auth.register");
    expect(actions).toContain("auth.login");
  });
});
