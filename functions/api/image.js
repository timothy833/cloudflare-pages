export async function onRequest(context) {
    const { request } = context;
    const url = new URL(request.url);
    const key = decodeURIComponent(url.searchParams.get("key"));  // ✅ 確保 `/` 解析正確

    if (!key) {
        console.log("❌ Cloudflare Pages API：缺少圖片 key");
        return new Response(JSON.stringify({ error: "缺少圖片 key" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
        });
    }

    // ✅ 1️⃣ 先檢查 Cloudflare Pages 快取
    const cache = caches.default;
    let cachedResponse = await cache.match(request);

    if (cachedResponse) {
        console.log("✅ 使用 Cloudflare Pages 快取的 `signedUrl`");
        return cachedResponse;
    }

    console.log("⚠️ Cloudflare Pages 無快取，請求 Render Server");
    
     // ✅ 2️⃣ 請求 Render Server 取得 `signedUrl`
    const renderServerUrl = `${process.env.CDN_BASE_URL}/api/proxyImage?key=${encodeURIComponent(key)}`;
    let renderResponse = await fetch(renderServerUrl);

    if (!renderResponse.ok) {
        console.log("❌ Render Server 無法提供 `signedUrl`");
        return new Response(JSON.stringify({ error: "無法獲取圖片" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
        });
    }

    let { signedUrl } = await renderResponse.json();
    console.log("✅ 取得 R2 簽名 URL:", signedUrl);

    // ✅ 3️⃣ 讓 Cloudflare Pages 記住這個 `signedUrl`
    let response = new Response(null, {
        status: 302,
        headers: {
          "Location": signedUrl,
          "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
        },
    });

    // **存入 Cloudflare Pages Edge Cache**
    cache.put(request, response.clone());

    console.log("✅ Cloudflare Pages 快取已更新，回應 302 Redirect");

    return response;
}
  