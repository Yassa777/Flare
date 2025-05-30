# Flare — Real-Time Brand Intel for Sales Teams

Flare is a real-time monitoring platform that scans the internet for mentions of your brand, competitors, and custom keywords. It filters noise, analyzes sentiment, and delivers only high-signal leads to your sales team in a live dashboard — like Google Alerts, weaponized for outbound.

---

## 🚀 Features

- ✅ **Real-time ingestion** from NewsAPI + Reddit (extensible to any RSS or social platform)
- 🧠 **Sentiment analysis** using HuggingFace transformers
- 🧹 **Noise filtering** to reduce spam and irrelevant content
- 🖥️ **Live dashboard** built with Next.js, Supabase Realtime, Tailwind, shadcn/ui
- ⚡ **One-click lead capture** with notes and filtering by sentiment/source/keyword
- 🪝 **Optional Slack alerts** for high-priority events

---

## 🧱 Tech Stack

| Layer | Tool |
|-------|------|
| Frontend | Next.js 14 (App Router), Tailwind CSS, shadcn/ui, React Query |
| Backend | Supabase Postgres, Supabase Realtime, Supabase Auth |
| Ingestion | Cloudflare Workers (or Vercel Edge Functions) |
| Queue | Upstash Redis Streams (serverless Kafka-lite) |
| NLP | Python + FastAPI + HuggingFace Transformers |
| Dev | Turborepo (monorepo), Vercel (FE+edge), Railway (worker) |

---

## 🛠️ Getting Started

### 1. Clone the repo
```bash
git clone https://github.com/your-org/anora.git
cd anora
pnpm install
