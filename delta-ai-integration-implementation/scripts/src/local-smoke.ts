const apiUrl = process.env.API_URL ?? "http://localhost:3100";
const webUrl = process.env.APP_URL ?? "http://localhost:5173";
export {};

async function check(url: string, expectedContentType: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error(
      `Could not connect to ${url}. Start the required local service first: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.includes(expectedContentType)) {
    const body = await response.text();
    throw new Error(
      `${url} returned ${response.status} (${contentType}): ${body.slice(0, 240)}`,
    );
  }
}

async function checkApiNotFound(): Promise<void> {
  const response = await fetch(`${apiUrl}/api/__smoke_missing_route__`);
  const contentType = response.headers.get("content-type") ?? "";
  if (response.status < 400 || !contentType.includes("application/json")) {
    throw new Error(
      `API errors must be JSON; received ${response.status} (${contentType})`,
    );
  }
}

async function checkAuthAndProjects(): Promise<void> {
  const email = `smoke-${Date.now()}@delta.local`;
  const password = "DeltaSmokePassword2026!";
  const register = await fetch(`${apiUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, organization_name: "DELTA Smoke" }),
  });
  const registration = await register.json() as { token?: string; error?: unknown };
  if (!register.ok || !registration.token) {
    throw new Error(`Local registration failed with ${register.status}: ${JSON.stringify(registration)}`);
  }

  const projects = await fetch(`${apiUrl}/api/projects`, {
    headers: { authorization: `Bearer ${registration.token}` },
  });
  const contentType = projects.headers.get("content-type") ?? "";
  if (!projects.ok || !contentType.includes("application/json")) {
    throw new Error(`Authenticated project list failed with ${projects.status} (${contentType})`);
  }
  const payload = await projects.json();
  if (!Array.isArray(payload)) {
    throw new Error("Authenticated project list did not return an array");
  }
}

await check(`${apiUrl}/api/healthz`, "application/json");
await check(`${apiUrl}/api/readyz`, "application/json");
await checkApiNotFound();
await checkAuthAndProjects();
await check(`${webUrl}/app`, "text/html");
console.log(`Local smoke check passed: API ${apiUrl}, web ${webUrl}`);
