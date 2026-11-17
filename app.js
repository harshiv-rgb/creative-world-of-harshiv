/* The Creative World of Harshiv — Firebase synchronized shop */

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
  updateDoc
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

const ADMIN_UID = "7SgbiCsfqFS2WsxFV2sNXdBtCsR2";

const shopSettingsRef = doc(db, "settings", "shop");
const productsRef = collection(db, "products");
const ordersRef = collection(db, "orders");

const DELIVERY_CHARGE = 30;

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
];


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


/* PRICE CALCULATIONS */

function getSubtotal(items = cart) {
  return items.reduce((sum, item) => {
    const product = products.find(p => p.id === item.id);

    if (!product) return sum;

    return sum + Number(product.price) * Number(item.qty);
  }, 0);
}


function getFinalTotal(subtotal, extraCharges = 0) {
  return Number(subtotal) + DELIVERY_CHARGE + Number(extraCharges || 0);
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
    deliveryElement.textContent = money(DELIVERY_CHARGE);
  }

  if (totalElement) {
    totalElement.textContent = money(
      getFinalTotal(subtotal)
    );
  }
}


/* SHARED WHATSAPP SETTINGS */

onSnapshot(shopSettingsRef, snapshot => {

  settings = snapshot.exists()
    ? {
        whatsapp: String(snapshot.data().whatsapp || "")
      }
    : {
        whatsapp: ""
      };

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

  if (isAdmin) {
    renderAdmin();
  }

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

        await setDoc(
          doc(db, "products", String(p.id)),
          {
            id: String(p.id),
            name: String(p.name),
            description: String(p.description || ""),
            price: Number(p.price),
            symbol: String(p.symbol || "🎁")
          }
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

  $("#" + view + "View").classList.remove("hidden");

  document.querySelectorAll(".nav-btn").forEach(b => {
    b.classList.toggle(
      "active",
      b.dataset.view === view
    );
  });

  if (view === "cart") {
    renderCart();
  }

  if (view === "admin") {
    renderAdmin();
  }

  if (view === "account") {
    renderCustomerAccount();
  }

}


document.querySelectorAll(".nav-btn").forEach(b => {

  b.addEventListener("click", () => {
    show(b.dataset.view);
  });

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


/* DISPLAY PRODUCTS */

function renderProducts() {

  $("#productGrid").innerHTML = products.map(p => `

    <article class="product">

      <div class="product-art">

        ${p.imageUrl
          ? `<img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}" loading="lazy">`
          : `<span>${escapeHtml(p.symbol || "🎁")}</span>`
        }

      </div>

      <div class="product-info">

        <h3>${escapeHtml(p.name)}</h3>

        <p>${escapeHtml(p.description || "Handmade creation.")}</p>

        <div class="price">
          ${money(p.price)}
        </div>

        <button data-add="${escapeHtml(p.id)}">
          Add to cart
        </button>

      </div>

    </article>

  `).join("");


  document.querySelectorAll("[data-add]").forEach(b => {

    b.addEventListener("click", () => {

      const id = b.dataset.add;

      const item = cart.find(x => x.id === id);

      if (item) {
        item.qty++;
      } else {
        cart.push({
          id,
          qty: 1
        });
      }

      save("cwh_cart", cart);

      updateCount();

      toast("Added to your cart.");

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

          <div class="tiny muted">
            ${money(p.price)} each
          </div>

          <div class="line-price">
            <b>${money(line)}</b>
          </div>

        </div>

        <div class="qty">

          <button data-dec="${escapeHtml(p.id)}">−</button>

          <b>${item.qty}</b>

          <button data-inc="${escapeHtml(p.id)}">+</button>

        </div>

        <button
          class="remove"
          data-remove="${escapeHtml(p.id)}"
        >
          Remove
        </button>

      </div>

    `;

  }).join("") + `

    <div class="cart-total">

      Product subtotal: ${money(subtotal)}<br>

      Delivery charge: ${money(DELIVERY_CHARGE)}<br>

      <strong>
        Final total: ${money(getFinalTotal(subtotal))}
      </strong>

    </div>

  `;


  updateCheckoutPrices();


  document.querySelectorAll("[data-inc]").forEach(b => {

    b.onclick = () => {
      changeQty(b.dataset.inc, 1);
    };

  });


  document.querySelectorAll("[data-dec]").forEach(b => {

    b.onclick = () => {
      changeQty(b.dataset.dec, -1);
    };

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

  if (x) {
    x.qty += delta;
  }

  cart = cart.filter(x => x.qty > 0);

  save("cwh_cart", cart);

  updateCount();

  renderCart();

}


/* CUSTOMIZATION FEATURE */

const customizeToggle = $("#customizeToggle");

const customizationPanel = $("#customizationPanel");

const customizationText = $("#customizationText");

const saveCustomization = $("#saveCustomization");

const customizationSavedBox = $("#customizationSaved");


function updateCustomizationDisplay() {

  if (customizationSaved) {

    customizationSavedBox.classList.remove("hidden");

    customizeToggle.textContent = "✏️ Edit Customization";

  } else {

    customizationSavedBox.classList.add("hidden");

    customizeToggle.textContent = "✨ Customize Your Product";

  }

}


customizeToggle.addEventListener("click", () => {

  customizationPanel.classList.toggle("hidden");

  if (!customizationPanel.classList.contains("hidden")) {

    customizationText.value = customization;

    customizeToggle.textContent = "Close Customization";

  } else {

    updateCustomizationDisplay();

  }

});


saveCustomization.addEventListener("click", () => {

  const value = customizationText.value.trim();

  if (!value) {

    toast("Please write your customization requirements.");

    return;

  }

  customization = value;

  customizationSaved = true;

  save("cwh_customization", customization);

  customizationPanel.classList.add("hidden");

  updateCustomizationDisplay();

  toast("Customization saved successfully!");

});


updateCustomizationDisplay();


/* CHECKOUT AND SAVE ORDER */

$("#checkoutForm").addEventListener("submit", async e => {

  e.preventDefault();

  if (!cart.length) return;

  if (!currentUser || currentUser.uid === ADMIN_UID) {
    toast("Please sign in with your customer account before ordering.");
    show("account");
    return;
  }

  if (!shopSettingsLoaded) {

    toast("Please wait while shop details load.");

    return;

  }

  if (!settings.whatsapp) {

    toast("Shop WhatsApp number is not configured.");

    return;

  }

  const f = new FormData(e.currentTarget);

  const name = String(
    f.get("customerName") || ""
  ).trim();

  const phone = String(
    f.get("phone") || ""
  ).trim();

  const address = String(
    f.get("address") || ""
  ).trim();

  const notes = String(
    f.get("notes") || ""
  ).trim();


  const items = cart.map(x => {

    const p = products.find(p => p.id === x.id);

    return p ? {

      name: p.name,

      price: Number(p.price),

      qty: x.qty

    } : null;

  }).filter(Boolean);


  if (!items.length) {

    toast("Your cart products are no longer available.");

    return;

  }


  // CORRECTED SUBTOTAL CALCULATION

  const subtotal = items.reduce(
    (s, x) => s + Number(x.price) * Number(x.qty),
    0
  );


  const extraCharges = 0;

  const extraChargeReason = "";

  const total = getFinalTotal(
    subtotal,
    extraCharges
  );


  const order = {

    id: "CWH-" + Date.now().toString().slice(-8),

    customerUid: currentUser.uid,

    customerEmail: currentUser.email || "",

    date: new Date().toLocaleString(),

    name,

    phone,

    address,

    notes,

    items,

    subtotal,

    deliveryCharge: DELIVERY_CHARGE,

    extraCharges,

    extraChargeReason,

    total,

    customization: customizationSaved ? customization : "",

    payment: "Cash on Delivery",

    status: "New"

  };


  const lines = items.map(x =>

    `• ${x.name} × ${x.qty} — ${money(x.price * x.qty)}`

  ).join("\n");


  const customizationMessage = order.customization

    ? `\n✨ CUSTOMIZATION REQUIREMENTS:\n\n${order.customization}\n`

    : `\n✨ CUSTOMIZATION: None requested.\n`;


  const msg = `

NEW COD ORDER — The Creative World of Harshiv

Order: ${order.id}

Customer: ${name}

Phone: ${phone}

Address: ${address}


Items:

${lines}


Product subtotal: ${money(subtotal)}

Delivery charge: ${money(DELIVERY_CHARGE)}

Final total: ${money(total)}


Payment: CASH ON DELIVERY

${customizationMessage}

${notes ? "Extra Instructions: " + notes : ""}

Please confirm this order.

`;


  const url = `https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(msg)}`;


  try {

    await setDoc(
      doc(db, "orders", order.id),
      order
    );

    const whatsappWindow = window.open(
      url,
      "_blank",
      "noopener"
    );

    toast(
      whatsappWindow
        ? "Order saved! Press Send in WhatsApp."
        : "Order saved! Please open WhatsApp to send it."
    );


    cart = [];

    save("cwh_cart", cart);


    customization = "";

    customizationSaved = false;

    save("cwh_customization", "");


    customizationText.value = "";

    customizationPanel.classList.add("hidden");

    updateCustomizationDisplay();

    updateCount();

    renderCart();

    e.currentTarget.reset();


  } catch (error) {

    console.error("Order saving error:", error);

    toast(
      "Order error: " +
      (error.code || error.message || "Unknown error")
    );

  }

});


/* CUSTOMER ACCOUNT AND ORDER HISTORY */

function renderCustomerAccount() {
  const user = currentUser && currentUser.uid !== ADMIN_UID ? currentUser : null;
  $("#customerSignedOut").classList.toggle("hidden", !!user);
  $("#customerSignedIn").classList.toggle("hidden", !user);
  if (user) {
    $("#customerEmail").textContent = user.email || "Customer";
    renderCustomerOrders();
  }
}

function listenToCustomerOrders(user) {
  if (customerOrdersUnsubscribe) {
    customerOrdersUnsubscribe();
    customerOrdersUnsubscribe = null;
  }
  customerOrders = [];
  if (!user || user.uid === ADMIN_UID) {
    renderCustomerOrders();
    return;
  }
  const ownOrdersQuery = query(ordersRef, where("customerUid", "==", user.uid));
  customerOrdersUnsubscribe = onSnapshot(ownOrdersQuery, snapshot => {
    customerOrders = snapshot.docs.map(d => d.data());
    customerOrders.sort((a,b) => String(b.date || "").localeCompare(String(a.date || "")));
    renderCustomerOrders();
  }, error => {
    console.error("Customer orders loading error:", error);
    $("#customerOrdersList").innerHTML = '<p class="muted">Could not load orders. Please check Firestore rules.</p>';
  });
}

function renderCustomerOrders() {
  const host = $("#customerOrdersList");
  if (!host) return;
  if (!currentUser || currentUser.uid === ADMIN_UID) {
    host.innerHTML = '<p class="muted">Sign in with a customer account to see your orders.</p>';
    return;
  }
  if (!customerOrders.length) {
    host.innerHTML = '<p class="muted">You have no orders yet. Your new orders will appear here.</p>';
    return;
  }
  host.innerHTML = customerOrders.map(o => {
    const subtotal = Number(o.subtotal || 0);
    const delivery = Number(o.deliveryCharge ?? DELIVERY_CHARGE);
    const extra = Number(o.extraCharges || 0);
    const total = Number(o.total ?? subtotal + delivery + extra);
    const pending = o.returnRequestStatus === "Pending";
    const requestStatus = o.returnRequestStatus || "No request";
    return `<article class="customer-order-card">
      <b>${escapeHtml(o.id)} — ${escapeHtml(o.date || "")}</b><br>
      <span class="status-pill">${escapeHtml(o.status || "New")}</span>
      <p>${(o.items || []).map(i => `${escapeHtml(i.name)} × ${Number(i.qty || 0)}`).join("<br>")}</p>
      <div class="price-summary">
        <div class="price-summary-row"><span>Product subtotal</span><b>${money(subtotal)}</b></div>
        <div class="price-summary-row"><span>Delivery charge</span><b>${money(delivery)}</b></div>
        <div class="price-summary-row"><span>Additional charge</span><b>${money(extra)}</b></div>
        <div class="price-summary-row final-price"><span>Final total</span><b>${money(total)}</b></div>
      </div>
      ${o.extraChargeReason ? `<div class="order-customization"><b>Additional charge reason:</b><br>${escapeHtml(o.extraChargeReason)}</div>` : ""}
      <div class="request-box">
        <b>Return / replacement request:</b> <span class="status-pill">${escapeHtml(requestStatus)}</span>
        ${o.returnRequestType ? `<p><b>Type:</b> ${escapeHtml(o.returnRequestType)}<br><b>Reason:</b> ${escapeHtml(o.returnRequestReason || "")}</p>` : ""}
        ${pending ? '<p class="tiny muted">Your request is waiting for the shop to review it.</p>' : `
          <form data-customer-request="${escapeHtml(o.id)}">
            <label>Request type<select name="type" required><option value="">Choose one</option><option value="Return">Return</option><option value="Replacement">Replacement</option></select></label>
            <label>Reason<textarea name="reason" rows="3" maxlength="500" required placeholder="Please explain why you are requesting this."></textarea></label>
            <button class="primary-btn" type="submit">Send request</button>
          </form>`}
      </div>
    </article>`;
  }).join("");
  host.querySelectorAll("[data-customer-request]").forEach(form => {
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const user = auth.currentUser;
      if (!user || user.uid === ADMIN_UID) return toast("Please sign in to your customer account.");
      const data = new FormData(form);
      const type = String(data.get("type") || "");
      const reason = String(data.get("reason") || "").trim();
      if (!["Return", "Replacement"].includes(type) || !reason) return toast("Choose a request type and enter a reason.");
      const button = form.querySelector("button[type=submit]");
      button.disabled = true;
      try {
        await updateDoc(doc(db, "orders", form.dataset.customerRequest), {
          returnRequestType: type,
          returnRequestReason: reason,
          returnRequestStatus: "Pending",
          returnRequestedAt: new Date().toISOString()
        });
        toast("Your request has been sent to the shop.");
      } catch (error) {
        console.error("Return/replacement request error:", error);
        toast("Could not send the request. Please check Firestore rules.");
        button.disabled = false;
      }
    });
  });
}

$("#customerLoginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const data = new FormData(e.currentTarget);
  try {
    const result = await signInWithEmailAndPassword(auth, String(data.get("email")).trim(), String(data.get("password")));
    if (result.user.uid === ADMIN_UID) { await signOut(auth); toast("Please use the Admin page for the admin account."); return; }
    e.currentTarget.reset();
    toast("Signed in successfully.");
  } catch (error) {
    console.error(error);
    toast(error.code === "auth/invalid-credential" ? "Incorrect email or password." : "Could not sign in. Check the details and try again.");
  }
});

$("#customerRegisterForm").addEventListener("submit", async e => {
  e.preventDefault();
  const data = new FormData(e.currentTarget);
  try {
    const result = await createUserWithEmailAndPassword(auth, String(data.get("email")).trim(), String(data.get("password")));
    if (result.user.uid === ADMIN_UID) { await signOut(auth); return; }
    e.currentTarget.reset();
    toast("Customer account created successfully.");
  } catch (error) {
    console.error(error);
    toast(error.code === "auth/email-already-in-use" ? "This email already has an account. Please sign in." : error.code === "auth/weak-password" ? "Choose a stronger password with at least 6 characters." : "Could not create account. Check Firebase Authentication settings.");
  }
});

$("#customerLogoutBtn").onclick = async () => {
  try { await signOut(auth); toast("You have signed out."); }
  catch (error) { console.error(error); toast("Could not sign out."); }
};


/* ADMIN LOGIN */

$("#loginForm").addEventListener("submit", async e => {

  e.preventDefault();

  const form = new FormData(e.currentTarget);

  const email = String(
    form.get("email") || ""
  ).trim();

  const password = String(
    form.get("password") || ""
  );


  try {

    const credential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    if (credential.user.uid !== ADMIN_UID) {

      await signOut(auth);

      toast("This account is not authorized as admin.");

    }

  } catch (error) {

    console.error(error);

    toast(
      error.code === "auth/invalid-credential"
        ? "Incorrect email or password."
        : "Sign-in failed. Check your Firebase settings."
    );

  }

});


$("#logoutBtn").onclick = async () => {

  await signOut(auth);

};


/* SHARED ADMIN ORDERS */

function listenToOrders() {

  if (ordersUnsubscribe) {

    ordersUnsubscribe();

    ordersUnsubscribe = null;

  }


  ordersUnsubscribe = onSnapshot(
    ordersRef,

    snapshot => {

      orders = snapshot.docs.map(d => d.data());

      orders.sort((a, b) =>
        b.id.localeCompare(a.id)
      );

      if (isAdmin) {
        renderAdmin();
      }

    },

    error => {

      console.error("Orders loading error:", error);

      toast("Could not load orders. Check Firebase rules.");

    }

  );

}


/* AUTHENTICATION STATE */

onAuthStateChanged(auth, user => {

  currentUser = user || null;
  const allowed = !!user && user.uid === ADMIN_UID;
  isAdmin = allowed;

  if (allowed) {
    if (customerOrdersUnsubscribe) { customerOrdersUnsubscribe(); customerOrdersUnsubscribe = null; }
    customerOrders = [];
    listenToOrders();
  } else {
    if (ordersUnsubscribe) { ordersUnsubscribe(); ordersUnsubscribe = null; }
    orders = [];
    if (user) listenToCustomerOrders(user);
    else {
      if (customerOrdersUnsubscribe) { customerOrdersUnsubscribe(); customerOrdersUnsubscribe = null; }
      customerOrders = [];
    }
  }

  renderAdmin(allowed);
  renderCustomerAccount();
});


/* ADMIN DASHBOARD */

function renderAdmin(logged = isAdmin) {

  $("#adminLogin").classList.toggle(
    "hidden",
    logged
  );

  $("#adminPanel").classList.toggle(
    "hidden",
    !logged
  );

  if (!logged) return;


  $("#orderTotal").textContent = orders.length;

  $("#productTotal").textContent = products.length;


  /* DISPLAY ORDERS */

  $("#ordersList").innerHTML = orders.length

    ? orders.map(o => {

        const subtotal = Number(
          o.subtotal ??
          (o.total || 0) - DELIVERY_CHARGE
        );

        const delivery = Number(
          o.deliveryCharge ?? DELIVERY_CHARGE
        );

        const extra = Number(
          o.extraCharges || 0
        );

        const total = Number(
          o.total ??
          getFinalTotal(subtotal, extra)
        );


        return `

          <div class="order-card">

            <b>
              ${escapeHtml(o.id)} —
              ${escapeHtml(o.name)}
            </b>

            <br>

            <span class="tiny muted">
              ${escapeHtml(o.date)} ·
              ${escapeHtml(o.status)}
            </span>

            <br><br>

            ${o.items.map(i =>

              `${escapeHtml(i.name)} × ${i.qty}`

            ).join("<br>")}

            <br><br>

            <div class="price-summary">

              <div class="price-summary-row">
                <span>Product subtotal</span>
                <b>${money(subtotal)}</b>
              </div>

              <div class="price-summary-row">
                <span>Delivery charge</span>
                <b>${money(delivery)}</b>
              </div>

              <div class="price-summary-row">
                <span>Extra admin charges</span>
                <b>${money(extra)}</b>
              </div>

              <div class="price-summary-row final-price">
                <span>Final total</span>
                <b>${money(total)}</b>
              </div>

            </div>


            ${
              o.extraChargeReason
                ? `
                  <div class="order-customization">
                    <b>Admin charge reason:</b><br>
                    ${escapeHtml(o.extraChargeReason)}
                  </div>
                `
                : ""
            }


            <br>

            <span class="tiny">
              Phone: ${escapeHtml(o.phone)}
              <br>
              Address: ${escapeHtml(o.address)}
            </span>


            ${
              o.customization
                ? `
                  <div class="order-customization">
                    <b>✨ Customer Customization:</b>
                    <br>
                    ${escapeHtml(o.customization)}
                  </div>
                `
                : ""
            }


            ${
              o.notes
                ? `
                  <div class="tiny">
                    <b>Extra instructions:</b>
                    ${escapeHtml(o.notes)}
                  </div>
                `
                : ""
            }


            ${o.returnRequestType ? `
              <div class="request-box">
                <b>Customer ${escapeHtml(o.returnRequestType)} request</b><br>
                <span class="status-pill">${escapeHtml(o.returnRequestStatus || "Pending")}</span>
                <p>${escapeHtml(o.returnRequestReason || "No reason supplied")}</p>
                ${o.returnRequestStatus === "Pending" ? `
                  <button class="primary-btn" data-return-decision="${escapeHtml(o.id)}" data-decision="Approved">Approve</button>
                  <button class="secondary-btn" data-return-decision="${escapeHtml(o.id)}" data-decision="Rejected">Reject</button>
                ` : ""}
              </div>
            ` : ""}

            <br>

            <button
              class="secondary-btn"
              data-status="${escapeHtml(o.id)}"
            >
              Mark confirmed
            </button>


            <button
              class="secondary-btn"
              data-delete-order="${escapeHtml(o.id)}"
            >
              Delete
            </button>


            <div class="admin-extra-charge">

              <h3>Admin extra charge</h3>

              <p class="tiny muted">
                Only the admin can change this charge.
              </p>

              <label>
                Extra charge amount (₹)

                <input
                  type="number"
                  min="0"
                  step="1"
                  value="${extra}"
                  data-extra-amount="${escapeHtml(o.id)}"
                >

              </label>


              <label>
                Reason for extra charge

                <input
                  type="text"
                  maxlength="200"
                  value="${escapeHtml(o.extraChargeReason || "")}"
                  placeholder="Enter the reason"
                  data-extra-reason="${escapeHtml(o.id)}"
                >

              </label>


              <button
                class="primary-btn"
                data-save-extra="${escapeHtml(o.id)}"
              >
                Save extra charge
              </button>

            </div>

          </div>

        `;

      }).join("")

    : '<p class="muted">No new orders yet.</p>';


  /* APPROVE OR REJECT CUSTOMER RETURN / REPLACEMENT REQUESTS */

  document.querySelectorAll("[data-return-decision]").forEach(b => {
    b.onclick = async () => {
      if (!isAdmin || auth.currentUser?.uid !== ADMIN_UID) return toast("Admin access required.");
      try {
        await updateDoc(doc(db, "orders", b.dataset.returnDecision), {
          returnRequestStatus: b.dataset.decision
        });
        toast(`Customer request ${b.dataset.decision.toLowerCase()}.`);
      } catch (error) {
        console.error(error);
        toast("Could not update the customer request.");
      }
    };
  });


  /* MARK ORDER CONFIRMED */

  document.querySelectorAll("[data-status]").forEach(b => {

    b.onclick = async () => {

      try {

        await updateDoc(
          doc(db, "orders", b.dataset.status),
          {
            status: "Confirmed"
          }
        );

        toast("Order confirmed.");

      } catch (error) {

        console.error(error);

        toast("Could not update order.");

      }

    };

  });


  /* DELETE ORDER */

  document.querySelectorAll("[data-delete-order]").forEach(b => {

    b.onclick = async () => {

      try {

        await deleteDoc(
          doc(db, "orders", b.dataset.deleteOrder)
        );

        toast("Order deleted.");

      } catch (error) {

        console.error(error);

        toast("Could not delete order.");

      }

    };

  });


  /* SAVE ADMIN EXTRA CHARGE */

  document.querySelectorAll("[data-save-extra]").forEach(b => {

    b.onclick = async () => {

      if (!isAdmin || auth.currentUser?.uid !== ADMIN_UID) {

        toast("Admin access required.");

        return;

      }


      const orderId = b.dataset.saveExtra;

      const amountInput = document.querySelector(
        `[data-extra-amount="${orderId}"]`
      );

      const reasonInput = document.querySelector(
        `[data-extra-reason="${orderId}"]`
      );


      const amount = Number(amountInput.value);

      const reason = reasonInput.value.trim();


      if (!Number.isFinite(amount) || amount < 0) {

        toast("Enter a valid extra charge amount.");

        return;

      }

      if (amount > 0 && !reason) {

        toast("Please enter the reason for the extra charge.");

        return;

      }


      const order = orders.find(o => o.id === orderId);

      if (!order) {

        toast("Order not found.");

        return;

      }


      const subtotal = Number(
        order.subtotal ??
        (order.total || 0) - DELIVERY_CHARGE
      );

      const newTotal = getFinalTotal(
        subtotal,
        amount
      );


      b.disabled = true;

      b.textContent = "Saving...";


      try {

        await updateDoc(
          doc(db, "orders", orderId),

          {
            extraCharges: amount,

            extraChargeReason: reason,

            total: newTotal
          }

        );

        toast("Extra charge and final total saved!");

      } catch (error) {

        console.error("Extra charge update error:", error);

        toast("Could not save extra charge. Check Firestore rules.");

      } finally {

        b.disabled = false;

        b.textContent = "Save extra charge";

      }

    };

  });


  /* DISPLAY ADMIN PRODUCTS */

  $("#adminProducts").innerHTML = products.map(p => `

    <div class="admin-product">

      <div class="admin-product-details">

        ${
          p.imageUrl
            ? `<img class="admin-product-thumb" src="${escapeHtml(p.imageUrl)}" alt="">`
            : `<span class="admin-product-symbol">${escapeHtml(p.symbol || "🎁")}</span>`
        }

        <span>
          ${escapeHtml(p.name)} — ${money(p.price)}
        </span>

      </div>


      <div class="admin-product-controls">

        <label class="change-image-label">

          ${p.imageUrl ? "Change photo" : "Add photo"}

          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            data-product-image="${escapeHtml(p.id)}"
          >

        </label>


        <button
          class="secondary-btn"
          data-del-product="${escapeHtml(p.id)}"
        >
          Delete
        </button>

      </div>

    </div>

  `).join("");


  /* CHANGE PRODUCT IMAGE */

  document.querySelectorAll("[data-product-image]").forEach(input => {

    input.addEventListener("change", async () => {

      if (!isAdmin || auth.currentUser?.uid !== ADMIN_UID) {

        toast("Admin access required.");

        return;

      }


      const file = input.files[0];

      if (!file) return;


      if (
        !ALLOWED_IMAGE_TYPES.includes(file.type) ||
        file.size > MAX_IMAGE_SIZE
      ) {

        input.value = "";

        toast("Choose a JPG, PNG, WEBP or GIF image up to 5 MB.");

        return;

      }


      const product = products.find(
        p => p.id === input.dataset.productImage
      );

      if (!product) {

        toast("Product could not be found.");

        return;

      }


      input.disabled = true;


      try {

        const safeName = file.name.replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        );

        const imagePath =
          `products/${product.id}/${Date.now()}-${safeName}`;

        const imageRef = ref(storage, imagePath);


        await uploadBytes(
          imageRef,
          file,
          {
            contentType: file.type
          }
        );


        const imageUrl = await getDownloadURL(imageRef);


        await updateDoc(
          doc(db, "products", product.id),
          {
            imageUrl,
            imagePath
          }
        );


        if (product.imagePath) {

          try {

            await deleteObject(
              ref(storage, product.imagePath)
            );

          } catch (cleanupError) {

            console.warn(
              "Old product image cleanup failed:",
              cleanupError
            );

          }

        }


        toast("Product picture updated for all devices!");


      } catch (error) {

        console.error(
          "Existing product image upload error:",
          error
        );

        toast(
          error.code === "storage/unauthorized"
            ? "Image upload blocked. Check Firebase Storage rules."
            : "Could not update product picture."
        );

      } finally {

        input.disabled = false;

        input.value = "";

      }

    });

  });


  /* DELETE PRODUCT */

  document.querySelectorAll("[data-del-product]").forEach(b => {

    b.onclick = async () => {

      if (!isAdmin) {

        toast("Admin access required.");

        return;

      }


      const product = products.find(
        p => p.id === b.dataset.delProduct
      );


      try {

        await deleteDoc(
          doc(db, "products", b.dataset.delProduct)
        );


        if (product?.imagePath) {

          try {

            await deleteObject(
              ref(storage, product.imagePath)
            );

          } catch (imageError) {

            console.warn(
              "Product image cleanup failed:",
              imageError
            );

          }

        }


        toast("Product deleted.");

      } catch (error) {

        console.error(error);

        toast("Could not delete product.");

      }

    };

  });


  $("#settingsForm").elements.whatsapp.value =
    settings.whatsapp || "";

}


/* PRODUCT IMAGE PREVIEW */

const productImageInput = $("#productImage");

const productImagePreview = $("#productImagePreview");


productImageInput.addEventListener("change", () => {

  const file = productImageInput.files[0];


  if (previewObjectUrl) {

    URL.revokeObjectURL(previewObjectUrl);

  }


  previewObjectUrl = null;

  productImagePreview.innerHTML = "";

  productImagePreview.classList.add("hidden");


  if (!file) return;


  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {

    productImageInput.value = "";

    toast("Choose a JPG, PNG, WEBP or GIF image.");

    return;

  }


  if (file.size > MAX_IMAGE_SIZE) {

    productImageInput.value = "";

    toast("Image must be 5 MB or smaller.");

    return;

  }


  previewObjectUrl = URL.createObjectURL(file);


  productImagePreview.innerHTML = `

    <img
      src="${previewObjectUrl}"
      alt="Selected product preview"
    >

  `;


  productImagePreview.classList.remove("hidden");

});


/* ADD PRODUCT TO FIREBASE */

$("#productForm").addEventListener("submit", async e => {

  e.preventDefault();


  if (!isAdmin || auth.currentUser?.uid !== ADMIN_UID) {

    toast("Admin access required.");

    return;

  }


  const form = e.currentTarget;

  const f = new FormData(form);


  const product = {

    id: "p" + Date.now(),

    name: String(
      f.get("name") || ""
    ).trim(),

    price: Number(
      f.get("price")
    ),

    description: String(
      f.get("description") || ""
    ).trim(),

    symbol: String(
      f.get("symbol") || ""
    ).trim() || "🎁"

  };


  const imageFile = productImageInput.files[0] || null;


  if (
    !product.name ||
    !Number.isFinite(product.price) ||
    product.price < 0
  ) {

    toast("Enter a valid product name and price.");

    return;

  }


  if (
    imageFile &&
    (
      !ALLOWED_IMAGE_TYPES.includes(imageFile.type) ||
      imageFile.size > MAX_IMAGE_SIZE
    )
  ) {

    toast("Choose a JPG, PNG, WEBP or GIF image up to 5 MB.");

    return;

  }


  const submitButton = form.querySelector(
    'button[type="submit"]'
  );


  submitButton.disabled = true;

  submitButton.textContent = imageFile
    ? "Uploading image..."
    : "Adding product";


  let uploadedImageRef = null;


  try {

    if (imageFile) {

      const safeName = imageFile.name.replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      );

      const imagePath =
        `products/${product.id}/${Date.now()}-${safeName}`;

      uploadedImageRef = ref(storage, imagePath);


      await uploadBytes(
        uploadedImageRef,
        imageFile,
        {
          contentType: imageFile.type
        }
      );


      product.imageUrl = await getDownloadURL(
        uploadedImageRef
      );

      product.imagePath = imagePath;

    }


    await setDoc(
      doc(db, "products", product.id),
      product
    );


    form.reset();

    productImagePreview.innerHTML = "";

    productImagePreview.classList.add("hidden");


    if (previewObjectUrl) {

      URL.revokeObjectURL(previewObjectUrl);

    }

    previewObjectUrl = null;


    toast("Product added for all devices!");


  } catch (error) {

    console.error(
      "Product add/upload error:",
      error
    );


    if (uploadedImageRef) {

      try {

        await deleteObject(uploadedImageRef);

      } catch (cleanupError) {

        console.warn(cleanupError);

      }

    }


    if (error.code === "storage/unauthorized") {

      toast("Image upload blocked. Check Firebase Storage rules.");

    } else if (
      error.code === "storage/bucket-not-found" ||
      error.code === "storage/project-not-found"
    ) {

      toast("Firebase Storage is not set up yet.");

    } else {

      toast("Could not add product. Check Firebase Storage and Firestore rules.");

    }

  } finally {

    submitButton.disabled = false;

    submitButton.textContent = "Add product";

  }

});


/* SAVE WHATSAPP NUMBER */

$("#settingsForm").addEventListener("submit", async e => {

  e.preventDefault();


  const user = auth.currentUser;


  if (!user || user.uid !== ADMIN_UID) {

    toast("Only the authorized admin can change this number.");

    return;

  }


  const n = String(
    new FormData(e.currentTarget).get("whatsapp") || ""
  ).replace(/\D/g, "");


  if (n.length < 10 || n.length > 15) {

    toast("Enter a valid number with country code.");

    return;

  }


  try {

    await setDoc(
      shopSettingsRef,
      {
        whatsapp: n
      }
    );

    toast("WhatsApp number saved for all devices!");

  } catch (error) {

    console.error(error);

    toast("Could not save WhatsApp number.");

  }

});


/* EXPORT SHARED ORDERS */

$("#exportOrders").onclick = () => {

  const rows = [

    [
      "Order ID",
      "Date",
      "Customer",
      "Customer Email",
      "Phone",
      "Address",
      "Items",
      "Product Subtotal",
      "Delivery Charge",
      "Extra Charges",
      "Extra Charge Reason",
      "Final Total",
      "Payment",
      "Customization",
      "Extra Instructions",
      "Status"
    ],

    ...orders.map(o => [

      o.id,

      o.date,

      o.name,

      o.customerEmail || "",

      o.phone,

      o.address,

      o.items.map(i =>
        `${i.name} x${i.qty}`
      ).join("; "),

      o.subtotal ?? "",

      o.deliveryCharge ?? DELIVERY_CHARGE,

      o.extraCharges ?? 0,

      o.extraChargeReason || "",

      o.total,

      o.payment,

      o.customization || "",

      o.notes || "",

      o.status

    ])

  ];


  const csv = rows.map(r =>

    r.map(v =>
      '"' + String(v ?? "").replace(/"/g, '""') + '"'
    ).join(",")

  ).join("\n");


  const a = document.createElement("a");

  a.href = URL.createObjectURL(
    new Blob(
      [csv],
      {
        type: "text/csv;charset=utf-8"
      }
    )
  );

  a.download = "creative-world-orders.csv";

  a.click();

  URL.revokeObjectURL(a.href);

};


/* INITIALIZE WEBSITE */

renderProducts();

updateCount();

renderCart();


if (
  "serviceWorker" in navigator &&
  location.protocol.startsWith("http")
) {

  addEventListener("load", () => {

    navigator.serviceWorker.register(
      "./service-worker.js"
    ).catch(console.error);

  });

}
