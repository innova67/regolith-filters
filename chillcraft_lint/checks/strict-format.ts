import * as path from "path";
import { Check, LintContext, LintIssue } from "../types";
import { walkDir, readJson } from "../utils";

const ID = "strict-format";

/**
 * Roturas que el juego (>= 1.26.30) rechaza en el content log pero que los schemas de
 * Blockception y Microsoft Learn todavía aceptan. Lista mantenida a mano: cada content log
 * nuevo que muestre un patrón repetible añade una regla aquí.
 *
 * Fuentes: tres rondas de content log de Biosphere (cc_bio, MC 1.26.50, 2026-09-15/16) y los
 * changelogs oficiales de Bedrock 26.40 y 26.50 (feedback.minecraft.net, "Technical Updates"):
 * solo se añaden reglas que el changelog enuncia de forma explícita, cada una con la
 * format_version a partir de la cual aplica.
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

type Version = [number, number, number];

const MIN_VERSION: Version = [1, 26, 30];
const V1_26_40: Version = [1, 26, 40];
const V1_26_50: Version = [1, 26, 50];

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseVersion(raw: unknown): Version | null {
  if (typeof raw !== "string") return null;
  const parts = raw.split(".").map((p) => Number.parseInt(p, 10));
  if (parts.length < 2 || parts.some((n) => Number.isNaN(n))) return null;
  return [parts[0], parts[1], parts[2] ?? 0];
}

function atLeast(v: Version, min: Version): boolean {
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

function lintFile(kind: Kind, file: string, data: Json, version: Version): LintIssue[] {
  const issues: LintIssue[] = [];
  const push = (message: string, severity: "error" | "warning" = "error"): void => {
    issues.push({ checkId: ID, severity, message, path: file });
  };
  const since = (min: Version): boolean => atLeast(version, min);

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

    if (kind === "entities") lintEntityKey(key, val, keyPath, where, since, push);

    // Features (26.50): snap_to_surface_feature renombró vertical_search_range.
    if (kind === "features" && key === "vertical_search_range" && keyPath.includes("minecraft:snap_to_surface_feature")) {
      push(`${where}: en 1.26.50 vertical_search_range se renombró a search_range`, "warning");
    }
  });

  return issues;
}

type Push = (message: string, severity?: "error" | "warning") => void;

/** Reglas de entidad de los changelogs 26.40 y 26.50 (validación estricta por format_version). */
function lintEntityKey(
  key: string,
  val: unknown,
  keyPath: string[],
  where: string,
  since: (min: Version) => boolean,
  push: Push,
): void {
  const inRangedAttack = keyPath.includes("minecraft:behavior.ranged_attack");
  const inProjectile = keyPath.includes("minecraft:projectile");

  if (since(V1_26_40)) {
    if (inRangedAttack && (key === "attack_interval_min" || key === "attack_interval_max")) {
      push(`${where}: desde 1.26.40 ranged_attack usa attack_interval {"min", "max"} en lugar de attack_interval_min/attack_interval_max`);
    }
    if (inProjectile && key === "should_bounce" && typeof val === "boolean") {
      push(`${where}: desde 1.26.40 should_bounce es un enum: "no" | "if_invulnerable" | "if_no_damage_dealt"`);
    }
    if (inProjectile && key === "semi_random_diff_damage") {
      push(`${where}: desde 1.26.40 semi_random_diff_damage se sustituye por difficulty_randomization ("none" | "additive" | "multiplicative")`);
    }
    if (key === "scale_previous_velocity" && keyPath.includes("minecraft:apply_knockback_rules")) {
      push(`${where}: desde 1.26.40 scale_previous_velocity se llama slowdown_scale`);
    }
  }

  if (since(V1_26_50)) {
    if (inRangedAttack && (key === "attack_radius" || key === "attack_radius_min")) {
      push(`${where}: desde 1.26.50 ranged_attack usa attack_range {"min", "max"} en lugar de attack_radius_min/attack_radius`);
    }
    if (
      keyPath.includes("minecraft:interact") &&
      (key === "interactions" || key === "spawn_entities" || key === "play_sounds") &&
      !Array.isArray(val)
    ) {
      push(`${where}: desde 1.26.50 minecraft:interact solo acepta arrays en interactions, spawn_entities y play_sounds`);
    }
    if (inProjectile) {
      if (key === "anchor" && typeof val === "number") {
        push(`${where}: desde 1.26.50 anchor es un string: "origin" | "eye_height" | "middle"`);
      }
      if ((key === "first_spawn_chance" || key === "second_spawn_chance") && typeof val === "number" && (val < 0 || val > 1)) {
        push(`${where}: desde 1.26.50 ${key} es una probabilidad entre 0.0 y 1.0`);
      }
      if (key === "damage" && keyPath.includes("impact_damage") && Array.isArray(val)) {
        push(`${where}: desde 1.26.50 impact_damage.damage como rango es {"min", "max"}, no un array`);
      }
      if (key === "effects" && keyPath.includes("mob_effects") && !Array.isArray(val)) {
        push(`${where}: desde 1.26.50 mob_effects.effects es un array`);
      }
      if (key === "owner_launch_immunity_ticks") {
        push(`${where}: owner_launch_immunity_ticks está obsoleto desde 1.26.50 (comprobación espacial automática)`, "warning");
      }
    }
    if (key === "minecraft:uses_legacy_ambient_sounds") {
      push(`${where}: minecraft:uses_legacy_ambient_sounds está obsoleto; definir las condiciones en minecraft:ambient_sound_interval.event_names`, "warning");
    }
  }
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
        issues.push(...lintFile(kind, file, data, version));
      }
    }
    return issues;
  },
};
