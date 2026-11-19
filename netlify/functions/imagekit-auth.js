const crypto = require("node:crypto");
const admin = require("firebase-admin");

const ADMIN_UID = "7SgbiCsfqFS2WsxFV2sNXdBtCsR2";

const allowedOrigin = "https://harshiv-rgb.github.io";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(
        /\\n/g,
        "\n"
      )
    })
  });
}

exports.handler = async (event) => {

  const origin = event.headers.origin || "";

  const headers = {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json"
  };

  const response = (statusCode, data) => ({
    statusCode,
    headers,
    body: JSON.stringify(data)
  });

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers
    };
  }

  if (origin !== allowedOrigin) {
    return response(403, {
      error: "Origin not allowed"
    });
  }

  if (event.httpMethod !== "GET") {
    return response(405, {
      error: "Method not allowed"
    });
  }

  try {

    // Check Firebase login token
    const authorization =
      event.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
      return response(401, {
        error: "Authentication required"
      });
    }

    const idToken = authorization.substring(7);

    const decodedToken =
      await admin.auth().verifyIdToken(idToken);

    // Check whether the user is your admin
    if (decodedToken.uid !== ADMIN_UID) {
      return response(403, {
        error: "Admin access required"
      });
    }

    // Read ImageKit private key securely
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;

    if (!privateKey) {
      return response(500, {
        error: "ImageKit key is not configured"
      });
    }

    // Generate ImageKit authentication
    const token = crypto.randomBytes(16).toString("hex");

    const expire =
      Math.floor(Date.now() / 1000) + 10 * 60;

    const signature = crypto
      .createHmac("sha1", privateKey)
      .update(token + expire)
      .digest("hex");

    return response(200, {
      token,
      expire,
      signature
    });

  } catch (error) {

    console.error("ImageKit authentication error:", error);

    return response(401, {
      error: "Authentication failed"
    });

  }

};
