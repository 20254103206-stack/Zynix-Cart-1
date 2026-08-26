# ZYNIX CART — Final Stable Build

## Features
- Fixed 20:9 main and side hero banner frames.
- Admin Panel accessible from the lock icon in the navbar.
- Gmail-only customer registration/login.
- Checkout requires authenticated registration/login.
- Orders are authenticated server-side.
- Local JSON storage works without PostgreSQL.
- Order confirmation email uses Gmail SMTP/App Password when configured.

## Run
1. `npm install`
2. `npm run dev`
3. Open the Vite URL shown in the terminal.

## Admin
Click the lock icon in the navbar. Default local admin password: `Zynix123`. Change it in `server/.env` before deployment.

## Gmail order email
Set `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` in `server/.env`. `SMTP_PASS` must be a Gmail App Password, not the normal Gmail password.

## Persistent hero uploads
Hero/side banner uploads are saved by the Admin Panel to `server/data/store-content.json` in local-storage mode. Do not delete `server/data` after uploading. For production, configure PostgreSQL with `DATABASE_URL`.


## Customer authentication
- New Gmail registration sends a 6-digit verification code before the account is created.
- Forgot password sends a 6-digit recovery code.
- Customer cart, wishlist, and order history are isolated by Gmail account in browser storage and server-side orders are filtered by the authenticated Gmail.
- Google Sign-In is supported through Google Identity Services. Create a Google OAuth Web client ID and put it in the project root `.env` as `VITE_GOOGLE_CLIENT_ID=...` and the same client ID in `server/.env` as `GOOGLE_CLIENT_ID=...`, then restart.
- Orders can be tracked from Account → Orders → Track. Admin status changes can trigger an email update to the customer.
