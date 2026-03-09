# Asset Generation Plan

Generated asset targets for IRON FRONTIER.

## Structure
- hero/: 32x32 hero sprite sources
- enemies/: 32x32 enemy robot variants by rank
- robots/: 32x32 allied robot sprite sources
- parts/: 16x16 robot part icons
- towers/: 16x16 turret structure icons
- ui/: UI icons and badges
- tiles/: dark planet ground and path tiles

## Batch Prompt File
- output/imagegen/asset-prompts.jsonl

## Generation Notes
- Style: dark SF pixel art, dark background, red/orange accents
- Prefer transparent background for characters and UI assets
- Final in-game sizes:
  - hero, enemies, allies: 32x32
  - parts, towers, most UI icons: 16x16
  - slot frame: 32x32 is acceptable before downscaling

## Pending
Live generation requires OPENAI_API_KEY in the current shell environment.