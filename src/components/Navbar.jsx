import { useState } from "react";
import { FaShoppingCart, FaSearch, FaUser, FaTimes, FaHeart } from "react-icons/fa";
import logo from "../asset/logo.png";

function Navbar({ cartCount, wishlistCount, onCartClick, onProfileClick, onWishlistClick, onSearch }) {
  const goToCategories = (e) => {
    e.preventDefault();
    document.getElementById("feature-categories")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const closeSearch = () => { setSearchText(""); onSearch(""); setSearchOpen(false); };
  return <nav className="navbar premium-navbar">
    <div className={`navbar-container ${searchOpen ? "search-mode" : ""}`}>
      {!searchOpen ? <>
        <a href="#" className="navbar-logo"><img src={logo} alt="ZYNIX CART" className="navbar-logo-image" /></a>
        <div className="nav-links"><a href="#">Home</a><a href="#feature-categories" onClick={goToCategories}>Categories</a><a href="#products">Shop</a><a href="#footer">Contact</a></div>
        <div className="nav-actions">
          <button onClick={()=>setSearchOpen(true)} aria-label="Search"><FaSearch/></button>
          <button onClick={onWishlistClick} aria-label="Wishlist"><FaHeart/>{wishlistCount > 0 && <span>{wishlistCount}</span>}</button>
          <button onClick={onProfileClick} aria-label="Profile"><FaUser/></button>
          <button className="cart-btn" onClick={onCartClick} aria-label="Shopping Cart"><FaShoppingCart/>{cartCount > 0 && <span>{cartCount}</span>}</button>
        </div>
      </> : <div className="navbar-search-inline">
        <FaSearch className="inline-search-icon"/>
        <input autoFocus type="search" value={searchText} onChange={e=>{const value=e.target.value;setSearchText(value);onSearch(value)}} onKeyDown={e=>{if(e.key === "Escape") closeSearch();}} placeholder="Search smart gadgets..."/>
        {searchText && <button className="inline-search-clear" onClick={()=>{setSearchText("");onSearch("")}} aria-label="Clear search"><FaTimes/></button>}
        <button className="inline-search-close" onClick={closeSearch} aria-label="Close search"><FaTimes/></button>
      </div>}
    </div>
  </nav>;
}

export default Navbar;
