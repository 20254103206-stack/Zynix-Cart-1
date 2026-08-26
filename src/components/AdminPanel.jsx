import { useMemo, useState } from "react";

const API_BASE = "";
const DEFAULT_FEATURES = [
  { icon: "truck", title: "Fast Delivery", text: "Quick and reliable delivery right to your doorstep." },
  { icon: "shield", title: "Warranty", text: "Shop with confidence with our product warranty." },
  { icon: "card", title: "Secure Payment", text: "Checkout is designed for secure order processing." },
  { icon: "headset", title: "24/7 Support", text: "We're always here when you need assistance." },
];
const DEFAULT_CATEGORIES = [
  { title: "Fans", text: "See every fan item", collection: "Fans", image: "/src/asset/fan.png" },
  { title: "Smart Lamps", text: "See every lamp item", collection: "Smart Lamps", image: "/src/asset/lamp.png" },
  { title: "Humidifiers", text: "See every humidifier item", collection: "Humidifiers", image: "/src/asset/humidifier.png" },
  { title: "Smart Watches", text: "See every watch item", collection: "Smart Watches", image: "/src/asset/smartwatch.png" },
];
const blankProduct = { name: "", collection: "New Collection", category: "HOME GADGETS", price: "", stock: 10, description: "", image: "", demoImages: [], couponEnabled: false, couponCode: "", couponType: "percent", couponValue: 0 };
const blankSection = { title: "", subtitle: "", productIds: [] };
const blankBanner = { title: "", image: "", tone: "silver", target: "" };
const blankPromo = { title: "", image: "", target: "", placement: "footer", showButton: true, animatedButton: true, buttonText: "SHOP NOW" };

function AdminPanel({ store, onStoreChange, onClose }) {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("dashboard");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState("All");
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState(blankProduct);
  const [productMsg, setProductMsg] = useState("");
  const [editingSection, setEditingSection] = useState(null);
  const [sectionForm, setSectionForm] = useState(blankSection);
  const [sectionMsg, setSectionMsg] = useState("");
  const [editingBanner, setEditingBanner] = useState(null);
  const [bannerForm, setBannerForm] = useState(blankBanner);
  const [bannerMsg, setBannerMsg] = useState("");
  const [editingSideBanner, setEditingSideBanner] = useState(null);
  const [sideBannerForm, setSideBannerForm] = useState(blankBanner);
  const [sideBannerMsg, setSideBannerMsg] = useState("");
  const [editingPromo, setEditingPromo] = useState(null);
  const [promoForm, setPromoForm] = useState(blankPromo);
  const [promoMsg, setPromoMsg] = useState("");
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryMsg, setInventoryMsg] = useState("");
  const [couponMsg, setCouponMsg] = useState("");
  const [siteForm, setSiteForm] = useState(() => makeSiteForm(store?.settings || {}));

  const products = store.products || [];
  const sections = store.sections || [];
  const heroBanners = store.heroBanners || [];
  const sideBanners = store.sideBanners || [];
  const promoBanners = store.promoBanners || [];
  const settings = store.settings || {};
  const collections = useMemo(() => [...new Set(products.map(p => p.collection).filter(Boolean))], [products]);
  const activeCoupons = products.filter(p => p.couponEnabled && String(p.couponCode || "").trim()).length;
  const lowStock = products.filter(p => Number(p.stock) <= 5);
  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const pendingOrders = orders.filter(o => !["Delivered", "Cancelled"].includes(o.status)).length;
  const filteredOrders = orders.filter(o => {
    const hay = `${o.id} ${o.customer?.name || ""} ${o.customer?.email || ""} ${o.customer?.phone || ""}`.toLowerCase();
    return (orderFilter === "All" || o.status === orderFilter) && hay.includes(orderSearch.toLowerCase());
  });
  const filteredInventory = products.filter(p => `${p.name} ${p.collection} ${p.category}`.toLowerCase().includes(inventorySearch.toLowerCase()));

  function makeSiteForm(s) {
    return {
      featureHeading: s.featureHeading || "Built For Better Living",
      featureSubtitle: s.featureSubtitle || "Everything you need for a smarter and better lifestyle.",
      categoryHeading: s.categoryHeading || "Featured Categories",
      categorySubtitle: s.categorySubtitle || "Choose a category and ZYNIX will show every item from that collection.",
      offerTitle: s.offerTitle || "Smart tech, better everyday.",
      offerSubtitle: s.offerSubtitle || "Upgrade your space with useful gadgets designed for modern living.",
      footerTagline: s.footerTagline || "Smart gadgets for modern living.",
      features: Array.isArray(s.features) && s.features.length ? s.features : DEFAULT_FEATURES,
      categories: Array.isArray(s.categories) && s.categories.length ? s.categories : DEFAULT_CATEGORIES,
      accent: s.accent || "#9b6cff",
      glow: s.glow || "medium",
    };
  }

  async function login(e) {
    e.preventDefault(); setError("");
    try {
      const r = await fetch(`${API_BASE}/api/admin/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const d = await r.json(); if (!r.ok) throw Error(d.error || "Login failed");
      setAuthed(true); await loadOrders(password);
    } catch (e) { setError(e.message); }
  }

  async function loadOrders(pass = password) {
    setLoading(true); setError("");
    try {
      const r = await fetch(`${API_BASE}/api/orders`, { headers: { "x-admin-password": pass } });
      const d = await r.json(); if (!r.ok) throw Error(d.error || "Could not load orders"); setOrders(Array.isArray(d) ? d : []);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }

  async function persist(next) {
    try {
      const r = await fetch(`${API_BASE}/api/store-content`, { method: "PUT", headers: { "Content-Type": "application/json", "x-admin-password": password }, body: JSON.stringify({ content: next }) });
      const d = await r.json(); if (!r.ok) throw Error(d.error || `Could not save (${r.status})`);
      onStoreChange(d.content || next); return true;
    } catch (e) { setError(`Save failed: ${e.message}`); return false; }
  }

  const readFile = file => new Promise(resolve => {
    if (!file) return resolve("");
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1800 / img.naturalWidth, 1100 / img.naturalHeight);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/webp", 0.82));
      };
      img.onerror = () => resolve(reader.result); img.src = reader.result;
    };
    reader.onerror = () => resolve(""); reader.readAsDataURL(file);
  });

  async function saveProduct(e) {
    e.preventDefault(); setProductMsg("");
    const price = Number(productForm.price), stock = Number(productForm.stock), couponValue = Number(productForm.couponValue || 0);
    if (!productForm.name.trim() || !productForm.image) return setProductMsg("Product name and image are required.");
    if (!Number.isFinite(price) || price < 0) return setProductMsg("Enter a valid Taka price.");
    if (!Number.isInteger(stock) || stock < 0) return setProductMsg("Stock must be a whole number.");
    if (productForm.couponEnabled && (!productForm.couponCode.trim() || !Number.isFinite(couponValue) || couponValue < 0)) return setProductMsg("Coupon code and discount are required.");
    if (productForm.couponType === "percent" && couponValue > 100) return setProductMsg("Percentage discount cannot exceed 100%.");
    const item = { ...productForm, price, stock, couponValue, couponCode: String(productForm.couponCode || "").trim().toUpperCase() };
    const nextProducts = editingProduct === "new" ? [...products, { ...item, id: `product-${Date.now()}` }] : products.map(p => p.id === editingProduct ? { ...p, ...item } : p);
    if (await persist({ ...store, products: nextProducts })) { setProductMsg("Saved successfully."); setEditingProduct(null); setProductForm(blankProduct); }
  }
  async function deleteProduct(id) {
    if (!confirm("Delete this product?")) return;
    await persist({ ...store, products: products.filter(p => p.id !== id), sections: sections.map(s => ({ ...s, productIds: (s.productIds || []).filter(x => x !== id) })) });
  }

  async function saveSection(e) {
    e.preventDefault(); if (!sectionForm.title.trim()) return setSectionMsg("Section title is required.");
    const item = { ...sectionForm, id: editingSection === "new" ? `section-${Date.now()}` : editingSection };
    const nextSections = editingSection === "new" ? [...sections, item] : sections.map(s => s.id === editingSection ? item : s);
    if (await persist({ ...store, sections: nextSections })) { setEditingSection(null); setSectionForm(blankSection); setSectionMsg("Section saved."); }
  }
  async function saveBanner(e, side = false) {
    e.preventDefault(); const form = side ? sideBannerForm : bannerForm; if (!form.image || !form.target) return (side ? setSideBannerMsg : setBannerMsg)("Image and target are required.");
    const list = side ? sideBanners : heroBanners; const editing = side ? editingSideBanner : editingBanner;
    const item = { ...form, id: editing === "new" ? `${side ? "side-banner" : "banner"}-${Date.now()}` : editing };
    const nextList = editing === "new" ? [...list, item] : list.map(b => b.id === editing ? item : b);
    if (await persist({ ...store, [side ? "sideBanners" : "heroBanners"]: nextList })) {
      if (side) { setEditingSideBanner(null); setSideBannerForm(blankBanner); setSideBannerMsg("Saved."); } else { setEditingBanner(null); setBannerForm(blankBanner); setBannerMsg("Saved."); }
    }
  }


  async function savePromo(e) {
    e.preventDefault(); setPromoMsg("");
    if (!promoForm.image || !promoForm.target) return setPromoMsg("Image and product target are required.");
    const item = { ...promoForm, id: editingPromo === "new" ? `promo-${Date.now()}` : editingPromo, showButton: promoForm.showButton !== false, animatedButton: promoForm.animatedButton !== false };
    const next = editingPromo === "new" ? [...promoBanners, item] : promoBanners.map(b => b.id === editingPromo ? item : b);
    if (await persist({ ...store, promoBanners: next })) { setEditingPromo(null); setPromoForm(blankPromo); setPromoMsg("Banner saved."); }
  }
  async function updateStatus(id, status) {
    try {
      const r = await fetch(`${API_BASE}/api/orders/${encodeURIComponent(id)}/status`, { method: "PATCH", headers: { "Content-Type": "application/json", "x-admin-password": password }, body: JSON.stringify({ status }) });
      const d = await r.json(); if (!r.ok) throw Error(d.error || "Could not update order"); setOrders(o => o.map(x => x.id === id ? { ...x, status } : x));
    } catch (e) { setError(e.message); }
  }

  async function bulkCoupon(enabled) {
    const code = prompt(enabled ? "Coupon code (example: ZYNIX10)" : "Coupon code to disable");
    if (enabled && !code?.trim()) return;
    const value = enabled ? Number(prompt("Discount percentage (0-100)", "10")) : 0;
    if (enabled && (!Number.isFinite(value) || value < 0 || value > 100)) return setCouponMsg("Invalid percentage.");
    const normalized = String(code || "").trim().toUpperCase();
    const nextProducts = products.map(p => enabled ? { ...p, couponEnabled: true, couponCode: normalized, couponType: "percent", couponValue: value } : (String(p.couponCode || "").toUpperCase() === normalized ? { ...p, couponEnabled: false } : p));
    if (await persist({ ...store, products: nextProducts })) setCouponMsg(enabled ? `Coupon ${normalized} enabled on ${products.length} products.` : `Coupon ${normalized} disabled.`);
  }

  async function updateStock(id, stock) {
    const n = Math.max(0, Math.floor(Number(stock) || 0));
    await persist({ ...store, products: products.map(p => p.id === id ? { ...p, stock: n } : p) });
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify({ ...store, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `zynix-store-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href);
  }
  function importBackup(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data.products) || !Array.isArray(data.sections) || !Array.isArray(data.heroBanners) || !Array.isArray(data.sideBanners)) throw Error("Invalid ZYNIX backup file.");
        if (confirm("Restore this backup? Current storefront content will be replaced.")) await persist(data);
      } catch (err) { setError(err.message); }
    };
    reader.readAsText(file); e.target.value = "";
  }

  const updateFeature = (i, key, value) => setSiteForm(x => ({ ...x, features: (x.features.length ? x.features : DEFAULT_FEATURES).map((f,n) => n === i ? { ...f, [key]: value } : f) }));
  const updateCategory = (i, key, value) => setSiteForm(x => ({ ...x, categories: (x.categories.length ? x.categories : DEFAULT_CATEGORIES).map((c,n) => n === i ? { ...c, [key]: value } : c) }));
  async function saveSite(e) { e.preventDefault(); if (await persist({ ...store, settings: siteForm })) setError(""); }

  if (!authed) return <div className="modal-overlay"><div className="admin-modal admin-login-modal"><button className="modal-close" onClick={onClose}>×</button><span>SECURE ACCESS</span><h2>ZYNIX ADMIN</h2><p>Manage products, orders, coupons, banners, stock and storefront content.</p><form onSubmit={login}><input autoFocus type="password" placeholder="Admin password" value={password} onChange={e => setPassword(e.target.value)} required/><button className="primary-btn full-btn">LOGIN</button></form>{error && <p className="admin-error">{error}</p>}</div></div>;

  return <div className="modal-overlay"><div className="admin-modal">
    <button className="modal-close" onClick={onClose}>×</button>
    <div className="admin-header"><div><span>STORE MANAGEMENT</span><h2>ZYNIX CMS</h2><p>Everything important for your shop is manageable from here.</p></div><button className="secondary-btn" onClick={() => loadOrders()}>SYNC ORDERS</button></div>
    <div className="admin-tabs admin-tabs-wrap">
      <button className={tab==='promo'?'active':''} onClick={()=>setTab('promo')}>PROMO BANNERS</button>
      {[['dashboard','DASHBOARD'],['orders','ORDERS'],['products','PRODUCTS'],['coupons','COUPONS'],['inventory','INVENTORY'],['sections','SECTIONS'],['hero','HERO BANNERS'],['sideHero','SIDE BANNERS'],['site','SITE DESIGN'],['backup','BACKUP']].map(([id,label]) => <button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}</button>)}
    </div>
    {error && <div className="admin-error admin-top-error">{error}</div>}

    {tab==='dashboard' && <div className="admin-dashboard">
      <div className="admin-stat-grid"><div className="admin-stat"><span>PRODUCTS</span><strong>{products.length}</strong><small>{collections.length} collections</small></div><div className="admin-stat"><span>ORDERS</span><strong>{orders.length}</strong><small>{pendingOrders} active</small></div><div className="admin-stat"><span>REVENUE</span><strong>৳{totalRevenue.toFixed(0)}</strong><small>from loaded orders</small></div><div className="admin-stat"><span>LOW STOCK</span><strong>{lowStock.length}</strong><small>5 or fewer left</small></div></div>
      <div className="admin-dashboard-grid"><div className="admin-form"><h3>Quick actions</h3><div className="admin-quick-grid"><button className="secondary-btn" onClick={()=>{setTab('products');setEditingProduct('new');setProductForm({...blankProduct,collection:collections[0]||'New Collection'})}}>+ PRODUCT</button><button className="secondary-btn" onClick={()=>{setTab('hero');setEditingBanner('new');setBannerForm(blankBanner)}}>+ HERO BANNER</button><button className="secondary-btn" onClick={()=>setTab('coupons')}>MANAGE COUPONS</button><button className="secondary-btn" onClick={()=>setTab('inventory')}>CHECK STOCK</button></div></div><div className="admin-form"><h3>Store health</h3><p className="admin-health-line"><span className="health-dot ok"/> Admin API connected</p><p className="admin-health-line"><span className={products.length?'health-dot ok':'health-dot warn'}/> {products.length ? 'Products are loaded' : 'Add your first product'}</p><p className="admin-health-line"><span className={heroBanners.length?'health-dot ok':'health-dot warn'}/> {heroBanners.length} hero banner(s)</p><p className="admin-health-line"><span className={activeCoupons?'health-dot ok':'health-dot warn'}/> {activeCoupons} active product coupon(s)</p></div></div>
    </div>}

    {tab==='orders' && <div className="admin-orders"><div className="orders-toolbar"><div><h3>Customer Orders</h3><p>{filteredOrders.length} of {orders.length} orders shown.</p></div><button className="secondary-btn" onClick={()=>loadOrders()}>REFRESH</button></div><div className="admin-order-filters"><input placeholder="Search order, name, email or phone" value={orderSearch} onChange={e=>setOrderSearch(e.target.value)}/><select value={orderFilter} onChange={e=>setOrderFilter(e.target.value)}>{['All','Pending','Confirmed','Processing','Shipped','Delivered','Cancelled'].map(s=><option key={s}>{s}</option>)}</select></div>{loading?<p>Loading orders...</p>:filteredOrders.length===0?<div className="admin-help"><h3>No matching orders</h3><p>Orders placed through checkout will appear here.</p></div>:filteredOrders.map(o=><div className="admin-order-card" key={o.id}><div className="admin-order-top"><div><span>{o.id}</span><h3>{o.customer?.name}</h3><p>{o.customer?.email}</p><p>{o.customer?.phone} · {o.customer?.city}</p><p>{o.customer?.address}</p></div><div className="admin-order-meta"><strong>৳{Number(o.total).toFixed(2)}</strong><small>{o.discount?`Discount: ৳${Number(o.discount).toFixed(2)}`:''}</small><small>{new Date(o.created_at).toLocaleString()}</small><select value={o.status||'Pending'} onChange={e=>updateStatus(o.id,e.target.value)}>{['Pending','Confirmed','Processing','Shipped','Delivered','Cancelled'].map(s=><option key={s}>{s}</option>)}</select></div></div><div className="admin-order-items">{(o.items||[]).map(i=><div key={i.id}><img src={i.image} alt=""/><span>{i.name} × {i.quantity}</span><strong>৳{(Number(i.price)*Number(i.quantity)).toFixed(2)}</strong></div>)}</div></div>)}</div>}

    {tab==='products' && <div className="admin-cms"><div className="orders-toolbar"><div><h3>Products</h3><p>Create, edit, delete and control product coupons.</p></div><button className="primary-btn" onClick={()=>{setEditingProduct('new');setProductForm({...blankProduct,collection:collections[0]||'New Collection'});setProductMsg('')}}>+ ADD PRODUCT</button></div>{editingProduct&&<form className="admin-form" onSubmit={saveProduct}><div className="admin-form-title"><h3>{editingProduct==='new'?'Add New Product':'Edit Product'}</h3><button type="button" onClick={()=>setEditingProduct(null)}>CANCEL</button></div><div className="admin-form-grid"><input required placeholder="Product name" value={productForm.name} onChange={e=>setProductForm({...productForm,name:e.target.value})}/><input placeholder="Collection" value={productForm.collection} onChange={e=>setProductForm({...productForm,collection:e.target.value})}/><input placeholder="Category" value={productForm.category} onChange={e=>setProductForm({...productForm,category:e.target.value})}/><input required type="number" min="0" step="0.01" placeholder="Price (৳)" value={productForm.price} onChange={e=>setProductForm({...productForm,price:e.target.value})}/><input required type="number" min="0" step="1" placeholder="Stock" value={productForm.stock} onChange={e=>setProductForm({...productForm,stock:e.target.value})}/><textarea className="full" placeholder="Description" value={productForm.description} onChange={e=>setProductForm({...productForm,description:e.target.value})}/><input className="full" placeholder="Image URL (or upload below)" value={productForm.image.startsWith('data:')?'':productForm.image} onChange={e=>setProductForm({...productForm,image:e.target.value})}/></div><label className="admin-upload full">UPLOAD PRODUCT IMAGE<input type="file" accept="image/*" onChange={async e=>setProductForm({...productForm,image:await readFile(e.target.files?.[0])})}/></label>{productForm.image&&<img className="admin-preview" src={productForm.image} alt="Preview"/>}<div className="admin-coupon-box"><label><input type="checkbox" checked={!!productForm.couponEnabled} onChange={e=>setProductForm({...productForm,couponEnabled:e.target.checked})}/> ENABLE COUPON FOR THIS PRODUCT</label>{productForm.couponEnabled&&<div className="admin-form-grid"><input placeholder="Coupon code" value={productForm.couponCode} onChange={e=>setProductForm({...productForm,couponCode:e.target.value.toUpperCase()})}/><select value={productForm.couponType} onChange={e=>setProductForm({...productForm,couponType:e.target.value})}><option value="percent">Percentage %</option><option value="fixed">Fixed ৳</option></select><input type="number" min="0" step="0.01" placeholder="Discount" value={productForm.couponValue} onChange={e=>setProductForm({...productForm,couponValue:e.target.value})}/></div>}</div>{productMsg&&<p className="admin-message">{productMsg}</p>}<button className="primary-btn">SAVE PRODUCT</button></form>}<div className="admin-product-list">{products.map(p=><div className="admin-product-row" key={p.id}><img src={p.image} alt=""/><div><span>{p.collection}</span><h3>{p.name}</h3><small>{p.category} · Stock {p.stock}</small></div><strong>৳{Number(p.price).toFixed(2)}</strong><div className="admin-row-actions"><button onClick={()=>{setEditingProduct(p.id);setProductForm({...p})}}>EDIT</button><button onClick={()=>deleteProduct(p.id)}>DELETE</button></div></div>)}</div></div>}

    {tab==='coupons' && <div className="admin-cms"><div className="orders-toolbar"><div><h3>Coupon Center</h3><p>Control product-level coupon availability without opening every product.</p></div><div className="admin-row-actions"><button className="secondary-btn" onClick={()=>bulkCoupon(true)}>ENABLE ALL</button><button className="secondary-btn" onClick={()=>bulkCoupon(false)}>DISABLE CODE</button></div></div>{couponMsg&&<p className="admin-message">{couponMsg}</p>}<div className="admin-coupon-grid">{products.map(p=><div className="admin-coupon-card" key={p.id}><div><span>{p.collection}</span><h3>{p.name}</h3><p>{p.couponEnabled&&p.couponCode?`${p.couponCode} · ${p.couponType==='fixed'?`৳${p.couponValue}`:`${p.couponValue}%`} off`:'No coupon active'}</p></div><button className={p.couponEnabled?'secondary-btn':'primary-btn'} onClick={()=>{setEditingProduct(p.id);setProductForm({...p});setTab('products')}}>{p.couponEnabled?'EDIT COUPON':'ADD COUPON'}</button></div>)}</div></div>}

    {tab==='inventory' && <div className="admin-cms"><div className="orders-toolbar"><div><h3>Inventory Control</h3><p>Fast stock editing, low-stock alerts and out-of-stock management.</p></div><input className="admin-search-input" placeholder="Search products" value={inventorySearch} onChange={e=>setInventorySearch(e.target.value)}/></div>{inventoryMsg&&<p className="admin-message">{inventoryMsg}</p>}<div className="admin-inventory-summary"><div><strong>{products.length}</strong><span>Total SKUs</span></div><div><strong>{lowStock.length}</strong><span>Low stock</span></div><div><strong>{products.filter(p=>Number(p.stock)<=0).length}</strong><span>Out of stock</span></div></div><div className="admin-inventory-list">{filteredInventory.map(p=><div className={`admin-inventory-row ${Number(p.stock)<=0?'danger':''} ${Number(p.stock)>0&&Number(p.stock)<=5?'warning':''}`} key={p.id}><img src={p.image} alt=""/><div><h3>{p.name}</h3><small>{p.collection} · ৳{Number(p.price).toFixed(2)}</small></div><label>STOCK<input type="number" min="0" value={p.stock} onChange={e=>updateStock(p.id,e.target.value)} onBlur={()=>setInventoryMsg(`${p.name} stock saved.`)}/></label><span>{Number(p.stock)<=0?'OUT OF STOCK':Number(p.stock)<=5?'LOW STOCK':'IN STOCK'}</span></div>)}</div></div>}

    {tab==='sections' && <div className="admin-cms"><div className="orders-toolbar"><div><h3>Custom Sections</h3><p>Build product collections such as Best Sellers, New Arrivals or Offers.</p></div><button className="primary-btn" onClick={()=>{setEditingSection('new');setSectionForm(blankSection);setSectionMsg('')}}>+ ADD SECTION</button></div>{editingSection&&<form className="admin-form" onSubmit={saveSection}><div className="admin-form-title"><h3>{editingSection==='new'?'Add Section':'Edit Section'}</h3><button type="button" onClick={()=>setEditingSection(null)}>CANCEL</button></div><input required placeholder="Section title" value={sectionForm.title} onChange={e=>setSectionForm({...sectionForm,title:e.target.value})}/><input placeholder="Subtitle" value={sectionForm.subtitle} onChange={e=>setSectionForm({...sectionForm,subtitle:e.target.value})}/><h4>Select products</h4><div className="admin-check-grid">{products.map(p=><label key={p.id}><input type="checkbox" checked={(sectionForm.productIds||[]).includes(p.id)} onChange={e=>setSectionForm({...sectionForm,productIds:e.target.checked?[...(sectionForm.productIds||[]),p.id]:(sectionForm.productIds||[]).filter(id=>id!==p.id)})}/>{p.name}</label>)}</div>{sectionMsg&&<p className="admin-message">{sectionMsg}</p>}<button className="primary-btn">SAVE SECTION</button></form>}<div className="admin-section-list">{sections.map(s=><div className="admin-section-card" key={s.id}><div><span>CUSTOM SECTION</span><h3>{s.title}</h3><p>{s.subtitle}</p><small>{(s.productIds||[]).length} products</small></div><div className="admin-row-actions"><button onClick={()=>{setEditingSection(s.id);setSectionForm({...s})}}>EDIT</button><button onClick={async()=>{if(confirm('Delete this section?'))await persist({...store,sections:sections.filter(x=>x.id!==s.id)})}}>DELETE</button></div></div>)}</div></div>}

    {tab==='hero' && <BannerManager title="Hero Banner Manager" list={heroBanners} products={products} sections={sections} editing={editingBanner} setEditing={setEditingBanner} form={bannerForm} setForm={setBannerForm} msg={bannerMsg} setMsg={setBannerMsg} onSave={e=>saveBanner(e,false)} onDelete={async id=>{if(confirm('Delete this hero banner?'))await persist({...store,heroBanners:heroBanners.filter(b=>b.id!==id)})}} readFile={readFile} />}
    {tab==='sideHero' && <BannerManager title="Side Banner Manager" list={sideBanners.slice(0,2)} products={products} sections={sections} editing={editingSideBanner} setEditing={setEditingSideBanner} form={sideBannerForm} setForm={setSideBannerForm} msg={sideBannerMsg} setMsg={setSideBannerMsg} onSave={e=>saveBanner(e,true)} onDelete={async id=>{if(confirm('Delete this side banner?'))await persist({...store,sideBanners:sideBanners.filter(b=>b.id!==id)})}} readFile={readFile} side />}

    {tab==='promo' && <div className="admin-cms"><div className="orders-toolbar"><div><h3>Promo Banner Manager</h3><p>Add banners between any two product collections or place one in the footer. Each banner can link directly to a product and show an animated SHOP NOW button.</p></div><button className="primary-btn" onClick={()=>{setEditingPromo('new');setPromoForm(blankPromo);setPromoMsg('')}}>+ ADD PROMO BANNER</button></div>{promoMsg&&<p className="admin-message">{promoMsg}</p>}{editingPromo&&<form className="admin-form" onSubmit={savePromo}><div className="admin-form-title"><h3>{editingPromo==='new'?'Add Promo Banner':'Edit Promo Banner'}</h3><button type="button" onClick={()=>setEditingPromo(null)}>CANCEL</button></div><input placeholder="Banner title (optional)" value={promoForm.title} onChange={e=>setPromoForm({...promoForm,title:e.target.value})}/><label className="admin-upload full">UPLOAD BANNER IMAGE<input type="file" accept="image/*" onChange={async e=>setPromoForm({...promoForm,image:await readFile(e.target.files?.[0])})}/></label>{promoForm.image&&<img className="admin-preview hero-admin-preview" src={promoForm.image} alt="Preview"/>}<select required value={promoForm.target} onChange={e=>setPromoForm({...promoForm,target:e.target.value})}><option value="">SELECT PRODUCT TARGET</option>{products.map(p=><option key={p.id} value={`product:${p.id}`}>{p.name}</option>)}</select><select value={promoForm.placement} onChange={e=>setPromoForm({...promoForm,placement:e.target.value})}><option value="footer">FOOTER</option>{collections.map(c=><option key={c} value={`after:${c}`}>AFTER {c}</option>)}{sections.map(s=><option key={s.id} value={`after:custom:${s.id}`}>AFTER {s.title}</option>)}</select><div className="admin-coupon-box"><label><input type="checkbox" checked={promoForm.showButton!==false} onChange={e=>setPromoForm({...promoForm,showButton:e.target.checked})}/> SHOW SHOP NOW BUTTON</label>{promoForm.showButton!==false&&<><input placeholder="Button text" value={promoForm.buttonText||'SHOP NOW'} onChange={e=>setPromoForm({...promoForm,buttonText:e.target.value})}/><label><input type="checkbox" checked={promoForm.animatedButton!==false} onChange={e=>setPromoForm({...promoForm,animatedButton:e.target.checked})}/> ANIMATE BUTTON</label></>}</div><button className="primary-btn">SAVE PROMO BANNER</button></form>}<div className="admin-banner-list">{promoBanners.map((b,i)=><div className="admin-banner-card" key={b.id}><img src={b.image} alt=""/><div><span>PROMO {i+1}</span><h3>{b.title||'ZYNIX Promo'}</h3><p>{b.placement} · {products.find(p=>p.id===String(b.target).replace('product:',''))?.name||'Product'}</p></div><div className="admin-row-actions"><button onClick={()=>{setEditingPromo(b.id);setPromoForm({...blankPromo,...b});setPromoMsg('')}}>EDIT</button><button onClick={async()=>{if(confirm('Delete this promo banner?'))await persist({...store,promoBanners:promoBanners.filter(x=>x.id!==b.id)})}}>DELETE</button></div></div>)}</div></div>}

    {tab==='site' && <div className="admin-cms"><div className="orders-toolbar"><div><h3>Site Design & Content</h3><p>Edit visible headings, feature cards, categories and glow settings.</p></div></div><form className="admin-form" onSubmit={saveSite}><div className="admin-form-grid"><input placeholder="Category heading" value={siteForm.categoryHeading} onChange={e=>setSiteForm({...siteForm,categoryHeading:e.target.value})}/><input placeholder="Category subtitle" value={siteForm.categorySubtitle} onChange={e=>setSiteForm({...siteForm,categorySubtitle:e.target.value})}/><input placeholder="Features heading" value={siteForm.featureHeading} onChange={e=>setSiteForm({...siteForm,featureHeading:e.target.value})}/><input placeholder="Features subtitle" value={siteForm.featureSubtitle} onChange={e=>setSiteForm({...siteForm,featureSubtitle:e.target.value})}/><input placeholder="Offer title" value={siteForm.offerTitle} onChange={e=>setSiteForm({...siteForm,offerTitle:e.target.value})}/><input placeholder="Offer subtitle" value={siteForm.offerSubtitle} onChange={e=>setSiteForm({...siteForm,offerSubtitle:e.target.value})}/><input placeholder="Footer tagline" value={siteForm.footerTagline} onChange={e=>setSiteForm({...siteForm,footerTagline:e.target.value})}/><label>Glow color<input type="color" value={siteForm.accent} onChange={e=>setSiteForm({...siteForm,accent:e.target.value})}/></label><label>Glow<select value={siteForm.glow} onChange={e=>setSiteForm({...siteForm,glow:e.target.value})}><option value="soft">Soft</option><option value="medium">Medium</option><option value="strong">Strong</option></select></label></div><h4>Features</h4><div className="admin-settings-list">{(siteForm.features.length?siteForm.features:DEFAULT_FEATURES).map((f,i)=><div className="admin-settings-row" key={i}><input placeholder="Title" value={f.title} onChange={e=>updateFeature(i,'title',e.target.value)}/><input placeholder="Description" value={f.text} onChange={e=>updateFeature(i,'text',e.target.value)}/><select value={f.icon||'bolt'} onChange={e=>updateFeature(i,'icon',e.target.value)}><option value="truck">Delivery</option><option value="shield">Shield</option><option value="card">Payment</option><option value="headset">Support</option><option value="bolt">Bolt</option><option value="star">Star</option><option value="box">Box</option><option value="heart">Heart</option></select></div>)}</div><h4>Categories</h4><div className="admin-settings-list">{(siteForm.categories.length?siteForm.categories:DEFAULT_CATEGORIES).map((c,i)=><div className="admin-settings-row" key={i}><input placeholder="Title" value={c.title} onChange={e=>updateCategory(i,'title',e.target.value)}/><input placeholder="Collection" value={c.collection} onChange={e=>updateCategory(i,'collection',e.target.value)}/><input placeholder="Short text" value={c.text} onChange={e=>updateCategory(i,'text',e.target.value)}/></div>)}</div><button className="primary-btn">SAVE ALL SITE SETTINGS</button></form></div>}

    {tab==='backup' && <div className="admin-cms"><div className="orders-toolbar"><div><h3>Backup & Restore</h3><p>Keep a copy of your products, coupons, banners, sections and design settings.</p></div></div><div className="admin-backup-grid"><div className="admin-form"><h3>Export</h3><p>Download the current ZYNIX storefront data as a JSON backup.</p><button className="primary-btn" onClick={exportBackup}>DOWNLOAD BACKUP</button></div><div className="admin-form"><h3>Restore</h3><p>Upload a previously exported ZYNIX JSON backup.</p><label className="admin-upload full">CHOOSE BACKUP FILE<input type="file" accept="application/json,.json" onChange={importBackup}/></label></div></div></div>}
  </div></div>;
}

function BannerManager({ title, list, products, sections, editing, setEditing, form, setForm, msg, setMsg, onSave, onDelete, readFile, side }) {
  return <div className="admin-cms"><div className="orders-toolbar"><div><h3>{title}</h3><p>{side ? 'Manage up to two side banners.' : 'Upload banners for the automatic sliding hero.'}</p></div><button className="primary-btn" onClick={()=>{if(side&&list.length>=2)return setMsg('Only two side banners are shown. Edit one to replace it.');setEditing('new');setForm({title:'',image:'',tone:'silver',target:''});setMsg('')}}>+ ADD BANNER</button></div>{msg&&<p className="admin-message">{msg}</p>}{editing&&<form className="admin-form" onSubmit={onSave}><div className="admin-form-title"><h3>{editing==='new'?'Add Banner':'Edit Banner'}</h3><button type="button" onClick={()=>setEditing(null)}>CANCEL</button></div><input placeholder="Banner label" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/><label className="admin-upload full">UPLOAD IMAGE<input type="file" accept="image/*" onChange={async e=>setForm({...form,image:await readFile(e.target.files?.[0])})}/></label>{form.image&&<img className="admin-preview hero-admin-preview" src={form.image} alt="Preview"/>}<select required value={form.target} onChange={e=>setForm({...form,target:e.target.value})}><option value="">SELECT TARGET</option><optgroup label="PRODUCTS">{products.map(p=><option key={p.id} value={`product:${p.id}`}>{p.name}</option>)}</optgroup><optgroup label="CUSTOM SECTIONS">{sections.map(s=><option key={s.id} value={`section:${s.id}`}>{s.title}</option>)}</optgroup></select><button className="primary-btn">SAVE BANNER</button></form>}<div className="admin-banner-list">{list.map((b,i)=><div className="admin-banner-card" key={b.id}><img src={b.image} alt=""/><div><span>{side?'SIDE BANNER':'BANNER'} {i+1}</span><h3>{b.title||'ZYNIX Banner'}</h3><p>{String(b.target||'').startsWith('section:') ? sections.find(s=>s.id===String(b.target).slice(8))?.title || 'Section' : products.find(p=>p.id===String(b.target).replace('product:',''))?.name || 'Product'}</p></div><div className="admin-row-actions"><button onClick={()=>{setEditing(b.id);setForm({...b});setMsg('')}}>EDIT</button><button onClick={()=>onDelete(b.id)}>DELETE</button></div></div>)}</div></div>;
}

export default AdminPanel;
