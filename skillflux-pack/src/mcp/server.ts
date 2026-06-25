import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { beginAuthFlow, beginCheckout, resolveAuthStatus } from "./api-client.js";
import { runMcpDoctor } from "./doctor-service.js";
import {
  getPackSkillInfo,
  installSkill,
  listInstalledSkills,
  removeSkill,
  restoreProjectSkills,
  searchPack,
  updateSkills,
} from "./skill-service.js";
import {
  SkillFluxError,
  errResult,
  okResult,
  type ToolResult,
} from "./tool-response.js";

function textResult(payload: ToolResult, isError = false) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    isError,
  };
}

function wrapError(error: unknown) {
  if (error instanceof SkillFluxError) {
    return textResult(errResult(error.code, error.message, error.nextAction), true);
  }
  if (error instanceof z.ZodError) {
    return textResult(
      errResult("INVALID_INPUT", error.errors.map((item) => item.message).join("; ")),
      true,
    );
  }
  return textResult(
    errResult("INTERNAL", error instanceof Error ? error.message : String(error)),
    true,
  );
}

export function createMcpServer(): Server {
  const server = new Server(
    { name: "skillflux-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "auth.start",
        description: "Start browser-based device login for SkillFlux marketplace access.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "auth.status",
        description:
          "Return auth/payment/entitlement state: unauthenticated, pending, needs_payment, or active.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "billing.checkout",
        description:
          "Create a hosted subscription checkout session for SkillFlux. Ask the user whether they want the monthly or annual plan.",
        inputSchema: {
          type: "object",
          properties: {
            product: { type: "string", description: "Product id, default deluxe-pack" },
            plan: {
              type: "string",
              enum: ["monthly", "annual"],
              description: "Subscription billing period (default monthly)",
            },
          },
        },
      },
      {
        name: "pack.search",
        description: "Search the official SkillFlux skill catalog by keyword and category.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
            category: { type: "string" },
          },
        },
      },
      {
        name: "pack.info",
        description: "Return catalog metadata and install state for one skill id.",
        inputSchema: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
      },
      {
        name: "skill.install",
        description:
          "Download and enable a curated skill in the current project (.skillflux/skills/). Curated skills are always project-scoped; global/user scope is reserved for the SkillFlux bootstrap only.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
      },
      {
        name: "skill.update",
        description:
          "Update one or all project skills. Set force=true to overwrite locally modified files.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
            force: { type: "boolean" },
          },
        },
      },
      {
        name: "skill.list",
        description: "List skills enabled in the current project.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "skill.remove",
        description: "Remove one project skill using lockfile-tracked files only.",
        inputSchema: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
      },
      {
        name: "skill.restore",
        description:
          "Reproducibly install all skills declared in the current project's skillflux.json, pinned to the lockfile (installed.json) versions when present. Always project-scoped.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "doctor",
        description: "Diagnose global SkillFlux bootstrap and current project skill state.",
        inputSchema: { type: "object", properties: {} },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "auth.start": {
          const auth = await beginAuthFlow();
          return textResult(
            okResult(auth, auth.message ?? "Device login started.", auth.status),
          );
        }
        case "auth.status": {
          const auth = await resolveAuthStatus();
          return textResult(
            okResult(auth, auth.message ?? `Auth status: ${auth.status}.`, auth.status),
          );
        }
        case "billing.checkout": {
          const parsed = z
            .object({
              product: z.string().optional(),
              plan: z.enum(["monthly", "annual"]).optional(),
            })
            .parse(args ?? {});
          const plan = parsed.plan ?? "monthly";
          const checkout = await beginCheckout(parsed.product, plan);
          return textResult(
            okResult(
              checkout,
              `Open the checkout URL in your browser to start the ${plan} subscription.`,
            ),
          );
        }
        case "pack.search": {
          const parsed = z
            .object({ query: z.string().optional(), category: z.string().optional() })
            .parse(args ?? {});
          return textResult(await searchPack(parsed.query, parsed.category));
        }
        case "pack.info": {
          const parsed = z.object({ id: z.string() }).parse(args ?? {});
          return textResult(await getPackSkillInfo(parsed.id));
        }
        case "skill.install": {
          const parsed = z.object({ id: z.string() }).parse(args ?? {});
          return textResult(await installSkill(parsed.id));
        }
        case "skill.update": {
          const parsed = z
            .object({ id: z.string().optional(), force: z.boolean().optional() })
            .parse(args ?? {});
          return textResult(await updateSkills(parsed.id, parsed.force ?? false));
        }
        case "skill.list":
          return textResult(await listInstalledSkills());
        case "skill.remove": {
          const parsed = z.object({ id: z.string() }).parse(args ?? {});
          return textResult(await removeSkill(parsed.id));
        }
        case "skill.restore":
          return textResult(await restoreProjectSkills());
        case "doctor":
          return textResult(await runMcpDoctor());
        default:
          return textResult(errResult("INVALID_INPUT", `Unknown tool: ${name}`), true);
      }
    } catch (error) {
      return wrapError(error);
    }
  });

  return server;
}

export async function startMcpServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
