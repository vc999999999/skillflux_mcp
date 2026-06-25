import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../src/mcp/server.js";

// End-to-end test of the MCP server contract through the same handlers used by
// stdio (tools/list + tools/call), in a temp project dir and fixture mode.
// It never touches the developer's real agent config.

interface CallResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

describe("mcp server contract (fixture mode)", () => {
  let client: Client;
  let projectDir: string;
  let originalCwd: string;
  const savedEnv: Record<string, string | undefined> = {};

  async function call(name: string, args: Record<string, unknown> = {}) {
    const result = (await client.callTool({ name, arguments: args })) as CallResult;
    const text = result.content.find((part) => part.type === "text")?.text ?? "{}";
    return { payload: JSON.parse(text), isError: result.isError ?? false };
  }

  beforeAll(async () => {
    savedEnv.SKILLFLUX_FIXTURE = process.env.SKILLFLUX_FIXTURE;
    savedEnv.SKILLFLUX_API_URL = process.env.SKILLFLUX_API_URL;
    process.env.SKILLFLUX_FIXTURE = "1";
    delete process.env.SKILLFLUX_API_URL;

    originalCwd = process.cwd();
    projectDir = await mkdtemp(join(tmpdir(), "skillflux-mcp-smoke-"));
    process.chdir(projectDir);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createMcpServer();
    await server.connect(serverTransport);
    client = new Client({ name: "smoke-test", version: "0.0.0" }, { capabilities: {} });
    await client.connect(clientTransport);
  });

  afterAll(async () => {
    process.chdir(originalCwd);
    await rm(projectDir, { recursive: true, force: true });
    process.env.SKILLFLUX_FIXTURE = savedEnv.SKILLFLUX_FIXTURE;
    process.env.SKILLFLUX_API_URL = savedEnv.SKILLFLUX_API_URL;
    if (savedEnv.SKILLFLUX_FIXTURE === undefined) delete process.env.SKILLFLUX_FIXTURE;
  });

  it("lists the full tool set", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "auth.start",
        "auth.status",
        "billing.checkout",
        "pack.search",
        "pack.info",
        "skill.install",
        "skill.update",
        "skill.list",
        "skill.remove",
        "skill.restore",
        "doctor",
      ]),
    );
  });

  it("reports active auth in fixture mode", async () => {
    const { payload } = await call("auth.status");
    expect(payload.ok).toBe(true);
    expect(payload.status).toBe("active");
  });

  it("finds demo-skill via pack.search", async () => {
    const { payload } = await call("pack.search", { query: "demo" });
    expect(payload.ok).toBe(true);
    expect(payload.data.skills.some((s: { id: string }) => s.id === "demo-skill")).toBe(true);
  });

  it("installs demo-skill into the project and records the lockfile", async () => {
    const { payload, isError } = await call("skill.install", { id: "demo-skill" });
    expect(isError).toBe(false);
    expect(payload.ok).toBe(true);
    expect(payload.data.scope).toBe("project");

    await expect(stat(join(projectDir, ".skillflux/installed.json"))).resolves.toBeDefined();
    await expect(
      stat(join(projectDir, ".skillflux/skills/demo-skill/SKILL.md")),
    ).resolves.toBeDefined();
    await expect(stat(join(projectDir, "skillflux.json"))).resolves.toBeDefined();
  });

  it("lists the installed skill", async () => {
    const { payload } = await call("skill.list");
    expect(payload.ok).toBe(true);
    expect(payload.data.skills.some((s: { id: string }) => s.id === "demo-skill")).toBe(true);
  });

  it("refuses to install a deluxe skill in fixture mode", async () => {
    const { payload, isError } = await call("skill.install", { id: "prd-writer" });
    expect(isError).toBe(true);
    expect(payload.ok).toBe(false);
    expect(payload.code).toBe("PAYMENT_REQUIRED");
  });
});
