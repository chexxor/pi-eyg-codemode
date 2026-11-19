import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import fs from "node:fs";
import path from "node:path";
import { allRecords, generateMap, lint, scaffold, verify, writeMap, worldDir } from "../lib/world_model.mjs";

// The contract this extension exists to enforce (design §9): a world-model tool
// returns claim | source | verified_at | verify records, never a prose summary.
// "Read the pointer" has to be the path of least resistance, so the tool's text
// output is the record table and `structuredContent` is the same data as objects.

const ClaimSchema = Type.Object({
  id: Type.String(),
  type: Type.String(),
  owner: Type.String(),
  status: Type.String(),
  verified_at: Type.String(),
  verify: Type.String(),
  confidence: Type.String(),
  sources: Type.Array(Type.String()),
});

const RecordLineSchema = Type.Object({
  id: Type.String(),
  status: Type.String(),
  verified_at: Type.String(),
  verify: Type.String(),
  sources: Type.Array(Type.String()),
  file: Type.String(),
});

function table(records: Array<Record<string, unknown>>): string {
  if (records.length === 0) return "no claims matched";
  const lines = ["claim | status | verified_at | verify | sources"];
  for (const record of records) {
    const data = (record as { data?: Record<string, unknown> }).data ?? record;
    lines.push(
      `${data.id} | ${data.status} | ${data.verified_at} | ${data.verify ?? "none"} | ${(data.sources ?? []).join(", ") || "-"}`
    );
  }
  return lines.join("\n");
}

export default function (pi: ExtensionAPI) {
  // A non-LLM entry point: `pi --world-model-check` runs the gate and the verify pass
  // in the current workspace and prints what it found. CI and a shell can use it without
  // starting an agent, which is how this package proves it loaded in a new workspace.
  pi.registerFlag("world-model-check", {
    description: "Run the world model gate (lint, map check, verify) in the current workspace and exit",
    type: "boolean",
    default: false,
  });

  pi.registerTool({
    name: "world_model",
    label: "Project world model",
    description:
      "Read and check the project world model in docs/world/. Returns claim records (id | status | verified_at | verify | sources), never a prose summary. Actions: map (tier-0 index), claims (list or one claim by id), lint (schema gate), verify (run a claim's verify command), init (create docs/world/ for a new repository).",
    promptSnippet: "Read docs/world claims as records: world_model with action map, claims, lint or verify.",
    promptGuidelines: [
      "Use world_model with action=claims before acting on a claim from docs/world, and action=verify to run that claim's verify command; act only when it exits 0.",
      "Use world_model with action=map instead of scanning the repository to rediscover its layout.",
    ],
    parameters: Type.Object({
      action: Type.String({ description: "map | claims | lint | verify | init" }),
      id: Type.Optional(Type.String({ description: "claim id for claims or verify, e.g. entity.sources.mobilizon" })),
      query: Type.Optional(Type.String({ description: "substring to filter claims by id or body" })),
      changedFrom: Type.Optional(Type.String({ description: "git ref for verify, e.g. origin/main" })),
    }),
    outputSchema: Type.Object({
      records: Type.Array(RecordLineSchema),
      text: Type.String(),
    }),
    async execute(toolCallId, params, signal) {
      if (signal?.aborted) return { content: [{ type: "text", text: "cancelled" }], details: {} };
      const root = process.cwd();
      const action = params.action ?? "map";

      if (action === "init") {
        const created = scaffold(root);
        return {
          content: [{ type: "text", text: created.length ? `created ${created.join(", ")}` : "docs/world/ already exists" }],
          details: { created },
        };
      }

      if (action === "lint") {
        const problems = lint(root);
        const text = problems.length
          ? problems.map((problem) => `${problem.file}:${problem.line}: ${problem.rule}: ${problem.message}`).join("\n")
          : "clean";
        return {
          content: [{ type: "text", text }],
          details: { problems },
          structuredContent: { records: problems.map((problem) => ({ id: problem.rule, status: problem.rule, verified_at: "", verify: "", sources: [problem.file], file: problem.file })), text },
        };
      }

      if (action === "map") {
        const map = fs.existsSync(path.join(worldDir(root), "00-map.md"))
          ? fs.readFileSync(path.join(worldDir(root), "00-map.md"), "utf8")
          : generateMap(root);
        return {
          content: [{ type: "text", text: map }],
          details: { characters: map.length },
          structuredContent: { records: allRecords(root).map(toLine), text: map },
        };
      }

      if (action === "verify") {
        const records = allRecords(root).filter((record) => !params.id || record.data?.id === params.id);
        const results = verify(root, { all: !params.id && !params.changedFrom, changedFrom: params.changedFrom ?? null, dryRun: false });
        const selected = params.id || params.changedFrom ? results.filter((result) => (params.id ? result.id === params.id : true)) : results;
        void records;
        const text = selected
          .map((result) => `${result.id} | ${result.status} | ${result.result} | ${result.command ?? "none"} | ${(result.sources ?? []).join(", ") || "-"} | commit ${result.commit || "-"}`)
          .join("\n");
        return {
          content: [{ type: "text", text: text || "no claims matched" }],
          details: { failed: selected.filter((result) => result.result !== "pass").length },
          structuredContent: { records: selected.map((result) => ({ id: result.id, status: result.status, verified_at: result.verified_at, verify: result.command ?? "", sources: result.sources ?? [], file: result.id })), text },
        };
      }

      // claims
      let records = allRecords(root);
      if (params.id) records = records.filter((record) => record.data?.id === params.id);
      if (params.query) {
        records = records.filter((record) => `${record.data?.id ?? ""} ${record.body ?? ""}`.toLowerCase().includes(params.query.toLowerCase()));
      }
      return {
        content: [{ type: "text", text: table(records) }],
        details: { count: records.length },
        structuredContent: { records: records.map(toLine), text: table(records) },
      };
    },
  });

  pi.registerCommand("world", {
    description: "Show or check the project world model: /world map | claims | lint | verify <id>",
    handler: async (args, ctx) => {
      const root = ctx.cwd || process.cwd();
      const parts = String(args ?? "").trim().split(/\s+/);
      const action = parts[0] || "map";
      if (action === "lint") {
        const problems = lint(root);
        ctx.ui.notify(problems.length ? problems.map((p) => `${p.file}:${p.line}: ${p.rule}: ${p.message}`).join("\n") : "world model: clean", problems.length ? "error" : "info");
        return;
      }
      if (action === "verify") {
        const results = verify(root, { all: true, dryRun: parts.includes("--dry-run") });
        const failed = results.filter((result) => result.result !== "pass");
        ctx.ui.notify(`checked ${results.length} claims, ${failed.length} failed${failed.length ? ": " + failed.map((r) => r.id).join(", ") : ""}`, failed.length ? "error" : "info");
        return;
      }
      if (action === "claims") {
        const records = allRecords(root).filter((record) => !parts[1] || record.data?.id === parts[1]);
        ctx.ui.notify(table(records), "info");
        return;
      }
      const map = fs.existsSync(path.join(worldDir(root), "00-map.md")) ? fs.readFileSync(path.join(worldDir(root), "00-map.md"), "utf8") : generateMap(root);
      ctx.ui.notify(map, "info");
    },
  });

  pi.on("session_start", async (event, ctx) => {
    if (!pi.getFlag("world-model-check")) return;
    const root = ctx.cwd || process.cwd();
    const problems = lint(root);
    if (problems.length) {
      console.error(problems.map((problem) => `${problem.file}:${problem.line}: ${problem.rule}: ${problem.message}`).join("\n"));
      process.exit(1);
    }
    const mapCheck = writeMap(root);
    const results = verify(root, { all: true, dryRun: true });
    const failed = results.filter((result) => result.result !== "pass");
    const tools = pi.getAllTools().map((tool) => tool.name);
    console.log(`world model: lint clean, ${results.length} claims, ${failed.length} failing`);
    for (const result of failed) console.log(`  FAIL ${result.id}: ${result.command} -> ${result.stderr}`);
    console.log(`  generated region ${mapCheck.changed ? "was stale" : "current"}`);
    console.log(`  tool registered: ${tools.includes("world_model") ? "yes" : "no"} (${tools.length} tools active in this session)`);
    process.exit(failed.length ? 1 : 0);
  });

  // Tier 0 is loaded, not re-discovered. The map is put in front of the model on every
  // run of the session, so an agent does not spend tool calls rediscovering the layout.
  // The replacement is not cumulative: each run starts from the chained prompt as it is
  // at that moment, so the map appears once per run, never twice.
  pi.on("before_agent_start", async (event, ctx) => {
    const root = ctx.cwd || process.cwd();
    const mapPath = path.join(worldDir(root), "00-map.md");
    if (!fs.existsSync(mapPath)) return undefined;
    const map = fs.readFileSync(mapPath, "utf8").trim();
    if (!map) return undefined;
    return {
      systemPrompt: `${event.systemPrompt}\n\n<project_world_model tier="0" cwd="${root}">\n${map}\n</project_world_model>\n\nClaims in docs/world carry a verify command. Run it before acting on a claim; if it exits non-zero the claim is stale and the code is right. The world_model tool returns records, not prose.`,
    };
  });

  pi.on("session_shutdown", () => {
    // Nothing to clean up: the extension writes only when a tool action asks it to.
  });
}

function toLine(record: { data?: Record<string, unknown>; file: string }): Record<string, unknown> {
  const data = record.data ?? {};
  return {
    id: String(data.id ?? record.file),
    status: String(data.status ?? "unknown"),
    verified_at: String(data.verified_at ?? ""),
    verify: String(data.verify ?? ""),
    sources: Array.isArray(data.sources) ? data.sources.map(String) : [],
    file: record.file,
  };
}
