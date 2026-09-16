# chillcraft_lint

Regolith filter that validates your Behavior Pack and Resource Pack against Chillcraft's Minecraft Marketplace Partner Program compliance rules. Runs at build time and exits with code 1 if any error-level check fails, stopping the pipeline before producing a bad build.

## What it does

Runs 10 checks across BP and RP:

| Check | Severity | What it validates |
|---|---|---|
| `manifest-pack-scope` | error | Both manifests have `"pack_scope": "world"` in header |
| `manifest-product-type` | error | Both manifests have `metadata.product_type = "addon"` |
| `manifest-dependencies` | error | BP depends on RP's UUID and RP depends on BP's UUID |
| `no-runtime-identifier` | error | No `runtime_identifier` field in any entity file (Partner Program prohibition) |
| `namespace-format` | error | Entity, client entity and block IDs use `ns:name` colon notation (the only form Minecraft resolves), no `minecraft:` vanilla overrides |
| `texture-paths` | error / warning | No loose files in `textures/` root, no vanilla directory overrides, custom textures in `textures/chillcraft/{project}/` |
| `no-experimental` | error | No `use_beta_features: true`, no experimental capabilities, no `is_experimental: true` in entity files |
| `file-count-limit` | warning → error | Total BP + RP file count stays under 3,500 (warns at 3,150) |
| `size-limit` | warning → error | Total BP + RP size stays under 25 MB (warns at 22.5 MB) |
| `strict-format` | error | Syntax the game rejects with `format_version` ≥ 1.26.30 although the Blockception schemas and Microsoft Learn still accept it: `replace_biomes.targets` without namespace; range fields (`hover_height`, `cooldown_range`, `look_time`, `float_duration`, `branch_interval`, `trunk_height`, `height_distribution`) as arrays, or `{range_min, range_max}` in entities / `{min, max}` in features; boolean `ambient_occlusion` in `material_instances`; `min_height_for_canopy` inside `mega_trunk`; `minecraft:pushable`. Hand-maintained list fed by each content log |

Errors stop the build (`exit 1`). Warnings are printed but do not stop it.

## Configuration

Pass settings directly in your Regolith profile:

```json
"filters": [
    {
        "filter": "chillcraft_lint",
        "settings": {
            "namespace": "cc_ft",
            "project": "my_project"
        }
    }
]
```

| Field | Required | Description |
|---|---|---|
| `namespace` | Recommended | Identifier prefix used in entity and block IDs (e.g. `cc_ft`) |
| `project` | Recommended | Project slug used in texture paths (e.g. `my_project`) |

Without `namespace`, the `namespace-format` check emits a warning and skips. Without `project`, the texture path specificity check skips.

As a fallback, values can also be provided in `data/chillcraft_lint.json` — settings in the profile take priority.

## Installation

```json
"filterDefinitions": {
    "chillcraft_lint": {
        "url": "github.com/innova67/regolith-filters/chillcraft_lint",
        "version": "1.0.0"
    }
}
```

Then run:

```sh
regolith install-all
```

## Usage

Add the filter to your profile. Place it **first** so it catches issues before other filters run:

```json
"filters": [
    {
        "filter": "chillcraft_lint",
        "settings": {
            "namespace": "cc_ft",
            "project": "my_project"
        }
    }
]
```

## Output

```
[ERROR] manifest-pack-scope: BP manifest requiere "pack_scope": "world" en header (C:\...\BP\manifest.json)
[ERROR] no-runtime-identifier: runtime_identifier encontrado — prohibido en Partner Program (C:\...\BP\entities\zombie.json)
[WARNING] size-limit: Tamaño total del addon: 23.10 MB (92.4% del límite de 25 MB)

chillcraft_lint: 2 error(es), 1 warning(s)
```

Or on a clean project:

```
[OK] chillcraft_lint: todos los checks pasaron
```

## Requirements

- Node.js 18+
- Regolith with `nodejs` runner support
