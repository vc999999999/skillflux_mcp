import { apiBaseUrl, isFixtureMode, readConfig, writeConfig } from "../lib/config.js";
import { SkillFluxError, type ToolErrorCode } from "./tool-response.js";

export type AuthStatus = "unauthenticated" | "pending" | "needs_payment" | "active" | "expired";

export interface AuthStatusResult {
  status: AuthStatus;
  plan?: string;
  expiresAt?: string;
  loginUrl?: string;
  userCode?: string;
  pollAfterSeconds?: number;
  message?: string;
  deviceToken?: string;
}

export interface DeviceStartResult {
  loginUrl: string;
  deviceSessionId: string;
  userCode: string;
  expiresAt: string;
  pollAfterSeconds: number;
}

export type BillingPlan = "monthly" | "annual";

export interface CheckoutResult {
  checkoutUrl: string;
  plan?: BillingPlan;
}

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  message?: string;
  code?: string;
}

function bodyExcerpt(text: string, max = 200): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > max ? `${collapsed.slice(0, max)}…` : collapsed;
}

/** Map an HTTP status or backend error code to an agent-facing tool error code. */
function normalizeErrorCode(status: number, apiCode?: string): ToolErrorCode {
  switch (apiCode) {
    case "UNAUTHORIZED":
      return "AUTH_REQUIRED";
    case "FORBIDDEN":
      return "PAYMENT_REQUIRED";
    case "NOT_FOUND":
      return "NOT_FOUND";
    case "INVALID_INPUT":
      return "INVALID_INPUT";
  }
  if (status === 401) return "AUTH_REQUIRED";
  if (status === 403) return "PAYMENT_REQUIRED";
  if (status === 404) return "NOT_FOUND";
  return "INTERNAL";
}

function nextActionFor(code: ToolErrorCode): { tool: string } | undefined {
  if (code === "AUTH_REQUIRED") return { tool: "auth.start" };
  if (code === "PAYMENT_REQUIRED") return { tool: "billing.checkout" };
  return undefined;
}

async function apiFetch<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (init.token) {
    headers.set("Authorization", `Bearer ${init.token}`);
  }

  const url = `${apiBaseUrl()}${path}`;
  let response: Response;
  try {
    response = await fetch(url, { ...init, headers });
  } catch (error) {
    throw new SkillFluxError(
      "INTERNAL",
      `Cannot reach SkillFlux API (${path}): ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // Read the body as text first so a non-JSON response (e.g. a Cloudflare HTML
  // error page or an empty body) never throws a raw JSON parse error.
  const rawBody = await response.text();
  let parsed: unknown;
  if (rawBody) {
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      parsed = undefined;
    }
  }

  const envelope =
    typeof parsed === "object" && parsed !== null ? (parsed as ApiEnvelope<T>) : undefined;

  // Structured failure envelope from the registry.
  if (envelope && "ok" in envelope && envelope.ok === false) {
    const code = normalizeErrorCode(response.status, envelope.code);
    throw new SkillFluxError(
      code,
      envelope.message ?? envelope.code ?? `SkillFlux API ${path} failed (HTTP ${response.status}).`,
      nextActionFor(code),
    );
  }

  // Non-2xx without a parseable envelope (HTML error page, gateway error, …).
  if (!response.ok) {
    const code = normalizeErrorCode(response.status, undefined);
    const detail = parsed === undefined && rawBody ? ` ${bodyExcerpt(rawBody)}` : "";
    throw new SkillFluxError(
      code,
      `SkillFlux API ${path} failed (HTTP ${response.status}).${detail}`,
      nextActionFor(code),
    );
  }

  if (envelope && "data" in envelope) {
    return envelope.data as T;
  }

  return parsed as T;
}

export async function startDeviceSession(
  deviceId: string,
  agent: string,
): Promise<DeviceStartResult> {
  return apiFetch<DeviceStartResult>("/device/start", {
    method: "POST",
    body: JSON.stringify({ deviceId, agent }),
  });
}

export async function pollDeviceStatus(
  deviceSessionId: string,
): Promise<AuthStatusResult> {
  return apiFetch<AuthStatusResult>("/device/status", {
    method: "POST",
    body: JSON.stringify({ deviceSessionId }),
  });
}

export async function fetchAuthStatusWithToken(token: string): Promise<AuthStatusResult> {
  return apiFetch<AuthStatusResult>("/device/status", {
    method: "POST",
    token,
    body: JSON.stringify({}),
  });
}

export async function createCheckout(
  token: string,
  product = "deluxe-pack",
  plan: BillingPlan = "monthly",
): Promise<CheckoutResult> {
  return apiFetch<CheckoutResult>("/checkout", {
    method: "POST",
    token,
    body: JSON.stringify({ product, plan }),
  });
}

export async function fetchPack(token: string) {
  return apiFetch("/pack", { method: "GET", token });
}

export async function fetchSkill(token: string, id: string, version?: string) {
  const query = version ? `?version=${encodeURIComponent(version)}` : "";
  return apiFetch(`/skill/${encodeURIComponent(id)}${query}`, { method: "GET", token });
}

export async function resolveAuthStatus(): Promise<AuthStatusResult> {
  const config = await readConfig();

  if (isFixtureMode()) {
    return {
      status: "active",
      plan: "fixture",
      message: "Fixture mode — local bundled catalog without API.",
    };
  }

  if (!config) {
    return { status: "unauthenticated", message: "Run `npx skillflux install` first." };
  }

  if (config.deviceToken) {
    const result = await fetchAuthStatusWithToken(config.deviceToken);
    return {
      ...result,
      message: result.message ?? `Auth status: ${result.status}.`,
    };
  }

  if (config.deviceSessionId) {
    const result = await pollDeviceStatus(config.deviceSessionId);
    if (result.deviceToken) {
      config.deviceToken = result.deviceToken;
      delete config.deviceSessionId;
      await writeConfig(config);
    }
    return result;
  }

  return { status: "unauthenticated", message: "Call auth.start to begin browser login." };
}

export async function beginAuthFlow(): Promise<AuthStatusResult> {
  const config = await readConfig();
  if (!config) {
    throw new Error("SkillFlux is not installed. Run `npx skillflux install` first.");
  }

  if (isFixtureMode()) {
    return {
      status: "active",
      plan: "fixture",
      message: "Fixture mode skips browser login.",
    };
  }

  const started = await startDeviceSession(config.deviceId, config.agent);
  config.deviceSessionId = started.deviceSessionId;
  await writeConfig(config);

  return {
    status: "pending",
    loginUrl: started.loginUrl,
    userCode: started.userCode,
    pollAfterSeconds: started.pollAfterSeconds,
    message: "Open the login URL in your browser to authorize this device.",
  };
}

export async function beginCheckout(
  product?: string,
  plan: BillingPlan = "monthly",
): Promise<CheckoutResult> {
  const config = await readConfig();
  if (!config?.deviceToken) {
    throw new Error("Login required before checkout.");
  }
  if (isFixtureMode()) {
    return {
      checkoutUrl: `https://skillflux.cn/pack?utm_source=fixture&plan=${plan}`,
      plan,
    };
  }
  return createCheckout(config.deviceToken, product, plan);
}
