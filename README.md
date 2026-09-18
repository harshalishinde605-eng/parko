# ParKo — Parkinson's Patient Caregiver & Physiotherapy Management System
Production full-stack: Node.js + Express REST API (Render) + PostgreSQL (Neon) + Unified Expo React Native app (Doctor + Caregiver roles).

## Structure
- `backend/` — Express API, Prisma schema (17 tables), JWT + RBAC, PDF reports, alerts engine. See `backend/.env.example`. Health: `GET /api/health`.
- `mobile/` — Expo RN unified app. Role select on launch → Doctor / Caregiver dashboards. API base in `app.json extra.apiUrl`.
- `DEPLOY.md` — Neon + Render + EAS steps + end-to-end test.

## Quick start (dev, same WiFi for phone test)
Backend: `cd backend && npm install && npx prisma generate && npm run dev`
Mobile: `cd mobile && npm install && npx expo start`
