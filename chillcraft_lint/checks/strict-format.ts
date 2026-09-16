import * as path from "path";
import { Check, LintContext, LintIssue } from "../types";
import { walkDir, readJson } from "../utils";

const ID = "strict-format";

/**
 * Roturas que el juego (>= 1.26.30) rechaza en el content log pero que los schemas de
 * Blockception y Microsoft Learn todavía aceptan. Lista mantenida a mano: cada content log
 * nuevo que muestre un patrón repetible añade una regla aquí.
 *
 * Fuente: tres rondas de content log de Biosphere (cc_bio, MC 1.26.50, 2026-09-15/16).
 */

/**
 * Campos de rango que con format_version >= 1.26.30 deben ser objeto, no array.
 * En BP/entities el objeto es {min, max}; en BP/features es {range_min, range_max}.
 * Misma lista que las tolerancias Ajv de `scripts/validate-packs.ts` del template
 * chillcraft_addon_template (el schema 1.26.40 aún pide arrays): mantener en sincronía.
 */
export const RANGE_FIELDS: ReadonlySet<string> = new Set([
  "hover_height",
  "cooldown_range",
  "look_time",
  "float_duration",
  "branch_interval",
  "trunk_height",
  // NO incluir `height_distribution` (growing_plant_feature): es una lista ponderada de pares
  // [rango, peso] y el array es correcto (verificado en Biosphere HEAD, carga limpio en 1.26.50).
]);

const MIN_VERSION: [number, number, number] = [1, 26, 30];

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseVersion(raw: unknown): [number, number, number] | null {
  if (typeof raw !== "string") return null;
  const parts = raw.split(".").map((p) => Number.parseInt(p, 10));
  if (parts.length < 2 || parts.some((n) => Number.isNaN(n))) return null;
  return [parts[0], parts[1], parts[2] ?? 0];
}

function atLeast(v: [number, number, number], min: [number, number, number]): boolean {
  for (let i = 0; i < 3; i++) {
    if (v[i] > min[i]) return true;
    if (v[i] < min[i]) return false;
  }
  return true;
}

/** Recorre el JSON y llama a `visit` con cada par clave/valor y la ruta de claves hasta él. */
function walkJson(value: unknown, keyPath: string[], visit: (key: string, val: unknown, keyPath: string[]) => void): void {
  if (Array.isArray(value)) {
    value.forEach((item, i) => walkJson(item, [...keyPath, String(i)], visit));
    return;
  }
  if (!isObject(value)) return;
  for (const [k, v] of Object.entries(value)) {
    const p = [...keyPath, k];
    visit(k, v, p);
    walkJson(v, p, visit);
  }
}

type Kind = "entities" | "features" | "biomes" | "blocks";

function lintFile(kind: Kind, file: string, data: Json): LintIssue[] {
  const issues: LintIssue[] = [];
  const push = (message: string): void => {
    issues.push({ checkId: ID, severity: "error", message, path: file });
  };

  walkJson(data, [], (key, val, keyPath) => {
    const where = keyPath.join(".");

    // Rangos: array -> objeto; forma del objeto según tipo de archivo.
    if (RANGE_FIELDS.has(key) && (kind === "entities" || kind === "features")) {
      if (Array.isArray(val)) {
        const shape = kind === "entities" ? "{\"min\": a, \"max\": b}" : "{\"range_min\": a, \"range_max\": b}";
        push(`${where}: con format_version >= 1.26.30 un rango es un objeto ${shape}, no un array`);
      } else if (isObject(val)) {
        if (kind === "entities" && ("range_min" in val || "range_max" in val)) {
          push(`${where}: en entidades el rango es {"min", "max"}; range_min/range_max da "not present in the Schema"`);
        }
        if (kind === "features" && ("min" in val || "max" in val)) {
          push(`${where}: en features el rango es {"range_min", "range_max"}; con min/max el juego lee 0`);
        }
      }
    }

    // Biomas: targets de replace_biomes con namespace.
    if (kind === "biomes" && key === "targets" && Array.isArray(val) && keyPath.includes("minecraft:replace_biomes")) {
      for (const target of val) {
        if (typeof target === "string" && !target.includes(":")) {
          push(`${where}: el target "${target}" necesita namespace ("minecraft:${target}"); sin él: "No biome found with name"`);
        }
      }
    }

    // Bloques: ambient_occlusion booleano en material_instances.
    if (kind === "blocks" && key === "ambient_occlusion" && typeof val === "boolean" && keyPath.includes("minecraft:material_instances")) {
      push(`${where}: ambient_occlusion booleano da "invalid numeric value" (>= 1.26.50); omitirlo o usar un número`);
    }

    // Features: min_height_for_canopy solo en acacia_trunk.
    if (kind === "features" && key === "min_height_for_canopy" && keyPath.includes("mega_trunk")) {
      push(`${where}: min_height_for_canopy no es válido en mega_trunk (solo en acacia_trunk)`);
    }

    // Entidades: minecraft:pushable sustituido.
    if (kind === "entities" && key === "minecraft:pushable") {
      push(`${where}: minecraft:pushable fue sustituido por minecraft:pushable_by_entity + minecraft:pushable_by_block`);
    }
  });

  return issues;
}

export const strictFormat: Check = {
  id: ID,
  severity: "error",
  scope: "format",
  run(ctx: LintContext): LintIssue[] {
    const issues: LintIssue[] = [];
    const kinds: Kind[] = ["entities", "features", "biomes", "blocks"];
    for (const kind of kinds) {
      const files = walkDir(path.join(ctx.bpDir, kind)).filter((f) => f.endsWith(".json"));
      for (const file of files) {
        const data = readJson(file);
        if (!isObject(data)) continue;
        const version = parseVersion(data["format_version"]);
        if (!version || !atLeast(version, MIN_VERSION)) continue;
        issues.push(...lintFile(kind, file, data));
      }
    }
    return issues;
  },
};
