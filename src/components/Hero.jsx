import { useEffect, useRef, useState } from "react";
import heroImage from "../asset/hero.png";
import lampImage from "../asset/lamp.png";
import fanImage from "../asset/fan.png";
import humidifierImage from "../asset/humidifier.png";
import smartwatchImage from "../asset/smartwatch.png";

export const DEFAULT_HERO_BANNERS = [
  { id: "hero-main", image: heroImage, tone: "ice", target: "fan" },
];
export const DEFAULT_SIDE_BANNERS = [
  { id: "side-fan", image: fanImage, tone: "ice", target: "fan", title: "Premium Fan" },
  { id: "side-lamp", image: lampImage, tone: "silver", target: "lamp", title: "Smart Lamp" },
];

function Hero({ onProductClick, banners = DEFAULT_HERO_BANNERS, sideBanners = DEFAULT_SIDE_BANNERS }) {
  const safeBanners = banners?.length ? banners : DEFAULT_HERO_BANNERS;
  const [active, setActive] = useState(0);
  const touchStartX = useRef(null);
  const current = safeBanners[active % safeBanners.length];
  const safeSideBanners = sideBanners?.length ? sideBanners.slice(0, 2) : DEFAULT_SIDE_BANNERS;

  useEffect(() => setActive((v) => Math.min(v, Math.max(0, safeBanners.length - 1))), [safeBanners.length]);
  useEffect(() => {
    if (safeBanners.length < 2) return undefined;
    const timer = setInterval(() => {
      setActive((v) => (v + 1) % safeBanners.length);
    }, 4200);
    return () => clearInterval(timer);
  }, [safeBanners.length]);

  const go = (item) => onProductClick?.(item.target || item.id);
  const onTouchStart = (e) => { touchStartX.current = e.touches[0]?.clientX ?? null; };
  const onTouchEnd = (e) => {
    if (touchStartX.current == null || safeBanners.length < 2) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    if (Math.abs(delta) > 45) setActive((v) => delta < 0 ? (v + 1) % safeBanners.length : (v - 1 + safeBanners.length) % safeBanners.length);
    touchStartX.current = null;
  };

  return (
    <section
      className="hero-banner-shell"
      aria-label="Featured Zynix gadgets"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="hero-banner-layout">
        <article className="hero-banner-main" onClick={() => go(current)}>
          <div className="hero-banner-track" style={{ transform: `translateX(-${active * 100}%)` }}>
            {safeBanners.map((item, index) => (
              <div className={`hero-banner-slide tone-${item.tone || "silver"}`} key={item.id || index}>
                <img src={item.image} alt={item.title || "ZYNIX CART featured banner"} className="hero-banner-image" />
              </div>
            ))}
          </div>
          <div className="premium-hero-glow" />
          <div className="hero-white-orbit hero-white-orbit-one" />
          <div className="hero-white-orbit hero-white-orbit-two" />
          <div className="hero-white-spark hero-white-spark-one" />
          <div className="hero-white-spark hero-white-spark-two" />
          {safeBanners.length > 1 && (
            <div className="hero-banner-dots hero-main-dots" role="tablist" aria-label="Featured banners">
              {safeBanners.map((item, index) => (
                <button
                  key={item.id || index}
                  type="button"
                  className={index === active ? "active" : ""}
                  aria-label={`Go to banner ${index + 1}`}
                  aria-selected={index === active}
                  onClick={(e) => { e.stopPropagation(); setActive(index); }}
                />
              ))}
            </div>
          )}
        </article>
        <div className="hero-banner-side">
          {safeSideBanners.map((item) => (
            <article key={item.id} className={`hero-banner-small tone-${item.tone || "silver"}`} onClick={() => go(item)}>
              <div className="hero-small-glow" /><div className="hero-white-spark hero-small-spark" />
              <img src={item.image} alt={item.title || "ZYNIX CART banner"} onLoad={(e) => { if (e.currentTarget.naturalWidth / e.currentTarget.naturalHeight >= 1.35) e.currentTarget.classList.add("wide-banner-image"); }} />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
export default Hero;
