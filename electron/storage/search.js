const { db } = require('./jsonDb');

function includesQ(x, q) { return (x || '').toLowerCase().includes(q); }

function searchAll(q, options) {
  const qq = (q || '').trim().toLowerCase();
  const profile_id = options?.profile_id && options.profile_id !== 'all' ? options.profile_id : null;
  const limit = Math.max(5, Math.min(100, Number(options?.limit || 20)));
  if (!qq) return { tasks: [], plans: [], logs: [], goals: [], docs: [] };

  const raw = db._raw();

  const tasks = raw.tasks.filter(t =>
    (!profile_id || t.profile_id===profile_id) &&
    (includesQ(t.title, qq) || includesQ(t.description, qq))
  ).slice(0, limit);

  const plans = raw.maintenance_plans.filter(p => includesQ(p.title, qq) || includesQ(p.note, qq)).slice(0, limit);
  const logs = raw.maintenance_logs.filter(l => includesQ(l.note, qq)).slice(0, limit);
  const goals = raw.goals.filter(g => includesQ(g.title, qq) || includesQ(g.note, qq)).slice(0, limit);
  const docs = raw.documents.filter(d => includesQ(d.title, qq) || includesQ(d.file_name, qq)).slice(0, limit);

  return { tasks, plans, logs, goals, docs };
}

module.exports = { searchAll };
