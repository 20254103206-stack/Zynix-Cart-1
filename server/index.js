import express from "express";
import cors from "cors";
import Stripe from "stripe";
import nodemailer from "nodemailer";
import crypto from "crypto";
import dotenv from "dotenv";
import pg from "pg";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });
// Also allow a root .env if someone prefers that layout.
dotenv.config();

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "40mb" }));

// Serve the built React app from the same public URL as the API.
const CLIENT_DIST_DIR = path.resolve(__dirname, "..", "dist");
app.use(express.static(CLIENT_DIST_DIR));

const { Pool } = pg;
let pool = null;
let databaseAvailable = false;

const DATA_DIR = path.join(__dirname, "data");
const STORE_FILE = path.join(DATA_DIR, "store-content.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const AUTH_CODES_FILE = path.join(DATA_DIR, "auth-codes.json");

async function ensureLocalStorage() {
  await fs.promises.mkdir(DATA_DIR, { recursive: true });
  try { await fs.promises.access(STORE_FILE); } catch { await fs.promises.writeFile(STORE_FILE, "null", "utf8"); }
  try { await fs.promises.access(ORDERS_FILE); } catch { await fs.promises.writeFile(ORDERS_FILE, "[]", "utf8"); }
  try { await fs.promises.access(USERS_FILE); } catch { await fs.promises.writeFile(USERS_FILE, "[]", "utf8"); }
  try { await fs.promises.access(AUTH_CODES_FILE); } catch { await fs.promises.writeFile(AUTH_CODES_FILE, "{}", "utf8"); }
}

async function readJsonFile(file, fallback) {
  try { return JSON.parse(await fs.promises.readFile(file, "utf8")); }
  catch { return fallback; }
}

const AUTH_SECRET = process.env.AUTH_SECRET || "zynix-change-this-secret";
const isGmail = (email) => /^[a-z0-9._%+-]+@gmail\.com$/i.test(String(email || "").trim());
const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const hashPassword = (password, salt = crypto.randomBytes(16).toString("hex")) => ({
  salt,
  hash: crypto.scryptSync(String(password), salt, 64).toString("hex"),
});
const passwordMatches = (password, user) => {
  try {
    const derived = crypto.scryptSync(String(password), user.salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(derived, "hex"), Buffer.from(user.password_hash, "hex"));
  } catch { return false; }
};
const makeAuthToken = (email) => {
  const value = normalizeEmail(email);
  return `${Buffer.from(value).toString("base64url")}.${crypto.createHmac("sha256", AUTH_SECRET).update(value).digest("base64url")}`;
};
const emailFromToken = (token) => {
  try {
    const [encoded, signature] = String(token || "").split(".");
    const email = Buffer.from(encoded, "base64url").toString("utf8");
    const expected = crypto.createHmac("sha256", AUTH_SECRET).update(email).digest("base64url");
    if (!email || !signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    return normalizeEmail(email);
  } catch { return null; }
};


const makeCode = () => String(crypto.randomInt(100000, 1000000));
async function saveAuthCode(email, type) {
  const codes = await readJsonFile(AUTH_CODES_FILE, {});
  const normalized = normalizeEmail(email);
  const code = makeCode();
  codes[`${type}:${normalized}`] = { code, expiresAt: Date.now() + 10 * 60 * 1000 };
  await writeJsonFile(AUTH_CODES_FILE, codes);
  return code;
}
async function consumeAuthCode(email, type, code) {
  const codes = await readJsonFile(AUTH_CODES_FILE, {});
  const key = `${type}:${normalizeEmail(email)}`;
  const record = codes[key];
  if (!record || String(record.code) !== String(code) || Date.now() > Number(record.expiresAt)) return false;
  delete codes[key];
  await writeJsonFile(AUTH_CODES_FILE, codes);
  return true;
}
async function sendSimpleMail({to, subject, html, text}) {
  const transporter = createMailer();
  if (!transporter) throw new Error("SMTP is not configured.");
  await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, html, text });
}
async function sendVerificationEmail(email, code, purpose="registration") {
  const subject = purpose === "registration" ? "ZYNIX CART — Verify your Gmail" : "ZYNIX CART — Password recovery code";
  const title = purpose === "registration" ? "Verify your email" : "Reset your password";
  await sendSimpleMail({ to: email, subject, text: `Your ZYNIX CART code is ${code}. It expires in 10 minutes.`, html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><h2>${title}</h2><p>Your verification code is:</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:18px;background:#f5f5f5;text-align:center">${code}</div><p>This code expires in 10 minutes.</p></div>` });
}

async function findUser(email) {
  const normalized = normalizeEmail(email);
  if (databaseAvailable && pool) {
    const { rows } = await pool.query("SELECT id, name, email, salt, password_hash, created_at FROM users WHERE email=$1", [normalized]);
    return rows[0] || null;
  }
  const users = await readJsonFile(USERS_FILE, []);
  return users.find(u => normalizeEmail(u.email) === normalized) || null;
}

async function createUser({ name, email, password }) {
  const normalized = normalizeEmail(email);
  const { salt, hash } = hashPassword(password);
  const id = `USR-${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`;
  if (databaseAvailable && pool) {
    const { rows } = await pool.query(
      `INSERT INTO users (id,name,email,salt,password_hash) VALUES ($1,$2,$3,$4,$5) RETURNING id,name,email,created_at`,
      [id, String(name).trim(), normalized, salt, hash]
    );
    return rows[0];
  }
  const users = await readJsonFile(USERS_FILE, []);
  const user = { id, name: String(name).trim(), email: normalized, salt, password_hash: hash, verified: true, created_at: new Date().toISOString() };
  users.unshift(user);
  await writeJsonFile(USERS_FILE, users);
  return user;
}

async function getAuthUser(req) {
  const email = emailFromToken(req.headers.authorization?.replace(/^Bearer\s+/i, ""));
  if (!email) return null;
  return findUser(email);
}

const requireAuth = async (req, res, next) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Please register or log in with your Gmail account before ordering." });
    req.user = user;
    next();
  } catch (e) { res.status(500).json({ error: e.message }); }
};

function createMailer() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
  const user = String(process.env.SMTP_USER || "").trim();
  // Google displays App Passwords in groups of four characters; spaces are not part of the password.
  const pass = String(process.env.SMTP_PASS || "").replace(/\s+/g, "");
  if (!user || !pass || pass.includes("PASTE_NEW_GOOGLE_APP_PASSWORD")) return null;
  return nodemailer.createTransport({
    host, port, secure,
    auth: { user, pass },
    tls: { minVersion: "TLSv1.2" },
  });
}

async function verifySmtpOnStartup() {
  const transporter = createMailer();
  if (!transporter) {
    console.warn("SMTP not configured: set SMTP_USER and SMTP_PASS in server/.env");
    return false;
  }
  try {
    await transporter.verify();
    console.log(`SMTP verified for ${process.env.SMTP_USER}`);
    return true;
  } catch (e) {
    console.error(`SMTP verification failed: ${e?.message || e}`);
    return false;
  }
}

async function sendOrderEmail(order) {
  const transporter = createMailer();
  if (!transporter || !order.customer?.email) return { sent: false, reason: "SMTP is not configured." };
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const currency = "৳";
  const itemsHtml = (order.items || []).map(item =>
    `<tr><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(item.name)}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${item.quantity}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${currency}${Number(item.price).toFixed(2)}</td></tr>`
  ).join("");
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:650px;margin:auto;color:#111">
    <h2 style="margin-bottom:4px">ZYNIX CART — Order Confirmed</h2>
    <p>Hi ${escapeHtml(order.customer.name)}, thank you for your order.</p>
    <p><b>Order ID:</b> ${escapeHtml(order.id)}</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0">
      <thead><tr><th style="text-align:left;padding:8px;border-bottom:2px solid #111">Product</th><th style="padding:8px;border-bottom:2px solid #111">Qty</th><th style="text-align:right;padding:8px;border-bottom:2px solid #111">Price</th></tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <p style="font-size:18px"><b>Total: ${currency}${Number(order.total).toFixed(2)}</b></p>
    <p><b>Payment:</b> ${escapeHtml(order.payment)}</p>
    <p><b>Delivery:</b> ${escapeHtml(order.customer.address)}, ${escapeHtml(order.customer.city || "")}</p>
    <p>We have received your order and will process it shortly.</p>
  </div>`;
  await transporter.sendMail({
    from, to: order.customer.email,
    subject: `ZYNIX CART Order Confirmation — ${order.id}`,
    html,
  });
  return { sent: true };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[c]));
}

async function writeJsonFile(file, value) {
  const tmp = `${file}.tmp`;
  await fs.promises.writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
  await fs.promises.rename(tmp, file);
}

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 1500,
  });
  pool.on("error", (err) => console.error("PostgreSQL pool error:", err.message));
}

async function ensureDatabase() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS store_content (
      id INTEGER PRIMARY KEY DEFAULT 1,
      content JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      customer JSONB NOT NULL,
      items JSONB NOT NULL,
      total NUMERIC(12,2) NOT NULL,
      payment TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending'
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  databaseAvailable = true;
}

const requireAdmin = (req, res, next) => {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return res.status(503).json({ error: "ADMIN_PASSWORD is not configured on the server. Put it in server/.env and restart the server." });
  const provided = req.headers["x-admin-password"];
  if (provided !== expected) return res.status(401).json({ error: "Invalid admin password." });
  next();
};

app.post("/api/auth/register", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    if (!name || name.length < 2) return res.status(400).json({ error: "Please enter your name." });
    if (!isGmail(email)) return res.status(400).json({ error: "Only Gmail addresses (@gmail.com) can be used for registration." });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
    if (await findUser(email)) return res.status(409).json({ error: "This Gmail is already registered. Please log in or use Forgot password." });
    const pending = await readJsonFile(AUTH_CODES_FILE, {});
    const { salt, hash } = hashPassword(password);
    const id = `USR-${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`;
    pending[`pending:${email}`] = { id, name, email, salt, password_hash: hash, expiresAt: Date.now() + 15 * 60 * 1000 };
    const code = makeCode();
    pending[`registration:${email}`] = { code, expiresAt: Date.now() + 10 * 60 * 1000 };
    await writeJsonFile(AUTH_CODES_FILE, pending);
    await sendVerificationEmail(email, code, "registration");
    res.json({ ok: true, verificationRequired: true, email });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/auth/verify-registration", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email); const code = String(req.body?.code || "");
    if (!isGmail(email) || !(await consumeAuthCode(email, "registration", code))) return res.status(400).json({ error: "Invalid or expired verification code." });
    const codes = await readJsonFile(AUTH_CODES_FILE, {}); const pending = codes[`pending:${email}`];
    if (!pending || Date.now() > Number(pending.expiresAt)) return res.status(400).json({ error: "Registration session expired. Please register again." });
    delete codes[`pending:${email}`]; await writeJsonFile(AUTH_CODES_FILE, codes);
    const user = await createUser({ name: pending.name, email, password: "__TEMP__" });
    // Replace generated password hash with the already-created hash so the password is never stored in plaintext.
    if (databaseAvailable && pool) await pool.query("UPDATE users SET salt=$1,password_hash=$2 WHERE email=$3", [pending.salt, pending.password_hash, email]);
    else { const users=await readJsonFile(USERS_FILE,[]); const u=users.find(x=>normalizeEmail(x.email)===email); if(u){u.salt=pending.salt;u.password_hash=pending.password_hash;u.verified=true;} await writeJsonFile(USERS_FILE,users); }
    res.json({ ok:true, token:makeAuthToken(email), user:{id:user.id,name:user.name,email:user.email} });
  } catch(e){ res.status(500).json({error:e.message}); }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email); const password = String(req.body?.password || "");
    if (!isGmail(email)) return res.status(400).json({ error: "Please use a Gmail address." });
    const user = await findUser(email);
    if (!user || (user.verified === false) || !passwordMatches(password, user)) return res.status(401).json({ error: "Invalid Gmail or password." });
    res.json({ ok: true, token: makeAuthToken(user.email), user: { id:user.id,name:user.name,email:user.email } });
  } catch(e){ res.status(500).json({error:e.message}); }
});

app.post("/api/auth/forgot-password", async (req,res)=>{
  try{
    const email=normalizeEmail(req.body?.email); if(!isGmail(email)) return res.status(400).json({error:"Please use a Gmail address."});
    const user=await findUser(email); if(!user) return res.status(404).json({error:"No account was found for this Gmail."});
    const code=await saveAuthCode(email,"recovery"); await sendVerificationEmail(email,code,"recovery");
    res.json({ok:true,recoveryRequired:true,email});
  }catch(e){res.status(500).json({error:e.message});}
});

app.post("/api/auth/reset-password", async (req,res)=>{
  try{
    const email=normalizeEmail(req.body?.email), code=String(req.body?.code||""), password=String(req.body?.password||"");
    if(!isGmail(email)||password.length<6) return res.status(400).json({error:"Use a valid Gmail and a password of at least 6 characters."});
    if(!(await consumeAuthCode(email,"recovery",code))) return res.status(400).json({error:"Invalid or expired recovery code."});
    const {salt,hash}=hashPassword(password);
    if(databaseAvailable&&pool) await pool.query("UPDATE users SET salt=$1,password_hash=$2,verified=true WHERE email=$3",[salt,hash,email]);
    else {const users=await readJsonFile(USERS_FILE,[]); const u=users.find(x=>normalizeEmail(x.email)===email); if(!u)return res.status(404).json({error:"Account not found."}); u.salt=salt;u.password_hash=hash;u.verified=true;await writeJsonFile(USERS_FILE,users);}
    res.json({ok:true,token:makeAuthToken(email)});
  }catch(e){res.status(500).json({error:e.message});}
});

app.post("/api/auth/google", async (req,res)=>{
  try{
    const credential=String(req.body?.credential||""); if(!credential) return res.status(400).json({error:"Google credential is missing."});
    const r=await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`); const info=await r.json();
    if(!r.ok || info.aud!==process.env.GOOGLE_CLIENT_ID || info.email_verified!=="true" || !isGmail(info.email)) return res.status(401).json({error:"Google sign-in could not be verified. Check GOOGLE_CLIENT_ID in server/.env."});
    const email=normalizeEmail(info.email); let user=await findUser(email);
    if(!user){
      const {salt,hash}=hashPassword(crypto.randomBytes(24).toString("hex")); const id=`USR-${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`; const name=String(info.name||email.split("@")[0]).trim();
      if(databaseAvailable&&pool){const q=await pool.query(`INSERT INTO users (id,name,email,salt,password_hash) VALUES ($1,$2,$3,$4,$5) RETURNING id,name,email,created_at`,[id,name,email,salt,hash]);user=q.rows[0];}
      else {const users=await readJsonFile(USERS_FILE,[]); user={id,name,email,salt,password_hash:hash,verified:true,created_at:new Date().toISOString()}; users.unshift(user); await writeJsonFile(USERS_FILE,users);}
    }
    res.json({ok:true,token:makeAuthToken(email),user:{id:user.id,name:user.name,email:user.email}});
  }catch(e){res.status(500).json({error:e.message});}
});

app.get("/api/auth/me", async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: "Not logged in." });
    res.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/health", async (_, res) => {
  try {
    if (!pool) return res.json({ ok: true, database: false, service: "ZYNIX CART API" });
    await pool.query("SELECT 1");
    res.json({ ok: true, database: true, service: "ZYNIX CART API" });
  } catch (e) {
    res.status(503).json({ ok: false, database: false, error: e.message });
  }
});

app.post("/api/smtp-test", async (req, res) => {
  const to = normalizeEmail(req.body?.to || process.env.SMTP_USER);
  if (!isGmail(to)) return res.status(400).json({ error: "Please provide a Gmail address in the 'to' field." });
  const transporter = createMailer();
  if (!transporter) return res.status(503).json({ error: "SMTP is not configured." });
  try {
    await transporter.verify();
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: "ZYNIX CART SMTP Test",
      text: "Your ZYNIX CART Gmail SMTP configuration is working."
    });
    res.json({ ok: true, sent: true, to });
  } catch (e) {
    console.error("SMTP test failed:", e?.message || e);
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});


app.post("/api/admin/login", (req, res) => {
  const password = String(req.body?.password || "");
  if (!process.env.ADMIN_PASSWORD) return res.status(503).json({ error: "ADMIN_PASSWORD is not configured on the server. Put it in server/.env and restart the server." });
  if (password !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: "Incorrect admin password." });
  res.json({ ok: true });
});



app.get("/api/store-content", async (_, res) => {
  try {
    if (databaseAvailable && pool) {
      const { rows } = await pool.query("SELECT content FROM store_content WHERE id=1");
      return res.json({ content: rows[0]?.content || null, storage: "postgres" });
    }
    const content = await readJsonFile(STORE_FILE, null);
    res.json({ content, storage: "local" });
  } catch (e) {
    // If PostgreSQL becomes unavailable after startup, transparently fall back to local storage.
    const content = await readJsonFile(STORE_FILE, null);
    res.json({ content, storage: "local-fallback", warning: e.message });
  }
});

app.put("/api/store-content", requireAdmin, async (req, res) => {
  const content = req.body?.content;
  if (!content || !Array.isArray(content.products) || !Array.isArray(content.sections) || !Array.isArray(content.heroBanners) || !Array.isArray(content.sideBanners)) {
    return res.status(400).json({ error: "Invalid store content." });
  }
  try {
    if (databaseAvailable && pool) {
      await pool.query(`
        INSERT INTO store_content (id, content, updated_at) VALUES (1, $1, NOW())
        ON CONFLICT (id) DO UPDATE SET content=$1, updated_at=NOW()
      `, [JSON.stringify(content)]);
    } else {
      await writeJsonFile(STORE_FILE, content);
    }
    res.json({ ok: true, content });
  } catch (e) {
    // PostgreSQL may fail while the site is running; keep CMS changes persistent locally.
    try {
      await writeJsonFile(STORE_FILE, content);
      res.json({ ok: true, content, storage: "local-fallback" });
    } catch (localError) {
      res.status(500).json({ error: `${e.message}; local fallback failed: ${localError.message}` });
    }
  }
});

app.get("/api/my-orders", requireAuth, async (req,res)=>{
  try{
    if(databaseAvailable&&pool){const {rows}=await pool.query("SELECT id,created_at,customer,items,total,payment,status FROM orders WHERE customer->>'email'=$1 ORDER BY created_at DESC",[req.user.email]);return res.json(rows);}
    const orders=await readJsonFile(ORDERS_FILE,[]); res.json(orders.filter(o=>normalizeEmail(o.customer?.email)===normalizeEmail(req.user.email)));
  }catch(e){res.status(500).json({error:e.message});}
});

app.get("/api/orders/:id", requireAuth, async (req,res)=>{
  try{
    let order=null;
    if(databaseAvailable&&pool){const {rows}=await pool.query("SELECT id,created_at,customer,items,total,payment,status FROM orders WHERE id=$1",[req.params.id]);order=rows[0];}
    else {const orders=await readJsonFile(ORDERS_FILE,[]);order=orders.find(o=>String(o.id)===String(req.params.id));}
    if(!order)return res.status(404).json({error:"Order not found."});
    if(normalizeEmail(order.customer?.email)!==normalizeEmail(req.user.email))return res.status(403).json({error:"You can only track your own orders."});
    res.json(order);
  }catch(e){res.status(500).json({error:e.message});}
});

app.get("/api/orders", requireAdmin, async (_, res) => {
  try {
    if (databaseAvailable && pool) {
      const { rows } = await pool.query("SELECT id, created_at, customer, items, total, payment, status FROM orders ORDER BY created_at DESC");
      return res.json(rows);
    }
    const orders = await readJsonFile(ORDERS_FILE, []);
    res.json(orders);
  } catch (e) {
    const orders = await readJsonFile(ORDERS_FILE, []);
    res.json(orders);
  }
});

const calculateCouponDiscount = (product, quantity, code) => {
  if (!product?.couponEnabled || !code) return 0;
  const entered=String(code).trim().toUpperCase();
  const actual=String(product.couponCode||"").trim().toUpperCase();
  if (!actual || entered!==actual) return 0;
  const line=Number(product.price||0)*Number(quantity||0);
  const value=Math.max(0,Number(product.couponValue||0));
  return product.couponType==="fixed" ? Math.min(line,value*Number(quantity||0)) : Math.min(line,line*Math.min(100,value)/100);
};

app.post("/api/orders", requireAuth, async (req, res) => {
  const { id, customer, items, payment, couponCode } = req.body || {};
  const authenticatedCustomer = {
    ...(customer || {}),
    name: req.user.name,
    email: req.user.email,
  };
  if (!id || !authenticatedCustomer.name || !authenticatedCustomer.email || !authenticatedCustomer.phone || !authenticatedCustomer.address || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: "Incomplete order details." });
  }

  if (!databaseAvailable || !pool) {
    try {
      const content = await readJsonFile(STORE_FILE, null);
      if (!content) return res.status(409).json({ error: "Store inventory is not initialized yet. Save your products from the Admin Panel first." });
      const products = Array.isArray(content.products) ? content.products.map(p => ({ ...p })) : [];
      const normalizedItems = items.map(item => ({ ...item, quantity: Math.floor(Number(item.quantity)) }));
      if (normalizedItems.some(item => !item.id || !Number.isInteger(item.quantity) || item.quantity <= 0)) return res.status(400).json({ error: "Invalid product quantity." });
      let orderTotal = 0;
      let discountTotal = 0;
      for (const item of normalizedItems) {
        const product = products.find(p => String(p.id) === String(item.id));
        if (!product) return res.status(409).json({ error: `Product "${item.name || item.id}" is no longer available.` });
        const stock = Math.max(0, Math.floor(Number(product.stock) || 0));
        if (item.quantity > stock) return res.status(409).json({ error: `${product.name} has only ${stock} item(s) left in stock.` });
        product.stock = stock - item.quantity;
        const lineTotal = Number(product.price) * item.quantity;
        const itemDiscount = calculateCouponDiscount(product, item.quantity, couponCode);
        discountTotal += itemDiscount;
        orderTotal += lineTotal - itemDiscount;
      }
      const orderItems = normalizedItems.map(item => {
        const product = products.find(p => String(p.id) === String(item.id));
        return { id: product.id, name: product.name, price: Number(product.price) || 0, image: product.image, quantity: item.quantity };
      });
      const nextContent = { ...content, products };
      await writeJsonFile(STORE_FILE, nextContent);
      const existingOrders = await readJsonFile(ORDERS_FILE, []);
      const newOrder = { id, created_at: new Date().toISOString(), customer: authenticatedCustomer, items: orderItems, total: orderTotal, couponCode: couponCode || "", discount: discountTotal, payment: payment || "Cash on Delivery", status: "Pending" };
      await writeJsonFile(ORDERS_FILE, [newOrder, ...existingOrders]);
      const emailResult = await sendOrderEmail({ id, customer: authenticatedCustomer, items: orderItems, total: orderTotal, payment: payment || "Cash on Delivery" }).catch(e => ({ sent: false, reason: e.message }));
      return res.status(201).json({ ok: true, id, total: orderTotal, discount: discountTotal, couponCode: couponCode || "", content: nextContent, emailSent: emailResult.sent, emailError: emailResult.sent ? undefined : emailResult.reason });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lock the store row so two simultaneous orders cannot oversell the same stock.
    const storeResult = await client.query("SELECT content FROM store_content WHERE id=1 FOR UPDATE");
    if (!storeResult.rows[0]?.content) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Store inventory is not initialized yet. Save your products from the Admin Panel first." });
    }

    const content = storeResult.rows[0].content;
    const products = Array.isArray(content.products) ? content.products : [];
    const normalizedItems = items.map(item => ({
      ...item,
      quantity: Math.floor(Number(item.quantity)),
    }));

    if (normalizedItems.some(item => !item.id || !Number.isInteger(item.quantity) || item.quantity <= 0)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Invalid product quantity." });
    }

    const productMap = new Map(products.map(product => [String(product.id), product]));
    const nextProducts = products.map(product => ({ ...product }));
    let orderTotal = 0;
    let discountTotal = 0;

    for (const item of normalizedItems) {
      const product = productMap.get(String(item.id));
      if (!product) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: `Product "${item.name || item.id}" is no longer available.` });
      }

      const stock = Number.isFinite(Number(product.stock))
        ? Math.max(0, Math.floor(Number(product.stock)))
        : 0;

      if (item.quantity > stock) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: `${product.name} has only ${stock} item(s) left in stock.` });
      }

      const next = nextProducts.find(p => String(p.id) === String(product.id));
      next.stock = stock - item.quantity;
      const lineTotal = Number(product.price) * item.quantity;
      const itemDiscount = calculateCouponDiscount(product, item.quantity, couponCode);
      discountTotal += itemDiscount;
      orderTotal += lineTotal - itemDiscount;
    }

    // Store only the validated product snapshot and quantity in the order.
    const orderItems = normalizedItems.map(item => {
      const product = productMap.get(String(item.id));
      return {
        id: product.id,
        name: product.name,
        price: Number(product.price) || 0,
        image: product.image,
        quantity: item.quantity,
      };
    });

    const nextContent = { ...content, products: nextProducts };
    await client.query(
      `UPDATE store_content SET content=$1, updated_at=NOW() WHERE id=1`,
      [JSON.stringify(nextContent)]
    );

    await client.query(
      `INSERT INTO orders (id, customer, items, total, payment) VALUES ($1,$2,$3,$4,$5)`,
      [id, JSON.stringify(authenticatedCustomer), JSON.stringify(orderItems), orderTotal, payment || "Cash on Delivery"]
    );

    await client.query("COMMIT");
    const emailResult = await sendOrderEmail({ id, customer: authenticatedCustomer, items: orderItems, total: orderTotal, payment: payment || "Cash on Delivery" }).catch(e => ({ sent: false, reason: e.message }));
    res.status(201).json({ ok: true, id, total: orderTotal, discount: discountTotal, couponCode: couponCode || "", content: nextContent, emailSent: emailResult.sent, emailError: emailResult.sent ? undefined : emailResult.reason });
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch {}
    if (e?.code === "23505") return res.status(409).json({ error: "This order ID already exists. Please try again." });
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

app.patch("/api/orders/:id/status", requireAdmin, async (req, res) => {
  const allowed = ["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"];
  const status = String(req.body?.status || "");
  if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid status." });
  try {
    if (databaseAvailable && pool) {
      const { rowCount } = await pool.query("UPDATE orders SET status=$1 WHERE id=$2", [status, req.params.id]);
      if (!rowCount) return res.status(404).json({ error: "Order not found." });
    } else {
      const orders = await readJsonFile(ORDERS_FILE, []);
      const index = orders.findIndex(o => String(o.id) === String(req.params.id));
      if (index < 0) return res.status(404).json({ error: "Order not found." });
      orders[index].status = status;
      await writeJsonFile(ORDERS_FILE, orders);
    }
    try {
      let updated=null;
      if(databaseAvailable&&pool){const {rows}=await pool.query("SELECT id,customer,items,total,payment,status FROM orders WHERE id=$1",[req.params.id]);updated=rows[0];}
      else {const all=await readJsonFile(ORDERS_FILE,[]);updated=all.find(o=>String(o.id)===String(req.params.id));}
      if(updated?.customer?.email){await sendSimpleMail({to:updated.customer.email,subject:`ZYNIX CART — Order ${updated.id} update`,text:`Your order ${updated.id} status is now ${status}. Track it from your ZYNIX CART account.`,html:`<div style="font-family:Arial,sans-serif"><h2>Order status updated</h2><p><b>Order:</b> ${escapeHtml(updated.id)}</p><p><b>Status:</b> ${escapeHtml(status)}</p><p>Log in to ZYNIX CART to track your parcel.</p></div>`}).catch(e=>console.warn("Status email failed:",e.message));}
    } catch {}
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/create-checkout-session", async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({error:"Stripe is not configured. Add STRIPE_SECRET_KEY to server/.env."});
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const {items,customer} = req.body;
    const session = await stripe.checkout.sessions.create({
      mode:"payment",
      line_items:(items||[]).map(i=>({price_data:{currency:"usd",product_data:{name:i.name,images:[]},unit_amount:Math.round(Number(i.price)*100)},quantity:i.quantity})),
      customer_email:customer?.email||undefined,
      success_url:`${process.env.CLIENT_URL||"http://localhost:5173"}/?payment=success`,
      cancel_url:`${process.env.CLIENT_URL||"http://localhost:5173"}/?payment=cancelled`
    });
    res.json({url:session.url});
  } catch(e) { res.status(400).json({error:e.message}); }
});

// SPA fallback: let React handle client-side routes after all API routes.
app.get(/^(?!\/api(?:\/|$)).*/, (req, res) => {
  res.sendFile(path.join(CLIENT_DIST_DIR, "index.html"));
});

const port = process.env.PORT || 4242;

// Keep the API process alive even if SMTP or PostgreSQL is unavailable.
process.on("uncaughtException", (err) => console.error("Uncaught server error:", err));
process.on("unhandledRejection", (err) => console.error("Unhandled server rejection:", err));

async function startServer() {
  await ensureLocalStorage();
  try {
    await ensureDatabase();
  } catch (e) {
    console.error("Database initialization failed:", e.message);
    databaseAvailable = false;
    if (pool) { try { await pool.end(); } catch {} }
    pool = null;
  }

  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`ZYNIX API running on http://0.0.0.0:${port} (${databaseAvailable ? "PostgreSQL" : "local storage"})`);
  });

  server.on("error", (err) => {
    console.error("ZYNIX API server error:", err.message);
  });

  // Keep this Node process alive explicitly. This prevents the dev runner
  // from treating a completed async startup callback as the end of the API.
  await verifySmtpOnStartup();
  await new Promise((resolve) => server.on("close", resolve));
}

startServer().catch((e) => {
  console.error("Fatal server startup error:", e);
  // Do not call process.exit(); keep the process available so the dev runner can show the error.
});
