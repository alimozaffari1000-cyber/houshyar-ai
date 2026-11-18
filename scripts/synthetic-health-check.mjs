const target = process.env.HOUSHYAR_PUBLIC_URL?.trim();

if (!target) {
  console.error("HOUSHYAR_PUBLIC_URL is required.");
  process.exit(2);
}

let healthUrl;
try {
  const base = new URL(target);
  if (base.protocol !== "https:" || base.username || base.password) {
    throw new Error("URL must use HTTPS and must not contain credentials.");
  }
  if (
    base.hostname === "localhost" ||
    base.hostname.endsWith(".localhost") ||
    base.hostname.endsWith(".local") ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(base.hostname) ||
    base.hostname.includes(":")
  ) {
    throw new Error("Private, local, and IP-literal hosts are not allowed.");
  }
  base.pathname = base.pathname.replace(/\/$/, "") + "/api/health";
  base.search = "";
  base.hash = "";
  healthUrl = base;
} catch (error) {
  console.error(`Invalid HOUSHYAR_PUBLIC_URL: ${error.message}`);
  process.exit(2);
}

const attempts = 3;
let lastError = "unknown error";

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    const response = await fetch(healthUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    if (body?.status !== "ok" || body?.service !== "houshyar-ai") {
      throw new Error("Unexpected health response schema.");
    }
    console.log(JSON.stringify({
      result: "healthy",
      status: response.status,
      service: body.service,
      version: typeof body.version === "string" ? body.version : "unknown",
      checkedAt: new Date().toISOString()
    }, null, 2));
    process.exit(0);
  } catch (error) {
    lastError = error?.name === "TimeoutError" ? "request timed out" : error.message;
    console.error(`Health check attempt ${attempt}/${attempts} failed: ${lastError}`);
    if (attempt < attempts) {
      await new Promise(resolve => setTimeout(resolve, attempt * 2000));
    }
  }
}

console.error(`HOUSHYAR HEALTH CHECK FAILED after ${attempts} attempts: ${lastError}`);
process.exit(1);
