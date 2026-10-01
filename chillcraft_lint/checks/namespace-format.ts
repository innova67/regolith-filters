import * as path from "path";
import { Check, LintContext, LintIssue } from "../types";
import { walkDir, readJson } from "../utils";

const ID = "namespace-format";

function extractIdentifier(data: unknown, ...keys: string[]): string | null {
  let cur: unknown = data;
  for (const key of keys) {
    if (typeof cur !== "object" || cur === null) return null;
    cur = (cur as Record<string, unknown>)[key];
  }
  return typeof cur === "string" ? cur : null;
}

export const namespaceFormat: Check = {
  id: ID,
  severity: "error",
  scope: "namespace",
  run(ctx: LintContext): LintIssue[] {
    const issues: LintIssue[] = [];

    if (!ctx.namespace) {
      issues.push({ checkId: ID, severity: "warning", message: 'namespace no configurado — agrega "namespace" en los settings del filtro o en data/chillcraft_lint.json' });
      return issues;
    }

    const ns = ctx.namespace;

    // BP entities: identifier usa dos puntos → "cc_ft:nombre"
    const bpEntities = walkDir(path.join(ctx.bpDir, "entities")).filter((f) => f.endsWith(".json"));
    for (const file of bpEntities) {
      const id = extractIdentifier(readJson(file), "minecraft:entity", "description", "identifier");
      if (!id) continue;
      if (id.startsWith("minecraft:")) {
        issues.push({ checkId: ID, severity: "error", message: `Entidad usa namespace "minecraft:" — debe usar "${ns}:"`, path: file });
      } else if (!id.startsWith(`${ns}:`)) {
        issues.push({ checkId: ID, severity: "error", message: `Entidad usa namespace incorrecto "${id}" — esperado "${ns}:{nombre}"`, path: file });
      }
    }

    // RP client entities: mismo identifier
    const rpEntities = walkDir(path.join(ctx.rpDir, "entity")).filter((f) => f.endsWith(".json"));
    for (const file of rpEntities) {
      const id = extractIdentifier(readJson(file), "minecraft:client_entity", "description", "identifier");
      if (!id) continue;
      if (id.startsWith("minecraft:")) {
        issues.push({ checkId: ID, severity: "error", message: `Client entity usa namespace "minecraft:" — debe usar "${ns}:"`, path: file });
      } else if (!id.startsWith(`${ns}:`)) {
        issues.push({ checkId: ID, severity: "error", message: `Client entity usa namespace incorrecto "${id}" — esperado "${ns}:{nombre}"`, path: file });
      }
    }

    // BP blocks: identifier usa dos puntos → "cc_ft:nombre"
    const bpBlocks = walkDir(path.join(ctx.bpDir, "blocks")).filter((f) => f.endsWith(".json"));
    for (const file of bpBlocks) {
      const id = extractIdentifier(readJson(file), "minecraft:block", "description", "identifier");
      if (!id) continue;
      if (id.startsWith("minecraft:")) {
        issues.push({ checkId: ID, severity: "error", message: `Bloque usa namespace "minecraft:" — debe usar "${ns}:"`, path: file });
      } else if (!id.startsWith(`${ns}:`)) {
        issues.push({ checkId: ID, severity: "error", message: `Bloque usa namespace incorrecto "${id}" — esperado "${ns}:{nombre}"`, path: file });
      }
    }

    // BP dimensions (JSON estable desde 1.26.50): identifier propio; nunca redefinir una vanilla
    const bpDimensions = walkDir(path.join(ctx.bpDir, "dimensions")).filter((f) => f.endsWith(".json"));
    for (const file of bpDimensions) {
      const id = extractIdentifier(readJson(file), "minecraft:dimension", "description", "identifier");
      if (!id) continue;
      if (id.startsWith("minecraft:")) {
        issues.push({ checkId: ID, severity: "error", message: `Dimensión usa namespace "minecraft:" — no se modifican dimensiones vanilla; usar "${ns}:"`, path: file });
      } else if (!id.startsWith(`${ns}:`)) {
        issues.push({ checkId: ID, severity: "error", message: `Dimensión usa namespace incorrecto "${id}" — esperado "${ns}:{nombre}"`, path: file });
      }
    }

    return issues;
  },
};
