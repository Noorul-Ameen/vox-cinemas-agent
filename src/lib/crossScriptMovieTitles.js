const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const EASTERN_ARABIC_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

const TITLE_STOP_WORDS = new Set([
  "a", "an", "the", "and", "part", "movie", "film",
  "فيلم", "الفيلم", "جزء", "و",
]);

const TITLE_ALIASES = Object.freeze({
  "el gawahergy": ["الجواهرجي"],
  "sakr w canaria": ["صقر و كناريا", "صقر وكناريا"],
  "eben meen fehom": ["ابن مين فيهم"],
  "shamshoun w dalila": ["شمشون و دليلة", "شمشون ودليلة"],
  "khali balak min nafsik": ["خلي بالك من نفسك"],
  "the odyssey": ["الأوديسة", "اوديسي"],
  ishqnama: ["عشق نامة", "عشقنامه"],
});

const ARABIC_CONSONANTS = Object.freeze({
  ب: "b", پ: "b", ت: "t", ث: "t", ج: "j", ح: "h", خ: "x", د: "d", ذ: "t",
  ر: "r", ز: "z", س: "s", ش: "s", ص: "s", ض: "d", ط: "t", ظ: "z",
  غ: "g", ف: "f", ڤ: "f", ق: "k", ك: "k", گ: "g", ل: "l", م: "m", ن: "n", ه: "h",
});

function normalizeDigits(value) {
  return String(value || "").replace(/[٠-٩۰-۹]/g, (digit) => {
    const arabicIndex = ARABIC_DIGITS.indexOf(digit);
    if (arabicIndex >= 0) return String(arabicIndex);
    const easternIndex = EASTERN_ARABIC_DIGITS.indexOf(digit);
    return easternIndex >= 0 ? String(easternIndex) : digit;
  });
}

function normalizedTitleTokens(value) {
  return normalizeDigits(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u064b-\u065f\u0670]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function tokenDetails(value) {
  const original = String(value || "");
  const arabic = /\p{Script=Arabic}/u.test(original);
  const normalized = original
    .replace(/ph/g, "f");
  let key = "";
  const phoneticSource = arabic ? normalized.replace(/ه$/, "") : normalized;
  for (const character of phoneticSource) {
    if (ARABIC_CONSONANTS[character]) {
      key += ARABIC_CONSONANTS[character];
    } else if (/[a-z0-9]/.test(character) && !/[aeiouyw]/.test(character)) {
      if (/[bp]/.test(character)) key += "b";
      else if (/[ckq]/.test(character)) key += "k";
      else if (/[fv]/.test(character)) key += "f";
      else key += character;
    }
  }
  return Object.freeze({
    original,
    arabic,
    key: key.replace(/(.)\1+/g, "$1"),
    length: [...normalized].filter((character) => /[\p{L}\p{N}]/u.test(character)).length,
  });
}

function significantTitleTokens(value) {
  return normalizedTitleTokens(value)
    .filter((token) => !TITLE_STOP_WORDS.has(token))
    .map(tokenDetails)
    .filter((token) => token.key);
}

function aliasTokenEntries(value) {
  const source = Array.isArray(value) ? value : normalizedTitleTokens(value);
  return source.flatMap((token, sourceIndex) => (
    normalizedTitleTokens(token).map((normalized) => ({ normalized, original: token, sourceIndex }))
  )).filter((token) => !TITLE_STOP_WORDS.has(token.normalized));
}

function explicitAliasRange(query, title) {
  const titleKey = normalizedTitleTokens(title).join(" ");
  const aliases = TITLE_ALIASES[titleKey] || [];
  const queryTokens = aliasTokenEntries(query);
  for (const alias of aliases) {
    const aliasTokens = aliasTokenEntries(alias).map((token) => token.normalized);
    for (let start = 0; start <= queryTokens.length - aliasTokens.length; start += 1) {
      if (!aliasTokens.every((token, offset) => queryTokens[start + offset].normalized === token)) continue;
      const matched = queryTokens.slice(start, start + aliasTokens.length);
      return Object.freeze({
        start: matched[0].sourceIndex,
        length: aliasTokens.length,
        tokens: Object.freeze(matched.map((token) => token.original)),
      });
    }
  }
  return null;
}

function tokenLengthsCompatible(left, right, tokenCount) {
  const leftWithoutArticle = left.arabic && left.original.startsWith("ال") ? left.key.replace(/^l/, "") : left.key;
  const rightWithoutArticle = right.arabic && right.original.startsWith("ال") ? right.key.replace(/^l/, "") : right.key;
  if (left.key !== right.key && leftWithoutArticle !== right.key && left.key !== rightWithoutArticle) return false;
  if (/^\d+$/.test(left.key) || /^\d+$/.test(right.key)) return left.key === right.key;
  if (tokenCount === 1 && left.key.length <= 2) return left.length === right.length;
  const permittedDifference = tokenCount === 1
    ? Math.max(1, Math.ceil(Math.max(left.length, right.length) * 0.3))
    : Math.max(1, Math.ceil(Math.max(left.length, right.length) * 0.45));
  return Math.abs(left.length - right.length) <= permittedDifference;
}

function scriptsDiffer(left, right) {
  return left.some((token) => token.arabic) !== right.some((token) => token.arabic);
}

export function findCrossScriptMovieTitleRange(query, title) {
  const aliasRange = explicitAliasRange(query, title);
  if (aliasRange) return aliasRange;
  const queryTokens = Array.isArray(query)
    ? query.map((token, sourceIndex) => ({ ...tokenDetails(token), sourceIndex })).filter((token) => token.key)
    : significantTitleTokens(query).map((token, sourceIndex) => ({ ...token, sourceIndex }));
  const titleTokens = significantTitleTokens(title);
  if (!queryTokens.length || !titleTokens.length || !scriptsDiffer(queryTokens, titleTokens)) return null;

  for (let start = 0; start <= queryTokens.length - titleTokens.length; start += 1) {
    const compatible = titleTokens.every((titleToken, offset) => (
      tokenLengthsCompatible(queryTokens[start + offset], titleToken, titleTokens.length)
    ));
    if (compatible) {
      const matched = queryTokens.slice(start, start + titleTokens.length);
      return Object.freeze({
        start: matched[0].sourceIndex,
        length: titleTokens.length,
        tokens: Object.freeze(matched.map((token) => token.original)),
      });
    }
  }
  for (let length = Math.min(queryTokens.length, titleTokens.length - 1); length >= 2; length -= 1) {
    const prefix = titleTokens.slice(0, length);
    const strength = prefix.reduce((total, token) => total + token.key.length, 0);
    if (strength < 4) continue;
    for (let start = 0; start <= queryTokens.length - length; start += 1) {
      const compatible = prefix.every((titleToken, offset) => (
        tokenLengthsCompatible(queryTokens[start + offset], titleToken, titleTokens.length)
      ));
      if (compatible) {
        const matched = queryTokens.slice(start, start + length);
        return Object.freeze({
          start: matched[0].sourceIndex,
          length,
          tokens: Object.freeze(matched.map((token) => token.original)),
        });
      }
    }
  }
  return null;
}

export function resolveCrossScriptMovieCandidate(movies, candidate, getTitle = (movie) => movie?.title ?? movie?.Title ?? movie?.name) {
  const list = Array.isArray(movies) ? movies : [];
  const candidateCount = significantTitleTokens(candidate).length;
  const matches = candidateCount
    ? list.filter((movie) => findCrossScriptMovieTitleRange(candidate, getTitle(movie))?.length === candidateCount)
    : [];
  return matches.length === 1 ? matches[0] : null;
}
