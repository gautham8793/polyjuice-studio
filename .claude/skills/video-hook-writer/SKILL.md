---
name: video-hook-writer
description: Write, rewrite, or audit high-retention video hooks using the 3-step Curiosity Loop psychology (Context Lean, Scroll-Stop Interjection, Contrarian Snapback), staccato rhythm, 3-5 word visual title hooks, and calibrated opening motion. Use when the user asks to write a hook, improve or audit a video opener, brainstorm hook variations, or rework Scene 1 of a Polyjuice Video Studio project.
argument-hint: <topic or project-slug>
---

# /video-hook-writer - High-Retention Hook Generator & Auditor

Craft or upgrade Scene 1 (`kind: "hook"`) for Polyjuice Video Studio projects (Shorts, Reels, and long-form `Cinematic` videos) using the 6-part Curiosity Loop framework.

## 1. The 3-Step Spoken Hook Formula (`narration`)

Build the opening spoken hook in 2 to 3 short, staccato sentences (typically 12-22 words total for a 9:16 Short, or 25-40 words for a 16:9 long-form intro) that chain three psychological beats:

1. **Beat 1 - Context Lean (Topic Clarity + Lean-In):**
   Make the topic immediately clear so the target viewer self-selects in, and pull them forward using one of three angles backed by `research.md`:
   - **Benefit / Pain-Point Lead:** Connect the topic to how it directly affects the viewer (cost, health, safety, daily life).
   - **Cult Hopping (Wrap the Unknown in the Known):** Anchor a technical or unfamiliar topic to a household name, famous brand, celebrity, or everyday comparison so the viewer never feels lost.
   - **Mind-Blowing Scale / Stat:** State a verified number from `research.md` against a familiar benchmark ("twenty times bigger than an IMAX").
2. **Beat 2 - Scroll-Stop Interjection (The Stun Gun):**
   Drop a short contrasting pivot that interrupts the initial direction and challenges conventional wisdom. Start with a contrasting word or phrase: *"But get this:"*, *"Yet"*, *"Except"*, *"Most people blame X, but..."*.
3. **Beat 3 - Contrarian Snapback + Immediate Value Hit:**
   Snap the narrative in the opposite direction while staying on topic (*"If you think X is about Y, it is actually Z"*) and frontload the first hit of value within **4 seconds** for Shorts (or **60 seconds** for long-form). Every claim must be backed in `research.md` (REQ-01).

## 2. Staccato Rhythm & TTS Rules

- **Staccato cadence upfront:** Keep hook clauses short and punchy (4-8 words per clause) to maximize value density per word. Save medium and longer sentences for later scenes.
- **No throat-clearing:** Never open with "Hi guys", "In this video", or "Today we're looking at".
- **TTS-clean formatting:** Spell out all numbers in words inside `narration` ("twelve thousand dollars", not "$12,000") and use natural contractions.

## 3. Visual Hook (`onScreenText` + Opening Motion)

Viewers read faster than they hear. Combine three layers at second zero: spoken word + title text + calibrated visual motion.

- **On-Screen Title (`onScreenText`):** Distill the Context Lean into **3 to 5 bold words** in ALL CAPS, wrapping 1-2 words in `*asterisks*` for the brand accent (e.g., `*FUTURE* OF HOME DESIGN` or `WHY *YOU* PAY FOR AI`). Avoid unfamiliar jargon on screen so a scroller grasps the category in under a second, and do not copy the spoken line verbatim.
- **Calibrated Opening Motion (`visual`):** Give Scene 1 enough motion in the lower two-thirds of the frame to catch the eye (a clear subject action in `aiPrompt`, a map zoom, or a fast counter/widget reveal) without chaotic background clutter or a static portrait.

## 4. Output Format (3 Variations + Audit)

When asked to write or improve a hook for a topic or `projects/<slug>/project.json`, present **3 distinct variations** before locking the choice:

- **Option A (Pain / Benefit Lean):** Leads with what is at stake for the viewer, then snaps back.
- **Option B (Cult-Hop / Familiar Comparison):** Anchors the topic to a household name or everyday analogy, then snaps back.
- **Option C (Hard Stat + Contrarian Twist):** Opens with the most shocking sourced number from `research.md`, then snaps to the hidden reason.

For each option, show:
1. `onScreenText` (3-5 words, ALL CAPS with `*accent*`)
2. `narration` (broken down by `[Context Lean] / [Interjection] / [Snapback]`)
3. `visual` (the concrete opening motion or `aiPrompt`)
