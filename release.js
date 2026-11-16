/* Сроки релизов: дата песни отдельно от даты публикации разбора.
 * Реальный календарный год используется только для расчётов, но никогда не выводится ученику.
 * Полные даты нужны для точных фильтров 7/30 дней; неполные — лишь для года.
 */
const RELEASE_PERIODS = ["all", "week", "month", "year", "published"];

function releaseDateForIndex(song, record) {
  if (!record || typeof record.date !== "string") return "";
  const canon=value=>String(value||"").normalize("NFKC").toLocaleLowerCase("ru-RU").replace(/ё/g,"е").trim();
  return canon(record.artist)===canon(song.artist) && canon(record.title)===canon(song.title)
    ? record.date : "";
}

function releaseInfo(song) {
  const raw = String(song?.releaseDate || "").trim();
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(raw);
  if (!match) return null;
  const year = Number(match[1]), month = match[2] ? Number(match[2]) : null;
  const day = match[3] ? Number(match[3]) : null;
  if (year < 1900 || year > 2100 || (month !== null && (month < 1 || month > 12))) return null;
  if (day !== null) {
    const candidate = new Date(year, month - 1, day);
    if (candidate.getFullYear() !== year || candidate.getMonth() !== month - 1 || candidate.getDate() !== day) return null;
  }
  return {year,month,day,date:day !== null ? new Date(year, month - 1, day) : null};
}

function releaseRecency(song, now = new Date()) {
  const info = releaseInfo(song);
  if (!info) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (info.year > today.getFullYear()) return null;
  if (info.year===today.getFullYear() && info.month!==null && info.month>today.getMonth()+1) return null;
  if (info.date && info.date > today) return null;
  if (info.date) {
    const days = Math.round((today - info.date) / 86400000);
    if (days <= 7 && days >= 0) return "week";
    if (days <= 30 && days >= 0) return "month";
  }
  return info.year === today.getFullYear() ? "year" : null;
}

function releasePeriodMatches(song, period, now = new Date()) {
  if (period === "all") return true;
  if (period === "published") return Boolean(song?.isNew);
  const recency = releaseRecency(song, now);
  if (period === "week") return recency === "week";
  if (period === "month") return recency === "week" || recency === "month";
  if (period === "year") return recency !== null;
  return true;
}

function releaseLabel(song, now = new Date()) {
  const status = releaseRecency(song, now);
  if (status === "week") return "Релиз недели";
  if (status === "month") return "Свежий релиз";
  if (status === "year") return "Новая песня";
  return song.isNew ? "Новый разбор" : "";
}

function releaseOrderValue(song) {
  const raw = String(song.releaseDate || "");
  const info = releaseInfo(song);
  if (!info) return -1;
  return Number(raw.padEnd(10,"-01").replace(/-/g,"")) || -1;
}

function freshnessScore(song) {
  const status = releaseRecency(song);
  return status === "week" ? 4 : status === "month" ? 3 : status === "year" ? 2 : song.isNew ? 1 : 0;
}

function compareFreshness(a,b) {
  const score=freshnessScore(b)-freshnessScore(a);
  if (score) return score;
  const releases=releaseOrderValue(b)-releaseOrderValue(a);
  if (releases && (releaseRecency(a) || releaseRecency(b))) return releases;
  const published=new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime();
  return (Number.isFinite(published)?published:0) || b.id-a.id;
}
