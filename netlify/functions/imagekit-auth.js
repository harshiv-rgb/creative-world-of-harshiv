const crypto = require("node:crypto");

exports.handler = async (event) => {
  const allowedOrigin = "https://harshiv-rgb.github.io";
  const origin = event.headers.origin || "";

  const headers = {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers
    };
  }

  if (origin !== allowedOrigin) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: "Origin not allowed" })
    };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;

  if (!privateKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "ImageKit key is not configured" })
    };
  }

  const token = crypto.randomBytes(16).toString("hex");
  const expire = Math.floor(Date.now() / 1000) + 10 * 60;

  const signature = crypto
    .createHmac("sha1", privateKey)
    .update(token + expire)
    .digest("hex");

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      token,
      expire,
      signature
    })
  };
};
