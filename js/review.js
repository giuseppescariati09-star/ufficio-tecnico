export const INTERVALS = [1, 3, 7, 14, 30];
const MAX_BOX = INTERVALS.length - 1;

export function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function localToday(now = new Date()) {
  const p = (v) => String(v).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

const isValid = (s) => Boolean(s) && typeof s === 'object'
  && Number.isInteger(s.box) && s.box >= 0 && s.box <= MAX_BOX && typeof s.due === 'string';

export function grade(state, correct, today) {
  const prev = isValid(state) ? state : null;
  const right = (prev?.right ?? 0) + (correct ? 1 : 0);
  const wrong = (prev?.wrong ?? 0) + (correct ? 0 : 1);
  const box = correct ? Math.min((prev ? prev.box : 0) + 1, MAX_BOX) : 0;
  return { box, due: addDays(today, INTERVALS[box]), right, wrong };
}

function interleave(cases) {
  const groups = new Map();
  for (const c of cases) {
    if (!groups.has(c.ufficio)) groups.set(c.ufficio, []);
    groups.get(c.ufficio).push(c);
  }
  const lists = [...groups.values()];
  const out = [];
  while (out.length < cases.length) {
    for (const l of lists) if (l.length) out.push(l.shift());
  }
  return out;
}

export function todayQueue(cases, progress, today, { newLimit, reviewLimit }) {
  const reviews = [];
  const fresh = [];
  for (const c of cases) {
    const s = progress[c.id];
    if (!isValid(s)) fresh.push(c);
    else if (s.due <= today) reviews.push(c);
  }
  reviews.sort((a, b) => progress[a.id].due.localeCompare(progress[b.id].due));
  return [...reviews.slice(0, reviewLimit), ...interleave(fresh).slice(0, newLimit)];
}

export function mastery(cases, progress) {
  if (!cases.length) return 0;
  const points = cases.reduce((sum, c) => {
    const s = progress[c.id];
    return sum + (isValid(s) ? s.box + 1 : 0);
  }, 0);
  return Math.round((points / (cases.length * INTERVALS.length)) * 100);
}
