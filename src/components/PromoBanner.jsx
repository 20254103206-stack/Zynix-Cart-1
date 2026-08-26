import { useEffect, useRef, useState } from "react";

function PromoBanner({ banner, onProductClick }) {
  if (!banner?.image) return null;
  const target = banner.target || "";
  const go = () => onProductClick?.(target);
  return <div className="promo-slide">
    <img src={banner.image} alt={banner.title || "ZYNIX promotion"}/>
    <div className="promo-banner-overlay">
      {banner.title && <span>{banner.title}</span>}
      {banner.showButton !== false && target && <button type="button" className="promo-shop-btn" onClick={(e)=>{e.stopPropagation();go()}}>{banner.buttonText || "SHOP NOW"}<b>→</b></button>}
    </div>
  </div>;
}

export function PromoBannerCarousel({ banners = [], onProductClick }) {
  const valid = banners.filter(b => b?.image);
  const [index, setIndex] = useState(0);
  const touchStart = useRef(null);
  const touchEnd = useRef(null);

  useEffect(() => {
    setIndex(i => Math.min(i, Math.max(0, valid.length - 1)));
  }, [valid.length]);

  useEffect(() => {
    if (valid.length <= 1) return;
    const timer = setInterval(() => setIndex(i => (i + 1) % valid.length), 4200);
    return () => clearInterval(timer);
  }, [valid.length]);

  if (!valid.length) return null;

  const swipe = () => {
    if (valid.length <= 1 || touchStart.current == null || touchEnd.current == null) return;
    const distance = touchStart.current - touchEnd.current;
    if (Math.abs(distance) > 45) {
      setIndex(i => distance > 0 ? (i + 1) % valid.length : (i - 1 + valid.length) % valid.length);
    }
    touchStart.current = null;
    touchEnd.current = null;
  };

  return <section
    className="promo-banner-carousel"
    aria-label="ZYNIX promotional banners"
    onTouchStart={e => { touchStart.current = e.changedTouches[0].clientX; }}
    onTouchMove={e => { touchEnd.current = e.changedTouches[0].clientX; }}
    onTouchEnd={swipe}
  >
    <div className="promo-slider-track" style={{ transform: `translateX(-${index * 100}%)` }}>
      {valid.map(b => <PromoBanner key={b.id} banner={b} onProductClick={onProductClick}/>) }
    </div>
    {valid.length > 1 && <div className="promo-dots" role="tablist" aria-label="Promo banner pages">
      {valid.map((b, i) => <button
        key={b.id}
        type="button"
        className={`promo-dot ${i === index ? "active" : ""}`}
        onClick={() => setIndex(i)}
        aria-label={`Go to promo banner ${i + 1}`}
        aria-selected={i === index}
      />)}
    </div>}
  </section>;
}

export default PromoBanner;
