/**
 * k6 smoke test: a minute of light, steady traffic against a production
 * build, to prove the main API routes answer correctly and fast before real
 * users do. Not a load test — one virtual user.
 *
 * Run it against `next build && next start` (dev mode compiles routes on
 * first hit, which says nothing about production latency):
 *
 *     bun run load:smoke                         # http://localhost:3355
 *     BASE_URL=https://staging.example.com bun run load:smoke
 *
 * It signs up one throwaway user and creates an org, then each iteration
 * signs in, reads the session and signs out.
 *
 * Better Auth allows 3 sign-in/sign-up requests per 10 seconds per IP in
 * production, so each iteration uses its own IP; the teardown then exceeds
 * the limit from one IP and expects a 429, proving the limiter is on.
 */
import { check, group, sleep } from "k6";
import http from "k6/http";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3355";

// Better Auth keys its limits on the client IP. Locally there's no proxy to
// set one, so send it the way nginx does in production. Each iteration is a
// different client: Better Auth only resets a bucket after a full quiet
// window, so one IP signing in steadily would trip the limiter by design.
function headersFor(ip) {
  return { "content-type": "application/json", origin: BASE_URL, "x-forwarded-for": ip };
}

function testNetIp(n) {
  return `198.51.100.${(n % 250) + 1}`;
}

export const options = {
  vus: 1,
  duration: __ENV.DURATION || "1m",
  thresholds: {
    checks: ["rate==1.0"],
    http_req_failed: ["rate==0"],
    "http_req_duration{kind:auth}": ["p(95)<500"],
  },
};

function post(path, body, ip, params = {}) {
  return http.post(`${BASE_URL}${path}`, JSON.stringify(body), { headers: headersFor(ip), ...params });
}

export function setup() {
  const email = `k6-smoke-${Date.now()}@example.com`;
  const password = `k6-${crypto.randomUUID()}`;
  const ip = "203.0.113.1";
  // Untagged: the first request also pays for the server's cold start.
  const signUp = post("/api/auth/sign-up/email", { name: "k6 smoke", email, password }, ip);
  check(signUp, { "sign-up 200": (r) => r.status === 200 });

  const org = post("/api/org", { name: `k6 smoke ${Date.now()}` }, ip);
  check(org, { "create org 201": (r) => r.status === 201 });
  // Clear the setup session so each iteration signs in for itself.
  http.cookieJar().clear(BASE_URL);
  return { email, password };
}

export default function iteration({ email, password }) {
  const ip = testNetIp(__ITER);
  group("auth", () => {
    const signIn = post("/api/auth/sign-in/email", { email, password }, ip, { tags: { kind: "auth" } });
    check(signIn, { "sign-in 200": (r) => r.status === 200 });

    const session = http.get(`${BASE_URL}/api/auth/get-session`, { headers: headersFor(ip), tags: { kind: "auth" } });
    check(session, { "session has the user": (r) => r.status === 200 && r.json("user.email") === email });
  });


  group("sign out", () => {
    const signOut = post("/api/auth/sign-out", {}, ip, { tags: { kind: "auth" } });
    check(signOut, { "sign-out 200": (r) => r.status === 200 });
  });

  sleep(1);
}

export function teardown({ email }) {
  // One client trying a wrong password: Better Auth allows 3 per 10s.
  const statuses = [];
  for (let i = 0; i < 5; i++) {
    const response = post(
      "/api/auth/sign-in/email",
      { email, password: "wrong-password" },
      "203.0.113.2",
      { responseCallback: http.expectedStatuses(401, 429) },
    );
    statuses.push(response.status);
  }
  check(statuses, { "sign-in is rate limited": (s) => s.includes(429) });
}
