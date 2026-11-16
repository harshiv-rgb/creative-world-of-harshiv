/* The Creative World of Harshiv — Firebase synchronized shop */

import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  collection,
  deleteDoc,
  updateDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";


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

const ADMIN_UID = "7SgbiCsfqFS2WsxFV2sNXdBtCsR2";

const shopSettingsRef = doc(db, "settings", "shop");

const productsRef = collection(db, "products");
const ordersRef = collection(db, "orders");


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


let products = [];
let cart = read("cwh_cart", []);
let orders = [];

let settings = { whatsapp: "" };

let shopSettingsLoaded = false;
let isAdmin = false;
let productSeedStarted = false;

let ordersUnsubscribe = null;


const money = n =>
  "₹" + Number(n).toLocaleString("en-IN");


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


// ------------------------------------
// SHARED WHATSAPP SETTINGS
// ------------------------------------

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


// ------------------------------------
// SHARED PRODUCTS
// ------------------------------------

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

  // Initialize default products if Firebase is empty.
  if (
    snapshot.empty &&
    isAdmin &&
    !productSeedStarted
  ) {

    productSeedStarted = true;

    try {

      // Use the existing products on this device if available.
      const localProducts = read(
        "cwh_products",
        DEFAULT_PRODUCTS
      );

      const initialProducts =
        Array.isArray(localProducts) && localProducts.length
          ? localProducts
          : DEFAULT_PRODUCTS;

      for (const p of initialProducts) {

        await setDoc(doc(db, "products", String(p.id)), {
          id: String(p.id),
          name: String(p.name),
          description: String(p.description || ""),
          price: Number(p.price),
          symbol: String(p.symbol || "🎁")
        });

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


// ------------------------------------
// NAVIGATION
// ------------------------------------

function show(view) {

  document.querySelectorAll(".view").forEach(x =>
    x.classList.add("hidden")
  );

  $("#" + view + "View").classList.remove("hidden");

  document.querySelectorAll(".nav-btn").forEach(b =>
    b.classList.toggle(
      "active",
      b.dataset.view === view
    )
  );

  if (view === "cart") renderCart();

  if (view === "admin") renderAdmin();

}


document.querySelectorAll(".nav-btn").forEach(b =>
  b.addEventListener("click", () =>
    show(b.dataset.view)
  )
);


document.querySelectorAll("[data-go]").forEach(b =>
  b.addEventListener("click", () =>
    document.getElementById("catalog").scrollIntoView({
      behavior: "smooth"
    })
  )
);


// ------------------------------------
// CART
// ------------------------------------

function cartQty() {
  return cart.reduce((a, x) => a + x.qty, 0);
}


function updateCount() {
  $("#cartCount").textContent = cartQty();
}


function renderProducts() {

  $("#productGrid").innerHTML = products.map(p => `

    <article class="product">

      <div class="product-art">
        ${escapeHtml(p.symbol || "🎁")}
      </div>

      <div class="product-info">

        <h3>${escapeHtml(p.name)}</h3>

        <p>${escapeHtml(p.description || "Handmade creation.")}</p>

        <div class="price">${money(p.price)}</div>

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
        cart.push({ id, qty: 1 });
      }

      save("cwh_cart", cart);

      updateCount();

      toast("Added to your cart.");

    });

  });

}


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

  let total = 0;

  wrap.innerHTML = cart.map(item => {

    const p = products.find(x => x.id === item.id);

    if (!p) return "";

    const line = p.price * item.qty;

    total += line;

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

        <button class="remove" data-remove="${escapeHtml(p.id)}">
          Remove
        </button>

      </div>

    `;

  }).join("") + `

    <div class="cart-total">
      Total: ${money(total)}
    </div>

  `;


  document.querySelectorAll("[data-inc]").forEach(b =>
    b.onclick = () => changeQty(b.dataset.inc, 1)
  );


  document.querySelectorAll("[data-dec]").forEach(b =>
    b.onclick = () => changeQty(b.dataset.dec, -1)
  );


  document.querySelectorAll("[data-remove]").forEach(b => {

    b.onclick = () => {

      cart = cart.filter(x =>
        x.id !== b.dataset.remove
      );

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


// ------------------------------------
// CHECKOUT AND SHARED ORDERS
// ------------------------------------

$("#checkoutForm").addEventListener("submit", async e => {

  e.preventDefault();

  if (!cart.length) return;

  if (!shopSettingsLoaded) {
    toast("Please wait while shop details load.");
    return;
  }

  if (!settings.whatsapp) {
    toast("Shop WhatsApp number is not configured.");
    return;
  }

  const f = new FormData(e.currentTarget);

  const name = String(f.get("customerName") || "").trim();
  const phone = String(f.get("phone") || "").trim();
  const address = String(f.get("address") || "").trim();
  const notes = String(f.get("notes") || "").trim();


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


  const total = items.reduce(
    (s, x) => s + x.price * x.qty,
    0
  );


  const order = {

    id: "CWH-" + Date.now().toString().slice(-8),

    date: new Date().toLocaleString(),

    name,
    phone,
    address,
    notes,

    items,
    total,

    payment: "Cash on Delivery",

    status: "New"

  };


  const lines = items.map(x =>
    `• ${x.name} × ${x.qty} — ${money(x.price * x.qty)}`
  ).join("\n");


  const msg = `
NEW COD ORDER — The Creative World of Harshiv

Order: ${order.id}

Customer: ${name}
Phone: ${phone}
Address: ${address}

Items:
${lines}

Total: ${money(total)}

Payment: CASH ON DELIVERY

${notes ? "Instructions: " + notes : ""}

Please confirm this order.
`;


  const url =
    `https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(msg)}`;


  try {

    // Save the order to shared Firebase storage.
    await setDoc(doc(db, "orders", order.id), order);

    // Keep the cart until Firebase confirms the save.
    const whatsappWindow = window.open(
      url,
      "_blank",
      "noopener"
    );

    if (!whatsappWindow) {
      toast("Order saved! Please open WhatsApp to send it.");
    } else {
      toast("Order saved! Press Send in WhatsApp.");
    }

    cart = [];

    save("cwh_cart", cart);

    updateCount();

    renderCart();

    e.currentTarget.reset();

  } catch (error) {

    console.error("Order saving error:", error);

    toast("Order could not be saved. Please try again.");

  }

});


// ------------------------------------
// ADMIN LOGIN
// ------------------------------------

$("#loginForm").addEventListener("submit", async e => {

  e.preventDefault();

  const form = new FormData(e.currentTarget);

  const email = String(form.get("email") || "").trim();

  const password = String(form.get("password") || "");

  try {

    const credential =
      await signInWithEmailAndPassword(auth, email, password);

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


// ------------------------------------
// SHARED ADMIN ORDERS
// ------------------------------------

function listenToOrders() {

  if (ordersUnsubscribe) {
    ordersUnsubscribe();
    ordersUnsubscribe = null;
  }

  ordersUnsubscribe = onSnapshot(ordersRef, snapshot => {

    orders = snapshot.docs.map(d => d.data());

    orders.sort((a, b) =>
      b.id.localeCompare(a.id)
    );

    if (isAdmin) {
      renderAdmin();
    }

  }, error => {

    console.error("Orders loading error:", error);

    toast("Could not load orders. Check Firebase rules.");

  });

}


// ------------------------------------
// AUTHENTICATION STATE
// ------------------------------------

onAuthStateChanged(auth, user => {

  const allowed =
    !!user && user.uid === ADMIN_UID;

  isAdmin = allowed;

  if (allowed) {

    listenToOrders();

  } else {

    if (ordersUnsubscribe) {
      ordersUnsubscribe();
      ordersUnsubscribe = null;
    }

    orders = [];

  }

  renderAdmin(allowed);

});


// ------------------------------------
// ADMIN DASHBOARD
// ------------------------------------

function renderAdmin(logged = isAdmin) {

  $("#adminLogin").classList.toggle("hidden", logged);

  $("#adminPanel").classList.toggle("hidden", !logged);

  if (!logged) return;


  $("#orderTotal").textContent = orders.length;

  $("#productTotal").textContent = products.length;


  // ORDERS

  $("#ordersList").innerHTML = orders.length

    ? orders.map(o => `

        <div class="order-card">

          <b>${escapeHtml(o.id)} — ${escapeHtml(o.name)}</b>

          <br>

          <span class="tiny muted">
            ${escapeHtml(o.date)} · ${escapeHtml(o.status)}
          </span>

          <br>

          ${o.items.map(i =>
            `${escapeHtml(i.name)} × ${i.qty}`
          ).join("<br>")}

          <br>

          <b>${money(o.total)} · COD</b>

          <br>

          <span class="tiny">
            ${escapeHtml(o.phone)} · ${escapeHtml(o.address)}
          </span>

          <br>

          <button class="secondary-btn" data-status="${escapeHtml(o.id)}">
            Mark confirmed
          </button>

          <button class="secondary-btn" data-delete-order="${escapeHtml(o.id)}">
            Delete
          </button>

        </div>

      `).join("")

    : '<p class="muted">No new orders yet.</p>';


  document.querySelectorAll("[data-status]").forEach(b => {

    b.onclick = async () => {

      try {

        await updateDoc(
          doc(db, "orders", b.dataset.status),
          { status: "Confirmed" }
        );

        toast("Order confirmed.");

      } catch (error) {

        console.error(error);

        toast("Could not update order.");

      }

    };

  });


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


  // PRODUCTS

  $("#adminProducts").innerHTML = products.map(p => `

    <div class="admin-product">

      <span>
        ${escapeHtml(p.name)} — ${money(p.price)}
      </span>

      <button class="secondary-btn" data-del-product="${escapeHtml(p.id)}">
        Delete
      </button>

    </div>

  `).join("");


  document.querySelectorAll("[data-del-product]").forEach(b => {

    b.onclick = async () => {

      try {

        await deleteDoc(
          doc(db, "products", b.dataset.delProduct)
        );

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


// ------------------------------------
// ADD PRODUCT TO FIREBASE
// ------------------------------------

$("#productForm").addEventListener("submit", async e => {

  e.preventDefault();

  if (!isAdmin) {
    toast("Admin access required.");
    return;
  }

  const f = new FormData(e.currentTarget);

  const product = {

    id: "p" + Date.now(),

    name: String(f.get("name") || "").trim(),

    price: Number(f.get("price")),

    description: String(f.get("description") || "").trim(),

    symbol: String(f.get("symbol") || "").trim() || "🎁"

  };


  if (!product.name || !Number.isFinite(product.price) || product.price < 0) {
    toast("Enter a valid product name and price.");
    return;
  }


  try {

    await setDoc(
      doc(db, "products", product.id),
      product
    );

    e.currentTarget.reset();

    toast("Product added for all devices!");

  } catch (error) {

    console.error(error);

    toast("Could not add product. Check Firebase rules.");

  }

});


// ------------------------------------
// SAVE WHATSAPP NUMBER
// ------------------------------------

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

    await setDoc(shopSettingsRef, {
      whatsapp: n
    });

    toast("WhatsApp number saved for all devices!");

  } catch (error) {

    console.error(error);

    toast("Could not save WhatsApp number.");

  }

});


// ------------------------------------
// EXPORT SHARED ORDERS
// ------------------------------------

$("#exportOrders").onclick = () => {

  const rows = [

    [
      "Order ID",
      "Date",
      "Customer",
      "Phone",
      "Address",
      "Items",
      "Total",
      "Payment",
      "Status"
    ],

    ...orders.map(o => [

      o.id,
      o.date,
      o.name,
      o.phone,
      o.address,

      o.items.map(i =>
        `${i.name} x${i.qty}`
      ).join("; "),

      o.total,
      o.payment,
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
    new Blob([csv], { type: "text/csv" })
  );

  a.download = "creative-world-orders.csv";

  a.click();

  URL.revokeObjectURL(a.href);

};


// ------------------------------------
// INITIALIZE WEBSITE
// ------------------------------------

renderProducts();

updateCount();


if (
  "serviceWorker" in navigator &&
  location.protocol.startsWith("http")
) {

  addEventListener("load", () => {

    navigator.serviceWorker
      .register("./service-worker.js")
      .catch(console.error);

  });

}
