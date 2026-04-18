# AGENTS.md

## Project
Lingua is an accuracy-first language learning platform.

## Core rules
- Never invent meanings, readings, translations, or grammar facts.
- Vocabulary and Sentence are the trusted truth layers.
- Transcript/content data is not truth by default.
- Only update UserProgress from trusted Vocabulary or Sentence anchors.
- Keep recommendation logic deterministic and explainable.
- Prefer minimal, targeted changes over broad refactors.
- Do not change UX wording toward developer terminology unless explicitly asked.

## Setup commands
- Server install: `cd server && npm install`
- Client install: `cd client && npm install`
- Start server: `cd server && npm run dev`
- Start client: `cd client && npm run dev`
- Build client: `cd client && npm run build`
- Seed system data: `cd server && npm run seed:system`
- Presets only: `cd server && npm run seed:presets`
- Starter content only: `cd server && npm run seed:starter-content`

## Architecture reminders
- Truth layer: Vocabulary, Sentence
- Study layer: Flashcards, QuizItem, StudySession, UserProgress
- Content layer: LearningContent, TranscriptSegment
- Presets are DB-backed global config, not truth
- Content study and quiz outcomes should only affect progress when anchored to trusted Vocabulary/Sentence records

## Workflow
- For big changes: first propose a short plan, then implement.
- After changes: run relevant checks and summarize modified files.
- Preserve existing working loops unless the task explicitly changes them.
