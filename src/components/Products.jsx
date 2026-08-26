import { useRef } from "react";
import { PromoBannerCarousel } from "./PromoBanner";
import lampImage from "../asset/lamp.png";
import fanImage from "../asset/fan.png";
import humidifierImage from "../asset/humidifier.png";
import smartwatchImage from "../asset/smartwatch.png";

const BASE_PRODUCTS = [
  { id: "lamp", name: "Smart Table Lamp", category: "SMART LIGHTING", price: 35, stock: 10, image: lampImage, description: "A modern smart lamp with a clean design for desks, bedrooms and workspaces.", collection: "Smart Lamps" },
  { id: "fan", name: "Mini Table Fan", category: "HOME GADGETS", price: 25, stock: 10, image: fanImage, description: "Compact everyday cooling with a portable design for your desk or room.", collection: "Fans" },
  { id: "humidifier", name: "Smart Humidifier", category: "HOME GADGETS", price: 40, stock: 10, image: humidifierImage, description: "A stylish compact humidifier designed to make your space more comfortable.", collection: "Humidifiers" },
  { id: "watch", name: "Smart Watch", category: "WEARABLES", price: 55, stock: 10, image: smartwatchImage, description: "A modern wearable for everyday notifications, activity and lifestyle tracking.", collection: "Smart Watches" },
];

const DEMO_NAMES = {
  Fans: ["Air Mini Fan", "Air Pro Fan", "DeskFlow Fan", "Breeze X Fan", "Turbo Cool Fan", "CoolMax Fan", "Breeze Pro", "Silent Desk Fan", "Portable Air Fan"],
  "Smart Lamps": ["Glow Mini Lamp", "Glow Pro Lamp", "Aura Desk Lamp", "Aura Bedside Lamp", "Beam X Lamp", "Halo Lamp", "Focus Lamp", "NightGlow Lamp", "Luma Pro"],
  Humidifiers: ["Mist Mini", "Mist Pro", "AirMist X", "Cloud Humidifier", "PureMist", "Mist Air", "Cloud Mini", "FreshAir Mist", "AquaMist Pro"],
  "Smart Watches": ["Watch S1", "Watch S2", "Watch Pro", "Watch Air", "Watch X", "Fit S", "Fit Pro", "Active X", "Ultra Watch"],
};

const BASE_BY_COLLECTION = Object.fromEntries(BASE_PRODUCTS.map((p) => [p.collection, p]));

// Ten visible demo entries per collection. Replace these from the Admin Panel later.
const DEMO_PRODUCTS = Object.entries(DEMO_NAMES).flatMap(([collection, names]) => {
  const base = BASE_BY_COLLECTION[collection];
  return names.map((name, index) => ({
    ...base,
    id: `${base.id}-demo-${index + 1}`,
    name: `ZYNIX ${name}`,
    price: base.price + (index + 1) * 5,
    stock: 10,
    description: `Temporary demo ${collection.toLowerCase()} product. Add your real product details from the Admin Panel.`,
  }));
});

export const DEFAULT_PRODUCTS = [...BASE_PRODUCTS, ...DEMO_PRODUCTS];
export const PRODUCTS = DEFAULT_PRODUCTS;
export const COLLECTIONS = Object.keys(DEMO_NAMES);

export function getCategoryCount(collection, products = DEFAULT_PRODUCTS) {
  return products.filter((product) => product.collection === collection).length;
}

function ProductCard({ product, onAddToCart, wishlist, onToggleWishlist, onOpenProduct }) {
  const stock = Number.isFinite(Number(product.stock)) ? Math.max(0, Math.floor(Number(product.stock))) : 0;
  const outOfStock = stock <= 0;
  return (
    <article className={`product-card category-product-card ${outOfStock ? "is-out-of-stock" : ""}`} data-product-id={product.id} onClick={()=>onOpenProduct?.(product)} tabIndex={0} role="button" onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")onOpenProduct?.(product)}}>
      <div className="product-visual">
        <img src={product.image} alt={product.name} className="product-image" />
        {outOfStock && <span className="stock-out-badge">STOCK OUT</span>}
        <button
          type="button"
          className={`wishlist-btn ${wishlist.includes(product.id) ? "active" : ""}`}
          onClick={(e) => {e.stopPropagation();onToggleWishlist(product.id)}}
          aria-label={`${wishlist.includes(product.id) ? "Remove" : "Add"} ${product.name} from wishlist`}
        >♥</button>
        <span className="product-category-pill">{product.collection}</span>
      </div>
      <div className="product-info">
        <span className="category-label">{product.category}</span>
        <h3>{product.name}</h3>
        <p className="product-description">{product.description}</p>
        <div className="product-bottom">
          <strong>৳{Number(product.price).toFixed(2)}</strong>{product.couponEnabled&&product.couponCode&&<span className="product-coupon-badge">COUPON</span>}
          <button type="button" className="product-cart-btn" disabled={outOfStock} onClick={(e) => {e.stopPropagation();onAddToCart(product)}}>
            {outOfStock ? "STOCK OUT" : "ADD TO CART"}
          </button>
        </div>
      </div>
    </article>
  );
}

function Products({ onAddToCart, wishlist, onToggleWishlist, onOpenProduct, searchQuery = "", selectedCategory = null, onClearCategory, products = DEFAULT_PRODUCTS, customSections = [], promoBanners = [], onProductClick }) {
  const carouselRefs = useRef({});
  const slideCollection = (collection, direction) => {
    const el = carouselRefs.current[collection];
    if (el) el.scrollBy({ left: direction * Math.max(el.clientWidth * 0.82, 320), behavior: "smooth" });
  };
  const q = searchQuery.trim().toLowerCase();
  const matches = (product) => {
    if (selectedCategory && product.collection !== selectedCategory) return false;
    if (!q) return true;
    return `${product.name} ${product.category} ${product.description} ${product.collection} ${product.price}`.toLowerCase().includes(q);
  };

  const collections = selectedCategory ? [selectedCategory] : COLLECTIONS;
  const sections = collections.map((collection) => ({
    collection,
    items: products.filter((p) => p.collection === collection && matches(p)),
  })).filter((section) => section.items.length > 0);

  return (
    <section className="products-section" id="products">
      <div className="featured-head">
        <div>
          <span className="featured-eyebrow">ZYNIX STORE</span>
          <h2>{selectedCategory || (q ? `Search results for “${searchQuery}”` : "Our Products")}</h2>
        </div>
        {(selectedCategory || q) ? (
          <button type="button" className="view-all" onClick={onClearCategory}>View All <span>→</span></button>
        ) : <span className="product-count-label">{products.length} ITEMS</span>}
      </div>

      <p className="featured-helper">
        {selectedCategory ? `Showing every ${selectedCategory.toLowerCase()} item in the ZYNIX shop.` : q ? `${sections.reduce((sum, section) => sum + section.items.length, 0)} matching products found.` : "Each category has its own product collection. Add or update products from the Admin Panel."}
      </p>

      {sections.map(({ collection, items }) => (
        <div className="product-collection" id={`collection-${collection.replace(/\s+/g, "-").toLowerCase()}`} key={collection}>
          <div className="collection-heading">
            <div><span>{items.length} ITEMS</span><h3>{collection}</h3></div>
            <div className="collection-actions">
              {!selectedCategory && <button type="button" className="filter-category-btn" onClick={() => document.getElementById("feature-categories")?.scrollIntoView({ behavior: "smooth" })}>FILTER CATEGORY →</button>}
              <div className="carousel-controls" aria-label={`${collection} product slider controls`}>
                <button type="button" onClick={() => slideCollection(collection, -1)} aria-label={`Previous ${collection}`}>←</button>
                <button type="button" onClick={() => slideCollection(collection, 1)} aria-label={`Next ${collection}`}>→</button>
              </div>
            </div>
          </div>
          <div
            className="products-grid product-carousel"
            ref={(node) => { carouselRefs.current[collection] = node; }}
          >
            {items.map((product) => <ProductCard key={product.id} product={product} onAddToCart={onAddToCart} wishlist={wishlist} onToggleWishlist={onToggleWishlist} onOpenProduct={onOpenProduct} />)}
          </div>
          {promoBanners.filter(b => b.placement === `after:${collection}`).length > 0 && <PromoBannerCarousel banners={promoBanners.filter(b => b.placement === `after:${collection}`)} onProductClick={onProductClick}/>}
        </div>
      ))}

      {customSections.map((section) => {
        const items = (section.productIds || []).map(id => products.find(p => p.id === id)).filter(Boolean).filter(matches);
        if (!items.length) return null;
        return (
          <div className="product-collection custom-product-section" id={`custom-${section.id}`} key={section.id}>
            <div className="collection-heading">
              <div><span>CUSTOM COLLECTION</span><h3>{section.title}</h3>{section.subtitle && <p className="featured-helper">{section.subtitle}</p>}</div>
              <div className="carousel-controls" aria-label={`${section.title} controls`}>
                <button type="button" onClick={() => slideCollection(section.id, -1)} aria-label={`Previous ${section.title}`}>←</button>
                <button type="button" onClick={() => slideCollection(section.id, 1)} aria-label={`Next ${section.title}`}>→</button>
              </div>
            </div>
            <div className="products-grid product-carousel" ref={(node)=>{carouselRefs.current[section.id]=node}}>
              {items.map(product => <ProductCard key={product.id} product={product} onAddToCart={onAddToCart} wishlist={wishlist} onToggleWishlist={onToggleWishlist} onOpenProduct={onOpenProduct}/>)}
            </div>
            {promoBanners.filter(b => b.placement === `after:custom:${section.id}`).length > 0 && <PromoBannerCarousel banners={promoBanners.filter(b => b.placement === `after:custom:${section.id}`)} onProductClick={onProductClick}/>}
          </div>
        );
      })}

      {!sections.length && !customSections.some(s => (s.productIds||[]).some(id => products.some(p=>p.id===id))) && (
        <div className="products-empty-state"><h3>No products found</h3><p>Try another product name, category or price.</p><button type="button" onClick={onClearCategory}>CLEAR SEARCH & FILTER</button></div>
      )}
    </section>
  );
}

export default Products;
