import { useEffect, useMemo, useState } from "react";
import Navbar from "./components/Navbar";
import Hero, { DEFAULT_HERO_BANNERS, DEFAULT_SIDE_BANNERS } from "./components/Hero";
import Products, { DEFAULT_PRODUCTS } from "./components/Products";
import AdminPanel from "./components/AdminPanel";
import Features from "./components/Features";
import Footer from "./components/Footer";

const API_BASE = "";

const load=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)) ?? fallback}catch{return fallback}};
const userStorageKey=(base,email)=>`${base}:${email||"guest"}`;
const normalizeProducts=(items=[])=>items.map(p=>({
  ...p,
  stock: Number.isFinite(Number(p.stock)) ? Math.max(0, Math.floor(Number(p.stock))) : 10,
}));

function App(){
  const [user,setUser]=useState(()=>load("zynix-user",null));
  const [cartItems,setCartItems]=useState(()=>load(userStorageKey("zynix-cart",load("zynix-user",null)?.email),[]));
  const [wishlist,setWishlist]=useState(()=>load(userStorageKey("zynix-wishlist",load("zynix-user",null)?.email),[]));
  const [orders,setOrders]=useState(()=>load(userStorageKey("zynix-orders",load("zynix-user",null)?.email),[]));
  const [authToken,setAuthToken]=useState(()=>localStorage.getItem("zynix-auth-token")||"");
  const [cartOpen,setCartOpen]=useState(false);
  const [profileOpen,setProfileOpen]=useState(false);
  const [wishlistOpen,setWishlistOpen]=useState(false);
  const [selectedProduct,setSelectedProduct]=useState(null);
  const [checkoutOpen,setCheckoutOpen]=useState(false);
  const [orderDone,setOrderDone]=useState(null);
  const [searchQuery,setSearchQuery]=useState("");
  const [selectedCategory,setSelectedCategory]=useState(null);
  const [products,setProducts]=useState(()=>normalizeProducts(load("zynix-products-v2",DEFAULT_PRODUCTS)));
  const [heroBanners,setHeroBanners]=useState(DEFAULT_HERO_BANNERS);
  const [sideBanners,setSideBanners]=useState(DEFAULT_SIDE_BANNERS);
  const [storeSections,setStoreSections]=useState([]);
  const [siteSettings,setSiteSettings]=useState({});
  const [promoBanners,setPromoBanners]=useState([]);
  const [cartFly,setCartFly]=useState(null);
  const [storeReady,setStoreReady]=useState(false);

  useEffect(()=>localStorage.setItem(userStorageKey("zynix-cart",user?.email),JSON.stringify(cartItems)),[cartItems,user?.email]);
  useEffect(()=>localStorage.setItem(userStorageKey("zynix-wishlist",user?.email),JSON.stringify(wishlist)),[wishlist,user?.email]);
  useEffect(()=>localStorage.setItem(userStorageKey("zynix-orders",user?.email),JSON.stringify(orders)),[orders,user?.email]);
  useEffect(()=>localStorage.setItem("zynix-user",JSON.stringify(user)),[user]);
  useEffect(()=>{
    const email=user?.email||null;
    setCartItems(load(userStorageKey("zynix-cart",email),[]));
    setWishlist(load(userStorageKey("zynix-wishlist",email),[]));
    setOrders(load(userStorageKey("zynix-orders",email),[]));
    if(user && authToken){ fetch(`${API_BASE}/api/my-orders`,{headers:{Authorization:`Bearer ${authToken}`}}).then(r=>r.ok?r.json():[]).then(setOrders).catch(()=>{}); }
  },[user?.email,authToken]);
  useEffect(()=>localStorage.setItem("zynix-products-v2",JSON.stringify(products)),[products]);
  useEffect(()=>{document.documentElement.style.setProperty("--zynix-purple",siteSettings.accent||"#9b6cff");document.documentElement.style.setProperty("--zynix-glow-opacity",siteSettings.glow==="soft"?".45":siteSettings.glow==="strong"?"1":".7")},[siteSettings.accent,siteSettings.glow]);
  useEffect(()=>{
    fetch(`${API_BASE}/api/store-content`).then(r=>r.json()).then(d=>{
      if(d.content){
        if(Array.isArray(d.content.products)&&d.content.products.length) setProducts(normalizeProducts(d.content.products));
        if(Array.isArray(d.content.heroBanners)&&d.content.heroBanners.length) setHeroBanners(d.content.heroBanners);
        if(Array.isArray(d.content.sideBanners)&&d.content.sideBanners.length) setSideBanners(d.content.sideBanners);
        if(Array.isArray(d.content.sections)) setStoreSections(d.content.sections);
        if(d.content.settings) setSiteSettings(d.content.settings);
        if(Array.isArray(d.content.promoBanners)) setPromoBanners(d.content.promoBanners);
      }
    }).catch(()=>{}).finally(()=>setStoreReady(true));
  },[]);

  const storeContent={products,heroBanners,sideBanners,sections:storeSections,settings:siteSettings,promoBanners};
  const isAdminRoute = window.location.pathname === "/admin" || window.location.pathname === "/admin/" || window.location.pathname === "/admin/login";
  const handleStoreChange=(next)=>{
    setProducts(normalizeProducts(next.products||[]));
    setHeroBanners(next.heroBanners?.length?next.heroBanners:DEFAULT_HERO_BANNERS);
    setSideBanners(next.sideBanners?.length?next.sideBanners:DEFAULT_SIDE_BANNERS);
    setStoreSections(next.sections||[]);
    setSiteSettings(next.settings||{});
    setPromoBanners(next.promoBanners||[]);
  };

  const launchCartFly=()=>{
    const cart=document.querySelector(".cart-btn");
    if(!cart)return;
    const r=cart.getBoundingClientRect();
    const start={x:Math.max(24,window.innerWidth*0.5-42),y:window.innerHeight*0.58};
    setCartFly({id:Date.now(),x:start.x,y:start.y,tx:r.left+r.width/2,ty:r.top+r.height/2});
    setTimeout(()=>setCartFly(null),850);
  };
  const addToCart=(p,{animate=true,open=true,removeFromWishlist=false}={})=>{
    const stock=Number.isFinite(Number(p.stock)) ? Math.max(0, Math.floor(Number(p.stock))) : 0;
    if(stock<=0)return false;
    const existing=cartItems.find(x=>x.id===p.id);
    if(existing && existing.quantity>=stock)return false;
    setCartItems(c=>{
      const e=c.find(x=>x.id===p.id);
      if(e)return c.map(x=>x.id===p.id?{...x,quantity:Math.min(stock,x.quantity+1)}:x);
      return [...c,{...p,quantity:1}];
    });
    if(removeFromWishlist) setWishlist(w=>w.filter(id=>id!==p.id));
    if(animate) launchCartFly();
    if(open) { setWishlistOpen(false); setCartOpen(true); }
    return true;
  };
  const addWishlistToCart=()=>{
    const available=wishProducts.filter(p=>Number(p.stock)>0);
    if(!available.length){alert("No in-stock wishlist products are available.");return;}
    available.forEach((p,i)=>addToCart(p,{animate:i===available.length-1,open:false,removeFromWishlist:true}));
    setWishlistOpen(false);
    setTimeout(()=>setCartOpen(true),520);
  };
  const changeQty=(id,delta)=>setCartItems(c=>c.map(x=>{
    if(x.id!==id)return x;
    const stock=Number.isFinite(Number(products.find(p=>p.id===id)?.stock)) ? Math.max(0,Math.floor(Number(products.find(p=>p.id===id)?.stock))) : 0;
    return {...x,quantity:Math.min(stock,x.quantity+delta)};
  }).filter(x=>x.quantity>0));
  const remove=id=>setCartItems(c=>c.filter(x=>x.id!==id));
  const toggleWishlist=id=>setWishlist(w=>w.includes(id)?w.filter(x=>x!==id):[...w,id]);
  const cartCount=cartItems.reduce((s,x)=>s+x.quantity,0);
  const total=cartItems.reduce((s,x)=>s+x.price*x.quantity,0);
  const wishProducts=useMemo(()=>products.filter(p=>wishlist.includes(p.id)),[wishlist,products]);
  const scrollToProduct=(target)=>{
    if(!target) return;
    const [type,id]=String(target).includes(":") ? String(target).split(":",2) : ["product",String(target)];
    if(type === "section"){
      const el=document.getElementById(`custom-${id}`);
      if(el){ el.scrollIntoView({behavior:"smooth",block:"start"}); el.classList.remove("product-banner-highlight"); void el.offsetWidth; el.classList.add("product-banner-highlight"); setTimeout(()=>el.classList.remove("product-banner-highlight"),1800); return; }
    }
    const card=document.querySelector(`[data-product-id="${id}"]`);
    const section=document.getElementById("products");
    if(card){ card.scrollIntoView({behavior:"smooth",block:"center",inline:"center"}); card.classList.remove("product-banner-highlight"); void card.offsetWidth; card.classList.add("product-banner-highlight"); setTimeout(()=>card.classList.remove("product-banner-highlight"),1800); }
    else section?.scrollIntoView({behavior:"smooth",block:"start"});
  };

  const placeOrder=async(form)=>{
    if(!user || !authToken){
      setCheckoutOpen(false);
      setProfileOpen(true);
      return;
    }
    const id=`ZX-${Date.now().toString().slice(-8)}`;
    const order={id,date:new Date().toISOString(),customer:{...form,name:user.name,email:user.email},items:cartItems,total:form.total,couponCode:form.couponCode||"",discount:Number(form.discount||0),payment:form.payment,status:"Pending"};
    try {
      const r=await fetch(`${API_BASE}/api/orders`,{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${authToken}`},
        body:JSON.stringify(order)
      });
      const data=await r.json();
      if(!r.ok) throw new Error(data.error||"Could not place order");
      if(data.content?.products) setProducts(data.content.products);
      setOrders(o=>[order,...o]);
      setCartItems([]);
      setCheckoutOpen(false);
      setCartOpen(false);
      setOrderDone(order);
      setProfileOpen(false);
      if(!data.emailSent) console.warn("Order saved, but confirmation email was not sent:", data.emailError);
    } catch(e) {
      alert(`Order could not be saved. ${e.message}`);
    }
  };

  if(isAdminRoute){
    return <AdminPanel store={storeContent} onStoreChange={handleStoreChange} onClose={()=>{window.location.href="/"}}/>;
  }

  return <>
    <Navbar cartCount={cartCount} wishlistCount={wishlist.length} onCartClick={()=>setCartOpen(true)} onProfileClick={()=>setProfileOpen(true)} onWishlistClick={()=>setWishlistOpen(true)} onSearch={(q)=>{setSearchQuery(q); if(q.trim()) setTimeout(()=>document.getElementById("products")?.scrollIntoView({behavior:"smooth",block:"start"}),50)}}/>
    <main><Hero banners={heroBanners} sideBanners={sideBanners} onProductClick={scrollToProduct}/><Products customSections={storeSections} promoBanners={promoBanners} onProductClick={scrollToProduct} products={products} onAddToCart={addToCart} wishlist={wishlist} onToggleWishlist={toggleWishlist} onOpenProduct={setSelectedProduct} searchQuery={searchQuery} selectedCategory={selectedCategory} onClearCategory={()=>{setSelectedCategory(null);setSearchQuery("")}}/><Features settings={siteSettings}/></main>
    {cartFly&&<div key={cartFly.id} className="cart-fly-animation" style={{"--fly-x":`${cartFly.x}px`,"--fly-y":`${cartFly.y}px`,"--fly-tx":`${cartFly.tx}px`,"--fly-ty":`${cartFly.ty}px`}}><span>🛒</span></div>}
    <Footer settings={siteSettings} promoBanners={promoBanners} onProductClick={scrollToProduct}/>



    {selectedProduct&&<div className="modal-overlay" onClick={()=>setSelectedProduct(null)}><div className="product-modal product-gallery-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setSelectedProduct(null)}>×</button><div className="product-gallery"><div className="gallery-main"><img src={selectedProduct.image} alt={selectedProduct.name}/></div><div className="gallery-thumbs">{[selectedProduct.image,...(Array.isArray(selectedProduct.demoImages)?selectedProduct.demoImages:[])].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).map((src,i)=><button key={`${src}-${i}`} type="button" className="gallery-thumb" onClick={e=>{e.currentTarget.closest('.product-gallery').querySelector('.gallery-main img').src=src}}><img src={src} alt={`${selectedProduct.name} ${i+1}`}/></button>)}</div></div><div className="modal-info"><span>{selectedProduct.category}</span><h2>{selectedProduct.name}</h2><p>{selectedProduct.description}</p><strong>৳{Number(selectedProduct.price).toFixed(2)}</strong><div className="modal-actions"><button className="secondary-btn" onClick={()=>toggleWishlist(selectedProduct.id)}>{wishlist.includes(selectedProduct.id)?"REMOVE WISHLIST":"ADD TO WISHLIST"}</button><button className="primary-btn" onClick={()=>{addToCart(selectedProduct);setSelectedProduct(null)}}>ADD TO CART</button></div></div></div></div>}

    {cartOpen&&<div className="cart-overlay" onClick={()=>setCartOpen(false)}><aside className="cart-drawer" onClick={e=>e.stopPropagation()}><div className="cart-header"><div><span>YOUR CART</span><h2>Shopping Cart</h2></div><button onClick={()=>setCartOpen(false)}>×</button></div><div className="cart-items">{cartItems.length===0?<div className="empty-cart"><div>🛒</div><h3>Your cart is empty</h3><p>Add some smart gadgets.</p></div>:cartItems.map(i=><div className="cart-item" key={i.id}><div className="cart-item-image"><img src={i.image} alt={i.name}/></div><div className="cart-item-info"><h3>{i.name}</h3><span>৳{Number(i.price).toFixed(2)}</span><div className="quantity-controls"><button onClick={()=>changeQty(i.id,-1)}>−</button><strong>{i.quantity}</strong><button onClick={()=>changeQty(i.id,1)}>+</button></div></div><button className="remove-item" onClick={()=>remove(i.id)}>×</button></div>)}</div>{cartItems.length>0&&<div className="cart-footer"><div className="cart-total"><span>Total</span><strong>৳{total.toFixed(2)}</strong></div><button className="checkout-btn" onClick={()=>{
  if(!user || !authToken){ setCartOpen(false); setProfileOpen(true); }
  else { setCartOpen(false); setCheckoutOpen(true); }
}}>{user ? "PROCEED TO CHECKOUT" : "LOGIN / REGISTER TO CHECKOUT"}</button></div>}</aside></div>}

    {checkoutOpen&&<Checkout cartItems={cartItems} total={total} onClose={()=>setCheckoutOpen(false)} onPlace={placeOrder}/>} 
    {profileOpen&&<Profile user={user} orders={orders} onClose={()=>setProfileOpen(false)} onSave={u=>{setUser(u);setAuthToken(localStorage.getItem("zynix-auth-token")||"")}} />} 
    {wishlistOpen&&<Wishlist products={wishProducts} onClose={()=>setWishlistOpen(false)} onAdd={p=>addToCart(p,{removeFromWishlist:true})} onOpen={setSelectedProduct} onRemove={toggleWishlist} onAddAll={addWishlistToCart}/>} 
    {orderDone&&<div className="modal-overlay"><div className="success-modal"><div className="success-icon">✓</div><span>ORDER CONFIRMED</span><h2>Thank you for shopping with ZYNIX.</h2><p>Your order <strong>{orderDone.id}</strong> has been received.</p><button className="primary-btn" onClick={()=>setOrderDone(null)}>CONTINUE SHOPPING</button></div></div>}
  </>;
}


function Checkout({cartItems,total,onClose,onPlace}){
  const [form,setForm]=useState({name:"",phone:"",address:"",city:"Dhaka",payment:"Cash on Delivery",couponCode:"",discount:0});
  const [couponMsg,setCouponMsg]=useState("");
  const [couponApplied,setCouponApplied]=useState(false);
  const calculateDiscount=(code)=>{
    const normalized=String(code||"").trim().toUpperCase();
    if(!normalized)return {discount:0,message:"Enter a coupon code."};
    let discount=0,matched=0;
    cartItems.forEach(item=>{
      if(!item.couponEnabled||String(item.couponCode||"").trim().toUpperCase()!==normalized)return;
      matched++;
      const line=Number(item.price||0)*Number(item.quantity||0);
      const value=Number(item.couponValue||0);
      discount += item.couponType==="fixed" ? Math.min(line,value*Number(item.quantity||0)) : Math.min(line,line*Math.min(100,Math.max(0,value))/100);
    });
    if(!matched)return {discount:0,message:"This coupon is not valid for the products in your cart."};
    return {discount:Math.min(total,discount),message:`Coupon applied. You saved ৳${Math.min(total,discount).toFixed(2)}.`};
  };
  const applyCoupon=()=>{
    const result=calculateDiscount(form.couponCode);
    setCouponMsg(result.message);setCouponApplied(result.discount>0);
    setForm(f=>({...f,discount:result.discount,total:Math.max(0,total-result.discount)}));
  };
  const submit=e=>{e.preventDefault();const latest=couponApplied?form:({...form,discount:0,total});onPlace(latest)};
  const finalTotal=Math.max(0,total-(couponApplied?Number(form.discount||0):0));
  return <div className="modal-overlay"><div className="checkout-modal">
    <button className="modal-close" onClick={onClose}>×</button>
    <span>SECURE CHECKOUT</span><h2>Complete Your Order</h2>
    <p className="logged-in-note">Ordering as <strong>{load("zynix-user",null)?.email}</strong></p>
    <form onSubmit={submit}><div className="checkout-grid">
      <input required placeholder="Full name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
      <input required placeholder="Phone number" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/>
      <input required className="full" placeholder="Delivery address" value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/>
      <input required placeholder="City" value={form.city} onChange={e=>setForm({...form,city:e.target.value})}/>
      <select value={form.payment} onChange={e=>setForm({...form,payment:e.target.value})}>
        <option>Cash on Delivery</option><option>Online Card Payment (requires Stripe setup)</option><option>bKash / Nagad (requires merchant integration)</option>
      </select>
    </div>
    <div className="coupon-checkout-row"><input placeholder="Coupon code" value={form.couponCode} onChange={e=>{setForm({...form,couponCode:e.target.value.toUpperCase(),discount:0,total});setCouponApplied(false);setCouponMsg("")}}/><button type="button" className="secondary-btn" onClick={applyCoupon}>APPLY</button></div>
    {couponMsg&&<p className={couponApplied?"coupon-success":"coupon-error"}>{couponMsg}</p>}
    <div className="checkout-summary"><span>Order total</span><strong>৳{finalTotal.toFixed(2)}</strong></div>
    <p className="payment-note">Your order confirmation will be sent automatically to your registered Gmail after the order is placed.</p>
    <button className="primary-btn full-btn">PLACE ORDER</button></form>
  </div></div>
}
function Profile({user,orders,onClose,onSave}){
  const [mode,setMode]=useState(user?"account":"login");
  const [name,setName]=useState(user?.name||""); const [email,setEmail]=useState(user?.email||"");
  const [password,setPassword]=useState(""); const [code,setCode]=useState(""); const [error,setError]=useState("");
  const [busy,setBusy]=useState(false); const [track,setTrack]=useState(null);
  const auth=async(e)=>{e.preventDefault();setError("");setBusy(true);try{
    if(mode==="register"&&!/^[^\s@]+@gmail\.com$/i.test(email.trim()))throw new Error("Only Gmail addresses (@gmail.com) can be registered.");
    if(mode==="verify"){const r=await fetch(`${API_BASE}/api/auth/verify-registration`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,code})});const d=await r.json();if(!r.ok)throw Error(d.error);localStorage.setItem("zynix-auth-token",d.token);onSave(d.user);setMode("account");return;}
    if(mode==="forgot-code"){const r=await fetch(`${API_BASE}/api/auth/reset-password`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,code,password})});const d=await r.json();if(!r.ok)throw Error(d.error);localStorage.setItem("zynix-auth-token",d.token);const me=await fetch(`${API_BASE}/api/auth/me`,{headers:{Authorization:`Bearer ${d.token}`}}).then(x=>x.json());onSave(me.user);setMode("account");return;}
    if(mode==="forgot"){const r=await fetch(`${API_BASE}/api/auth/forgot-password`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email})});const d=await r.json();if(!r.ok)throw Error(d.error);setMode("forgot-code");return;}
    const endpoint=mode==="register"?"/api/auth/register":"/api/auth/login";const body=mode==="register"?{name,email,password}:{email,password};
    const r=await fetch(`${API_BASE}${endpoint}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error);
    if(mode==="register"&&d.verificationRequired){setMode("verify");return;} localStorage.setItem("zynix-auth-token",d.token);onSave(d.user);setPassword("");if(mode==="login")onClose();
  }catch(err){setError(err.message)}finally{setBusy(false)}};
  const googleClientId=import.meta.env.VITE_GOOGLE_CLIENT_ID||"";
  useEffect(()=>{if((mode!=="login"&&mode!=="register")||!window.google||!googleClientId)return;const el=document.getElementById("google-login-button");if(!el)return;el.innerHTML="";window.google.accounts.id.initialize({client_id:googleClientId,callback:async(response)=>{setError("");setBusy(true);try{const r=await fetch(`${API_BASE}/api/auth/google`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({credential:response.credential})});const d=await r.json();if(!r.ok)throw Error(d.error);localStorage.setItem("zynix-auth-token",d.token);onSave(d.user);onClose()}catch(e){setError(e.message)}finally{setBusy(false)}}});window.google.accounts.id.renderButton(el,{theme:"outline",size:"large",width:320,text:"continue_with"})},[mode,googleClientId,onClose,onSave]);
  if(user&&mode==="account") return <div className="modal-overlay"><div className="account-modal"><button className="modal-close" onClick={onClose}>×</button><div className="account-tabs"><button className="active">ACCOUNT</button><button>ORDERS</button></div><h2>Welcome, {user.name}</h2><p className="account-email">{user.email}</p><div className="account-actions"><button className="primary-btn" onClick={onClose}>CONTINUE SHOPPING</button><button className="secondary-btn" onClick={()=>{localStorage.removeItem("zynix-auth-token");onSave(null);onClose()}}>LOG OUT</button></div><h3 className="account-section-title">Order History</h3>{orders.length?orders.map(o=><div className="order-row" key={o.id}><strong>{o.id}</strong><span>{o.status||"Pending"}</span><b>৳{Number(o.total).toFixed(2)}</b><button className="secondary-btn" onClick={async()=>{try{const r=await fetch(`${API_BASE}/api/orders/${o.id}`,{headers:{Authorization:`Bearer ${localStorage.getItem("zynix-auth-token")||""}`}});const d=await r.json();if(!r.ok)throw new Error(d.error);setTrack(d)}catch(e){setError(e.message)}}}>TRACK</button></div>):<p>No orders yet.</p>}{error&&<p className="auth-error">{error}</p>}{track&&<div className="tracking-box"><h3>Parcel Tracking</h3><p><b>{track.id}</b></p><div className="tracking-status">{["Pending","Confirmed","Processing","Shipped","Delivered"].map(st=><span className={track.status===st?"active":""} key={st}>{st}</span>)}</div><p>Current status: <strong>{track.status}</strong></p><button className="secondary-btn" onClick={()=>setTrack(null)}>CLOSE TRACKING</button></div>}</div></div>;
  const authMode=["login","register"].includes(mode)?mode:"login";
  const title=mode==="register"?"Create your account":mode==="verify"?"Verify your Gmail":mode==="forgot"?"Forgot password":mode==="forgot-code"?"Recover your password":"Welcome back";
  const help=mode==="register"?"Verification code will be sent to your Gmail.":mode==="verify"?`Enter the 6-digit code sent to ${email}.`:mode==="forgot"?"Enter your registered Gmail to receive a recovery code.":mode==="forgot-code"?`Enter the recovery code sent to ${email}.`:"Log in with your registered Gmail to continue.";
  const standardForm=<form onSubmit={auth} className="neon-auth-form">{mode==="register"&&<input required minLength="2" placeholder="Full name" value={name} onChange={e=>setName(e.target.value)}/>} {!['verify','forgot-code'].includes(mode)&&<input required type="email" placeholder="yourname@gmail.com" value={email} onChange={e=>setEmail(e.target.value)}/>} {mode==="verify"&&<input required inputMode="numeric" maxLength="6" placeholder="6-digit verification code" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))}/>} {mode==="forgot-code"&&<input required inputMode="numeric" maxLength="6" placeholder="6-digit recovery code" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))}/>} {['register','login','forgot-code'].includes(mode)&&<input required minLength="6" type="password" placeholder="Password (minimum 6 characters)" value={password} onChange={e=>setPassword(e.target.value)}/>} {error&&<p className="auth-error">{error}</p>}<button className="neon-submit" disabled={busy}>{busy?"PLEASE WAIT...":mode==="register"?"SEND VERIFICATION CODE":mode==="verify"?"VERIFY & CREATE ACCOUNT":mode==="forgot"?"SEND RECOVERY CODE":mode==="forgot-code"?"RESET PASSWORD":"LOGIN"}</button></form>;
  return <div className="modal-overlay auth-overlay"><div className={`neon-auth-modal mode-${authMode} ${mode!=='login'&&mode!=='register'?'mode-secondary':''}`}><button className="modal-close neon-close" onClick={onClose}>×</button><div className="neon-auth-shell"><div className="neon-auth-copy"><span>ZYNIX / DIGITAL STORE</span><h2>{mode==='register'?'JOIN THE GLOW':'WELCOME BACK'}</h2><p>{mode==='register'?'Create your account and unlock a smoother ZYNIX shopping experience.':'Sign in to access your cart, wishlist and orders.'}</p><div className="neon-orb"/><div className="neon-lines"/></div><div className="neon-auth-panel"><div className="neon-tabs"><button className={mode==='login'?'active':''} onClick={()=>{setMode('login');setError('')}}>LOGIN</button><button className={mode==='register'?'active':''} onClick={()=>{setMode('register');setError('')}}>REGISTER</button></div><span className="neon-kicker">ZYNIX ACCOUNT</span><h3>{title}</h3><p className="auth-help">{help}</p>{standardForm}{mode==='login'&&<><button className="text-link-btn neon-link" onClick={()=>{setMode('forgot');setError('')}}>Forgot password?</button><div className="or-divider">OR</div><div id="google-login-button" className="google-login-button"></div>{!googleClientId&&<p className="auth-note">Google login needs VITE_GOOGLE_CLIENT_ID in the project .env.</p>}</>}{mode==='register'&&<p className="auth-note">Only @gmail.com addresses are accepted.</p>}</div></div></div></div>;
}
function Wishlist({products,onClose,onAdd,onOpen,onRemove,onAddAll}){return <div className="modal-overlay"><div className="wishlist-modal"><button className="modal-close" onClick={onClose}>×</button><span>SAVED ITEMS</span><h2>Your Wishlist</h2>{products.length?<><div className="wishlist-toolbar"><span>{products.length} saved product{products.length>1?"s":""}</span><button className="wishlist-add-all" onClick={onAddAll}>ADD ALL TO CART</button></div><div className="wishlist-grid">{products.map(p=><div className="wishlist-card" key={p.id} onClick={()=>onOpen(p)}><img src={p.image} alt={p.name}/><h3>{p.name}</h3><strong>৳{Number(p.price).toFixed(2)}</strong><div><button onClick={e=>{e.stopPropagation();onAdd(p)}}>ADD TO CART</button><button onClick={e=>{e.stopPropagation();onRemove(p.id)}}>REMOVE</button></div></div>)}</div></>:<p>Your wishlist is empty.</p>}</div></div>}

export default App;
