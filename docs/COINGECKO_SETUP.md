# CoinGecko 接入与官方配置（小币种）

## 1. 官方账号与 API Key

1. 打开官网：`https://www.coingecko.com/en/api`
2. 打开文档：`https://docs.coingecko.com`
3. 注册/登录后在开发者后台创建 API Key（Demo 或 Pro）。
4. 文档里 Authentication 说明：
   - Demo Key 头：`x-cg-demo-api-key`
   - Pro Key 头：`x-cg-pro-api-key`
   - 文档链接：`https://docs.coingecko.com/reference/authentication`

## 2. 当前项目已接入方式（混合模式）

- 页面：`markets.html`、`mobile.html`
- 逻辑：`TwelveData + CoinGecko`
  - TwelveData 保留实时 WS
  - CoinGecko 20 秒轮询补充小币种

## 3. 为什么建议用 Worker 代理

浏览器直连 CoinGecko 可能遇到跨域/CORS限制。  
建议用 Cloudflare Worker 转发，前端请求你自己的域名接口。

项目已提供 Worker 模板：

- `deploy/cloudflare-worker/coingecko-proxy-worker.js`

## 4. Cloudflare Worker 配置步骤

1. Cloudflare -> `Workers & Pages` -> `Create` -> `Worker`
2. 将 `deploy/cloudflare-worker/coingecko-proxy-worker.js` 内容粘贴进去并保存部署。
3. 在 Worker 的 `Settings -> Variables` 新增：
   - `COINGECKO_DEMO_API_KEY` = 你的 Demo Key
4. 给 Worker 绑定路由（自定义域名）例如：
   - `https://api.easycryptoguide.com/api/coingecko/*`

## 5. 前端指向你的代理地址

本项目支持两种方式：

1. 全局变量：
   - `window.EC_COINGECKO_PROXY_URL = "https://api.easycryptoguide.com/api/coingecko/simple-price"`
2. 浏览器本地存储（立即生效）：
   - `localStorage.setItem('ec_coingecko_proxy_url', 'https://api.easycryptoguide.com/api/coingecko/simple-price')`

可选：如果你想直连官方（不推荐），也可配置：

- `localStorage.setItem('ec_coingecko_demo_key', '你的_demo_key')`

## 6. 常用官方端点

1. 实时批量价格：
   - `/simple/price`
   - 文档：`https://docs.coingecko.com/reference/simple-price`
2. 市场列表：
   - `/coins/markets`
   - 文档：`https://docs.coingecko.com/reference/coins-markets`
3. 历史走势：
   - `/coins/{id}/market_chart`
   - 文档：`https://docs.coingecko.com/reference/coins-id-market-chart`

## 7. 验证

1. 打开 `markets.html` 和 `mobile.html`
2. 看控制台是否还有 `CoinGecko CORS` 报错
3. 检查 ALGO/ADA/DOT/NEO/IOTA/XTZ/MANA/XLM 等小币价格是否有值且会刷新
