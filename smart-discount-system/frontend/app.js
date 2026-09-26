import React, { useState, useMemo } from "react";
import {
  ShoppingCart,
  User,
  Shield,
  Tag,
  Percent,
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Clock,
  Lock,
  LogOut,
} from "lucide-react";

// --- SEED DATA & CONSTANTS ---
const CATEGORIES = [
  "Electronics",
  "Computers & Accessories",
  "Mobile & Tablets",
  "Smart Home & Automation",
  "Office Supplies & Furniture",
  "Audio & Wearables",
  "Gaming & Entertainment",
  "Networking & Security",
  "Kitchen Appliances",
  "Tools & Hardware",
];

// Dynamically seed 100 products evenly across the 10 categories (10 items per category)
const PRODUCTS = Array.from({ length: 100 }, (_, i) => {
  const catIndex = Math.floor(i / 10);
  const catName = CATEGORIES[catIndex];
  const itemNum = (i % 10) + 1;
  const basePrice = Math.floor((i + 1) * 350 + (i % 3) * 120);

  return {
    id: `PRD-${1000 + i}`,
    name: `${catName.split(" ")[0]} Item #${itemNum}`,
    category: catName,
    price: basePrice,
    stock: 15 + (i % 20),
  };
});

// Pre-configured Discount Codes
const DISCOUNT_CODES = {
  WELCOME10: { type: "PERCENT", value: 10, minSubtotal: 1000 },
  FLAT500: { type: "FLAT", value: 500, minSubtotal: 5000 },
  MEGA15: { type: "PERCENT", value: 15, minSubtotal: 15000 },
};

// Pre-configured Loyalty Tiers
const LOYALTY_TIERS = {
  Regular: 0,
  Silver: 0.05,
  Gold: 0.1,
  Platinum: 0.15,
};

// System Accounts
const INITIAL_USERS = [
  {
    username: "admin",
    passKey: "admin124",
    role: "ADMIN",
    status: "Granted",
  },
  {
    username: "cashier1",
    passKey: "pass123",
    role: "USER",
    status: "Granted",
  },
  {
    username: "pending_john",
    passKey: "pass123",
    role: "USER",
    status: "Pending Admin Approval",
  },
];

export default function AIDrivenPOS() {
  // Auth state
  const [currentUser, setCurrentUser] = useState(null);
  const [authInput, setAuthInput] = useState({ username: "", passKey: "" });
  const [authError, setAuthError] = useState("");

  // Users Management state
  const [userList, setUserList] = useState(INITIAL_USERS);

  // POS State
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Discounts & Loyalty
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [couponError, setCouponError] = useState("");
  const [activeCoupon, setActiveCoupon] = useState(null);
  const [loyaltyTier, setLoyaltyTier] = useState("Regular");

  // Transaction Receipt state
  const [lastReceipt, setLastReceipt] = useState(null);

  // --- HANDLERS ---
  const handleLogin = (e) => {
    e.preventDefault();
    setAuthError("");

    const targetUser = userList.find(
      (u) => u.username === authInput.username && u.passKey === authInput.passKey
    );

    if (!targetUser) {
      setAuthError("Invalid credentials provided.");
      return;
    }

    if (targetUser.status !== "Granted") {
      setAuthError("Account status is 'Pending Admin Approval'. Contact Admin.");
      return;
    }

    setCurrentUser(targetUser);
    setAuthInput({ username: "", passKey: "" });
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCart([]);
    setActiveCoupon(null);
    setAppliedCoupon("");
    setLastReceipt(null);
  };

  const handleApproveUser = (username) => {
    setUserList((prev) =>
      prev.map((u) => (u.username === username ? { ...u, status: "Granted" } : u))
    );
  };

  // Cart Functions
  const addToCart = (product) => {
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prevCart;
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevCart, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id, delta) => {
    setCart((prevCart) =>
      prevCart
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            return newQty > 0 && newQty <= item.stock
              ? { ...item, quantity: newQty }
              : item;
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (id) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== id));
  };

  // Coupon handling
  const applyCouponCode = () => {
    setCouponError("");
    const codeKey = appliedCoupon.trim().toUpperCase();
    const config = DISCOUNT_CODES[codeKey];

    if (!config) {
      setCouponError("Invalid promo code.");
      setActiveCoupon(null);
      return;
    }

    if (subtotal < config.minSubtotal) {
      setCouponError(
        `Minimum subtotal of ₹${config.minSubtotal.toLocaleString()} required for ${codeKey}.`
      );
      setActiveCoupon(null);
      return;
    }

    setActiveCoupon({ code: codeKey, ...config });
  };

  // Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  }, [cart]);

  const loyaltyDiscount = useMemo(() => {
    const rate = LOYALTY_TIERS[loyaltyTier] || 0;
    return subtotal * rate;
  }, [subtotal, loyaltyTier]);

  const couponDiscount = useMemo(() => {
    if (!activeCoupon) return 0;
    if (subtotal < activeCoupon.minSubtotal) return 0; // Invalidated if subtotal drops

    if (activeCoupon.type === "PERCENT") {
      return (subtotal - loyaltyDiscount) * (activeCoupon.value / 100);
    } else if (activeCoupon.type === "FLAT") {
      return activeCoupon.value;
    }
    return 0;
  }, [subtotal, loyaltyDiscount, activeCoupon]);

  const totalDiscount = loyaltyDiscount + couponDiscount;
  const taxableSubtotal = Math.max(0, subtotal - totalDiscount);
  const gstTax = taxableSubtotal * 0.18; // 18% GST calculation
  const grandTotal = taxableSubtotal + gstTax;

  const handleCheckout = () => {
    if (cart.length === 0) return;

    const receipt = {
      orderId: `ORD-${Math.floor(100000 + Math.random() * 900000)}`,
      timestamp: new Date().toLocaleString(),
      cashier: currentUser.username,
      items: [...cart],
      loyaltyTier,
      subtotal,
      loyaltyDiscount,
      couponDiscount,
      taxableSubtotal,
      gstTax,
      grandTotal,
    };

    setLastReceipt(receipt);
    setCart([]);
    setActiveCoupon(null);
    setAppliedCoupon("");
  };

  // Filtered Products
  const filteredProducts = PRODUCTS.filter((p) => {
    const matchesCategory =
      selectedCategory === "All" || p.category === selectedCategory;
    const matchesQuery =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  // --- RENDER LOGIN IF NOT AUTHENTICATED ---
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-slate-100">
        <div className="bg-slate-800 p-8 rounded-xl shadow-2xl w-full max-w-md border border-slate-700">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-blue-600 p-3 rounded-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">OmniEngine POS</h1>
              <p className="text-xs text-slate-400">Enterprise Studio Authentication</p>
            </div>
          </div>

          {authError && (
            <div className="mb-4 p-3 bg-red-950/60 border border-red-500/50 rounded text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Username
              </label>
              <input
                type="text"
                required
                className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-sm focus:outline-none focus:border-blue-500"
                placeholder="e.g. admin or cashier1"
                value={authInput.username}
                onChange={(e) => setAuthInput({ ...authInput, username: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                PassKey
              </label>
              <input
                type="password"
                required
                className="w-full bg-slate-900 border border-slate-700 rounded p-2.5 text-sm focus:outline-none focus:border-blue-500"
                placeholder="Enter password"
                value={authInput.passKey}
                onChange={(e) => setAuthInput({ ...authInput, passKey: e.target.value })}
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 font-semibold p-2.5 rounded text-sm transition"
            >
              Sign In
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-700/60 text-xs text-slate-400 space-y-1">
            <p className="font-semibold text-slate-300">Default Credentials:</p>
            <p>• Admin: <code className="text-blue-400">admin</code> / <code className="text-blue-400">admin124</code></p>
            <p>• Cashier: <code className="text-blue-400">cashier1</code> / <code className="text-blue-400">pass123</code></p>
            <p>• Pending: <code className="text-blue-400">pending_john</code> / <code className="text-blue-400">pass123</code></p>
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN APPLICATION INTERFACE ---
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">OmniEngine POS</h1>
            <p className="text-xs text-slate-400">Enterprise Studio v2.4</p>
          </div>
        </div>

        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2 text-sm bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700">
            <User className="w-4 h-4 text-blue-400" />
            <span className="font-medium">{currentUser.username}</span>
            <span className="text-xs px-2 py-0.5 bg-blue-950 text-blue-300 rounded border border-blue-800 font-mono">
              {currentUser.role}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="text-slate-400 hover:text-red-400 transition flex items-center space-x-1 text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Main Content Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left/Middle Column: Products & Management */}
        <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-6">
          {/* Admin Management Panel (If ADMIN) */}
          {currentUser.role === "ADMIN" && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" /> Admin Access Controls: User Approvals
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {userList.map((user) => (
                  <div
                    key={user.username}
                    className="bg-slate-800 p-3 rounded border border-slate-700/70 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-200">{user.username}</p>
                      <p className="text-xs text-slate-400">Role: {user.role}</p>
                      <p className="text-[10px] mt-1 font-mono">
                        Status:{" "}
                        <span
                          className={
                            user.status === "Granted"
                              ? "text-emerald-400"
                              : "text-amber-400"
                          }
                        >
                          {user.status}
                        </span>
                      </p>
                    </div>
                    {user.status !== "Granted" && (
                      <button
                        onClick={() => handleApproveUser(user.username)}
                        className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 rounded transition flex items-center gap-1"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Approve
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Product Catalog Controls */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search 100 inventory items..."
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Categories scrollable bar */}
            <div className="w-full md:w-auto flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
              <button
                onClick={() => setSelectedCategory("All")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                  selectedCategory === "All"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-900 text-slate-400 hover:bg-slate-800"
                }`}
              >
                All
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                    selectedCategory === cat
                      ? "bg-blue-600 text-white"
                      : "bg-slate-900 text-slate-400 hover:bg-slate-800"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 flex-1 overflow-y-auto pr-1">
            {filteredProducts.map((product) => {
              const cartItem = cart.find((i) => i.id === product.id);
              const inCartQty = cartItem ? cartItem.quantity : 0;
              const isOut = product.stock - inCartQty <= 0;

              return (
                <div
                  key={product.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition"
                >
                  <div>
                    <span className="text-[10px] font-mono uppercase bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                      {product.category}
                    </span>
                    <h3 className="font-semibold text-sm text-slate-200 mt-2">
                      {product.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{product.id}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-emerald-400">
                        ₹{product.price.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Stock: {product.stock - inCartQty}
                      </p>
                    </div>

                    <button
                      onClick={() => addToCart(product)}
                      disabled={isOut}
                      className={`p-2 rounded-lg transition ${
                        isOut
                          ? "bg-slate-800 text-slate-600 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-500 text-white"
                      }`}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active Terminal Cart & Billing */}
        <div className="w-96 bg-slate-900 border-l border-slate-800 flex flex-col">
          {/* Cart Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShoppingCart className="w-5 h-5 text-blue-400" />
              <h2 className="font-bold text-base">Terminal Order</h2>
            </div>
            <span className="text-xs bg-slate-800 px-2.5 py-1 rounded-full text-slate-400 font-mono">
              {cart.reduce((a, b) => a + b.quantity, 0)} items
            </span>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm">
                <ShoppingCart className="w-10 h-10 mb-2 stroke-1" />
                <p>Terminal cart is empty</p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-950 p-3 rounded-lg border border-slate-800/80 flex items-center justify-between"
                >
                  <div className="flex-1 pr-2">
                    <p className="text-xs font-medium text-slate-200 line-clamp-1">
                      {item.name}
                    </p>
                    <p className="text-xs text-emerald-400 font-mono mt-0.5">
                      ₹{item.price.toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="flex items-center border border-slate-700 rounded bg-slate-900">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-2 text-xs font-mono">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="p-1 text-slate-500 hover:text-red-400 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Configuration & Order Summary */}
          <div className="p-4 border-t border-slate-800 space-y-3 bg-slate-900/50">
            {/* Loyalty Tier Selector */}
            <div>
              <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1 flex items-center gap-1">
                <Percent className="w-3 h-3 text-blue-400" /> Customer Loyalty Tier
              </label>
              <select
                value={loyaltyTier}
                onChange={(e) => setLoyaltyTier(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs focus:outline-none focus:border-blue-500"
              >
                <option value="Regular">Regular Tier (0% OFF)</option>
                <option value="Silver">Silver Tier (5% OFF)</option>
                <option value="Gold">Gold Tier (10% OFF)</option>
                <option value="Platinum">Platinum Tier (15% OFF)</option>
              </select>
            </div>

            {/* Discount Code Input */}
            <div>
              <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1 flex items-center gap-1">
                <Tag className="w-3 h-3 text-emerald-400" /> Apply Discount Coupon
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="WELCOME10 / FLAT500"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded p-2 text-xs uppercase focus:outline-none focus:border-blue-500"
                  value={appliedCoupon}
                  onChange={(e) => setAppliedCoupon(e.target.value)}
                />
                <button
                  onClick={applyCouponCode}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1 text-xs rounded font-medium border border-slate-700"
                >
                  Apply
                </button>
              </div>
              {couponError && (
                <p className="text-[10px] text-red-400 mt-1">{couponError}</p>
              )}
              {activeCoupon && (
                <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Coupon '{activeCoupon.code}' applied
                </p>
              )}
            </div>

            {/* Financial Calculations Breakdown */}
            <div className="pt-2 border-t border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal</span>
                <span className="font-mono">₹{subtotal.toLocaleString()}</span>
              </div>

              {loyaltyDiscount > 0 && (
                <div className="flex justify-between text-blue-400">
                  <span>Loyalty ({loyaltyTier})</span>
                  <span className="font-mono">-₹{loyaltyDiscount.toLocaleString()}</span>
                </div>
              )}

              {couponDiscount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Coupon ({activeCoupon?.code})</span>
                  <span className="font-mono">-₹{couponDiscount.toLocaleString()}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-400">
                <span>GST (18%)</span>
                <span className="font-mono">₹{gstTax.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>

              <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-slate-800">
                <span>Grand Total</span>
                <span className="font-mono text-emerald-400">
                  ₹{grandTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Final Checkout Button */}
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0}
              className={`w-full py-3 rounded-lg font-bold text-sm transition mt-2 ${
                cart.length === 0
                  ? "bg-slate-800 text-slate-600 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20"
              }`}
            >
              Complete Sale Transaction
            </button>
          </div>
        </div>
      </div>

      {/* RECEIPT MODAL OVERLAY */}
      {lastReceipt && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-sm w-full p-6 text-slate-100 shadow-2xl space-y-4">
            <div className="text-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-emerald-400">OmniEngine Store</h3>
              <p className="text-xs text-slate-400">Official Sale Tax Invoice</p>
            </div>

            <div className="text-xs space-y-1 font-mono text-slate-400 border-b border-slate-800 pb-3">
              <p>Order ID: {lastReceipt.orderId}</p>
              <p>Date: {lastReceipt.timestamp}</p>
              <p>Cashier: {lastReceipt.cashier}</p>
              <p>Loyalty Tier: {lastReceipt.loyaltyTier}</p>
            </div>

            {/* Receipt Items */}
            <div className="space-y-2 max-h-40 overflow-y-auto text-xs pr-1">
              {lastReceipt.items.map((item) => (
                <div key={item.id} className="flex justify-between">
                  <div>
                    <p className="text-slate-200">{item.name}</p>
                    <p className="text-slate-500 font-mono">
                      {item.quantity} x ₹{item.price.toLocaleString()}
                    </p>
                  </div>
                  <p className="font-mono text-slate-300">
                    ₹{(item.quantity * item.price).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>

            {/* Receipt Totals Breakdown */}
            <div className="border-t border-slate-800 pt-3 space-y-1 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal:</span>
                <span>₹{lastReceipt.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Discounts:</span>
                <span>-₹{(lastReceipt.loyaltyDiscount + lastReceipt.couponDiscount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>GST (18%):</span>
                <span>₹{lastReceipt.gstTax.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-emerald-400 pt-2 border-t border-slate-800">
                <span>Total Paid:</span>
                <span>₹{lastReceipt.grandTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            <button
              onClick={() => setLastReceipt(null)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold py-2.5 rounded transition"
            >
              Dismiss Receipt
            </button>
          </div>
        </div>
      )}
    </div>
  );
}