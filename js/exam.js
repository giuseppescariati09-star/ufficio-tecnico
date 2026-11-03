export function shuffle(items, rng = Math.random) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildExam(cases, n, minutes, now = Date.now(), rng = Math.random) {
  const groups = new Map();
  for (const c of shuffle(cases, rng)) {
    if (!groups.has(c.ufficio)) groups.set(c.ufficio, []);
    groups.get(c.ufficio).push(c.id);
  }
  const lists = [...groups.values()];
  const ids = [];
  while (ids.length < n && lists.some((l) => l.length)) {
    for (const l of lists) {
      if (ids.length < n && l.length) ids.push(l.shift());
    }
  }
  return { ids: shuffle(ids, rng), answers: {}, startedAt: now, endsAt: now + minutes * 60000 };
}

export function score(exam, cases, passMark) {
  const byId = new Map(cases.map((c) => [c.id, c]));
  const wrongIds = exam.ids.filter((id) => exam.answers[id] !== byId.get(id)?.corretta);
  const total = exam.ids.length;
  const correct = total - wrongIds.length;
  const onThirty = total ? Math.round((correct / total) * 300) / 10 : 0;
  return { correct, total, onThirty, passed: onThirty >= passMark, wrongIds };
}

export function remainingSeconds(exam, now = Date.now()) {
  return Math.max(0, Math.ceil((exam.endsAt - now) / 1000));
}
