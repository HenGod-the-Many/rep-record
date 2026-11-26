// Accessibility scan for Rep Record (W-20 slice 8). Paste into the browser console on the dev
// server (npm run dev, phone size 390 x 844) or run it through a browser tool. It visits each
// route, waits, and reports per screen:
//   small      controls smaller than 44 x 44 pt (checkboxes inside 44 pt rows are skipped)
//   unlabeled  buttons with neither text nor aria-label
//   tiny       text set below 11 px
//   hscroll    the page scrolls sideways
// Run it once at the default text size, then again after
//   document.documentElement.style.fontSize = '23px'   (about the largest standard iPhone size)
// To see that it can fail, add a 20 x 20 button to the page first: it must be reported.
(async () => {
  const { db } = await import('/rep-record/src/db/db.ts');
  const plan = (await db.plans.toArray()).find((p) => !p.hidden);
  const entry = plan && (await db.planExercises.where('planId').equals(plan.id).first());
  const split = await db.splits.toCollection().first();
  const warmup = await db.warmups.toCollection().first();
  const exercise = await db.exercises.toCollection().first();
  const session = await db.sessions.toCollection().last();
  const today = new Date().toISOString().slice(0, 10);
  const routes = [
    '/today', '/calendar', `/day/${today}`, `/move/${today}`, '/splits', '/plans', '/exercises', '/warmups', '/body', '/body/bodyweight', '/settings',
    ...(split ? [`/splits/${split.id}`] : []),
    ...(plan ? [`/plans/${plan.id}`, `/pick?mode=add&plan=${plan.id}`] : []),
    ...(plan && entry ? [`/plans/${plan.id}/entry/${entry.id}`] : []),
    ...(exercise ? [`/exercises/${exercise.id}`, `/exercises/${exercise.id}/history`] : []),
    ...(warmup ? [`/warmups/${warmup.id}`] : []),
    ...(session ? [`/log/${session.id}`] : []),
  ];
  const wait = () => new Promise((r) => setTimeout(r, 600));
  const out = {};
  for (const r of routes) {
    location.hash = `#${r}`;
    await wait();
    const small = [];
    for (const el of document.querySelectorAll('button, a, input, select, [role=button]')) {
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height || el.type === 'checkbox') continue;
      if (b.height < 43.5 || b.width < 43.5) small.push(`${(el.getAttribute('aria-label') || el.innerText || el.tagName).trim().slice(0, 30)} ${Math.round(b.width)}x${Math.round(b.height)}`);
    }
    const unlabeled = [...document.querySelectorAll('button')].filter((b) => !b.innerText.trim() && !b.getAttribute('aria-label')).length;
    const tiny = [...document.querySelectorAll('body *')].filter(
      (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(el).fontSize) < 11,
    ).length;
    out[r] = { small, unlabeled, tiny, hscroll: document.documentElement.scrollWidth > innerWidth };
  }
  console.table(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { small: v.small.length, unlabeled: v.unlabeled, tiny: v.tiny, hscroll: v.hscroll }])));
  return out;
})();
