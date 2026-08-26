ZYNIX CART - ADMIN ACCESS

Customer website:
http://localhost:5173/

Admin login (hidden from customer navbar):
http://localhost:5173/admin

Alternative:
http://localhost:5173/admin/login

Default local admin password:
Zynix123

How to login:
1. Run: npm install
2. Run: npm run dev
3. Open http://localhost:5173/admin
4. Enter: Zynix123
5. Click LOGIN

The customer-facing navbar does NOT show an Admin button.
To change the admin password, edit server/.env:
ADMIN_PASSWORD=your-new-password
Then restart the server.

For production, change ADMIN_PASSWORD and AUTH_SECRET before launch.
