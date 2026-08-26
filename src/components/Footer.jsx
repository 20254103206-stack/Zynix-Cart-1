import logo from "../asset/logo.png";
import { PromoBannerCarousel } from "./PromoBanner";
import { FaFacebookF, FaInstagram, FaTiktok, FaWhatsapp, FaFacebookMessenger } from "react-icons/fa";

const SOCIAL_LINKS = {
  facebook: "https://www.facebook.com/share/1DjFaoQ3dd/",
  instagram: "https://www.instagram.com/zynixcart?igsi=ZDFrZ3dwbWxodWQ4",
  tiktok: "https://www.tiktok.com/@zynix.cart?is_from_webapp=1&sender_device=pc",
  whatsapp: "https://wa.me/8801616760214",
  messenger: "https://m.me/zynixcart",
};

function Footer({settings={}, promoBanners=[], onProductClick}){
  return <>


    {promoBanners.filter(b=>b.placement === "footer").length > 0 && <PromoBannerCarousel banners={promoBanners.filter(b=>b.placement === "footer")} onProductClick={onProductClick}/>}

    <footer className="footer" id="footer">
      <div className="footer-container">
        <div className="footer-brand">
          <img src={logo} alt="ZYNIX CART" className="footer-logo"/>
          <p>{settings.footerTagline||"Smart gadgets designed for a smarter, easier and better life."}</p>
          <div className="footer-socials">
            <a href={SOCIAL_LINKS.facebook} target="_blank" rel="noreferrer" aria-label="Facebook"><FaFacebookF/></a>
            <a href={SOCIAL_LINKS.instagram} target="_blank" rel="noreferrer" aria-label="Instagram"><FaInstagram/></a>
            <a href={SOCIAL_LINKS.tiktok} target="_blank" rel="noreferrer" aria-label="TikTok"><FaTiktok/></a>
          </div>
        </div>

        <div className="footer-column">
          <h3>Quick Links</h3>
          <a href="#">Home</a>
          <a href="#products">Shop</a>
          <a href="#footer">About Us</a>
        </div>

        <div className="footer-column">
          <h3>Customer Care</h3>
          <a href={SOCIAL_LINKS.messenger} target="_blank" rel="noreferrer">Messenger Support</a>
          <a href={SOCIAL_LINKS.whatsapp} target="_blank" rel="noreferrer">WhatsApp Support</a>
          <a href="#">Shipping & Delivery</a>
          <a href="#">Returns & Refunds</a>
        </div>

        <div className="footer-column">
          <h3>Contact</h3>
          <p>📍 Dhaka, Bangladesh</p>
          <p>📧 zynixcart0@gmail.com</p>
          <a href={SOCIAL_LINKS.whatsapp} target="_blank" rel="noreferrer">📞 +880 1616-760214</a>
        </div>
      </div>

      <div className="footer-bottom">
        <p>© 2026 ZYNIX CART. All Rights Reserved.</p>
        <div><a href="#">Privacy Policy</a><a href="#">Terms & Conditions</a></div>
      </div>
    </footer>

    <div className="floating-support" aria-label="Customer support">
      <a className="support-fab messenger-fab" href={SOCIAL_LINKS.messenger} target="_blank" rel="noreferrer" aria-label="Messenger Support">
        <FaFacebookMessenger/><span>Support</span>
      </a>
      <a className="support-fab whatsapp-fab" href={SOCIAL_LINKS.whatsapp} target="_blank" rel="noreferrer" aria-label="WhatsApp Support">
        <FaWhatsapp/><span>WhatsApp</span>
      </a>
    </div>
  </>
}

export default Footer;
