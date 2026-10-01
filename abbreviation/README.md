# Abbreviation

Regolith filter that reduces JSON filenames in the Behavior Pack and Resource Pack to short abbreviations of at most 5 letters. Keeps file trees readable and avoids overly long paths without manual renaming.

## What it does

During each build, the filter:

1. Strips common suffixes from the stem (`.behavior`, `.animation`, `.animation_controller`, etc.)
2. For **compound names** (containing `_` or `-`): takes the first letter of each word
3. For **single words**: takes the first, middle, and last letter
4. Truncates the result to **5 characters** maximum
5. Resolves collisions in the same directory by appending a counter (`name1.json`, `name2.json`, …)

**Source files in `packs/` are never modified** — renaming happens only on the Regolith build copy.

### Example

Before (source):

```
BP/entities/zombie_piglin_spawn.behavior.json
BP/entities/attack_speed_boost.behavior.json
BP/entities/creeper.json
```

After (build output):

```
BP/entities/zps.json
BP/entities/asb.json
BP/entities/cpr.json
```

## Installation

```json
"filterDefinitions": {
    "abbreviation": {
        "url": "github.com/innova67/regolith-filters/abbreviation",
        "version": "1.0.0"
    }
}
```

Then run:

```sh
regolith install-all
```

## Usage

Add the filter to your profile:

```json
"filters": [
    {
        "filter": "abbreviation"
    }
]
```

This filter takes no settings — it applies the same abbreviation rules everywhere.

## Notes

**BP ignored directories** — these folders are left untouched:

`loot_tables`, `trading`, `scripts`, `structures`, `texts`, `feature_rules`, `features`, `biomes`, `dimensions`, `functions`, `item_catalog` (`dimensions`: custom dimension JSON, stable since Minecraft 1.26.50; kept like `biomes` until it is verified that the game does not tie the file name to the identifier)

**RP ignored directories** — left untouched:

`textures`, `texts`, `sounds`, `particles`, `biomes`, `fogs` (Minecraft requires a client biome file to be named after its identifier)

**RP ignored files** — always kept as-is:

`manifest.json`, `sounds.json`, `blocks.json`, `biomes_client.json`, `_ui_defs.json`, `music_definitions.json`

- `manifest.json` is always skipped in BP as well.
- Only `.json` filenames are changed — folder names are never modified.
- Every build writes `data/abbreviation_map.json` (`original path -> abbreviated path`, relative to the Regolith working dir). Regolith copies `data/` back to the project's `dataPath`, so tools that read Minecraft's content log can map `BP/blocks/tl.json` back to `BP/blocks/titan_leaves.block.json`. Add it to `.gitignore`.
- Requires Python 3.9+.
