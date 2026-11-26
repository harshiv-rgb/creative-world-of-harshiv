/* The Creative World of Harshiv — Red and White Firebase Shop */

import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  collection,
  query,
  where,
  deleteDoc,
  updateDoc,
  deleteField
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-storage.js";


/* FIREBASE CONFIGURATION */

const firebaseConfig = {
  apiKey: "AIzaSyDPqL93rmuXdrIJPkejOL_cjod2VTcgNzM",
  authDomain: "the-creative-world-of-harshiv.firebaseapp.com",
  projectId: "the-creative-world-of-harshiv",
  storageBucket: "the-creative-world-of-harshiv.firebasestorage.app",
  messagingSenderId: "618891651647",
  appId: "1:618891651647:web:b75b37d250c00b0b65e68a",
  measurementId: "G-E52JQLLF34"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);

const ADMIN_UID = "7SgbiCsfqFS2WsxFV2";

const shopSettingsRef = doc(db, "settings", "shop");
const productsRef = collection(db, "products");
const ordersRef = collection(db, "orders");

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
];


/* GOOGLE PAY SETTINGS */

const UPI_ID = "varunshilpa90@okhdfcbank";


/* DEFAULT PRODUCTS */

const DEFAULT_PRODUCTS = [
  {
    id: "p1",
    name: "Handmade Bookmarks",
    description: "Creative bookmarks for readers and book lovers.",
    price: 50,
    symbol: "🔖"
  },
  {
    id: "p2",
    name: "Science Projects",
    description: "Small creative school projects for young learners.",
    price: 150,
    symbol: "🔬"
  },
  {
    id: "p3",
    name: "Handmade Cards",
    description: "Personalized cards for special occasions.",
    price: 80,
    symbol: "💌"
  },
  {
    id: "p4",
    name: "Pen Stands",
    description: "Handmade desk creations for your stationery.",
    price: 120,
    symbol: "✏️"
  }
];


/* BASIC HELPERS */

const $ = s => document.querySelector(s);

const read = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
};

const save = (key, value) =>
  localStorage.setItem(key, JSON.stringify(value));

const money = n =>
  "₹" + Number(n || 0).toLocaleString("en-IN");


let products = [];
let cart = read("cwh_cart", []);
let orders = [];

let settings = { whatsapp: "" };

let customization = read("cwh_customization", "");
let customizationSaved = Boolean(customization);

let shopSettingsLoaded = false;
let isAdmin = false;
let currentUser = null;
let customerOrders = [];
let productSeedStarted = false;

let ordersUnsubscribe = null;
let customerOrdersUnsubscribe = null;
let previewObjectUrl = null;


function toast(msg) {
  const t = $("#toast");
  if (!t) return;

  t.textContent = msg;
  t.style.display = "block";

  setTimeout(() => {
    t.style.display = "none";
  }, 2800);
}


function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}


/* DISCOUNT HELPERS */

function getOriginalPrice(product) {
  const original = Number(product.originalPrice);
  const selling = Number(product.price);

  if (
    Number.isFinite(original) &&
    original > selling &&
    selling >= 0
  ) {
    return original;
  }

  return null;
}


function getDiscountPercentage(product) {
  const original = getOriginalPrice(product);
  if (!original) return 0;

  return Math.round(
    ((original - Number(product.price)) / original) * 100
  );
}


function getProductPriceHTML(product) {
  const original = getOriginalPrice(product);
  const selling = Number(product.price);
  const discount = getDiscountPercentage(product);

  if (!original) {
    return `
      <div class="price-block product-pricing">
        <span class="price">${money(selling)}</span>
      </div>
    `;
  }

  return `
    <div class="price-block product-pricing">
      <del class="original-price">${money(original)}</del>
      <strong class="price">${money(selling)}</strong>
      <span class="discount-badge">${discount}% OFF</span>
    </div>
  `;
}


/* PRICE CALCULATIONS */
/* Delivery is already included in product prices. */

function getSubtotal(items = cart) {
  return items.reduce((sum, item) => {
    const product = products.find(p => p.id === item.id);
    if (!product) return sum;

    return sum + Number(product.price) * Number(item.qty);
  }, 0);
}


function getFinalTotal(subtotal, extraCharges = 0) {
  return Number(subtotal) + Number(extraCharges || 0);
}


function updateCheckoutPrices() {
  const subtotal = getSubtotal();

  const subtotalElement = $("#checkoutSubtotal");
  const deliveryElement = $("#checkoutDelivery");
  const totalElement = $("#checkoutTotal");

  if (subtotalElement) {
    subtotalElement.textContent = money(subtotal);
  }

  if (deliveryElement) {
    deliveryElement.textContent = "Included";
  }

  if (totalElement) {
    totalElement.textContent = money(getFinalTotal(subtotal));
  }
}


/* PRODUCT DETAILS WINDOW */

const productModal = document.createElement("div");

productModal.id = "productDetailsModal";
productModal.className =
  "product-details-modal product-modal hidden";

productModal.innerHTML = `
  <div class="product-modal-backdrop" data-close-product></div>

  <div
    class="product-details-card product-modal-content"
    role="dialog"
    aria-modal="true"
    aria-labelledby="productModalName"
  >
    <button
      type="button"
      class="details-close product-modal-close"
      aria-label="Close product details"
      data-close-product
    >×</button>

    <div class="product-details-content" id="productModalContent"></div>
  </div>
`;

document.body.appendChild(productModal);


function closeProductDetails() {
  productModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
}


function openProductDetails(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  const image = product.imageUrl
    ? `
      <img
        class="product-details-image product-modal-image"
        src="${escapeHtml(product.imageUrl)}"
        alt="${escapeHtml(product.name)}"
      >
    `
    : `
      <div class="product-modal-symbol">
        ${escapeHtml(product.symbol || "🎁")}
      </div>
    `;

  $("#productModalContent").innerHTML = `
    <div class="product-detail-layout">
      <div class="product-detail-image-wrap">${image}</div>

      <div class="product-detail-info">
        <p class="eyebrow">PRODUCT DETAILS</p>

        <h2 id="productModalName">
          ${escapeHtml(product.name)}
        </h2>

        ${getProductPriceHTML(product)}

        <div class="product-detail-description">
          ${escapeHtml(product.description || "Handmade creation.")}
        </div>

        <p class="tiny muted">
          Price includes delivery charges.
        </p>

        <button
          type="button"
          class="primary-btn wide"
          id="modalAddToCart"
        >
          Add to cart
        </button>
      </div>
    </div>
  `;

  $("#modalAddToCart").onclick = () => {
    addToCart(product.id);
    closeProductDetails();
  };

  productModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
}


productModal.addEventListener("click", e => {
  if (e.target.closest("[data-close-product]")) {
    closeProductDetails();
  }
});


document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    closeProductDetails();
  }
});


/* SHARED WHATSAPP SETTINGS */

onSnapshot(shopSettingsRef, snapshot => {
  settings = snapshot.exists()
    ? { whatsapp: String(snapshot.data().whatsapp || "") }
    : { whatsapp: "" };

  shopSettingsLoaded = true;

  const input = $("#settingsForm")?.elements?.whatsapp;

  if (input && document.activeElement !== input) {
    input.value = settings.whatsapp;
  }

}, error => {
  console.error(error);
  shopSettingsLoaded = false;
  toast("Could not load shop settings.");
});


/* SHARED PRODUCTS */

onSnapshot(productsRef, async snapshot => {
  products = snapshot.docs.map(d => ({
    ...d.data(),
    id: d.id
  }));

  renderProducts();
  renderCart();

  if (isAdmin) renderAdmin();

  if (snapshot.empty && isAdmin && !productSeedStarted) {
    productSeedStarted = true;

    try {
      const localProducts = read(
        "cwh_products",
        DEFAULT_PRODUCTS
      );

      const initialProducts =
        Array.isArray(localProducts) && localProducts.length
          ? localProducts
          : DEFAULT_PRODUCTS;

      for (const p of initialProducts) {
        const productData = {
          id: String(p.id),
          name: String(p.name),
          description: String(p.description || ""),
          price: Number(p.price),
          symbol: String(p.symbol || "🎁")
        };

        const original = Number(p.originalPrice);

        if (
          Number.isFinite(original) &&
          original > productData.price
        ) {
          productData.originalPrice = original;
        }

        await setDoc(
          doc(db, "products", String(p.id)),
          productData
        );
      }

      toast("Products uploaded to Firebase!");

    } catch (error) {
      console.error("Product initialization error:", error);
      productSeedStarted = false;
      toast("Could not initialize products.");
    }
  }

}, error => {
  console.error("Product loading error:", error);
  toast("Could not load products. Check Firebase rules.");
});


/* NAVIGATION */

function show(view) {
  document.querySelectorAll(".view").forEach(x => {
    x.classList.add("hidden");
  });

  const target = $("#" + view + "View");

  if (target) target.classList.remove("hidden");

  document.querySelectorAll(".nav-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.view === view);
  });

  if (view === "cart") renderCart();
  if (view === "admin") renderAdmin();
  if (view === "account") renderCustomerAccount();
}


document.querySelectorAll(".nav-btn").forEach(b => {
  b.addEventListener("click", () => show(b.dataset.view));
});


document.querySelectorAll("[data-go]").forEach(b => {
  b.addEventListener("click", () => {
    document.getElementById("catalog").scrollIntoView({
      behavior: "smooth"
    });
  });
});


/* CART */

function cartQty() {
  return cart.reduce((a, x) => a + x.qty, 0);
}


function updateCount() {
  $("#cartCount").textContent = cartQty();
}


function addToCart(id) {
  const product = products.find(p => p.id === id);

  if (!product) {
    toast("This product is no longer available.");
    return;
  }

  const item = cart.find(x => x.id === id);

  if (item) {
    item.qty++;
  } else {
    cart.push({ id, qty: 1 });
  }

  save("cwh_cart", cart);
  updateCount();
  renderCart();

  toast("Added to your cart.");
}


/* DISPLAY PRODUCTS */

function renderProducts() {
  $("#productGrid").innerHTML = products.map(p => `
    <article class="product">
      <button
        type="button"
        class="product-open"
        data-product-details="${escapeHtml(p.id)}"
        aria-label="View details for ${escapeHtml(p.name)}"
      >
        <div class="product-art">
          ${p.imageUrl
            ? `<img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}" loading="lazy">`
            : `<span>${escapeHtml(p.symbol || "🎁")}</span>`
          }
        </div>

        <div class="product-info">
          <h3>${escapeHtml(p.name)}</h3>
          <p>${escapeHtml(p.description || "Handmade creation.")}</p>
          <p class="delivery-included-note">Price includes delivery charges.</p>
          ${getProductPriceHTML(p)}
          <span class="view-details-label">
            View product details →
          </span>
        </div>
      </button>

      <div class="product-card-action">
        <button type="button" data-add="${escapeHtml(p.id)}">
          Add to cart
        </button>
      </div>
    </article>
  `).join("");

  document.querySelectorAll("[data-add]").forEach(b => {
    b.addEventListener("click", () => addToCart(b.dataset.add));
  });

  document.querySelectorAll("[data-product-details]").forEach(b => {
    b.addEventListener("click", () => {
      openProductDetails(b.dataset.productDetails);
    });
  });
}


/* DISPLAY CART */

function renderCart() {
  const wrap = $("#cartContents");
  const checkout = $("#checkoutWrap");

  if (!cart.length) {
    wrap.innerHTML = `
      <div class="panel">
        <p>Your cart is empty.</p>
        <button class="primary-btn" id="backShop">
          Continue shopping
        </button>
      </div>
    `;

    checkout.classList.add("hidden");
    $("#backShop").onclick = () => show("shop");
    updateCheckoutPrices();
    return;
  }

  checkout.classList.remove("hidden");

  let subtotal = 0;

  wrap.innerHTML = cart.map(item => {
    const p = products.find(x => x.id === item.id);
    if (!p) return "";

    const line = Number(p.price) * item.qty;
    subtotal += line;

    return `
      <div class="cart-row">
        <div>
          <b>${escapeHtml(p.name)}</b>
          <div class="tiny muted">${money(p.price)} each</div>
          <div class="line-price"><b>${money(line)}</b></div>
        </div>

        <div class="qty">
          <button data-dec="${escapeHtml(p.id)}">−</button>
          <b>${item.qty}</b>
          <button data-inc="${escapeHtml(p.id)}">+</button>
        </div>

        <button class="remove" data-remove="${escapeHtml(p.id)}">
          Remove
        </button>
      </div>
    `;
  }).join("") + `
    <div class="cart-total">
      <strong>Product subtotal: ${money(subtotal)}</strong><br>
      <strong>Delivery charge: Included</strong><br>
      <strong>Final total: ${money(subtotal)}</strong>
    </div>
  `;

  updateCheckoutPrices();

  document.querySelectorAll("[data-inc]").forEach(b => {
    b.onclick = () => changeQty(b.dataset.inc, 1);
  });

  document.querySelectorAll("[data-dec]").forEach(b => {
    b.onclick = () => changeQty(b.dataset.dec, -1);
  });

  document.querySelectorAll("[data-remove]").forEach(b => {
    b.onclick = () => {
      cart = cart.filter(x => x.id !== b.dataset.remove);
      save("cwh_cart", cart);
      updateCount();
      renderCart();
    };
  });
}


function changeQty(id, delta) {
  const x = cart.find(x => x.id === id);
  if (x) x.qty += delta;

  cart = cart.filter(x => x.qty > 0);

  save("cwh_cart", cart);
  updateCount();
  renderCart();
}


/* CUSTOMIZATION FEATURE */

function updateCustomizationDisplay() {
  const display = $("#customizationDisplay");

  if (display) {
    display.textContent = customization || "No customization added.";
  }

  const input = $("#customizationText");

  if (input && document.activeElement !== input) {
    input.value = customization;
  }
}


$("#customizationBtn")?.addEventListener("click", () => {
  const section = $("#customizationSection");

  if (section) section.classList.toggle("hidden");

  const input = $("#customizationText");
  if (input) input.value = customization;
});


$("#saveCustomization")?.addEventListener("click", () => {
  const input = $("#customizationText");

  customization = input ? input.value.trim() : "";
  customizationSaved = Boolean(customization);

  save("cwh_customization", customization);
  updateCustomizationDisplay();

  $("#customizationSection")?.classList.add("hidden");

  toast("Customization saved!");
});


$("#clearCustomization")?.addEventListener("click", () => {
  customization = "";
  customizationSaved = false;

  save("cwh_customization", "");
  updateCustomizationDisplay();

  if ($("#customizationText")) {
    $("#customizationText").value = "";
  }

  toast("Customization removed.");
});


updateCustomizationDisplay();


/* UPI PAYMENT INSTRUCTIONS */
function updatePaymentInstructions() {
  const box = $("#gpayInstructions");
  if (!box) return;
  box.classList.remove("hidden");
  box.innerHTML = `
    <div class="gpay-payment-box">
      <h3>Pay using UPI</h3>
      <p>Press <b>Pay Now</b> to open your UPI app chooser with the shop UPI ID and exact amount prefilled.</p>
      <div class="gpay-number-row"><strong class="gpay-number">${UPI_ID}</strong><button type="button" id="copyGpayNumber" class="secondary-btn">Copy UPI ID</button></div>
      <p class="payment-warning">Before approving, verify that the recipient shown in your UPI app is exactly this UPI ID.</p>
      <p class="tiny muted">Your payment request is saved first as Pending Verification. The shop administrator will verify the payment using the shop bank/UPI records and mark it Paid. Only then will the Confirm Order & Send WhatsApp button appear in My Account.</p>
      <p class="tiny muted">Your UPI app does not automatically notify this website when payment is complete. The shop will verify the payment manually using its bank/UPI records.</p>
    </div>`;
  $("#copyGpayNumber")?.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(UPI_ID); toast("Shop UPI ID copied."); }
    catch { toast("Shop UPI ID: " + UPI_ID); }
  });
}
updatePaymentInstructions();

function getCheckoutValue(name) {
  const form = $("#checkoutForm");
  const field = form?.elements.namedItem(name);
  return field ? String(field.value || "").trim() : "";
}
function getWhatsAppNumber() { return String(settings.whatsapp || "").replace(/\D/g, ""); }
function createWhatsAppMessage(order) {
  const lines = (order.items || []).map(item => `${item.name} x ${item.qty} = ${money(Number(item.price) * Number(item.qty))}`);
  return [
    "CONFIRMED PAID ORDER — THE CREATIVE WORLD OF HARSHIV", "",
    `Order ID: ${order.id}`, `Customer: ${order.name}`, `Phone: ${order.phone}`, `Address: ${order.address}`, "",
    "PRODUCTS:", ...lines, "", `Product subtotal: ${money(order.subtotal)}`,
    "Delivery charge: Included", `Extra charges: ${money(order.extraCharges)}`, `Total: ${money(order.total)}`, "",
    `Payment method: ${order.payment}`, "Payment status: Paid (verified by shop)",
    `Customization: ${order.customization || "None"}`, `Notes: ${order.notes || "None"}`, "",
    "Thank you for shopping with us!"
  ].join("\n");
}

/* SAVE PENDING PAYMENT REQUEST, THEN OPEN UPI APP */
$("#checkoutForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  if (!currentUser || currentUser.uid === ADMIN_UID) { toast("Please sign in with your customer account first."); show("account"); return; }
  if (!cart.length) { toast("Your cart is empty."); return; }
  if (!shopSettingsLoaded) { toast("Please wait while shop settings load."); return; }
  const name=getCheckoutValue("customerName"), phone=getCheckoutValue("phone"), address=getCheckoutValue("address"), notes=getCheckoutValue("notes");
  if (!name || !phone || !address) { toast("Please fill in your name, phone number and address."); return; }
  if (!getWhatsAppNumber()) { toast("Shop WhatsApp number is not configured."); return; }
  const items=cart.map(item => { const p=products.find(x=>x.id===item.id); return p ? {id:p.id,name:p.name,price:Number(p.price),qty:Number(item.qty)} : null; }).filter(Boolean);
  if (!items.length) { toast("Your cart products are no longer available."); return; }
  const subtotal=items.reduce((sum,item)=>sum+item.price*item.qty,0);
  if (!Number.isFinite(subtotal) || subtotal<=0) { toast("Please check your cart total."); return; }
  const id="CWH-"+Date.now();
  const order={id,customerUid:currentUser.uid,customerEmail:currentUser.email||"",date:new Date().toISOString(),name,phone,address,notes,items,subtotal,extraCharges:0,extraChargeReason:"",total:subtotal,customization:customizationSaved?customization:"",payment:"Google Pay / UPI",paymentStatus:"Pending Verification",status:"Payment Pending",orderConfirmed:false};
  const button=$("#placeOrderButton") || $("#checkoutForm button[type='submit']");
  if(button){button.disabled=true;button.textContent="Saving payment request...";}
  try {
    await setDoc(doc(db,"orders",id),order);
    const params=new URLSearchParams({pa:UPI_ID,pn:"The Creative World of Harshiv",am:subtotal.toFixed(2),cu:"INR",tn:`Order ${id}`,tr:id});
    toast("Payment request saved. Opening your UPI app...");
    window.location.href=`upi://pay?${params.toString()}`;
  } catch(error) {
    console.error("Payment request error:",error);
    toast("Payment request could not be saved. Please try again.");
  } finally { if(button){button.disabled=false;button.textContent="Pay Now";} }
});


/* CUSTOMER ACCOUNT AND ORDER HISTORY */

function listenToCustomerOrders(uid) {
  if (customerOrdersUnsubscribe) {
    customerOrdersUnsubscribe();
    customerOrdersUnsubscribe = null;
  }

  const q = query(
    ordersRef,
    where("customerUid", "==", uid)
  );

  customerOrdersUnsubscribe = onSnapshot(q, snapshot => {
    customerOrders = snapshot.docs.map(d => ({
      ...d.data(),
      id: d.id
    }));

    customerOrders.sort((a, b) => {
      return new Date(b.date || 0) - new Date(a.date || 0);
    });

    renderCustomerAccount();

  }, error => {
    console.error("Customer orders error:", error);
    toast("Could not load your orders.");
  });
}


function renderCustomerAccount() {
  const loginPanel = $("#customerLogin");
  const accountPanel = $("#customerAccount");
  const orderContainer = $("#customerOrders");

  if (!currentUser || currentUser.uid === ADMIN_UID) {
    loginPanel?.classList.remove("hidden");
    accountPanel?.classList.add("hidden");

    if (orderContainer) orderContainer.innerHTML = "";
    return;
  }

  loginPanel?.classList.add("hidden");
  accountPanel?.classList.remove("hidden");

  const emailDisplay = $("#customerEmail");

  if (emailDisplay) {
    emailDisplay.textContent = currentUser.email || "";
  }

  if (!orderContainer) return;

  if (!customerOrders.length) {
    orderContainer.innerHTML = `
      <div class="panel">
        <p>You have not placed any orders yet.</p>
      </div>
    `;
    return;
  }

  orderContainer.innerHTML = customerOrders.map(o => {
    const paymentMethod = o.payment || "Google Pay";
    const paymentStatus = o.paymentStatus || "Pending Verification";

    const itemsHTML = (o.items || []).map(item => `
      <div class="order-item">
        ${escapeHtml(item.name)}
        × ${Number(item.qty)}
        — ${money(Number(item.price) * Number(item.qty))}
      </div>
    `).join("");

    const returnStatus = o.returnRequest?.status || "";
    const replacementStatus = o.replacementRequest?.status || "";

    return `
      <article class="panel order-card">
        <div class="order-heading">
          <h3>Order ${escapeHtml(o.id)}</h3>
          <span class="status-badge">
            ${escapeHtml(o.status || "Pending")}
          </span>
        </div>

        <p class="tiny muted">${escapeHtml(o.date || "")}</p>

        <div class="order-items">${itemsHTML}</div>

        <div class="order-total">
          Product subtotal: ${money(o.subtotal)}<br>
          Delivery charge: Included<br>
          Extra charges: ${money(o.extraCharges)}<br>
          <strong>Total: ${money(o.total)}</strong>
        </div>

        <div class="payment-details">
          <p>
            <strong>Payment method:</strong>
            ${escapeHtml(paymentMethod)}
          </p>

          <p>
            <strong>Payment status:</strong>
            ${escapeHtml(paymentStatus)}
          </p>

        </div>
        ${paymentStatus === "Paid" && !o.orderConfirmed ? `
          <div class="request-box"><b>Payment verified!</b><p class="tiny">Confirm your order to send its details to the shop on WhatsApp.</p><button type="button" class="primary-btn wide" data-confirm-paid-order="${escapeHtml(o.id)}">Confirm Order & Send WhatsApp</button></div>
        ` : ""}
        ${o.orderConfirmed ? `<p class="status-pill">Order confirmed</p>` : ""}

        ${o.extraChargeReason ? `
          <p class="extra-charge-notice">
            Extra charge reason:
            ${escapeHtml(o.extraChargeReason)}
          </p>
        ` : ""}

        ${o.customization ? `
          <p>
            <strong>Customization:</strong>
            ${escapeHtml(o.customization)}
          </p>
        ` : ""}

        ${o.notes ? `
          <p><strong>Notes:</strong> ${escapeHtml(o.notes)}</p>
        ` : ""}

        ${returnStatus ? `
          <p>
            <strong>Return request:</strong>
            ${escapeHtml(returnStatus)}
          </p>
        ` : ""}

        ${replacementStatus ? `
          <p>
            <strong>Replacement request:</strong>
            ${escapeHtml(replacementStatus)}
          </p>
        ` : ""}

        ${o.orderConfirmed && !o.returnRequest && !o.replacementRequest &&
          o.status !== "Cancelled" ? `
          <div class="order-actions">
            <button
              type="button"
              class="secondary-btn"
              data-return="${escapeHtml(o.id)}"
            >
              Request Return
            </button>

            <button
              type="button"
              class="secondary-btn"
              data-replacement="${escapeHtml(o.id)}"
            >
              Request Replacement
            </button>
          </div>
        ` : ""}
      </article>
    `;
  }).join("");


  orderContainer.querySelectorAll("[data-confirm-paid-order]").forEach(button => {
    button.addEventListener("click", async () => {
      const id=button.dataset.confirmPaidOrder;
      const order=customerOrders.find(o=>o.id===id);
      if(!order || order.paymentStatus!=="Paid" || order.orderConfirmed){toast("This order is not ready for confirmation.");return;}
      if(!confirm("Confirm this paid order and open WhatsApp to send the order details to the shop?")) return;
      const number=getWhatsAppNumber();
      if(!number){toast("Shop WhatsApp number is not configured.");return;}
      const wa=window.open("about:blank","_blank");
      button.disabled=true;
      try {
        await updateDoc(doc(db,"orders",id),{orderConfirmed:true,status:"Confirmed"});
        const url=`https://wa.me/${number}?text=${encodeURIComponent(createWhatsAppMessage({...order,orderConfirmed:true,status:"Confirmed"}))}`;
        if(wa) wa.location.href=url; else window.location.href=url;
        cart=[]; save("cwh_cart",cart); customization=""; customizationSaved=false; save("cwh_customization","");
        updateCount(); renderCart(); updateCustomizationDisplay();
        toast("Order confirmed. Press Send in WhatsApp to notify the shop.");
      } catch(error) {
        console.error("Order confirmation error:",error); if(wa) wa.close();
        toast("Could not confirm your order. Please try again."); button.disabled=false;
      }
    });
  });

  orderContainer.querySelectorAll("[data-return]").forEach(button => {
    button.addEventListener("click", async () => {
      const orderId = button.dataset.return;
      const order = customerOrders.find(o => o.id === orderId);

      if (!order) return;

      if (order.returnRequest || order.replacementRequest) {
        toast("A request has already been submitted for this order.");
        return;
      }

      if (!confirm("Submit a return request for this order?")) return;

      try {
        await updateDoc(
          doc(db, "orders", orderId),
          {
            returnRequest: {
              status: "Pending",
              requestedAt: new Date().toISOString()
            }
          }
        );

        toast("Return request submitted.");

      } catch (error) {
        console.error("Return request error:", error);
        toast("Could not submit return request.");
      }
    });
  });


  orderContainer.querySelectorAll("[data-replacement]").forEach(button => {
    button.addEventListener("click", async () => {
      const orderId = button.dataset.replacement;
      const order = customerOrders.find(o => o.id === orderId);

      if (!order) return;

      if (order.returnRequest || order.replacementRequest) {
        toast("A request has already been submitted for this order.");
        return;
      }

      if (!confirm("Submit a replacement request for this order?")) return;

      try {
        await updateDoc(
          doc(db, "orders", orderId),
          {
            replacementRequest: {
              status: "Pending",
              requestedAt: new Date().toISOString()
            }
          }
        );

        toast("Replacement request submitted.");

      } catch (error) {
        console.error("Replacement request error:", error);
        toast("Could not submit replacement request.");
      }
    });
  });
}


/* CUSTOMER LOGIN */

$("#customerLoginForm")?.addEventListener("submit", async e => {
  e.preventDefault();

  const email = e.target.elements.email.value.trim();
  const password = e.target.elements.password.value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    toast("Signed in successfully!");

  } catch (error) {
    console.error("Customer login error:", error);
    toast("Login failed. Please check your email and password.");
  }
});


/* CUSTOMER REGISTRATION */

$("#customerRegisterForm")?.addEventListener("submit", async e => {
  e.preventDefault();

  const email = e.target.elements.email.value.trim();
  const password = e.target.elements.password.value;

  if (password.length < 6) {
    toast("Password must contain at least 6 characters.");
    return;
  }

  try {
    await createUserWithEmailAndPassword(auth, email, password);
    toast("Account created successfully!");

  } catch (error) {
    console.error("Customer registration error:", error);
    toast("Could not create account. Please try again.");
  }
});


/* CUSTOMER LOGOUT */

$("#customerLogoutBtn")?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    toast("You have signed out.");

  } catch (error) {
    console.error(error);
    toast("Could not sign out.");
  }
});


/* ADMIN LOGIN */

$("#loginForm")?.addEventListener("submit", async e => {
  e.preventDefault();

  const email = e.target.elements.email.value.trim();
  const password = e.target.elements.password.value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    toast("Login successful!");

  } catch (error) {
    console.error("Admin login error:", error);
    toast("Admin login failed.");
  }
});


/* ADMIN LOGOUT */

$("#logoutBtn")?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    toast("Admin logged out.");

  } catch (error) {
    console.error(error);
    toast("Could not log out.");
  }
});


/* SHARED ADMIN ORDERS */

function listenToOrders() {
  if (ordersUnsubscribe) {
    ordersUnsubscribe();
    ordersUnsubscribe = null;
  }

  ordersUnsubscribe = onSnapshot(ordersRef, snapshot => {
    orders = snapshot.docs.map(d => ({
      ...d.data(),
      id: d.id
    }));

    orders.sort((a, b) => {
      return new Date(b.date || 0) - new Date(a.date || 0);
    });

    if (isAdmin) renderAdmin();

  }, error => {
    console.error("Admin orders error:", error);
    toast("Could not load orders.");
  });
}


/* AUTHENTICATION STATE */

onAuthStateChanged(auth, user => {
  currentUser = user;

  isAdmin = Boolean(
    user && user.uid === ADMIN_UID
  );

  if (customerOrdersUnsubscribe) {
    customerOrdersUnsubscribe();
    customerOrdersUnsubscribe = null;
  }

  if (isAdmin) {
    listenToOrders();

  } else {
    if (ordersUnsubscribe) {
      ordersUnsubscribe();
      ordersUnsubscribe = null;
    }

    orders = [];

    if (user) {
      listenToCustomerOrders(user.uid);
    } else {
      customerOrders = [];
    }
  }

  renderAdmin();
  renderCustomerAccount();
});


/* ADMIN DASHBOARD */

function renderAdmin() {
  const login = $("#adminLogin");
  const panel = $("#adminPanel");

  if (!login || !panel) return;

  if (!isAdmin) {
    login.classList.remove("hidden");
    panel.classList.add("hidden");
    return;
  }

  login.classList.add("hidden");
  panel.classList.remove("hidden");

  const totalOrders = orders.length;

  const pendingOrders = orders.filter(o =>
    o.paymentStatus !== "Paid" || !o.orderConfirmed
  ).length;

  const totalRevenue = orders
    .filter(o => o.paymentStatus === "Paid")
    .reduce((sum, o) => sum + Number(o.total || 0), 0);

  if ($("#adminTotalOrders")) {
    $("#adminTotalOrders").textContent = totalOrders;
  }

  if ($("#adminPendingOrders")) {
    $("#adminPendingOrders").textContent = pendingOrders;
  }

  if ($("#adminRevenue")) {
    $("#adminRevenue").textContent = money(totalRevenue);
  }


  /* ADMIN ORDER CARDS */

  const orderContainer = $("#adminOrders");

  if (orderContainer) {
    if (!orders.length) {
      orderContainer.innerHTML = `
        <div class="panel">
          <p>No orders received yet.</p>
        </div>
      `;

    } else {
      orderContainer.innerHTML = orders.map(o => {
        const paymentMethod = o.payment || "Google Pay";
        const paymentStatus = o.paymentStatus || "Pending Verification";

        const itemsHTML = (o.items || []).map(item => `
          <div>
            ${escapeHtml(item.name)}
            × ${Number(item.qty)}
            — ${money(Number(item.price) * Number(item.qty))}
          </div>
        `).join("");

        return `
          <article class="panel admin-order-card">
            <div class="order-heading">
              <h3>${escapeHtml(o.id)}</h3>
              <span class="status-badge">
                ${escapeHtml(o.status || "Pending")}
              </span>
            </div>

            <p class="tiny muted">${escapeHtml(o.date || "")}</p>

            <div class="admin-order-customer">
              <p>
                <strong>Customer:</strong>
                ${escapeHtml(o.name || "")}
              </p>

              <p>
                <strong>Email:</strong>
                ${escapeHtml(o.customerEmail || "")}
              </p>

              <p>
                <strong>Phone:</strong>
                ${escapeHtml(o.phone || "")}
              </p>

              <p>
                <strong>Address:</strong>
                ${escapeHtml(o.address || "")}
              </p>
            </div>

            <hr>

            <h4>Products</h4>
            ${itemsHTML}

            <hr>

            <p>Product subtotal: ${money(o.subtotal)}</p>
            <p>Delivery charge: Included</p>
            <p>Extra charges: ${money(o.extraCharges)}</p>
            <p>Customer confirmed: ${o.orderConfirmed ? "Yes" : "Not yet"}</p>

            <h3>Total: ${money(o.total)}</h3>

            <div class="payment-details">
              <p>
                <strong>Payment method:</strong>
                ${escapeHtml(paymentMethod)}
              </p>

              <p>
                <strong>Payment status:</strong>
                ${escapeHtml(paymentStatus)}
              </p>

            </div>

            ${paymentStatus !== "Paid" ? `
              <button
                type="button"
                class="primary-btn"
                data-verify-payment="${escapeHtml(o.id)}"
              >
                Verify payment & mark Paid
              </button>
            ` : ""}

            ${o.customization ? `
              <p>
                <strong>Customization:</strong>
                ${escapeHtml(o.customization)}
              </p>
            ` : ""}

            ${o.notes ? `
              <p><strong>Notes:</strong> ${escapeHtml(o.notes)}</p>
            ` : ""}

            ${o.returnRequest ? `
              <div class="admin-request">
                <p>
                  <strong>Return request:</strong>
                  ${escapeHtml(o.returnRequest.status)}
                </p>

                <button
                  data-return-decision="${escapeHtml(o.id)}"
                  data-decision="Approved"
                >
                  Approve return
                </button>

                <button
                  data-return-decision="${escapeHtml(o.id)}"
                  data-decision="Rejected"
                >
                  Reject return
                </button>
              </div>
            ` : ""}

            ${o.replacementRequest ? `
              <div class="admin-request">
                <p>
                  <strong>Replacement request:</strong>
                  ${escapeHtml(o.replacementRequest.status)}
                </p>

                <button
                  data-replacement-decision="${escapeHtml(o.id)}"
                  data-decision="Approved"
                >
                  Approve replacement
                </button>

                <button
                  data-replacement-decision="${escapeHtml(o.id)}"
                  data-decision="Rejected"
                >
                  Reject replacement
                </button>
              </div>
            ` : ""}

            <div class="admin-order-actions">
              <button data-delete-order="${escapeHtml(o.id)}" class="danger-btn">Delete order</button>
            </div>

            <div class="extra-charge-editor">
              <h4>Set extra charges</h4>

              <input
                type="number"
                min="0"
                step="1"
                placeholder="Extra charge amount"
                value="${Number(o.extraCharges || 0)}"
                data-extra-amount="${escapeHtml(o.id)}"
              >

              <input
                type="text"
                placeholder="Reason for extra charge"
                value="${escapeHtml(o.extraChargeReason || "")}"
                data-extra-reason="${escapeHtml(o.id)}"
              >

              <button data-save-extra="${escapeHtml(o.id)}">
                Save extra charges
              </button>
            </div>
          </article>
        `;
      }).join("");
    }
  }  /* VERIFY GOOGLE PAY PAYMENT */

  document.querySelectorAll("[data-verify-payment]").forEach(button => {
    button.onclick = async () => {
      if (!isAdmin || auth.currentUser?.uid !== ADMIN_UID) {
        toast("Admin access required.");
        return;
      }

      const orderId = button.dataset.verifyPayment;

      const confirmed = confirm(
        "Have you checked your bank or Google Pay records and confirmed that the money has actually reached you? Only continue if the payment is genuinely received."
      );

      if (!confirmed) return;

      button.disabled = true;

      try {
        await updateDoc(
          doc(db, "orders", orderId),
          {
            paymentStatus: "Paid",
            paymentVerifiedAt: new Date().toISOString()
          }
        );

        toast("Payment marked as Paid.");

      } catch (error) {
        console.error("Payment verification error:", error);
        toast("Could not update payment status.");
        button.disabled = false;
      }
    };
  });


  /* RETURN REQUEST DECISIONS */

  document.querySelectorAll("[data-return-decision]").forEach(button => {
    button.onclick = async () => {
      const orderId = button.dataset.returnDecision;
      const decision = button.dataset.decision;

      try {
        await updateDoc(
          doc(db, "orders", orderId),
          {
            "returnRequest.status": decision
          }
        );

        toast("Return request " + decision.toLowerCase() + ".");

      } catch (error) {
        console.error(error);
        toast("Could not update return request.");
      }
    };
  });


  /* REPLACEMENT REQUEST DECISIONS */

  document.querySelectorAll("[data-replacement-decision]").forEach(button => {
    button.onclick = async () => {
      const orderId = button.dataset.replacementDecision;
      const decision = button.dataset.decision;

      try {
        await updateDoc(
          doc(db, "orders", orderId),
          {
            "replacementRequest.status": decision
          }
        );

        toast("Replacement request " + decision.toLowerCase() + ".");

      } catch (error) {
        console.error(error);
        toast("Could not update replacement request.");
      }
    };
  });


  /* DELETE ORDERS */

  document.querySelectorAll("[data-delete-order]").forEach(button => {
    button.onclick = async () => {
      const orderId = button.dataset.deleteOrder;

      if (!confirm("Are you sure you want to delete this order?")) {
        return;
      }

      try {
        await deleteDoc(
          doc(db, "orders", orderId)
        );

        toast("Order deleted.");

      } catch (error) {
        console.error(error);
        toast("Could not delete order.");
      }
    };
  });


  /* SAVE EXTRA CHARGES */

  document.querySelectorAll("[data-save-extra]").forEach(button => {
    button.onclick = async () => {
      const orderId = button.dataset.saveExtra;

      const amountInput = document.querySelector(
        `[data-extra-amount="${CSS.escape(orderId)}"]`
      );

      const reasonInput = document.querySelector(
        `[data-extra-reason="${CSS.escape(orderId)}"]`
      );

      const amount = Number(amountInput?.value || 0);
      const reason = reasonInput?.value.trim() || "";

      if (!Number.isFinite(amount) || amount < 0) {
        toast("Enter a valid extra charge.");
        return;
      }

      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      const total =
        Number(order.subtotal || 0) + amount;

      try {
        await updateDoc(
          doc(db, "orders", orderId),
          {
            extraCharges: amount,
            extraChargeReason: reason,
            total
          }
        );

        toast("Extra charges saved.");

      } catch (error) {
        console.error(error);
        toast("Could not save extra charges.");
      }
    };
  });


  /* ADMIN PRODUCT MANAGEMENT */

  const productContainer = $("#adminProducts");

  if (productContainer) {
    productContainer.innerHTML = products.map(p => `
      <div class="panel admin-product-card">
        <h3>${escapeHtml(p.name)}</h3>

        <p>${escapeHtml(p.description || "")}</p>

        ${p.imageUrl ? `
          <img
            src="${escapeHtml(p.imageUrl)}"
            alt="${escapeHtml(p.name)}"
            class="admin-product-image"
          >
        ` : ""}

        <label>Original price</label>

        <input
          type="number"
          min="0"
          data-original-price="${escapeHtml(p.id)}"
          value="${Number(p.originalPrice || p.price)}"
        >

        <label>Selling price</label>

        <input
          type="number"
          min="0"
          data-selling-price="${escapeHtml(p.id)}"
          value="${Number(p.price)}"
        >

        <p class="discount-preview">
          ${getDiscountPercentage(p)}% discount
        </p>

        <button data-save-price="${escapeHtml(p.id)}">
          Save prices
        </button>

        <label>Product image URL</label>

        <input
          type="url"
          placeholder="Paste ImageKit image URL"
          data-image-url="${escapeHtml(p.id)}"
          value="${escapeHtml(p.imageUrl || "")}"
        >

        <button data-save-image="${escapeHtml(p.id)}">
          Save image URL
        </button>

        <label>Upload product image</label>

        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          data-upload-image="${escapeHtml(p.id)}"
        >

        <button
          data-delete-product="${escapeHtml(p.id)}"
          class="danger-btn"
        >
          Delete product
        </button>
      </div>
    `).join("");
  }


  /* SAVE PRODUCT PRICES */

  document.querySelectorAll("[data-save-price]").forEach(button => {
    button.onclick = async () => {
      const id = button.dataset.savePrice;

      const originalInput = document.querySelector(
        `[data-original-price="${CSS.escape(id)}"]`
      );

      const sellingInput = document.querySelector(
        `[data-selling-price="${CSS.escape(id)}"]`
      );

      const originalPrice = Number(originalInput?.value);
      const price = Number(sellingInput?.value);

      if (
        !Number.isFinite(price) ||
        !Number.isFinite(originalPrice) ||
        price < 0 ||
        originalPrice < price
      ) {
        toast("Original price must be equal to or higher than selling price.");
        return;
      }

      try {
        const data = { price };

        if (originalPrice > price) {
          data.originalPrice = originalPrice;
        } else {
          data.originalPrice = deleteField();
        }

        await updateDoc(
          doc(db, "products", id),
          data
        );

        toast("Product prices updated.");

      } catch (error) {
        console.error(error);
        toast("Could not update prices.");
      }
    };
  });


  /* SAVE IMAGEKIT IMAGE URL */

  document.querySelectorAll("[data-save-image]").forEach(button => {
    button.onclick = async () => {
      const id = button.dataset.saveImage;

      const input = document.querySelector(
        `[data-image-url="${CSS.escape(id)}"]`
      );

      const imageUrl = input?.value.trim() || "";

      if (imageUrl && !/^https:\/\/.+/i.test(imageUrl)) {
        toast("Please enter a valid HTTPS image URL.");
        return;
      }

      try {
        await updateDoc(
          doc(db, "products", id),
          { imageUrl }
        );

        toast("Product image URL saved.");

      } catch (error) {
        console.error(error);
        toast("Could not save image URL.");
      }
    };
  });


  /* UPLOAD PRODUCT IMAGE */

  document.querySelectorAll("[data-upload-image]").forEach(input => {
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        toast("Please select a JPG, PNG, WEBP or GIF image.");
        input.value = "";
        return;
      }

      if (file.size > MAX_IMAGE_SIZE) {
        toast("Image must be smaller than 5 MB.");
        input.value = "";
        return;
      }

      const id = input.dataset.uploadImage;
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

      const imageRef = ref(
        storage,
        `products/${id}/${Date.now()}_${safeName}`
      );

      try {
        toast("Uploading image...");

        await uploadBytes(imageRef, file);

        const imageUrl = await getDownloadURL(imageRef);

        await updateDoc(
          doc(db, "products", id),
          {
            imageUrl,
            imagePath: imageRef.fullPath
          }
        );

        toast("Product image uploaded!");

      } catch (error) {
        console.error("Image upload error:", error);
        toast("Image upload failed. Check Firebase Storage settings.");

      } finally {
        input.value = "";
      }
    };
  });


  /* DELETE PRODUCTS */

  document.querySelectorAll("[data-delete-product]").forEach(button => {
    button.onclick = async () => {
      const id = button.dataset.deleteProduct;

      if (!confirm("Delete this product permanently?")) {
        return;
      }

      const product = products.find(p => p.id === id);

      try {
        if (product?.imagePath) {
          try {
            await deleteObject(
              ref(storage, product.imagePath)
            );
          } catch (imageError) {
            console.warn("Could not delete product image:", imageError);
          }
        }

        await deleteDoc(
          doc(db, "products", id)
        );

        cart = cart.filter(item => item.id !== id);

        save("cwh_cart", cart);
        updateCount();
        renderCart();

        toast("Product deleted.");

      } catch (error) {
        console.error(error);
        toast("Could not delete product.");
      }
    };
  });

}


/* ADD NEW PRODUCT */

$("#addProductForm")?.addEventListener("submit", async e => {
  e.preventDefault();

  if (!isAdmin || auth.currentUser?.uid !== ADMIN_UID) {
    toast("Admin access required.");
    return;
  }

  const form = e.target;

  const name = form.elements.name.value.trim();
  const description = form.elements.description.value.trim();
  const price = Number(form.elements.price.value);

  const originalPrice = Number(
    form.elements.originalPrice?.value || price
  );

  const symbol = form.elements.symbol?.value.trim() || "🎁";

  if (!name || !Number.isFinite(price) || price < 0) {
    toast("Enter a valid product name and price.");
    return;
  }

  if (
    !Number.isFinite(originalPrice) ||
    originalPrice < price
  ) {
    toast("Original price must be equal to or higher than selling price.");
    return;
  }

  const id = "product-" + Date.now();

  const product = {
    id,
    name,
    description,
    price,
    symbol
  };

  if (originalPrice > price) {
    product.originalPrice = originalPrice;
  }

  try {
    await setDoc(
      doc(db, "products", id),
      product
    );

    form.reset();

    toast("Product added successfully!");

  } catch (error) {
    console.error(error);
    toast("Could not add product.");
  }
});


/* SAVE SHARED WHATSAPP SETTINGS */

$("#settingsForm")?.addEventListener("submit", async e => {
  e.preventDefault();

  if (!isAdmin || auth.currentUser?.uid !== ADMIN_UID) {
    toast("Admin access required.");
    return;
  }

  const whatsapp = e.target.elements.whatsapp.value.trim();

  if (!whatsapp) {
    toast("Enter a WhatsApp number.");
    return;
  }

  try {
    await setDoc(
      shopSettingsRef,
      { whatsapp },
      { merge: true }
    );

    toast("WhatsApp number saved for everyone.");

  } catch (error) {
    console.error(error);
    toast("Could not save WhatsApp number.");
  }
});


/* EXPORT ORDERS TO CSV */

$("#exportOrdersBtn")?.addEventListener("click", () => {
  if (!isAdmin) {
    toast("Admin access required.");
    return;
  }

  if (!orders.length) {
    toast("There are no orders to export.");
    return;
  }

  const headers = [
    "Order ID",
    "Date",
    "Customer",
    "Email",
    "Phone",
    "Address",
    "Products",
    "Subtotal",
    "Extra Charges",
    "Total",
    "Payment Method",
    "Payment Status",
    "Order Status",
    "Customization",
    "Notes"
  ];

  const rows = orders.map(o => [
    o.id,
    o.date,
    o.name,
    o.customerEmail,
    o.phone,
    o.address,

    (o.items || []).map(item =>
      `${item.name} x ${item.qty}`
    ).join("; "),

    o.subtotal,
    o.extraCharges,
    o.total,
    o.payment || "Google Pay",
    o.paymentStatus || "Pending Verification",
    o.status,
    o.customization,
    o.notes
  ]);

  const csv = [headers, ...rows].map(row => {
    return row.map(value => {
      const text = String(value ?? "");
      return `"${text.replace(/"/g, '""')}"`;
    }).join(",");
  }).join("\n");

  const blob = new Blob(
    ["\uFEFF" + csv],
    { type: "text/csv;charset=utf-8;" }
  );

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");

  a.href = url;
  a.download = "creative-world-orders.csv";

  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);

  toast("Orders exported successfully.");
});


/* INITIAL PAGE SETUP */

updateCount();
renderCart();
renderProducts();
updateCustomizationDisplay();


/* SERVICE WORKER */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js")
      .then(registration => {
        console.log(
          "Service worker registered:",
          registration.scope
        );
      })
      .catch(error => {
        console.error(
          "Service worker registration failed:",
          error
        );
      });
  });
}
