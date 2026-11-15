/* The Creative World of Harshiv — Firebase email/password sign-in.
   Product/order data is still local to this browser until Firestore is connected. */
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";

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
// Replace this with the UID shown beside your account in Firebase Authentication > Users.
const ADMIN_UID = "7SgbiCsfqFS2WsxFV2sNXdBtCsR2";

const DEFAULT_PRODUCTS = [
 {id:"p1",name:"Handmade Bookmarks",description:"Creative bookmarks for readers and book lovers.",price:50,symbol:"🔖"},
 {id:"p2",name:"Science Projects",description:"Small creative school projects for young learners.",price:150,symbol:"🔬"},
 {id:"p3",name:"Handmade Cards",description:"Personalized cards for special occasions.",price:80,symbol:"💌"},
 {id:"p4",name:"Pen Stands",description:"Handmade desk creations for your stationery.",price:120,symbol:"✏️"}
];
const $ = s => document.querySelector(s);
const read = (key, fallback) => { try { const v=localStorage.getItem(key); return v===null?fallback:JSON.parse(v); } catch { return fallback; } };
const save = (key,value) => localStorage.setItem(key,JSON.stringify(value));
let products=read("cwh_products",DEFAULT_PRODUCTS), cart=read("cwh_cart",[]), orders=read("cwh_orders",[]), settings=read("cwh_settings",{whatsapp:""});
const money = n => "₹"+Number(n).toLocaleString("en-IN");
function toast(msg){const t=$("#toast");t.textContent=msg;t.style.display="block";setTimeout(()=>t.style.display="none",2800)}
function show(view){document.querySelectorAll(".view").forEach(x=>x.classList.add("hidden"));$("#"+view+"View").classList.remove("hidden");document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===view));if(view==="cart")renderCart();if(view==="admin")renderAdmin()}
document.querySelectorAll(".nav-btn").forEach(b=>b.addEventListener("click",()=>show(b.dataset.view)));
document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>document.getElementById("catalog").scrollIntoView({behavior:"smooth"})));
function cartQty(){return cart.reduce((a,x)=>a+x.qty,0)}
function renderProducts(){
 $("#productGrid").innerHTML=products.map(p=>`<article class="product"><div class="product-art">${escapeHtml(p.symbol||"🎁")}</div><div class="product-info"><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.description||"Handmade creation.")}</p><div class="price">${money(p.price)}</div><button data-add="${p.id}">Add to cart</button></div></article>`).join("");
 document.querySelectorAll("[data-add]").forEach(b=>b.addEventListener("click",()=>{const id=b.dataset.add;const item=cart.find(x=>x.id===id);if(item)item.qty++;else cart.push({id,qty:1});save("cwh_cart",cart);updateCount();toast("Added to your cart.")}));
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function updateCount(){$("#cartCount").textContent=cartQty()}
function renderCart(){
 const wrap=$("#cartContents"), checkout=$("#checkoutWrap");
 if(!cart.length){wrap.innerHTML='<div class="panel"><p>Your cart is empty.</p><button class="primary-btn" id="backShop">Continue shopping</button></div>';checkout.classList.add("hidden");$("#backShop").onclick=()=>show("shop");return}
 checkout.classList.remove("hidden");
 let total=0;
 wrap.innerHTML=cart.map(item=>{const p=products.find(x=>x.id===item.id);if(!p)return "";const line=p.price*item.qty;total+=line;return `<div class="cart-row"><div><b>${escapeHtml(p.name)}</b><div class="tiny muted">${money(p.price)} each</div><div class="line-price"><b>${money(line)}</b></div></div><div class="qty"><button data-dec="${p.id}" aria-label="Decrease">−</button><b>${item.qty}</b><button data-inc="${p.id}" aria-label="Increase">+</button></div><button class="remove" data-remove="${p.id}">Remove</button></div>`}).join("")+`<div class="cart-total">Total: ${money(total)}</div>`;
 document.querySelectorAll("[data-inc]").forEach(b=>b.onclick=()=>changeQty(b.dataset.inc,1));
 document.querySelectorAll("[data-dec]").forEach(b=>b.onclick=()=>changeQty(b.dataset.dec,-1));
 document.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>{cart=cart.filter(x=>x.id!==b.dataset.remove);save("cwh_cart",cart);updateCount();renderCart()});
}
function changeQty(id,delta){const x=cart.find(x=>x.id===id);if(x)x.qty+=delta;cart=cart.filter(x=>x.qty>0);save("cwh_cart",cart);updateCount();renderCart()}
$("#checkoutForm").addEventListener("submit",e=>{
 e.preventDefault();if(!cart.length)return;
 const f=new FormData(e.currentTarget), name=f.get("customerName").trim(), phone=f.get("phone").trim(), address=f.get("address").trim(), notes=f.get("notes").trim();
 if(!settings.whatsapp){toast("Shop WhatsApp number is not configured yet. Ask the shop owner to set it in Admin.");return}
 const items=cart.map(x=>{const p=products.find(p=>p.id===x.id);return p?{name:p.name,price:p.price,qty:x.qty}:null}).filter(Boolean);
 const total=items.reduce((s,x)=>s+x.price*x.qty,0);
 const order={id:"CWH-"+Date.now().toString().slice(-8),date:new Date().toLocaleString(),name,phone,address,notes,items,total,payment:"Cash on Delivery",status:"New"};
 // Local copy is for demonstration only; it is not synced to the shop owner's other devices.
 orders.unshift(order);save("cwh_orders",orders);
 const lines=items.map(x=>`• ${x.name} × ${x.qty} — ${money(x.price*x.qty)}`).join("\n");
 const msg=`NEW COD ORDER — The Creative World of Harshiv\nOrder: ${order.id}\n\nCustomer: ${name}\nPhone: ${phone}\nAddress: ${address}\n\nItems:\n${lines}\n\nTotal: ${money(total)}\nPayment: CASH ON DELIVERY\n${notes?"Instructions: "+notes:""}\n\nPlease confirm this order.`;
 const url=`https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(msg)}`;
 window.open(url,"_blank","noopener");
 cart=[];save("cwh_cart",cart);updateCount();e.currentTarget.reset();toast("WhatsApp opened. Press Send to notify the shop.");
});
$("#loginForm").addEventListener("submit", async e=>{
 e.preventDefault();
 const form=new FormData(e.currentTarget);
 const email=String(form.get("email")||"").trim();
 const password=String(form.get("password")||"");
 try {
   const credential=await signInWithEmailAndPassword(auth,email,password);
   if(ADMIN_UID === "PASTE_YOUR_ADMIN_UID_HERE" || credential.user.uid !== ADMIN_UID){
     await signOut(auth);
     toast("This Firebase account is not authorized as the shop admin. Check ADMIN_UID in app.js.");
   }
 } catch(error) {
   toast(error.code === "auth/invalid-credential" ? "Incorrect email or password." : "Sign-in failed. Check your details and Firebase settings.");
   console.error("Firebase sign-in error:",error);
 }
});
$("#logoutBtn").onclick=async()=>{try{await signOut(auth)}catch(error){console.error(error);toast("Could not log out. Please try again.")}};
onAuthStateChanged(auth,user=>{
 const allowed=!!user && ADMIN_UID !== "PASTE_YOUR_ADMIN_UID_HERE" && user.uid===ADMIN_UID;
 if(user && !allowed) signOut(auth).catch(console.error);
 renderAdmin(allowed);
});
function renderAdmin(logged=!!auth.currentUser && auth.currentUser.uid===ADMIN_UID){
 $("#adminLogin").classList.toggle("hidden",logged);$("#adminPanel").classList.toggle("hidden",!logged);if(!logged)return;
 $("#orderTotal").textContent=orders.length;$("#productTotal").textContent=products.length;
 $("#ordersList").innerHTML=orders.length?orders.map(o=>`<div class="order-card"><b>${escapeHtml(o.id)} — ${escapeHtml(o.name)}</b><br><span class="tiny muted">${escapeHtml(o.date)} · ${escapeHtml(o.status)}</span><br>${o.items.map(i=>`${escapeHtml(i.name)} × ${i.qty}`).join("<br>")}<br><b>${money(o.total)} · COD</b><br><span class="tiny">${escapeHtml(o.phone)} · ${escapeHtml(o.address)}</span><br><button class="secondary-btn" data-status="${o.id}">Mark confirmed</button><button class="secondary-btn" data-delete-order="${o.id}">Delete</button></div>`).join(""):'<p class="muted">No orders saved in this browser yet.</p>';
 document.querySelectorAll("[data-status]").forEach(b=>b.onclick=()=>{const o=orders.find(x=>x.id===b.dataset.status);if(o)o.status="Confirmed";save("cwh_orders",orders);renderAdmin()});
 document.querySelectorAll("[data-delete-order]").forEach(b=>b.onclick=()=>{orders=orders.filter(x=>x.id!==b.dataset.deleteOrder);save("cwh_orders",orders);renderAdmin()});
 $("#adminProducts").innerHTML=products.map(p=>`<div class="admin-product"><span>${escapeHtml(p.name)} — ${money(p.price)}</span><button class="secondary-btn" data-del-product="${p.id}">Delete</button></div>`).join("");
 document.querySelectorAll("[data-del-product]").forEach(b=>b.onclick=()=>{products=products.filter(p=>p.id!==b.dataset.delProduct);save("cwh_products",products);renderProducts();renderAdmin()});
 $("#settingsForm").elements.whatsapp.value=settings.whatsapp||"";
}
$("#productForm").addEventListener("submit",e=>{e.preventDefault();const f=new FormData(e.currentTarget);products.push({id:"p"+Date.now(),name:f.get("name").trim(),price:Number(f.get("price")),description:f.get("description").trim(),symbol:f.get("symbol").trim()||"🎁"});save("cwh_products",products);e.currentTarget.reset();renderProducts();renderAdmin();toast("Product added on this device.")});
$("#settingsForm").addEventListener("submit",e=>{e.preventDefault();const n=new FormData(e.currentTarget).get("whatsapp").replace(/\D/g,"");if(n.length<10||n.length>15){toast("Enter a valid number with country code.");return}settings.whatsapp=n;save("cwh_settings",settings);toast("WhatsApp number saved on this device.")});
$("#exportOrders").onclick=()=>{const rows=[["Order ID","Date","Customer","Phone","Address","Items","Total","Payment","Status"],...orders.map(o=>[o.id,o.date,o.name,o.phone,o.address,o.items.map(i=>`${i.name} x${i.qty}`).join("; "),o.total,o.payment,o.status])];const csv=rows.map(r=>r.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="creative-world-orders.csv";a.click();URL.revokeObjectURL(a.href)};
renderProducts();updateCount();
if("serviceWorker" in navigator && location.protocol.startsWith("http"))addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(()=>{}));
