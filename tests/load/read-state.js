// k6 run -e URL=https://PROJECT.supabase.co -e KEY=publishable -e TOKENS_JSON='["test-user-token",...]' tests/load/read-state.js
import http from "k6/http";
import { check, sleep } from "k6";
export const options = {
  stages: [
    { duration: "1m", target: 10 },
    { duration: "2m", target: 50 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1000"],
  },
};
const users = JSON.parse(__ENV.TOKENS_JSON || "[]");
export default function () {
  if (!users.length)
    throw new Error("Provide disposable test accounts: [{token,owner}].");
  const user = users[(__VU - 1) % users.length];
  const response = http.post(
    `${__ENV.URL}/rest/v1/rpc/load_health_state`,
    JSON.stringify({ expected_owner: user.owner }),
    {
      headers: {
        apikey: __ENV.KEY,
        Authorization: `Bearer ${user.token}`,
        "Content-Type": "application/json",
      },
    },
  );
  check(response, { "authenticated read succeeds": (r) => r.status === 200 });
  sleep(2);
}
