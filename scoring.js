/* 计分引擎 —— 与 data.js 配套，浏览器 / Node 通用
 *
 * 四条硬规则（对标那套算法的坑，我们一条都不踩）：
 * 1. 每类型理论满分一律 30 分（主位 10 次 ×2 + 副位 10 次 ×1），归一化后完全可比。
 * 2. 隐藏类型 E1 / D1 必须「主位命中 ≥5 且是唯一最高、且领先第二名 ≥2」才判出，
 *    既保证真稀有，又不会被常规类型顺位顶掉。
 * 3. 兜底绝不回落到隐藏类型。
 * 4. 同分用答案指纹做稳定打散，不按类型编号排先后（否则编号靠前的类型会被系统性抬高）。
 */
(function (root) {

  var MAXPER = 30;

  var HIDDEN = { E1: true, D1: true };
  var HIDDEN_RULE = { minHits: 5, minGap: 2, maxRank: 2 };

  function fnv(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function score(answers, data) {
    var raw = {}, hits = {}, norm = {};
    data.ORDER.forEach(function (k) { raw[k] = 0; hits[k] = 0; });

    answers.forEach(function (optIndex, qi) {
      var q = data.QUESTIONS[qi];
      if (!q || optIndex == null || optIndex < 0) return;
      var opt = q.options[optIndex];
      if (!opt) return;
      opt.scores.forEach(function (s) {
        raw[s.code] += s.points;
        if (s.points === 2) hits[s.code] += 1;
      });
    });

    data.ORDER.forEach(function (k) {
      norm[k] = Math.round(raw[k] / MAXPER * 100);
    });

    var seed = fnv(answers.join(''));
    var tie = {};
    data.ORDER.forEach(function (k) { tie[k] = fnv(seed + '|' + k); });

    var order = data.ORDER.slice().sort(function (a, b) {
      if (norm[b] !== norm[a]) return norm[b] - norm[a];
      if (hits[b] !== hits[a]) return hits[b] - hits[a];
      if (raw[b] !== raw[a]) return raw[b] - raw[a];
      return tie[a] - tie[b];
    });

    var hitSorted = data.ORDER.map(function (k) { return hits[k]; }).sort(function (a, b) { return b - a; });
    var topHit = hitSorted[0], secondHit = hitSorted[1];

    var picked = null, i, k;
    for (i = 0; i < order.length; i++) {
      k = order[i];
      if (!HIDDEN[k]) continue;
      if (hits[k] < HIDDEN_RULE.minHits) continue;
      if (hits[k] !== topHit) continue;
      if (topHit - secondHit < HIDDEN_RULE.minGap) continue;
      if (i > HIDDEN_RULE.maxRank) continue;
      picked = k;
      break;
    }
    if (!picked) {
      for (i = 0; i < order.length; i++) {
        if (!HIDDEN[order[i]]) { picked = order[i]; break; }
      }
    }
    if (!picked) picked = order[0];

    return { code: picked, raw: raw, hits: hits, norm: norm, order: order };
  }

  root.ABO_SCORE = { score: score, HIDDEN: HIDDEN, HIDDEN_RULE: HIDDEN_RULE, MAXPER: MAXPER };
})(typeof window !== 'undefined' ? window : globalThis);
