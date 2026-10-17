/**
 * Snow Country booking chatbot — paste into n8n Code node
 * ("Snow Country Chatbot Core" workflow)
 *
 * Expected webhook body:
 * {
 *   "channel": "line" | "whatsapp" | "webchat",
 *   "userId": "unique-user-id",
 *   "message": "user text",
 *   "displayName": "optional guest name from profile"
 * }
 *
 * Environment (n8n Settings → Variables):
 *   SNOW_COUNTRY_API_BASE  e.g. https://showcountry.ice-solution.hk/api/v1
 *   SNOW_COUNTRY_INTEGRATION_KEY
 */

const API_BASE = ($env.SNOW_COUNTRY_API_BASE || 'http://localhost:3757/api/v1').replace(/\/$/, '');
const API_KEY = $env.SNOW_COUNTRY_INTEGRATION_KEY || '';

const input = $json.body || $json;
const channel = String(input.channel || 'webchat').toLowerCase();
const userId = String(input.userId || input.from || 'anonymous');
const text = String(input.message || input.text || '').trim();
const profileName = String(input.displayName || '').trim();

const staticData = $getWorkflowStaticData('global');
if (!staticData.sessions) staticData.sessions = {};
if (!staticData.pricingCache) staticData.pricingCache = null;

const sessionKey = `${channel}:${userId}`;
let session = staticData.sessions[sessionKey];

const RESET_WORDS = ['reset', '重新開始', '重新开始', 'restart', 'menu', '選單', '选单'];

async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (API_KEY) headers['X-API-Key'] = API_KEY;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.message || data.errors?.[0]?.msg || res.statusText;
    throw new Error(msg || `API ${res.status}`);
  }
  return data;
}

async function loadPricing() {
  if (staticData.pricingCache) return staticData.pricingCache;
  const res = await api('/website/pricing');
  staticData.pricingCache = res.data;
  return staticData.pricingCache;
}

function resortMenu(pricing) {
  const lines = ['請輸入雪場編號（reply 數字或 id）：'];
  let i = 1;
  const map = {};
  for (const region of pricing.regions || []) {
    for (const resort of region.resorts || []) {
      map[String(i)] = resort.id;
      map[resort.id] = resort.id;
      lines.push(`${i}. ${resort.nameEn || resort.name} (${resort.id})`);
      i += 1;
    }
  }
  return { text: lines.join('\n'), map };
}

function newSession() {
  return {
    step: 'lessonDate',
    data: {
      source: channel === 'line' ? 'line' : channel === 'whatsapp' ? 'whatsapp' : 'webchat',
      languagePref: 'any',
      paymentMethod: 'on_site',
      paymentStatus: 'pay_on_site',
      childrenUnder6: 0,
    },
  };
}

function parseDate(s) {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return s;
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m2) {
    const [, d, mo, y] = m2;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

if (!text) {
  return [{ json: { replyText: '請輸入文字訊息。輸入「重新開始」可重設預約流程。' } }];
}

if (RESET_WORDS.includes(text.toLowerCase()) || RESET_WORDS.includes(text)) {
  session = newSession();
  staticData.sessions[sessionKey] = session;
  return [{
    json: {
      replyText: '已重設預約流程。\n\n請輸入上課日期（YYYY-MM-DD），例如：2026-03-15',
      sessionStep: session.step,
    },
  }];
}

if (!session) {
  session = newSession();
  if (profileName) session.data.guestName = profileName;
  staticData.sessions[sessionKey] = session;
  return [{
    json: {
      replyText:
        '歡迎預約 Snow Country 滑雪課程！\n\n' +
        '請輸入上課日期（YYYY-MM-DD），例如：2026-03-15\n' +
        '（輸入「重新開始」可隨時重設）',
      sessionStep: session.step,
    },
  }];
}

const pricing = await loadPricing();
let replyText = '';
let quickReplies = [];

try {
  switch (session.step) {
    case 'lessonDate': {
      const date = parseDate(text);
      if (!date) {
        replyText = '日期格式不正確。請用 YYYY-MM-DD，例如 2026-03-15';
        break;
      }
      session.data.lessonDate = date;
      let capNote = '';
      try {
        const cap = await api(`/website/availability?date=${date}`);
        const st = cap.data?.status;
        if (st === 'overbooked') capNote = '\n⚠️ 此日較滿，仍可先提交，我們會確認。';
        else if (st === 'tight') capNote = '\n⚠️ 此日名額有限，建議盡早確認。';
      } catch {
        /* optional */
      }
      session.step = 'resort';
      session._resortMap = resortMenu(pricing).map;
      replyText = `日期：${date}${capNote}\n\n${resortMenu(pricing).text}`;
      break;
    }
    case 'resort': {
      const id = session._resortMap?.[text] || session._resortMap?.[text.toLowerCase()];
      if (!id) {
        replyText = `無效選擇。\n\n${resortMenu(pricing).text}`;
        break;
      }
      session.data.resortLocation = id;
      session.step = 'duration';
      replyText = '請選擇上課時數（輸入 3、4、5 或 6）：';
      quickReplies = ['3', '4', '5', '6'];
      break;
    }
    case 'duration': {
      const h = Number(text);
      if (![3, 4, 5, 6].includes(h)) {
        replyText = '請輸入 3、4、5 或 6 小時。';
        break;
      }
      session.data.durationHours = h;
      session.step = 'lessonType';
      replyText = '課程類型：\n1. ski（雙板）\n2. snowboard（單板）';
      quickReplies = ['ski', 'snowboard', '1', '2'];
      break;
    }
    case 'lessonType': {
      const t = text.toLowerCase();
      const type = t === '1' || t === 'ski' ? 'ski' : t === '2' || t === 'snowboard' ? 'snowboard' : null;
      if (!type) {
        replyText = '請輸入 ski 或 snowboard（或 1 / 2）。';
        break;
      }
      session.data.lessonType = type;
      session.step = 'totalGuests';
      replyText = '總人數（包括成人及小童）？';
      break;
    }
    case 'totalGuests': {
      const n = Number(text);
      if (!Number.isInteger(n) || n < 1) {
        replyText = '請輸入有效人數（正整數）。';
        break;
      }
      session.data.totalGuests = n;
      session.step = 'childrenUnder6';
      replyText = '6 歲以下小童人數？（沒有請輸入 0）';
      break;
    }
    case 'childrenUnder6': {
      const n = Number(text);
      if (!Number.isInteger(n) || n < 0) {
        replyText = '請輸入 0 或正整數。';
        break;
      }
      session.data.childrenUnder6 = n;
      session.step = 'languagePref';
      replyText = '語言偏好：\n1. 不限\n2. 中文\n3. 英文';
      quickReplies = ['1', '2', '3', 'any', 'zh', 'en'];
      break;
    }
    case 'languagePref': {
      const map = { '1': 'any', '2': 'zh', '3': 'en', any: 'any', zh: 'zh', en: 'en' };
      const pref = map[text.toLowerCase()];
      if (!pref) {
        replyText = '請輸入 1（不限）、2（中文）或 3（英文）。';
        break;
      }
      session.data.languagePref = pref;
      session.step = 'guestName';
      replyText = '聯絡人姓名？';
      break;
    }
    case 'guestName': {
      if (text.length < 2) {
        replyText = '請輸入有效姓名。';
        break;
      }
      session.data.guestName = text;
      session.step = 'phone';
      replyText = '聯絡電話？（含國碼，例如 +85291234567）';
      break;
    }
    case 'phone': {
      if (text.replace(/\D/g, '').length < 8) {
        replyText = '請輸入有效電話號碼。';
        break;
      }
      session.data.phone = text;
      if (channel === 'whatsapp') session.data.whatsapp = text;
      if (channel === 'line') session.data.line = userId;
      session.step = 'specialRequests';
      replyText = '特殊要求？（沒有請輸入 skip）';
      break;
    }
    case 'specialRequests': {
      if (text.toLowerCase() !== 'skip' && text !== '跳過' && text !== '无' && text !== '無') {
        session.data.specialRequests = text;
      }
      session.step = 'confirm';
      const quote = await api('/website/quote', {
        method: 'POST',
        body: {
          resortLocation: session.data.resortLocation,
          durationHours: session.data.durationHours,
          totalGuests: session.data.totalGuests,
          childrenUnder6: session.data.childrenUnder6,
          lessonDate: session.data.lessonDate,
        },
      });
      session._quote = quote.data;
      const q = quote.data;
      replyText =
        '── 預約摘要 ──\n' +
        `日期：${session.data.lessonDate}\n` +
        `雪場：${session.data.resortLocation}\n` +
        `時數：${session.data.durationHours} 小時\n` +
        `類型：${session.data.lessonType}\n` +
        `人數：${session.data.totalGuests}（6歲以下：${session.data.childrenUnder6}）\n` +
        `導師：${q.instructorsRequired} 組\n` +
        `預估費用：¥${q.totalAmount?.toLocaleString?.() || q.totalAmount}\n` +
        `付款：現場付款\n\n` +
        '確認提交？（輸入 yes 確認，no 取消）';
      quickReplies = ['yes', 'no'];
      break;
    }
    case 'confirm': {
      const ok = ['yes', 'y', '是', '確認', '好'].includes(text.toLowerCase());
      const no = ['no', 'n', '否', '取消'].includes(text.toLowerCase());
      if (no) {
        delete staticData.sessions[sessionKey];
        return [{
          json: {
            replyText: '已取消。輸入任意文字可重新開始預約。',
            sessionStep: 'cancelled',
          },
        }];
      }
      if (!ok) {
        replyText = '請輸入 yes 確認或 no 取消。';
        break;
      }
      const payload = {
        ...session.data,
        adminNotes: `Chatbot ${channel} userId=${userId}`,
      };
      const created = await api('/integrations/bookings', { method: 'POST', body: payload });
      const b = created.data;
      delete staticData.sessions[sessionKey];
      replyText =
        '✅ 預約已提交！\n\n' +
        `參考：${b.id}\n` +
        `狀態：待管理員確認\n` +
        `費用：¥${b.totalAmount?.toLocaleString?.() || b.totalAmount}\n\n` +
        '我們會盡快確認並安排導師。輸入任意文字可再次預約。';
      break;
    }
    default:
      session = newSession();
      replyText = '流程已重設。請輸入上課日期（YYYY-MM-DD）。';
  }
} catch (err) {
  replyText = `抱歉，系統錯誤：${err.message}\n請稍後再試或輸入「重新開始」。`;
}

staticData.sessions[sessionKey] = session;

return [{
  json: {
    replyText,
    quickReplies,
    sessionStep: session?.step,
    channel,
    userId,
  },
}];
