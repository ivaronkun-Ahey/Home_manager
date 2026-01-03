const fs = require('fs');
const path = require('path');
const { ensureDataDirs } = require('./fsPaths');
const { nanoid } = require('./nanoid');
const { addDays, startOfDay, isSameDay, toISODate, parseISODate, nowISO } = require('./time');
const { applyMigrations, CURRENT_SCHEMA_VERSION } = require('./migration');

const SCHEMA_VERSION = CURRENT_SCHEMA_VERSION;

function atomicWrite(filePath, content) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, content, 'utf-8');
  fs.renameSync(tmp, filePath);
}

// Создает пустую БД с дефолтными данными
function createDefaultSeed() {
  return {
    schema_version: SCHEMA_VERSION,
    created_at: nowISO(),

    // Существующие таблицы v1
    profiles: [{ id: nanoid(), name: 'Я', color: '#6ee7b7', icon: '👤', is_archived: false, created_at: nowISO() }],
    tags: [],
    tasks: [],
    routines: [],
    routine_instances: [],
    assets: [
      { id: nanoid(), name: 'Дом', type: 'home', note: '', created_at: nowISO(), updated_at: nowISO() },
      { id: nanoid(), name: 'Авто', type: 'car', note: '', created_at: nowISO(), updated_at: nowISO() }
    ],
    maintenance_plans: [],
    maintenance_logs: [],
    goals: [],
    expenses: [],
    documents: [],

    // Новые таблицы v2 (пустые, миграция их заполнит)
    properties: [],
    rooms: [],
    inventory: [],
    meters: [],
    meter_readings: [],
    contacts: [],
    checklists: [],
    checklist_progress: [],
    user_stats: null,  // будет инициализировано миграцией
    tariffs: [
      { id: 'cold_water', type: 'cold_water', name: 'Холодная вода', unit: 'м³', price: 45.00, updated_at: null },
      { id: 'hot_water', type: 'hot_water', name: 'Горячая вода', unit: 'м³', price: 220.00, updated_at: null },
      { id: 'gas', type: 'gas', name: 'Газ', unit: 'м³', price: 8.50, updated_at: null },
      { id: 'electricity', type: 'electricity', name: 'Электричество', unit: 'кВт·ч', price: 6.50, updated_at: null },
      { id: 'heating', type: 'heating', name: 'Отопление', unit: 'Гкал', price: 2500.00, updated_at: null }
    ],
    custom_meter_types: []
  };
}

function loadOrInit() {
  const { dataDir, backupsDir } = ensureDataDirs();
  const dbPath = path.join(dataDir, 'db.json');

  if (!fs.existsSync(dbPath)) {
    // Создаем новую БД с актуальной схемой v2
    const seed = createDefaultSeed();

    // Применяем миграции (для новой БД это добавит дефолтные данные)
    const migratedSeed = applyMigrations(seed);
    atomicWrite(dbPath, JSON.stringify(migratedSeed, null, 2));
    return { dbPath, data: migratedSeed };
  }

  // Загружаем существующую БД и применяем миграции
  let data;
  try {
    const raw = fs.readFileSync(dbPath, 'utf-8');
    data = JSON.parse(raw);
  } catch (err) {
    // БД повреждена - создаем backup и восстанавливаем
    console.error('[DB] CORRUPTED DATABASE DETECTED:', err.message);

    // Создаем backup поврежденного файла
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const backupPath = path.join(backupsDir, `db.corrupted.${timestamp}.json`);

    try {
      fs.copyFileSync(dbPath, backupPath);
      console.log(`[DB] Corrupted file backed up to: ${backupPath}`);
    } catch (backupErr) {
      console.error('[DB] Failed to backup corrupted file:', backupErr.message);
    }

    // Создаем свежую БД
    console.log('[DB] Creating fresh database...');
    const seed = createDefaultSeed();
    const migratedSeed = applyMigrations(seed);
    atomicWrite(dbPath, JSON.stringify(migratedSeed, null, 2));

    console.log('[DB] Database recovered successfully');
    return { dbPath, data: migratedSeed, recovered: true };
  }

  const oldVersion = data.schema_version || 1;

  // Применяем миграции если нужно
  data = applyMigrations(data);

  // Если была миграция - сохраняем
  if (data.schema_version !== oldVersion) {
    console.log(`[DB] Migrated from v${oldVersion} to v${data.schema_version}, saving...`);
    atomicWrite(dbPath, JSON.stringify(data, null, 2));
  }

  return { dbPath, data };
}

let state = null;

function getState() {
  if (!state) {
    state = loadOrInit();
  }
  return state;
}

function reloadState() {
  console.log('[DB] Reloading state from disk...');
  state = null;  // Invalidate cache
  state = loadOrInit();  // Reload from disk
  console.log('[DB] State reloaded successfully');
  return state;
}

function save() {
  const s = getState();
  atomicWrite(s.dbPath, JSON.stringify(s.data, null, 2));
}

function normalizeTags(tag_ids) {
  if (!Array.isArray(tag_ids)) return [];
  return [...new Set(tag_ids.filter(Boolean))];
}
function filterByTags(item, tag_ids) {
  if (!tag_ids?.length) return true;
  const set = new Set(item.tag_ids || []);
  return tag_ids.every(t => set.has(t));
}
function sortByDue(a,b){
  const da=a.due_at ? Date.parse(a.due_at) : Infinity;
  const db=b.due_at ? Date.parse(b.due_at) : Infinity;
  return da-db;
}
function computeNextDue(doneAtISO, intervalDays) {
  const d = parseISODate(doneAtISO);
  return toISODate(addDays(d, intervalDays));
}

const db = {
  _raw: () => getState().data,

  profiles: {
    list(){ return getState().data.profiles.slice().sort((a,b)=>a.name.localeCompare(b.name)); },
    create({ name, color, icon }) {
      const p = { id:nanoid(), name:(name||'').trim()||'Профиль', color:color||'#93c5fd', icon:icon||'👤', is_archived:false, created_at: nowISO() };
      getState().data.profiles.push(p); save(); return p;
    },
    update(id, patch){
      const p = getState().data.profiles.find(x=>x.id===id); if(!p) throw new Error('Profile not found');
      Object.assign(p, patch||{}, { id }); save(); return p;
    },
    archive(id, is_archived){
      const p = getState().data.profiles.find(x=>x.id===id); if(!p) throw new Error('Profile not found');
      p.is_archived = !!is_archived; save(); return p;
    },
    delete(id){
      const profiles = getState().data.profiles;
      if (profiles.length <= 1) throw new Error('Cannot delete the last profile');
      const exists = profiles.some(p => p.id === id);
      if (!exists) throw new Error('Profile not found');
      getState().data.tasks = getState().data.tasks.map(t => t.profile_id === id ? { ...t, profile_id: null } : t);
      getState().data.routines = getState().data.routines.map(r => r.profile_id === id ? { ...r, profile_id: null } : r);
      getState().data.profiles = profiles.filter(p => p.id !== id);
      save();
      return true;
    }
  },

  tags: {
    list(){ return getState().data.tags.slice().sort((a,b)=>a.name.localeCompare(b.name)); },
    create({ name, color }){
      const nm=(name||'').trim(); if(!nm) throw new Error('Tag name required');
      if(getState().data.tags.some(t=>t.name.toLowerCase()===nm.toLowerCase())) throw new Error('Tag already exists');
      const t={ id:nanoid(), name:nm, color:color||'#fca5a5', created_at: nowISO() };
      getState().data.tags.push(t); save(); return t;
    },
    rename(id, name){
      const t=getState().data.tags.find(x=>x.id===id); if(!t) throw new Error('Tag not found');
      const nm=(name||'').trim(); if(!nm) throw new Error('Tag name required');
      t.name=nm; save(); return t;
    },
    delete(id){
      const s = getState();
      s.data.tags = s.data.tags.filter(t=>t.id!==id);
      const lists=['tasks','routines','assets','maintenance_plans','maintenance_logs','goals','documents','expenses'];
      for(const key of lists){
        for(const item of (s.data[key]||[])){
          if(Array.isArray(item.tag_ids)) item.tag_ids = item.tag_ids.filter(t=>t!==id);
        }
      }
      save();
    },
    merge(fromId, intoId){
      if(fromId===intoId) return;
      const s = getState();
      if(!s.data.tags.find(t=>t.id===fromId)) throw new Error('from_tag not found');
      if(!s.data.tags.find(t=>t.id===intoId)) throw new Error('into_tag not found');
      const lists=['tasks','routines','assets','maintenance_plans','maintenance_logs','goals','documents','expenses'];
      for(const key of lists){
        for(const item of (s.data[key]||[])){
          if(!Array.isArray(item.tag_ids)) continue;
          const set=new Set(item.tag_ids);
          if(set.has(fromId)){ set.delete(fromId); set.add(intoId); item.tag_ids=[...set]; }
        }
      }
      s.data.tags = s.data.tags.filter(t=>t.id!==fromId);
      save();
    }
  },

  tasks: {
    list(filter){
      const f=filter||{};
      const q=(f.q||'').trim().toLowerCase();
      const today=startOfDay(new Date());
      const weekEnd=addDays(today, 7);
      let items = getState().data.tasks.slice();
      if(f.profile_id && f.profile_id!=='all') items = items.filter(t=>t.profile_id===f.profile_id);
      if(f.status && f.status!=='all') items = items.filter(t=>t.status===f.status);
      if(f.range && f.range!=='all'){
        if(f.range==='today') items = items.filter(t=>t.due_at && isSameDay(parseISODate(t.due_at), today));
        if(f.range==='week') items = items.filter(t=>t.due_at && parseISODate(t.due_at)>=today && parseISODate(t.due_at)<weekEnd);
        if(f.range==='overdue') items = items.filter(t=>t.due_at && parseISODate(t.due_at)<today && t.status!=='done');
      }
      if(Array.isArray(f.tag_ids) && f.tag_ids.length) items = items.filter(t=>filterByTags(t, f.tag_ids));
      if(q) items = items.filter(t => (t.title||'').toLowerCase().includes(q) || (t.description||'').toLowerCase().includes(q));
      return items.sort(sortByDue);
    },
    create(payload){
      const now=nowISO();
      const t={
        id:nanoid(),
        title:(payload.title||'').trim()||'Новое дело',
        description:(payload.description||'').trim(),
        status: payload.status || 'active',
        due_at: payload.due_at || null,
        priority: payload.priority || 'med',
        profile_id: payload.profile_id || null,
        tag_ids: normalizeTags(payload.tag_ids),
        linked: payload.linked || null,
        created_at: now,
        updated_at: now,
        done_at: null
      };
      getState().data.tasks.push(t); save(); return t;
    },
    update(id, patch){
      const t=getState().data.tasks.find(x=>x.id===id); if(!t) throw new Error('Task not found');
      Object.assign(t, patch||{});
      if('tag_ids' in (patch||{})) t.tag_ids = normalizeTags(patch.tag_ids);
      t.updated_at = nowISO();
      save(); return t;
    },
    setStatus(id, status){
      const t=getState().data.tasks.find(x=>x.id===id); if(!t) throw new Error('Task not found');
      t.status=status;
      t.done_at = status==='done' ? nowISO() : null;
      t.updated_at = nowISO();

      // Если задача из рутины и отмечена как выполненная - создаем routine_instance
      if (status === 'done' && t.linked?.type === 'routine' && t.linked?.id) {
        const routine_id = t.linked.id;
        const date = t.due_at || toISODate(startOfDay(new Date()));

        // Проверяем, не существует ли уже такой instance
        const existingInstance = getState().data.routine_instances.find(
          inst => inst.routine_id === routine_id && inst.date === date
        );

        if (!existingInstance) {
          const inst = {
            id: nanoid(),
            routine_id,
            date,
            status: 'done',
            done_at: nowISO(),
            note: '',
            task_id: t.id  // добавляем ссылку на задачу для обратной связи
          };
          getState().data.routine_instances.push(inst);
        }
      }

      save(); return t;
    },
    reschedule(id, due_at){ return this.update(id, { due_at: due_at || null }); },
    delete(id){ getState().data.tasks = getState().data.tasks.filter(t=>t.id!==id); save(); }
  },

  routines: {
    list(filter){
      const f=filter||{};
      let items=getState().data.routines.slice();
      if(f.profile_id && f.profile_id!=='all') items=items.filter(r=>r.profile_id===f.profile_id);
      if(typeof f.is_active==='boolean') items=items.filter(r=>r.is_active===f.is_active);
      return items.sort((a,b)=>a.title.localeCompare(b.title));
    },
    get(id){
      const routine = getState().data.routines.find(r=>r.id===id);
      if(!routine) throw new Error('Routine not found');
      const upcoming = getState().data.tasks.filter(t=>t.linked?.type==='routine' && t.linked?.id===id && t.status!=='done').sort(sortByDue).slice(0,30);
      const history = getState().data.routine_instances.filter(x=>x.routine_id===id).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,30);
      return { routine, upcoming, history };
    },
    create(payload){
      const now=nowISO();
      const r={
        id:nanoid(),
        title:(payload.title||'').trim()||'Новая рутина',
        description:(payload.description||'').trim(),
        is_active: payload.is_active !== false,
        profile_id: payload.profile_id || null,
        rule: payload.rule || { freq:'daily', interval:1 },
        start_date: payload.start_date || toISODate(startOfDay(new Date())),
        last_generated_at: null,
        created_at: now,
        updated_at: now
      };
      getState().data.routines.push(r); save(); return r;
    },
    update(id, patch){
      const r=getState().data.routines.find(x=>x.id===id); if(!r) throw new Error('Routine not found');
      Object.assign(r, patch||{});
      r.updated_at=nowISO();
      save(); return r;
    },
    setActive(id, is_active){ return this.update(id, { is_active: !!is_active }); },
    generate(daysAhead=14){
      const today = startOfDay(new Date());
      const end = addDays(today, daysAhead);
      let created=0;

      for(const r of getState().data.routines){
        if(!r.is_active) continue;
        const interval = Math.max(1, Number(r.rule?.interval || 1));
        const freq = r.rule?.freq || 'daily';
        let stepDays=1;
        if(freq==='daily') stepDays=interval;
        if(freq==='weekly') stepDays=7*interval;
        if(freq==='monthly') stepDays=30*interval; // MVP approximation

        const start = parseISODate(r.start_date || toISODate(today));
        for(let d = startOfDay(today); d < end; d = addDays(d, 1)){
          if(d < start) continue;
          const diffDays = Math.floor((d - start) / (24*3600*1000));
          if(diffDays % stepDays !== 0) continue;

          const dueISO = toISODate(d);
          const exists = getState().data.tasks.some(t => t.linked?.type==='routine' && t.linked?.id===r.id && t.due_at===dueISO);
          if(exists) continue;

          getState().data.tasks.push({
            id:nanoid(),
            title:r.title,
            description:r.description||'',
            status:'active',
            due_at: dueISO,
            priority:'med',
            profile_id: r.profile_id || null,
            tag_ids: [],
            linked: { type:'routine', id:r.id },
            created_at: nowISO(),
            updated_at: nowISO(),
            done_at: null
          });
          created++;
        }
        r.last_generated_at = nowISO();
      }
      if(created) save();
      return { generatedTasks: created };
    },
    markInstance({ routine_id, date, status }){
      const iso = date || toISODate(startOfDay(new Date()));
      const inst = { id:nanoid(), routine_id, date: iso, status: status || 'done', done_at: nowISO(), note:'' };
      getState().data.routine_instances.push(inst);
      save();
      return inst;
    },
    delete(id){
      const s = getState();
      s.data.routines = s.data.routines.filter(r=>r.id!==id);
      s.data.routine_instances = s.data.routine_instances.filter(i=>i.routine_id!==id);
      s.data.tasks = s.data.tasks.filter(t=>!(t.linked?.type==='routine' && t.linked?.id===id));
      save();
    }
  },

  assets: {
    list(){ return getState().data.assets.slice().sort((a,b)=>a.name.localeCompare(b.name)); },
    get(id){
      const asset=getState().data.assets.find(a=>a.id===id); if(!asset) throw new Error('Asset not found');
      const plans=getState().data.maintenance_plans.filter(p=>p.asset_id===id);
      const logs=getState().data.maintenance_logs.filter(l=>l.asset_id===id).sort((a,b)=>Date.parse(b.done_at)-Date.parse(a.done_at)).slice(0,20);
      const docs=getState().data.documents.filter(d=>d.linked?.type==='asset' && d.linked?.id===id);
      return { asset, plans, recentLogs: logs, documents: docs };
    },
    create(payload){
      const now=nowISO();
      const a={ id:nanoid(), name:(payload.name||'').trim()||'Новый объект', type:payload.type||'other', note:(payload.note||'').trim(), tag_ids: normalizeTags(payload.tag_ids), created_at:now, updated_at:now };
      getState().data.assets.push(a); save(); return a;
    },
    update(id, patch){
      const a=getState().data.assets.find(x=>x.id===id); if(!a) throw new Error('Asset not found');
      Object.assign(a, patch||{});
      if('tag_ids' in (patch||{})) a.tag_ids = normalizeTags(patch.tag_ids);
      a.updated_at=nowISO();
      save(); return a;
    },
    delete(id){
      getState().data.assets = getState().data.assets.filter(a=>a.id!==id);
      const planIds = getState().data.maintenance_plans.filter(p=>p.asset_id===id).map(p=>p.id);
      getState().data.maintenance_plans = getState().data.maintenance_plans.filter(p=>p.asset_id!==id);
      getState().data.maintenance_logs = getState().data.maintenance_logs.filter(l=>l.asset_id!==id && !planIds.includes(l.plan_id));
      save();
    }
  },

  maintenance: {
    plans: {
      list(filter){
        const f=filter||{};
        const daysSoon = Number(f.daysSoon || 14);
        const today = startOfDay(new Date());
        const soonEnd = addDays(today, daysSoon);
        let items=getState().data.maintenance_plans.slice();
        if(f.asset_id) items=items.filter(p=>p.asset_id===f.asset_id);
        if(typeof f.is_active==='boolean') items=items.filter(p=>p.is_active===f.is_active);

        if(f.range && f.range!=='all'){
          if(f.range==='overdue') items=items.filter(p=>parseISODate(p.next_due_at)<today);
          if(f.range==='soon') items=items.filter(p=>{ const d=parseISODate(p.next_due_at); return d>=today && d<soonEnd; });
        }
        if(Array.isArray(f.tag_ids) && f.tag_ids.length) items=items.filter(p=>filterByTags(p,f.tag_ids));
        items.sort((a,b)=>Date.parse(a.next_due_at)-Date.parse(b.next_due_at));
        return items;
      },
      create(payload){
        const now=nowISO();
        const interval_days = Math.max(1, Number(payload.interval_days || 30));
        const last_done_at = payload.last_done_at || null;
        const base = last_done_at ? parseISODate(last_done_at) : startOfDay(new Date());
        const next_due_at = payload.next_due_at || toISODate(addDays(base, interval_days));
        const p={
          id:nanoid(),
          asset_id: payload.asset_id,
          title:(payload.title||'').trim()||'План обслуживания',
          interval_days,
          last_done_at,
          next_due_at,
          expected_cost: payload.expected_cost ?? null,
          note:(payload.note||'').trim(),
          is_active: payload.is_active !== false,
          tag_ids: normalizeTags(payload.tag_ids),
          created_at: now,
          updated_at: now
        };
        getState().data.maintenance_plans.push(p); save(); return p;
      },
      update(id, patch){
        const p=getState().data.maintenance_plans.find(x=>x.id===id); if(!p) throw new Error('Plan not found');
        Object.assign(p, patch||{});
        if('tag_ids' in (patch||{})) p.tag_ids = normalizeTags(patch.tag_ids);
        if('interval_days' in (patch||{})) p.interval_days = Math.max(1, Number(p.interval_days));
        p.updated_at=nowISO();
        save(); return p;
      },
      setActive(id, is_active){ return this.update(id, { is_active: !!is_active }); },
      delete(id){
        getState().data.maintenance_plans = getState().data.maintenance_plans.filter(p=>p.id!==id);
        getState().data.maintenance_logs = getState().data.maintenance_logs.filter(l=>l.plan_id!==id);
        save();
      }
    },
    logs: {
      list(filter){
        const f=filter||{};
        let items=getState().data.maintenance_logs.slice();
        if(f.asset_id) items=items.filter(l=>l.asset_id===f.asset_id);
        if(f.plan_id) items=items.filter(l=>l.plan_id===f.plan_id);
        if(f.from) items=items.filter(l=>Date.parse(l.done_at)>=Date.parse(f.from));
        if(f.to) items=items.filter(l=>Date.parse(l.done_at)<=Date.parse(f.to));
        if(Array.isArray(f.tag_ids) && f.tag_ids.length) items=items.filter(l=>filterByTags(l,f.tag_ids));
        items.sort((a,b)=>Date.parse(b.done_at)-Date.parse(a.done_at));
        return items;
      },
      create(payload){
        const plan = getState().data.maintenance_plans.find(p=>p.id===payload.plan_id);
        if(!plan) throw new Error('Plan not found');
        const done_at = payload.done_at || toISODate(startOfDay(new Date()));
        const log={
          id:nanoid(),
          plan_id: plan.id,
          asset_id: plan.asset_id,
          done_at,
          cost: payload.cost ?? null,
          note:(payload.note||'').trim(),
          tag_ids: normalizeTags(payload.tag_ids),
          attachment_doc_ids: normalizeTags(payload.attachment_doc_ids),
          created_at: nowISO()
        };
        getState().data.maintenance_logs.push(log);

        plan.last_done_at = done_at;
        plan.next_due_at = computeNextDue(done_at, plan.interval_days);
        plan.updated_at = nowISO();

        if(payload.create_expense){
          getState().data.expenses.push({
            id:nanoid(),
            amount: Number(payload.cost || 0) || 0,
            spent_at: done_at,
            note: `Обслуживание: ${plan.title}`,
            goal_id: payload.goal_id || null,
            asset_id: plan.asset_id,
            plan_id: plan.id,
            log_id: log.id,
            tag_ids: normalizeTags(payload.tag_ids),
            created_at: nowISO()
          });
        }

        save();
        return log;
      },
      delete(id){ getState().data.maintenance_logs = getState().data.maintenance_logs.filter(l=>l.id!==id); save(); }
    }
  },

  goals: {
    list(filter){
      const f=filter||{};
      let items=getState().data.goals.slice();
      if(f.status && f.status!=='all') items=items.filter(g=>g.status===f.status);
      return items.sort((a,b)=>a.title.localeCompare(b.title));
    },
    get(id){
      const goal=getState().data.goals.find(g=>g.id===id); if(!goal) throw new Error('Goal not found');
      const expenses=getState().data.expenses.filter(e=>e.goal_id===id).sort((a,b)=>Date.parse(b.spent_at)-Date.parse(a.spent_at));
      const documents=getState().data.documents.filter(d=>d.linked?.type==='goal' && d.linked?.id===id);
      const tasks=getState().data.tasks.filter(t=>t.linked?.type==='goal' && t.linked?.id===id);
      return { goal, expenses, documents, tasks };
    },
    create(payload){
      const now=nowISO();
      const g={
        id:nanoid(),
        title:(payload.title||'').trim()||'Новая цель',
        target_amount: Number(payload.target_amount || 0) || 0,
        saved_amount: Number(payload.saved_amount || 0) || 0,
        due_at: payload.due_at || null,
        status: payload.status || 'active',
        note:(payload.note||'').trim(),
        tag_ids: normalizeTags(payload.tag_ids),
        created_at: now,
        updated_at: now
      };
      getState().data.goals.push(g); save(); return g;
    },
    update(id, patch){
      const g=getState().data.goals.find(x=>x.id===id); if(!g) throw new Error('Goal not found');
      Object.assign(g, patch||{});
      if('target_amount' in (patch||{})) g.target_amount = Number(g.target_amount||0) || 0;
      if('saved_amount' in (patch||{})) g.saved_amount = Number(g.saved_amount||0) || 0;
      if('tag_ids' in (patch||{})) g.tag_ids = normalizeTags(patch.tag_ids);
      g.updated_at = nowISO();
      save(); return g;
    },
    setStatus(id, status){ return this.update(id, { status }); },
    addContribution({ goal_id, amount, note, date }){
      const g=getState().data.goals.find(x=>x.id===goal_id); if(!g) throw new Error('Goal not found');
      const a=Number(amount||0)||0;
      g.saved_amount = (Number(g.saved_amount||0)||0) + a;
      g.updated_at=nowISO();
      getState().data.expenses.push({
        id:nanoid(),
        amount: -Math.abs(a),
        spent_at: date || toISODate(startOfDay(new Date())),
        note: note ? `Взнос: ${note}` : 'Взнос',
        goal_id,
        asset_id: null,
        plan_id: null,
        log_id: null,
        tag_ids: [],
        created_at: nowISO()
      });
      save();
      return g;
    }
  },

  expenses: {
    list(filter){
      const f=filter||{};
      let items=getState().data.expenses.slice();
      if(f.goal_id) items=items.filter(e=>e.goal_id===f.goal_id);
      if(f.asset_id) items=items.filter(e=>e.asset_id===f.asset_id);
      if(f.from) items=items.filter(e=>Date.parse(e.spent_at)>=Date.parse(f.from));
      if(f.to) items=items.filter(e=>Date.parse(e.spent_at)<=Date.parse(f.to));
      return items.sort((a,b)=>Date.parse(b.spent_at)-Date.parse(a.spent_at));
    },
    create(payload){
      const e={
        id:nanoid(),
        amount: Number(payload.amount||0)||0,
        spent_at: payload.spent_at || toISODate(startOfDay(new Date())),
        note:(payload.note||'').trim(),
        goal_id: payload.goal_id || null,
        asset_id: payload.asset_id || null,
        plan_id: payload.plan_id || null,
        log_id: payload.log_id || null,
        tag_ids: normalizeTags(payload.tag_ids),
        created_at: nowISO()
      };
      getState().data.expenses.push(e); save(); return e;
    },
    update(id, patch){
      const e = getState().data.expenses.find(x=>x.id===id);
      if(!e) throw new Error('Expense not found');
      if('amount' in (patch||{})) e.amount = Number(patch.amount||0)||0;
      if('spent_at' in (patch||{})) e.spent_at = patch.spent_at || toISODate(startOfDay(new Date()));
      if('note' in (patch||{})) e.note = (patch.note||'').trim();
      e.updated_at = nowISO();
      save();
      return e;
    },
    delete(id){ getState().data.expenses = getState().data.expenses.filter(e=>e.id!==id); save(); }
  },

  documents: {
    list(filter){
      const f=filter||{};
      const q=(f.q||'').trim().toLowerCase();
      let items=getState().data.documents.slice();
      if(f.linked_entity_type) items=items.filter(d=>d.linked?.type===f.linked_entity_type);
      if(f.linked_entity_id) items=items.filter(d=>d.linked?.id===f.linked_entity_id);
      if(Array.isArray(f.tag_ids) && f.tag_ids.length) items=items.filter(d=>filterByTags(d,f.tag_ids));
      if(q) items=items.filter(d=>(d.title||'').toLowerCase().includes(q) || (d.file_name||'').toLowerCase().includes(q));
      return items.sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
    },
    create(doc){ getState().data.documents.push(doc); save(); return doc; },
    relink(id, link){
      const d=getState().data.documents.find(x=>x.id===id); if(!d) throw new Error('Document not found');
      d.linked = link || null; save(); return d;
    },
    async delete(id){
      getState().data.documents = getState().data.documents.filter(x=>x.id!==id);
      save();
    }
  },

  // ============================================
  // NEW MODULES FOR v2.0
  // ============================================

  properties: {
    list(){
      return (getState().data.properties || []).slice().sort((a,b)=>a.name.localeCompare(b.name));
    },
    get(id){
      const property = getState().data.properties.find(p=>p.id===id);
      if(!property) throw new Error('Property not found');
      return property;
    },
    create(payload){
      const now=nowISO();
      const safeNumber = (val) => { const n = Number(val); return !isNaN(n) ? n : null; };
      const p={
        id:nanoid(),
        name:(payload.name||'').trim()||'Новая недвижимость',
        type: payload.type || 'apartment',
        address:(payload.address||'').trim(),
        area: payload.area ? safeNumber(payload.area) : null,
        rooms_count: payload.rooms_count ? safeNumber(payload.rooms_count) : null,
        floor: payload.floor ? safeNumber(payload.floor) : null,
        year_built: payload.year_built ? safeNumber(payload.year_built) : null,
        management_company:(payload.management_company||'').trim(),
        management_phone:(payload.management_phone||'').trim(),
        management_account:(payload.management_account||'').trim(),
        is_primary: !!payload.is_primary,
        notes:(payload.notes||'').trim(),
        created_at: now,
        updated_at: now
      };
      getState().data.properties.push(p); save(); return p;
    },
    update(id, patch){
      const p=getState().data.properties.find(x=>x.id===id);
      if(!p) throw new Error('Property not found');
      Object.assign(p, patch||{}, { id });
      p.updated_at=nowISO();
      save(); return p;
    },
    delete(id){
      // Удаляем property и все связанные данные
      const metersToDelete = getState().data.meters.filter(m=>m.property_id===id);
      getState().data.properties = getState().data.properties.filter(p=>p.id!==id);
      getState().data.rooms = getState().data.rooms.filter(r=>r.property_id!==id);
      getState().data.inventory = getState().data.inventory.filter(i=>i.property_id!==id);
      getState().data.meters = getState().data.meters.filter(m=>m.property_id!==id);
      // Также удаляем все показания счётчиков
      for (const meter of metersToDelete) {
        getState().data.meter_readings = getState().data.meter_readings.filter(r=>r.meter_id!==meter.id);
      }
      save();
    }
  },

  rooms: {
    list(filter){
      const f=filter||{};
      let items=(getState().data.rooms || []).slice();
      if(f.property_id) items=items.filter(r=>r.property_id===f.property_id);
      return items.sort((a,b)=>a.name.localeCompare(b.name));
    },
    get(id){
      const room = getState().data.rooms.find(r=>r.id===id);
      if(!room) throw new Error('Room not found');
      return room;
    },
    create(payload){
      const now=nowISO();
      const safeNumber = (val) => { const n = Number(val); return !isNaN(n) ? n : null; };
      const r={
        id:nanoid(),
        property_id: payload.property_id,
        name:(payload.name||'').trim()||'Комната',
        type: payload.type || 'other',
        area: payload.area ? safeNumber(payload.area) : null,
        notes:(payload.notes||'').trim(),
        created_at: now,
        updated_at: now
      };
      getState().data.rooms.push(r); save(); return r;
    },
    update(id, patch){
      const r=getState().data.rooms.find(x=>x.id===id);
      if(!r) throw new Error('Room not found');
      Object.assign(r, patch||{}, { id });
      r.updated_at=nowISO();
      save(); return r;
    },
    delete(id){
      getState().data.rooms = getState().data.rooms.filter(r=>r.id!==id);
      // Обновляем инвентарь - убираем room_id
      for(const item of (getState().data.inventory||[])){
        if(item.room_id===id) item.room_id=null;
      }
      save();
    }
  },

  inventory: {
    list(filter){
      const f=filter||{};
      let items=(getState().data.inventory || []).slice();
      if(f.property_id) items=items.filter(i=>i.property_id===f.property_id);
      if(f.room_id) items=items.filter(i=>i.room_id===f.room_id);
      if(f.category) items=items.filter(i=>i.category===f.category);
      if(f.status) items=items.filter(i=>i.status===f.status);
      return items.sort((a,b)=>a.name.localeCompare(b.name));
    },
    get(id){
      const item = getState().data.inventory.find(i=>i.id===id);
      if(!item) throw new Error('Inventory item not found');
      return item;
    },
    create(payload){
      const now=nowISO();
      let purchase_price = null;
      if (payload.purchase_price) {
        const price = Number(payload.purchase_price);
        purchase_price = (!isNaN(price) && price >= 0) ? price : null;
      }

      const item={
        id:nanoid(),
        property_id: payload.property_id,
        room_id: payload.room_id || null,
        name:(payload.name||'').trim()||'Новый предмет',
        category: payload.category || 'other',
        brand:(payload.brand||'').trim(),
        model:(payload.model||'').trim(),
        serial_number:(payload.serial_number||'').trim(),
        purchase_date: payload.purchase_date || null,
        purchase_price: purchase_price,
        warranty_until: payload.warranty_until || null,
        status: payload.status || 'active',
        notes:(payload.notes||'').trim(),
        created_at: now,
        updated_at: now
      };
      getState().data.inventory.push(item); save(); return item;
    },
    update(id, patch){
      const item=getState().data.inventory.find(x=>x.id===id);
      if(!item) throw new Error('Inventory item not found');
      Object.assign(item, patch||{}, { id });
      item.updated_at=nowISO();
      save(); return item;
    },
    delete(id){
      getState().data.inventory = getState().data.inventory.filter(i=>i.id!==id);
      save();
    }
  },

  meters: {
    list(filter){
      const f=filter||{};
      let items=(getState().data.meters || []).slice();
      if(f.property_id) items=items.filter(m=>m.property_id===f.property_id);
      if(typeof f.is_active==='boolean') items=items.filter(m=>m.is_active===f.is_active);
      return items.sort((a,b)=>a.name.localeCompare(b.name));
    },
    get(id){
      const meter = getState().data.meters.find(m=>m.id===id);
      if(!meter) throw new Error('Meter not found');
      return meter;
    },
    create(payload){
      const now=nowISO();
      const m={
        id:nanoid(),
        property_id: payload.property_id,
        name:(payload.name||'').trim()||'Счётчик',
        type: payload.type || 'cold_water',
        serial_number:(payload.serial_number||'').trim(),
        installation_date: payload.installation_date || null,
        next_verification: payload.next_verification || null,
        submission_day_start: payload.submission_day_start || 15,
        submission_day_end: payload.submission_day_end || 25,
        location:(payload.location||'').trim(),
        last_reading: null,
        last_reading_date: null,
        is_active: payload.is_active !== false,
        created_at: now,
        updated_at: now
      };
      getState().data.meters.push(m); save(); return m;
    },
    update(id, patch){
      const m=getState().data.meters.find(x=>x.id===id);
      if(!m) throw new Error('Meter not found');
      Object.assign(m, patch||{}, { id });
      m.updated_at=nowISO();
      save(); return m;
    },
    delete(id){
      getState().data.meters = getState().data.meters.filter(m=>m.id!==id);
      getState().data.meter_readings = getState().data.meter_readings.filter(r=>r.meter_id!==id);
      save();
    },
    addReading(payload){
      const meter = getState().data.meters.find(m=>m.id===payload.meter_id);
      if(!meter) throw new Error('Meter not found');

      const value = Number(payload.value);
      if (isNaN(value) || value < 0) {
        throw new Error('Invalid meter reading value');
      }

      const reading={
        id:nanoid(),
        meter_id: payload.meter_id,
        reading_date: payload.reading_date || toISODate(startOfDay(new Date())),
        value: value,
        consumption: null,  // будет рассчитано
        notes:(payload.notes||'').trim(),
        created_at: nowISO()
      };

      // Рассчитываем потребление
      if(meter.last_reading !== null && meter.last_reading !== undefined){
        reading.consumption = Math.max(0, reading.value - meter.last_reading);
      } else {
        reading.consumption = 0;
      }

      getState().data.meter_readings.push(reading);

      // Обновляем метр
      meter.last_reading = reading.value;
      meter.last_reading_date = reading.reading_date;
      meter.updated_at = nowISO();

      save();
      return reading;
    },
    getReadings(filter){
      const f=filter||{};
      let items=(getState().data.meter_readings || []).slice();
      if(f.meter_id) items=items.filter(r=>r.meter_id===f.meter_id);
      items.sort((a,b)=>Date.parse(b.reading_date)-Date.parse(a.reading_date));
      if(f.limit) items = items.slice(0, f.limit);
      return items;
    }
  },

  contacts: {
    list(filter){
      const f=filter||{};
      let items=(getState().data.contacts || []).slice();
      if(f.category) items=items.filter(c=>c.category===f.category);
      return items.sort((a,b)=>{
        // Избранные сверху
        if(a.is_favorite && !b.is_favorite) return -1;
        if(!a.is_favorite && b.is_favorite) return 1;
        return a.name.localeCompare(b.name);
      });
    },
    get(id){
      const contact = getState().data.contacts.find(c=>c.id===id);
      if(!contact) throw new Error('Contact not found');
      return contact;
    },
    create(payload){
      const now=nowISO();
      const c={
        id:nanoid(),
        name:(payload.name||'').trim()||'Новый контакт',
        category: payload.category || 'other',
        specialty:(payload.specialty||'').trim(),
        phone:(payload.phone||'').trim(),
        phone_alt:(payload.phone_alt||'').trim(),
        email:(payload.email||'').trim(),
        website:(payload.website||'').trim(),
        address:(payload.address||'').trim(),
        work_hours:(payload.work_hours||'').trim(),
        is_24h: !!payload.is_24h,
        rating: payload.rating || 0,
        last_used: null,
        price_info:(payload.price_info||'').trim(),
        notes:(payload.notes||'').trim(),
        is_favorite: !!payload.is_favorite,
        created_at: now,
        updated_at: now
      };
      getState().data.contacts.push(c); save(); return c;
    },
    update(id, patch){
      const c=getState().data.contacts.find(x=>x.id===id);
      if(!c) throw new Error('Contact not found');
      Object.assign(c, patch||{}, { id });
      c.updated_at=nowISO();
      save(); return c;
    },
    delete(id){
      getState().data.contacts = getState().data.contacts.filter(c=>c.id!==id);
      save();
    }
  },

  checklists: {
    create(payload){
      const name = (payload?.name || '').trim();
      if(!name) throw new Error('Checklist name required');
      const now = nowISO();
      const items = Array.isArray(payload?.items)
        ? payload.items.map(i=>String(i||'').trim()).filter(Boolean)
        : [];
      const cl = {
        id: nanoid(),
        name,
        category: payload?.category || 'other',
        description: (payload?.description || '').trim(),
        items,
        is_preset: false,
        is_active: payload?.is_active !== undefined ? Boolean(payload.is_active) : true,
        created_at: now,
        updated_at: now
      };
      getState().data.checklists.push(cl);
      save();
      return cl;
    },
    list(){
      return (getState().data.checklists || []).slice().sort((a,b)=>{
        // Preset чек-листы сверху
        if(a.is_preset && !b.is_preset) return -1;
        if(!a.is_preset && b.is_preset) return 1;
        return a.name.localeCompare(b.name);
      });
    },
    get(id){
      const checklist = getState().data.checklists.find(c=>c.id===id);
      if(!checklist) throw new Error('Checklist not found');
      return checklist;
    },
    update(id, patch){
      const checklist = getState().data.checklists.find(c=>c.id===id);
      if(!checklist) throw new Error('Checklist not found');
      if('name' in (patch||{})) checklist.name = (patch.name || '').trim() || 'Чек-лист';
      if('category' in (patch||{})) checklist.category = patch.category || 'other';
      if('description' in (patch||{})) checklist.description = (patch.description || '').trim();
      if('is_active' in (patch||{})) checklist.is_active = Boolean(patch.is_active);
      if('items' in (patch||{})) {
        const items = Array.isArray(patch.items)
          ? patch.items.map(i=>String(i||'').trim()).filter(Boolean)
          : [];
        checklist.items = items;
        const progress = getState().data.checklist_progress.find(p=>p.checklist_id===id);
        if(progress){
          progress.completed_items = (progress.completed_items || []).filter(i=>Number.isInteger(i) && i >= 0 && i < items.length);
          progress.last_updated = nowISO();
        }
      }
      checklist.updated_at = nowISO();
      save();
      return checklist;
    },
    delete(id){
      const checklist = getState().data.checklists.find(c=>c.id===id);
      if(!checklist) throw new Error('Checklist not found');
      getState().data.checklists = getState().data.checklists.filter(c=>c.id!==id);
      getState().data.checklist_progress = getState().data.checklist_progress.filter(p=>p.checklist_id!==id);
      save();
    },
    getProgress(id){
      const progress = getState().data.checklist_progress.find(p=>p.checklist_id===id);
      if(!progress){
        // Создаем новый прогресс
        const checklist = this.get(id);
        const newProgress = {
          id:nanoid(),
          checklist_id: id,
          completed_items: [],
          started_at: nowISO(),
          last_updated: nowISO()
        };
        getState().data.checklist_progress.push(newProgress);
        save();
        return newProgress;
      }
      return progress;
    },
    toggleItem(checklistId, itemIndex){
      const progress = this.getProgress(checklistId);
      const idx = progress.completed_items.indexOf(itemIndex);
      if(idx >= 0){
        progress.completed_items.splice(idx, 1);
      } else {
        progress.completed_items.push(itemIndex);
      }
      progress.last_updated = nowISO();
      save();
      return progress;
    },
    resetProgress(id){
      getState().data.checklist_progress = getState().data.checklist_progress.filter(p=>p.checklist_id!==id);
      save();
    }
  },

  stats: {
    get(){
      let stats = getState().data.user_stats;
      if(!stats){
        // Инициализируем если нет
        stats = {
          xp: 0,
          level: 1,
          current_streak: 0,
          longest_streak: 0,
          last_activity_date: null,
          total_tasks_completed: 0,
          total_maintenance_logged: 0,
          total_goals_achieved: 0,
          unlocked_achievements: [],
          gamification_enabled: true,
          animations_enabled: true,
          // Настройки уведомлений
          notifications_enabled: true,
          notifications_quiet_start: 22,
          notifications_quiet_end: 8,
          notifications_tasks: true,
          notifications_meters: true,
          notifications_warranty: true,
          notifications_maintenance: true,
          // Онбординг
          onboarding_completed: false,
          onboarding_profile: null,
          // Видимость модулей в меню
          visible_modules: {
            dashboard: true,
            tasks: true,
            routines: true,
            properties: true,
            inventory: true,
            meters: true,
            utility: true,
            contacts: true,
            checklists: true,
            maintenance: true,
            goals: true,
            documents: true,
            analytics: true,
            profiles: true,
            tags: true,
            stats: true,
            settings: true
          },
          // Тема оформления
          theme: 'dark', // 'light' | 'dark' | 'auto'
          // Язык интерфейса
          language: 'ru', // 'ru' | 'en'
          // Интеграция с Telegram
          telegram_enabled: false,
          telegram_bot_token: '',
          telegram_chat_id: '',
          created_at: nowISO(),
          updated_at: nowISO()
        };
        getState().data.user_stats = stats;
        save();
      }
      let needsSave = false;
      if (stats.max_streak != null && stats.longest_streak == null) {
        stats.longest_streak = stats.max_streak;
        needsSave = true;
      }
      if (stats.last_active_date && !stats.last_activity_date) {
        stats.last_activity_date = stats.last_active_date;
        needsSave = true;
      }
      if (stats.max_streak != null || stats.last_active_date) {
        delete stats.max_streak;
        delete stats.last_active_date;
        needsSave = true;
      }
      // Ensure language field exists
      if (!stats.language) {
        stats.language = 'ru';
        needsSave = true;
      }
      if (needsSave) save();
      return stats;
    },
    update(patch){
      const stats = this.get();
      Object.assign(stats, patch||{});
      stats.updated_at = nowISO();
      save();
      return stats;
    },
    updateNotificationSettings(settings) {
      const stats = this.get();
      Object.assign(stats, settings);
      stats.updated_at = nowISO();
      save();
      return stats;
    },
    getNotificationSettings() {
      const stats = this.get();
      return {
        enabled: stats.notifications_enabled ?? true,
        quiet_start: stats.notifications_quiet_start ?? 22,
        quiet_end: stats.notifications_quiet_end ?? 8,
        tasks: stats.notifications_tasks ?? true,
        meters: stats.notifications_meters ?? true,
        warranty: stats.notifications_warranty ?? true,
        maintenance: stats.notifications_maintenance ?? true
      };
    },
    isOnboardingCompleted() {
      const stats = this.get();
      return stats.onboarding_completed ?? false;
    },
    completeOnboarding(profile) {
      const stats = this.get();
      stats.onboarding_completed = true;
      stats.onboarding_profile = profile;
      stats.updated_at = nowISO();
      save();
      return stats;
    },
    getVisibleModules() {
      const stats = this.get();
      return stats.visible_modules || {};
    },
    setModuleVisibility(moduleKey, visible) {
      const stats = this.get();
      if (!stats.visible_modules) {
        stats.visible_modules = {};
      }
      stats.visible_modules[moduleKey] = visible;
      stats.updated_at = nowISO();
      save();
      return stats.visible_modules;
    },
    getLanguage() {
      const stats = this.get();
      return stats.language || 'ru';
    },
    setLanguage(language) {
      const stats = this.get();
      stats.language = language || 'ru';
      stats.updated_at = nowISO();
      save();
      return stats.language;
    }
  },

  // ===== TARIFFS =====
  tariffs: {
    list() {
      return [...getState().data.tariffs];
    },

    get(type) {
      return getState().data.tariffs.find(t => t.type === type);
    },

    update(type, price) {
      const tariff = getState().data.tariffs.find(t => t.type === type);
      if (tariff) {
        tariff.price = price;
        tariff.updated_at = nowISO();
        save();
      }
      return tariff;
    }
  },

  // ===== CUSTOM METER TYPES =====
  customMeterTypes: {
    list() {
      return (getState().data.custom_meter_types || []).slice()
        .filter(t => t.is_active !== false)
        .sort((a,b) => a.name.localeCompare(b.name));
    },

    listAll() {
      return (getState().data.custom_meter_types || []).slice()
        .sort((a,b) => a.name.localeCompare(b.name));
    },

    get(id) {
      const type = getState().data.custom_meter_types.find(t => t.id === id);
      if (!type) throw new Error('Custom meter type not found');
      return type;
    },

    create({ name, unit }) {
      const trimmedName = (name || '').trim();
      if (!trimmedName) throw new Error('Name is required');

      const trimmedUnit = (unit || '').trim();
      if (!trimmedUnit) throw new Error('Unit is required');

      const now = nowISO();
      const customType = {
        id: nanoid(),
        name: trimmedName,
        unit: trimmedUnit,
        created_at: now,
        is_active: true
      };

      getState().data.custom_meter_types.push(customType);
      save();
      return customType;
    },

    update(id, { name, unit }) {
      const type = getState().data.custom_meter_types.find(t => t.id === id);
      if (!type) throw new Error('Custom meter type not found');

      if (name !== undefined) {
        const trimmedName = (name || '').trim();
        if (!trimmedName) throw new Error('Name is required');
        type.name = trimmedName;
      }

      if (unit !== undefined) {
        const trimmedUnit = (unit || '').trim();
        if (!trimmedUnit) throw new Error('Unit is required');
        type.unit = trimmedUnit;
      }

      save();
      return type;
    },

    archive(id) {
      const type = getState().data.custom_meter_types.find(t => t.id === id);
      if (!type) throw new Error('Custom meter type not found');

      type.is_active = false;
      save();
      return type;
    },

    delete(id) {
      // Check if any meters are using this type
      const metersUsingType = getState().data.meters.filter(m => m.type === id);
      if (metersUsingType.length > 0) {
        throw new Error(`Cannot delete: ${metersUsingType.length} meter(s) are using this type`);
      }

      getState().data.custom_meter_types = getState().data.custom_meter_types.filter(t => t.id !== id);
      save();
    }
  }
};

module.exports = { db, save, reloadState, SCHEMA_VERSION };
