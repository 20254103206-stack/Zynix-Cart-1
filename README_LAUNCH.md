# ZYNIX CART - Free Launch

This package is configured for a single Render Web Service.

Render settings:
- Root Directory: ZYNIX_CART_FREE_LAUNCH_READY
- Build Command: npm install && npm run build
- Start Command: node server/index.js
- Environment: Node

Required environment variables:
- ADMIN_PASSWORD
- AUTH_SECRET
- CLIENT_URL (set to the Render service URL after deployment)
- DATABASE_URL (recommended for persistent orders)
- DATABASE_SSL=true when using Neon/Postgres with SSL

Do not upload server/.env or any secret credentials to GitHub.
