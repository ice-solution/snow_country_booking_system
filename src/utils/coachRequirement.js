/**
 * 計算所需教練人數
 * - ≥2 位 6 歲以下小童 → 2 位（硬性）
 * - ≤4 人 → 1 位
 * - 5 人以上 → 2 位
 */
function calculateCoachesRequired(totalGuests, childrenUnder6) {
  if (childrenUnder6 >= 2) return 2;
  if (totalGuests <= 4) return 1;
  return 2;
}

module.exports = { calculateCoachesRequired };
