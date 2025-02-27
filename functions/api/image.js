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

    const workerUrl = `https://wordscape-sound-401c.ca9m8e5zy.workers.dev?key=${encodeURIComponent(key)}`;
    console.log("🔄 Cloudflare Pages 代理請求到 Workers:", workerUrl);

    let response = await fetch(workerUrl);

    if (!response.ok) {
        console.log("❌ Cloudflare Pages API：Workers 回應錯誤");
        return new Response(JSON.stringify({ error: "無法獲取圖片" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
        });
    }

    // ✅ 設定 Cloudflare Edge Cache
    response = new Response(response.body, {
        headers: {
        "Content-Type": response.headers.get("Content-Type"),
        "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
        },
    });

    console.log("✅ Cloudflare Pages API 成功回應圖片，Cloudflare Edge Cache 啟動！");
    return response;
}
  