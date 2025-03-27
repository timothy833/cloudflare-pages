export async function onRequest(context) {
    const { request, env  } = context;  // ✅ `env` 取代 `process.env`
    const url = new URL(request.url);
    const key = decodeURIComponent(url.searchParams.get("key"));  // ✅ 確保 `/` 解析正確

    // console.log("🔍 Cloudflare Pages API 收到請求，Key:", key);

    if (!key) {
        // console.log("❌ Cloudflare Pages API：缺少圖片 key");
        return new Response(JSON.stringify({ error: "缺少圖片 key" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
        });
    }

    // ✅ **防盜鏈設定**（正式上線時可啟用）
    /*
    const allowedOrigins = ["https://your-frontend.com", "https://your-other-site.com"];
    const requestOrigin = request.headers.get("Referer") || request.headers.get("Origin");

    if (!allowedOrigins.includes(requestOrigin)) {
        console.log("❌ 未授權存取圖片，來源:", requestOrigin);
        return new Response(JSON.stringify({ error: "未授權存取圖片" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
        });
    }
    */

    // ✅ 1️⃣ 先檢查 Cloudflare Pages 快取
    const cache = caches.default;
    let cachedResponse = await cache.match(request);

    if (cachedResponse) {
        const headers = new Headers(cachedResponse.headers);
        headers.set("X-Cache-Status", "HIT");
        // cachedResponse.headers.set("X-Cache-Status", "HIT");
        // console.log("✅ 使用 Cloudflare Pages 快取的 `signedUrl`");
        // return cachedResponse;
        return new Response(cachedResponse.body, {
            status: cachedResponse.status,
            headers,
        });
    }

    // console.log("⚠️ Cloudflare Pages 無快取，請求 Render Server");

    // ✅ 取得 signed URL from Render Server
    if (!env.CDN_BASE_URL) {
        // console.log("❌ 環境變數 CDN_BASE_URL 未設置！");
        return new Response(JSON.stringify({ error: "CDN_BASE_URL 未設置" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
    
    
     // ✅ 2️⃣ 請求 Render Server 取得 `signedUrl`
    const renderServerUrl = `${env.CDN_BASE_URL}/api/proxyImage?key=${encodeURIComponent(key)}`;
    let renderResponse = await fetch(renderServerUrl);

    if (!renderResponse.ok) {
        // console.log("❌ Render Server 無法提供 `signedUrl`，刪除 Cloudflare 快取");

        // **刪除 Cloudflare Pages 快取**
        await cache.delete(request);

        return new Response(JSON.stringify({ error: "圖片不存在" }), {
        status: 404,
        headers: { 
            "Content-Type": "application/json",
            "Cache-Control": "no-store",  // 防止 Cloudflare 快取 404
         },
        });
    }

    let { signedUrl } = await renderResponse.json();
    console.log("✅ 取得 R2 簽名 URL");

    // ✅ 3️⃣ 讓 Cloudflare Pages 記住這個 `signedUrl`
    // let response = new Response(null, {
    //     status: 302,
    //     headers: {
    //       "Location": signedUrl,
    //       "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
    //     },
    // });

     // ✅ 抓取圖片實體內容（binary）
    const imageResponse = await fetch(signedUrl);
    if (!imageResponse.ok) {
        return new Response("R2 image not found", { status: 404 });
    }

    // ✅ 將圖片內容以正確格式回傳（並快取這個 Response）
    const response = new Response(imageResponse.body, {
        status: 200,
        headers: {
        "Content-Type": imageResponse.headers.get("Content-Type") || "image/jpeg",
        "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
        "X-Cache-Status": "MISS",
        },
    });

    // **存入 Cloudflare Pages Edge Cache**
    await cache.put(request, response.clone());
    console.log("✅ 已快取圖片內容");

    return response;


  // console.log("✅ Cloudflare Pages 快取已更新，回應 302 Redirect");

}
  