const { resolveResort } = require('../config/resorts');

function decodeQuotedPrintable(text) {
  if (!text) return '';
  return text
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/=C2=A0/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripHtml(html) {
  return decodeQuotedPrintable(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractEmailContent({ subject, text, html, rawEmail }) {
  let content = '';
  let emailSubject = subject || '';

  if (rawEmail) {
    const subjectMatch = rawEmail.match(/^Subject:\s*(.+)$/im);
    if (subjectMatch) emailSubject = decodeQuotedPrintable(subjectMatch[1].trim());

    const htmlMatch = rawEmail.match(/Content-Type: text\/html[\s\S]*?\n\n([\s\S]*?)(?=\n--|$)/i);
    const textMatch = rawEmail.match(/Content-Type: text\/plain[\s\S]*?\n\n([\s\S]*?)(?=\n--|$)/i);
    if (htmlMatch) content = stripHtml(htmlMatch[1]);
    else if (textMatch) content = decodeQuotedPrintable(textMatch[1]);
    else content = decodeQuotedPrintable(rawEmail);
  } else if (html) {
    content = stripHtml(html);
  } else {
    content = decodeQuotedPrintable(text || '');
  }

  return { subject: emailSubject, content };
}

function pickField(content, patterns) {
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function parseRegion(subject, content) {
  const combined = `${subject} ${content}`.toLowerCase();
  if (combined.includes('naeba')) return 'naeba';
  if (combined.includes('kagura') || combined.includes('joetsu')) return 'kagura_joetsu';
  if (combined.includes('hakuba')) return 'yuzawa';
  if (combined.includes('yuzawa')) return 'yuzawa';
  return 'yuzawa';
}

function parseDuration(content) {
  const match = content.match(/Participant:\s*\d+\s*x\s*(\d+)\s*hours?/i);
  if (match) return Number(match[1]);
  const match2 = content.match(/(\d+)\s*hours?\s*\(/i);
  if (match2) return Number(match2[1]);
  return 3;
}

function cleanValue(value) {
  if (!value) return value;
  return value
    .replace(/>>+>/g, '')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseGuestName(raw) {
  if (!raw) return 'Klook guest';
  return cleanValue(raw.replace(/^\([^)]+\)/, '')) || 'Klook guest';
}

function parseLessonType(value) {
  if (!value) return 'ski';
  return value.toLowerCase().includes('snowboard') ? 'snowboard' : 'ski';
}

function parseLanguagePref(content) {
  const lower = content.toLowerCase();
  if (lower.includes('mandarin') || lower.includes('chinese lesson')) return 'zh';
  if (lower.includes('english lesson')) return 'en';
  return 'zh';
}

function parseKlookEmail(input) {
  const { subject, content } = extractEmailContent(input);

  if (!/klook order received/i.test(subject) && !/booking reference id:/i.test(content)) {
    const error = new Error('Not a valid Klook Order Received email');
    error.status = 400;
    throw error;
  }

  const klookOrderId = pickField(content, [
    /Booking reference ID:\s*([A-Z0-9]+)/i,
    /booking_reference_id=3D([A-Z0-9]+)/i,
  ]);

  const lessonDate = pickField(content, [/Date Request:\s*(\d{4}-\d{2}-\d{2})/i]);

  const guestNameRaw = pickField(content, [
    /Lead participant:\s*(\(?(?:MISS|MR|MS|MRS)[^)]*\)?[^<\n]+?)(?:\s+Country|\s+Participant|$)/i,
    /Lead participant:<\/span>\s*(\(?(?:MISS|MR|MS|MRS)[^\n<]+)/i,
  ]);
  const email = pickField(content, [
    /Email Address:\s*([\w.+-]+@[\w.-]+\.\w+)/i,
    /mailto:([\w.+-]+@[\w.-]+\.\w+)/i,
  ]);

  const totalGuests = Number(
    pickField(content, [/Number of Participants:\s*(\d+)/i]) || 1
  );

  const resortRaw = cleanValue(
    pickField(content, [
      /Preferred Snow Resort[^:]*:\s*([A-Za-z][A-Za-z\s-]+?)(?:\s+Preferred Participation|For April|>>)/i,
      /Preferred Snow Resort[^:]*:\s*([^\n<]+)/i,
    ])
  );
  const lessonStartTime = cleanValue(
    pickField(content, [
      /Preferred Participation Time:<\/span>\s*([^<\n]+)/i,
      /Preferred Participation Time:\s*([^<\n]+?)(?:\s+For April|$)/i,
    ])
  );

  const lessonTypeRaw = pickField(content, [/Ski\/Snowboard:\s*(\w+)/i]);
  const whatsapp = pickField(content, [/WhatsApp:\s*([+\d\s-]+)/i]);

  const durationHours = parseDuration(content);
  const region = parseRegion(subject, content);
  const location = resolveResort(resortRaw);
  const languagePref = parseLanguagePref(content);

  const specialRequests = [
    resortRaw ? `Preferred resort: ${resortRaw}` : null,
    lessonStartTime ? `Preferred time: ${lessonStartTime}` : null,
    cleanValue(
      pickField(content, [/Chinese Lesson is mostly full[^:]*:\s*(\w+)/i])
    )
      ? `If Chinese full, switch to English: ${cleanValue(pickField(content, [/Chinese Lesson is mostly full[^:]*:\s*(\w+)/i]))}`
      : null,
  ]
    .filter(Boolean)
    .join('; ');

  const confidence = {
    klookOrderId: Boolean(klookOrderId),
    lessonDate: Boolean(lessonDate),
    guestName: Boolean(guestNameRaw),
    email: Boolean(email),
    phone: Boolean(whatsapp),
  };

  const missing = Object.entries(confidence)
    .filter(([, ok]) => !ok)
    .map(([key]) => key);

  return {
    parsed: {
      source: 'klook',
      klookOrderId,
      lessonDate,
      durationHours,
      region,
      resortLocation: location.id,
      resortName: location.name,
      lessonType: parseLessonType(lessonTypeRaw),
      totalGuests,
      childrenUnder6: 0,
      guestName: parseGuestName(guestNameRaw),
      email,
      phone: whatsapp?.replace(/\s/g, '') || 'TBC',
      languagePref,
      lessonStartTime: lessonStartTime?.trim() || null,
      specialRequests,
      paymentMethod: 'on_site',
      paymentStatus: 'pay_on_site',
    },
    confidence,
    missing,
    needsReview: missing.length > 0,
    rawSubject: subject,
  };
}

module.exports = {
  parseKlookEmail,
  extractEmailContent,
  decodeQuotedPrintable,
};
