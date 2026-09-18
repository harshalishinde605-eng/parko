# PARKO — Production Deployment

## 1. Database (Neon PostgreSQL)
1. Create project at neon.tech → copy `DATABASE_URL` (pooled, `?sslmode=require`).
2. Enable automated backups / PITR.
3. Never expose DB publicly; only Render connects.

## 2. Backend (Render)
1. Push `backend/` to GitHub.
2. Render → New Web Service → Docker → select repo.
3. Set env vars: `DATABASE_URL, DIRECT_URL, JWT_SECRET, JWT_REFRESH_SECRET, CORS_ORIGIN=https://expo.dev, NODE_ENV=production, PORT=4000`.
4. Health check: `/api/health` must return `{status:ok, environment:production}`.
5. Deploy → migrations run automatically via Dockerfile CMD.
6. Test: `https://<your-api>.onrender.com/api/health`

## 3. Mobile (Expo EAS)
1. `cd mobile && npm install && npx expo start` (dev).
2. Set `extra.apiUrl` in app.json to Render URL.
3. `eas build -p android --profile production` → APK for caregiver phones; same app for doctors (role select).
4. OTA: `eas update --channel production`.

## 4. End-to-end test (must pass)
Caregiver phone login → POST /api/exercise-logs → Neon → Doctor phone GET /api/patients/:id/exercise-history → visible <5s → PDF GET /api/reports/:id/pdf.
