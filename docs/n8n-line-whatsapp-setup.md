# Snow Country — n8n Chatbot、LINE 及 WhatsApp 設定指南

本文件說明如何匯入 n8n workflow、設定 Snow Country API，以及申請／設定 LINE 與 WhatsApp Business 帳號。

---

## 架構概覽

```
客人 (LINE / WhatsApp)
        │
        ▼
   n8n Adapter Workflow     ← 接收平台 webhook、回覆訊息
        │
        │  POST /webhook/snow-country-chat
        ▼
   n8n Core Workflow        ← 對話狀態、查價、建立預約
        │
        ▼
   Snow Country API
   showcountry.ice-solution.hk/api/v1
```

| Workflow 檔案 | 用途 |
|---------------|------|
| `deploy/n8n/snow-country-chatbot-core.json` | 預約對話核心（slot filling + quote + 建立預約） |
| `deploy/n8n/snow-country-line-adapter.json` | LINE Messaging API 接入 |
| `deploy/n8n/snow-country-whatsapp-adapter.json` | WhatsApp Cloud API 接入 |

對話邏輯原始碼（方便修改）：`deploy/n8n/chatbot-handler.js`

---

## 第一步：Snow Country 後端設定

### 1.1 環境變數

在伺服器 `.env` 設定：

```env
PORT=3757
NODE_ENV=production
INTEGRATION_API_KEY=請換成強隨機字串
ADMIN_API_KEY=另一組強隨機字串
APP_BASE_URL=https://showcountry.ice-solution.hk
```

> `INTEGRATION_API_KEY` 供 n8n 呼叫 `POST /api/v1/integrations/bookings` 使用。  
> 生產環境必須設定，否則整合 API 會回傳 503。

### 1.2 重啟服務

```bash
cd /path/to/snow_country_booking_system
npm run start   # 或 pm2 restart snow-country
```

### 1.3 驗證 API

```bash
# 價目表（公開）
curl -s https://showcountry.ice-solution.hk/api/v1/website/pricing | head

# 整合 meta（需 API Key）
curl -s -H "X-API-Key: YOUR_INTEGRATION_KEY" \
  https://showcountry.ice-solution.hk/api/v1/integrations/meta
```

---

## 第二步：安裝 n8n

### 選項 A — Docker（建議）

```bash
docker run -d --name n8n \
  -p 5678:5678 \
  -v n8n_data:/home/node/.n8n \
  -e N8N_HOST=n8n.yourdomain.com \
  -e N8N_PROTOCOL=https \
  -e WEBHOOK_URL=https://n8n.yourdomain.com/ \
  n8nio/n8n
```

### 選項 B — n8n Cloud

使用 [n8n.io](https://n8n.io) 雲端版，無需自行架設，但 webhook URL 會是 `*.app.n8n.cloud`。

### 選項 C — 與現有伺服器同機

可用 Apache/Nginx 反向代理 `n8n.yourdomain.com` → `localhost:5678`。

**重要：** LINE / WhatsApp webhook 必須為 **HTTPS 公開 URL**。

---

## 第三步：n8n 環境變數

在 n8n：**Settings → Variables**（或 Docker `-e`）設定：

| 變數 | 範例 | 說明 |
|------|------|------|
| `SNOW_COUNTRY_API_BASE` | `https://showcountry.ice-solution.hk/api/v1` | Snow Country API 根路徑 |
| `SNOW_COUNTRY_INTEGRATION_KEY` | `pk_...` | 同 `.env` 的 `INTEGRATION_API_KEY` |
| `SNOW_COUNTRY_N8N_CORE_URL` | `https://n8n.xxx/webhook/snow-country-chat` | Core workflow 的 Production Webhook URL |
| `LINE_CHANNEL_ACCESS_TOKEN` | | LINE 長期 Token |
| `LINE_CHANNEL_SECRET` | | LINE Channel Secret |
| `WHATSAPP_ACCESS_TOKEN` | | Meta 系統用戶 Token |
| `WHATSAPP_PHONE_NUMBER_ID` | | WhatsApp 電話號碼 ID |
| `WHATSAPP_VERIFY_TOKEN` | `snowcountry` | Webhook 驗證用自訂字串 |

---

## 第四步：匯入 Workflow

1. 開啟 n8n → **Workflows → Import from File**
2. 依序匯入：
   - `snow-country-chatbot-core.json`
   - `snow-country-line-adapter.json`
   - `snow-country-whatsapp-adapter.json`
3. 開啟 **Snow Country Chatbot Core** → 點 **Webhook** node → 複製 **Production URL**  
   例如：`https://n8n.yourdomain.com/webhook/snow-country-chat`
4. 將此 URL 填入 `SNOW_COUNTRY_N8N_CORE_URL`
5. **啟用（Activate）** 三個 workflow

### 測試 Core（無需 LINE/WhatsApp）

```bash
curl -s -X POST https://n8n.yourdomain.com/webhook/snow-country-chat \
  -H "Content-Type: application/json" \
  -d '{"channel":"webchat","userId":"test-user","message":"2026-03-15"}'
```

應回傳 JSON，包含 `replyText` 引導選擇雪場。

輸入 `重新開始` 可重設對話。

---

## 第五步：LINE 官方帳號設定

### 5.1 建立 LINE Developers 帳號

1. 前往 [https://developers.line.biz/](https://developers.line.biz/)
2. 使用 LINE Business ID 登入（可用公司或個人）
3. 建立 **Provider**（例如：Snow Country）

### 5.2 建立 Messaging API Channel

1. Provider 內 → **Create a new channel** → **Messaging API**
2. 填寫：
   - Channel name：`Snow Country Booking`
   - Channel description：滑雪課程預約
   - 類別：依實際選擇
3. 建立後記下：
   - **Channel secret** → `LINE_CHANNEL_SECRET`
   - **Channel access token**（Issue）→ `LINE_CHANNEL_ACCESS_TOKEN`

### 5.3 設定 LINE Official Account

1. 在 [LINE Official Account Manager](https://manager.line.biz/) 找到對應帳號
2. **設定 → Messaging API**：
   - 啟用 Messaging API
   - **Webhook URL**：`https://n8n.yourdomain.com/webhook/line-webhook`
   - 啟用 **Use webhook**
   - 關閉 **Auto-reply messages**（避免與 bot 衝突）
   - 關閉 **Greeting messages**（可選）

### 5.4 驗證

1. 加 LINE 官方帳號為好友
2. 傳送：`2026-03-15`
3. 應收到 bot 回覆引導選雪場
4. 完成流程後，在 Snow Country **Admin → Bookings** 檢查 `source: line` 的新預約

### 5.5 LINE 常見問題

| 問題 | 處理 |
|------|------|
| 收不到 webhook | 確認 URL HTTPS、n8n workflow 已 Activate |
| 401 invalid signature | 檢查 `LINE_CHANNEL_SECRET`；生產環境需確保 n8n 收到原始 body |
| 無回覆 | 檢查 `LINE_CHANNEL_ACCESS_TOKEN`、`SNOW_COUNTRY_N8N_CORE_URL` |

---

## 第六步：WhatsApp Business 設定

### 6.1 Meta Business 帳號

1. 前往 [https://business.facebook.com/](https://business.facebook.com/)
2. 建立 **Business Portfolio**（商業帳戶）
3. 完成商業驗證（正式對客建議完成，測試可用開發模式）

### 6.2 建立 Meta App

1. [https://developers.facebook.com/apps](https://developers.facebook.com/apps) → **Create App**
2. 類型選 **Business**
3. 加入產品：**WhatsApp**

### 6.3 WhatsApp Business 測試號碼

1. App → **WhatsApp → API Setup**
2. 記下：
   - **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`
   - **Temporary access token**（測試用，24h）或建立 **System User** 取得長期 Token → `WHATSAPP_ACCESS_TOKEN`
3. 在 **API Setup** 加入測試收件人電話號碼（開發模式只能回覆已登記號碼）

### 6.4 設定 Webhook

1. **WhatsApp → Configuration → Webhook**
2. **Callback URL**：`https://n8n.yourdomain.com/webhook/whatsapp-webhook`
3. **Verify token**：與 `WHATSAPP_VERIFY_TOKEN` 相同（例如 `snowcountry`）
4. 訂閱欄位：勾選 **messages**

n8n workflow 的 GET handler 會自動回應 `hub.challenge` 完成驗證。

### 6.5 正式電話號碼（上線前）

1. **WhatsApp Manager** 新增並驗證商業電話號碼
2. 連結至 Meta App
3. 申請 **永久 Access Token**（System User + WhatsApp 權限）
4. 注意：對話可能按條收費（視地區而定）

### 6.6 驗證

```bash
# Webhook 驗證（Meta 後台按 Verify 時自動處理）
curl "https://n8n.yourdomain.com/webhook/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=snowcountry&hub.challenge=12345"
# 應回傳：12345
```

用已登記測試號碼向 WhatsApp 商業號碼發送訊息，完成預約流程後檢查 Admin `source: whatsapp`。

---

## 對話流程（客人視角）

1. 輸入上課日期 `YYYY-MM-DD`
2. 選擇雪場（數字或 id，如 `gala`）
3. 時數：3 / 4 / 5 / 6
4. 課程：ski / snowboard
5. 總人數、6 歲以下人數
6. 語言偏好
7. 姓名、電話
8. 特殊要求（或 `skip`）
9. 確認報價後輸入 `yes` 提交

**付款：** 現場付款（`pay_on_site`），與網站預設一致。  
**狀態：** `pending`，需管理員在後台確認。

隨時可輸入 `重新開始` 重設。

---

## Snow Country API 參考

| 用途 | Method | Path | 認證 |
|------|--------|------|------|
| 價目表 / 雪場 | GET | `/website/pricing` | 無 |
| 查空位 | GET | `/website/availability?date=YYYY-MM-DD` | 無 |
| 報價 | POST | `/website/quote` | 無 |
| 建立預約（chatbot） | POST | `/integrations/bookings` | `X-API-Key` |

### 建立預約範例

```bash
curl -X POST https://showcountry.ice-solution.hk/api/v1/integrations/bookings \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_INTEGRATION_KEY" \
  -d '{
    "source": "line",
    "lessonDate": "2026-03-15",
    "resortLocation": "gala",
    "durationHours": 4,
    "lessonType": "ski",
    "totalGuests": 2,
    "childrenUnder6": 0,
    "guestName": "Chan Tai Man",
    "phone": "+85291234567",
    "line": "U1234567890abcdef",
    "languagePref": "zh",
    "paymentMethod": "on_site",
    "paymentStatus": "pay_on_site"
  }'
```

### 雪場 ID 參考

| ID | 名稱 |
|----|------|
| `gala` | GALA 湯澤 |
| `iwappara` | 岩原 |
| `nakazato` | 湯澤中里 |
| `ishiuchi` | 石打丸山 |
| `maiko` | 舞子高原 |
| `naspa` | Naspa |
| `kagura` | 神樂 |
| `joetsu` | 上越國際 |
| `naeba` | 苗場 |

完整列表以 `GET /website/pricing` 為準（後台可新增雪場）。

---

## 自訂與進階

### 修改對話文案

1. 編輯 `deploy/n8n/chatbot-handler.js`
2. 複製內容到 n8n **Chatbot Logic** Code node
3. 儲存並重新 Activate workflow

### 改用 AI Agent（Phase 2）

可將 Core workflow 的 Code node 換成 n8n **AI Agent** node，並在 system prompt 加入：

- 只能預約，不能承諾一定有位
- 時數限 3/4/5/6 小時
- 報價必須呼叫 `POST /website/quote`
- 確認後呼叫 `POST /integrations/bookings`
- 不得洩露 API Key

### 管理員通知（建議加裝）

在 Core workflow **Respond** 前加分支：

- 新預約成功 → Email / Slack / Telegram node 通知管理員

### Apache 反向代理 n8n（同伺服器範例）

```apache
<VirtualHost *:80>
    ServerName n8n.ice-solution.hk
    ProxyPass / http://127.0.0.1:5678/
    ProxyPassReverse / http://127.0.0.1:5678/
</VirtualHost>
```

Cloudflare Flexible SSL 與 Snow Country 主站設定類似。

---

## 上線檢查清單

- [ ] `INTEGRATION_API_KEY` 已設定（生產環境）
- [ ] n8n 三個 workflow 已 Activate
- [ ] `SNOW_COUNTRY_N8N_CORE_URL` 指向 Core Production Webhook
- [ ] Core webhook 測試 curl 成功
- [ ] LINE Webhook URL 已設定並啟用
- [ ] WhatsApp Webhook 驗證通過
- [ ] 完成一筆 LINE 測試預約，後台可見
- [ ] 完成一筆 WhatsApp 測試預約，後台可見
- [ ] 後台 Booking 詳情可見 social 欄位（LINE user id / WhatsApp 電話）

---

## 故障排除

| 症狀 | 可能原因 |
|------|----------|
| `未授權：請提供有效的 X-API-Key` | `SNOW_COUNTRY_INTEGRATION_KEY` 與伺服器 `.env` 不一致 |
| `請設定 INTEGRATION_API_KEY` | 生產環境未設定整合 Key |
| `Invalid resort` | 雪場 id 錯誤；以 pricing API 為準 |
| n8n 無法連 API | 防火牆、API 未運行、URL 錯誤 |
| LINE 驗簽失敗 | Secret 錯誤；考慮用 n8n 官方 LINE Trigger node |

---

## 相關檔案

```
deploy/n8n/
├── chatbot-handler.js              # 對話邏輯（可編輯）
├── snow-country-chatbot-core.json  # 匯入用
├── snow-country-line-adapter.json
└── snow-country-whatsapp-adapter.json

docs/
└── n8n-line-whatsapp-setup.md      # 本文件
```

如有問題，可先測試 Core webhook curl，再分別測試 LINE / WhatsApp adapter。
