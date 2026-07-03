/**
 * Gantt 時間軸設定
 * 每格 = 30 分鐘，2 格 = 1 小時
 */
const GANTT_START = { hour: 8, minute: 30 };
const GANTT_END = { hour: 16, minute: 30 };
const SLOT_MINUTES = 30;

function pad(n) {
  return String(n).padStart(2, '0');
}

function timeToMinutes(timeStr) {
  if (!timeStr) return null;
  const normalized = timeStr
    .toLowerCase()
    .replace(/\s/g, '')
    .replace(/：/g, ':');
  const match = normalized.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const ampm = match[3];

  if (ampm === 'pm' && hour < 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;

  return hour * 60 + minute;
}

function minutesToTime(totalMinutes) {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${pad(hour)}:${pad(minute)}`;
}

function generateTimeSlots() {
  const start = GANTT_START.hour * 60 + GANTT_START.minute;
  const end = GANTT_END.hour * 60 + GANTT_END.minute;
  const slots = [];

  for (let m = start; m < end; m += SLOT_MINUTES) {
    slots.push({
      index: slots.length,
      time: minutesToTime(m),
      minutes: m,
    });
  }

  return slots;
}

function timeToSlotIndex(timeStr) {
  const minutes = timeToMinutes(timeStr);
  if (minutes === null) return 0;
  const start = GANTT_START.hour * 60 + GANTT_START.minute;
  const index = Math.floor((minutes - start) / SLOT_MINUTES);
  return Math.max(0, index);
}

function durationToSlotSpan(durationHours) {
  return Math.max(1, Math.round((durationHours * 60) / SLOT_MINUTES));
}

module.exports = {
  GANTT_START,
  GANTT_END,
  SLOT_MINUTES,
  generateTimeSlots,
  timeToSlotIndex,
  durationToSlotSpan,
  timeToMinutes,
  minutesToTime,
};
