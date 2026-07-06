# Iron Frontier / Legion

> **TL;DR (EN):** A browser-game prototype built to test whether an AI coding agent could assemble a component-based action RPG and base-defense loop.
> What worked: movement, combat, drops, part assembly, and base-defense systems could be sketched quickly.
> What still needs human judgment: system integration, balance, asset scope, and whether this genre is realistic for AI-assisted prototyping. (as of 2026-04, using Codex)

`Legion` is the repository name. `Iron Frontier` is the working title used to describe the game concept.

This is not a finished game. It is an AI-assisted game prototyping experiment.

## What This Tested

The idea was to build a browser game where the player explores a hostile frontier, defeats enemies, collects parts, assembles units, and uses them to defend a base.

The reference feeling was close to a component-combination game such as `Necrosmith`: the interesting part was not choosing a finished character, but building something from heads, bodies, arms, legs, or machine parts.

## What Worked

- Basic player movement
- Enemy encounters
- Drops and parts
- Some part-combination flow
- Base-defense structure
- Map/visibility and progression sketches
- HTML/Canvas implementation that could be tested quickly

This confirmed that an AI coding agent can produce the skeleton of a multi-system browser game much faster than writing every piece manually.

## What Did Not Work Yet

(2026-04, Codex 기준) the hard part was not adding individual features. The hard part was making those features connect reliably.

Part-combination games also demand far more assets than they first appear to need. Heads, bodies, limbs, weapons, hit states, and animations need to fit together visually. Without that asset system, the game can have mechanics but still fail to feel like a coherent game.

## Main Lesson

AI can quickly create the structure of a complex game prototype, but a component-based game is expensive in assets, animation, and system integration.

For future AI-assisted game prototypes, the genre should be chosen with asset burden in mind. A simpler visual grammar may produce a better prototype than a mechanically ambitious one with too many required parts.

## Related Collection

This project is part of:

[AI Game Prototyping Experiments](https://github.com/rep87/ai-game-prototyping-experiments)

## Status

- Prototype / experiment
- Not a finished game
- Code sync is not being changed in this README-only update
