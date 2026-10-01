"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.namespaceFormat = void 0;
const path = require("path");
const utils_1 = require("../utils");
const ID = "namespace-format";
function extractIdentifier(data, ...keys) {
    let cur = data;
    for (const key of keys) {
        if (typeof cur !== "object" || cur === null)
            return null;
        cur = cur[key];
    }
    return typeof cur === "string" ? cur : null;
}
exports.namespaceFormat = {
    id: ID,
    severity: "error",
    scope: "namespace",
    run(ctx) {
        const issues = [];
        if (!ctx.namespace) {
            issues.push({ checkId: ID, severity: "warning", message: 'namespace no configurado — agrega "namespace" en los settings del filtro o en data/chillcraft_lint.json' });
            return issues;
        }
        const ns = ctx.namespace;
        // BP entities: identifier usa dos puntos → "cc_ft:nombre"
        const bpEntities = (0, utils_1.walkDir)(path.join(ctx.bpDir, "entities")).filter((f) => f.endsWith(".json"));
        for (const file of bpEntities) {
            const id = extractIdentifier((0, utils_1.readJson)(file), "minecraft:entity", "description", "identifier");
            if (!id)
                continue;
            if (id.startsWith("minecraft:")) {
                issues.push({ checkId: ID, severity: "error", message: `Entidad usa namespace "minecraft:" — debe usar "${ns}:"`, path: file });
            }
            else if (!id.startsWith(`${ns}:`)) {
                issues.push({ checkId: ID, severity: "error", message: `Entidad usa namespace incorrecto "${id}" — esperado "${ns}:{nombre}"`, path: file });
            }
        }
        // RP client entities: mismo identifier
        const rpEntities = (0, utils_1.walkDir)(path.join(ctx.rpDir, "entity")).filter((f) => f.endsWith(".json"));
        for (const file of rpEntities) {
            const id = extractIdentifier((0, utils_1.readJson)(file), "minecraft:client_entity", "description", "identifier");
            if (!id)
                continue;
            if (id.startsWith("minecraft:")) {
                issues.push({ checkId: ID, severity: "error", message: `Client entity usa namespace "minecraft:" — debe usar "${ns}:"`, path: file });
            }
            else if (!id.startsWith(`${ns}:`)) {
                issues.push({ checkId: ID, severity: "error", message: `Client entity usa namespace incorrecto "${id}" — esperado "${ns}:{nombre}"`, path: file });
            }
        }
        // BP blocks: identifier usa dos puntos → "cc_ft:nombre"
        const bpBlocks = (0, utils_1.walkDir)(path.join(ctx.bpDir, "blocks")).filter((f) => f.endsWith(".json"));
        for (const file of bpBlocks) {
            const id = extractIdentifier((0, utils_1.readJson)(file), "minecraft:block", "description", "identifier");
            if (!id)
                continue;
            if (id.startsWith("minecraft:")) {
                issues.push({ checkId: ID, severity: "error", message: `Bloque usa namespace "minecraft:" — debe usar "${ns}:"`, path: file });
            }
            else if (!id.startsWith(`${ns}:`)) {
                issues.push({ checkId: ID, severity: "error", message: `Bloque usa namespace incorrecto "${id}" — esperado "${ns}:{nombre}"`, path: file });
            }
        }
        // BP dimensions (JSON estable desde 1.26.50): identifier propio; nunca redefinir una vanilla
        const bpDimensions = (0, utils_1.walkDir)(path.join(ctx.bpDir, "dimensions")).filter((f) => f.endsWith(".json"));
        for (const file of bpDimensions) {
            const id = extractIdentifier((0, utils_1.readJson)(file), "minecraft:dimension", "description", "identifier");
            if (!id)
                continue;
            if (id.startsWith("minecraft:")) {
                issues.push({ checkId: ID, severity: "error", message: `Dimensión usa namespace "minecraft:" — no se modifican dimensiones vanilla; usar "${ns}:"`, path: file });
            }
            else if (!id.startsWith(`${ns}:`)) {
                issues.push({ checkId: ID, severity: "error", message: `Dimensión usa namespace incorrecto "${id}" — esperado "${ns}:{nombre}"`, path: file });
            }
        }
        return issues;
    },
};
