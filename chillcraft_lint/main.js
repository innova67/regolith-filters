"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fs = require("fs");
const manifest_pack_scope_1 = require("./checks/manifest-pack-scope");
const manifest_product_type_1 = require("./checks/manifest-product-type");
const manifest_dependencies_1 = require("./checks/manifest-dependencies");
const no_runtime_identifier_1 = require("./checks/no-runtime-identifier");
const namespace_format_1 = require("./checks/namespace-format");
const texture_paths_1 = require("./checks/texture-paths");
const file_count_limit_1 = require("./checks/file-count-limit");
const size_limit_1 = require("./checks/size-limit");
const no_experimental_1 = require("./checks/no-experimental");
const strict_format_1 = require("./checks/strict-format");
const CHECKS = [
    manifest_pack_scope_1.manifestPackScope,
    manifest_product_type_1.manifestProductType,
    manifest_dependencies_1.manifestDependencies,
    no_runtime_identifier_1.noRuntimeIdentifier,
    namespace_format_1.namespaceFormat,
    texture_paths_1.texturePaths,
    file_count_limit_1.fileCountLimit,
    size_limit_1.sizeLimit,
    no_experimental_1.noExperimental,
    strict_format_1.strictFormat,
];
function parseConfig(raw) {
    if (typeof raw !== "object" || raw === null)
        return { namespace: null, project: null };
    const cfg = raw;
    return {
        namespace: typeof cfg["namespace"] === "string" ? cfg["namespace"] : null,
        project: typeof cfg["project"] === "string" ? cfg["project"] : null,
    };
}
function readSettings() {
    try {
        return parseConfig(JSON.parse(process.argv[2] ?? "null"));
    }
    catch {
        return { namespace: null, project: null };
    }
}
function readFileConfig(dataDir) {
    const configPath = path.join(dataDir, "chillcraft_lint.json");
    if (!fs.existsSync(configPath))
        return { namespace: null, project: null };
    try {
        return parseConfig(JSON.parse(fs.readFileSync(configPath, "utf8")));
    }
    catch {
        return { namespace: null, project: null };
    }
}
function main() {
    const cwd = process.cwd();
    const dataDir = path.join(cwd, "data");
    const settings = readSettings();
    const fileConfig = readFileConfig(dataDir);
    const namespace = settings.namespace ?? fileConfig.namespace;
    const project = settings.project ?? fileConfig.project;
    const ctx = {
        bpDir: path.join(cwd, "BP"),
        rpDir: path.join(cwd, "RP"),
        dataDir,
        namespace,
        project,
    };
    const issues = [];
    for (const check of CHECKS) {
        issues.push(...check.run(ctx));
    }
    let errors = 0;
    let warnings = 0;
    for (const issue of issues) {
        const tag = issue.severity === "error" ? "[ERROR]" : "[WARNING]";
        const loc = issue.path ? ` (${issue.path})` : "";
        console.log(`${tag} ${issue.checkId}: ${issue.message}${loc}`);
        if (issue.severity === "error")
            errors++;
        else
            warnings++;
    }
    if (issues.length === 0) {
        console.log("[OK] chillcraft_lint: todos los checks pasaron");
    }
    else {
        console.log(`\nchillcraft_lint: ${errors} error(es), ${warnings} warning(s)`);
    }
    if (errors > 0)
        process.exit(1);
}
main();
