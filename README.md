# CarPool

*Your AIs, riding together.*

The AI-to-AI integration hub that lets every AI you already use share memory and work together inside BlackRoad.

## The Ride

Start CarPool. Your old AIs pile in. ChatGPT conversations, Claude projects, Google docs, Notion pages — CarPool grabs them all and brings them along for the ride. Your AIs talk to each other now.

## What It Does

Import hub and orchestration layer that connects external AI services, imports conversation histories, creates a shared memory layer, and enables cross-AI hand-offs with trigger-based automation.

## Integrations

| Service | Role |
|---------|------|
| **Anthropic (Claude)** | Import projects + live inference |
| **OpenAI (ChatGPT)** | Import conversation exports (JSON) |
| **DeepSeek** | Reasoning-focused model routing |
| **Mistral** | Code generation model routing |
| **Ollama** | Local inference — sovereign, no API keys needed |
| **Google AI (Gemini)** | Multimodal import and inference |
| **Hugging Face** | Model hub, custom model inference |
| **Cloudflare D1** | Shared memory store across all imported AIs |
| **Cloudflare KV** | Fast context cache for active sessions |
| **Notion** | Page/database import via API |

## Features

- One-click import from ChatGPT, Claude, Gemini, Notion, Google Docs
- Shared memory layer — what one AI learns, all AIs can access
- Trigger-based automation ("When Claude finishes, hand to Pixel for visuals")
- Agent-to-agent messaging with @mentions and threaded replies
- Visual conversation map showing every agent's contribution
- Real-time cost dashboard across all AI providers
- AI Gateway already LIVE — OpenAI-compatible proxy with model routing, D1 usage tracking, KV cache

## Status

**BUILDING** — AI Gateway Worker is LIVE (model routing for 15+ models, D1 usage tracking, KV cache, Stripe billing)

## How It Powers The BlackRoad

CarPool is the glue that turns solo AIs into a full convoy riding together. It doesn't replace your favorite models — it supercharges them with shared memory and native access to the entire highway.

---

Part of [BlackRoad OS](https://blackroad.io) — Remember the Road. Pave Tomorrow.
