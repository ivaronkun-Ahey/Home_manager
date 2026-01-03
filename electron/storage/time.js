function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function addDays(d, days) { const x = new Date(d); x.setDate(x.getDate()+days); return x; }
function isSameDay(a,b){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function toISODate(d){ const x=new Date(d); const y=x.getFullYear(); const m=String(x.getMonth()+1).padStart(2,'0'); const day=String(x.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }
function parseISODate(iso){ const [y,m,d]=String(iso||'').split('-').map(Number); return new Date(y,(m||1)-1,d||1,0,0,0,0); }
function nowISO(){ return new Date().toISOString(); }
module.exports = { startOfDay, addDays, isSameDay, toISODate, parseISODate, nowISO };
