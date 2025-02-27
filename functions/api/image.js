export async function onRequest(context) {
    const { request } = context;
    const url = new URL(request.url);
    const key = url.searchParams.get("key");

    if (!key) {
        console.log("❌ Cloudflare Pages API：缺少圖片 key");
        return new Response(JSON.stringify({ error: "缺少圖片 key" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
        });
    }

    if (request.method === "POST") {
        console.log("🔄 Cloudflare Pages 收到新的圖片，存取快取");
    
        // ✅ 設定 Cloudflare Edge Cache
        return new Response(request.body, {
            headers: {
            "Content-Type": request.headers.get("Content-Type"),
            "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
            },
        });
    }

    console.log("🔍 Cloudflare Pages 嘗試回應快取圖片");

    const workerUrl = `https://wordscape-sound-401c.ca9m8e5zy.workers.dev?key=${encodeURIComponent(key)}`;
    let response = await fetch(workerUrl);

    console.log("✅ Cloudflare Pages API 成功回應圖片，Cloudflare Edge Cache 啟動！");
    return response;
}
  