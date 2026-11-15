# The Creative World of Harshiv — independent COD-only PWA

## What is included
- Responsive storefront for Android, iPhone/iPad and desktop browsers
- Independent cart and checkout form
- Cash on Delivery is the only payment method
- WhatsApp order message: opens a pre-filled message to the shop; the customer must press Send
- Demo admin dashboard: view locally stored orders, export CSV, add/delete products, set WhatsApp number
- PWA manifest, icons and service worker

## Important limitations — read before using for real customers
This is a FRONT-END STARTER / DEMO, not yet a production multi-customer store.
- Products, settings, cart and admin orders are stored in the current browser's localStorage. They do not sync between customers' devices or your phone/laptop.
- When a customer places an order, WhatsApp opens with the order details. The customer must press Send. This is not an automatic WhatsApp Business API notification.
- The demo admin PIN is `2468`, visible in `app.js`. It is not secure authentication. Do not publish this version as a live store or collect real customer information until a secure backend, admin login and privacy protections are added.
- Customer order data is saved locally in the customer's browser as a demo; the admin dashboard on your device will not automatically receive it.
- The WhatsApp number must be set in Admin on the browser/device used by the customer. In a real deployment it should be a fixed shop number in the published app.
- No online payments are included. COD is the only displayed option.

## Run locally
For a quick visual preview, open `index.html` in a browser. PWA installation/service worker needs HTTPS hosting (or localhost).

## Free hosting / installation
A parent/guardian can help create a GitHub account and a public repository.
1. Create a public repository, e.g. `creative-world-harshiv`.
2. Extract this ZIP and upload all files directly into the repository root.
3. In Settings → Pages, select Deploy from a branch, branch `main`, folder `/ (root)`, then Save.
4. Wait for GitHub Pages to provide an HTTPS URL.
5. Android: open the URL in Chrome → menu → Install app / Add to Home screen.
6. iPhone/iPad: open the URL in Safari → Share → Add to Home Screen.
7. Desktop: open in Chrome/Edge; use the install icon/menu if offered.

## Before a real launch
The next development step is a secure backend (for example a database + authenticated admin service) so customer orders from every device appear in one dashboard. Also set the shop's WhatsApp number and add privacy/consent information. Use a parent/guardian's help with accounts and customer data.
