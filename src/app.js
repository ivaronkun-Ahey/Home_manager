/* global api, t, setLanguage, getCurrentLanguage */
const $ = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>[...r.querySelectorAll(s)];

const state = { route:'dashboard', profileId:'all', profiles:[], tags:[], userStats: null, calendar: { month: todayISO().slice(0,7), selected: todayISO() } };
const STORAGE_KEYS = { currentPropertyId: 'hm:currentPropertyId' };

// Меню навигации с ключами перевода
const MENU_MODULES = [
  { key: 'dashboard', icon: '🏠', labelKey: 'nav.dashboard', route: 'dashboard', sectionKey: 'nav.section.main' },
  { key: 'tasks', icon: '📋', labelKey: 'nav.tasks', route: 'tasks', sectionKey: 'nav.section.main' },
  { key: 'calendar', icon: '📅', labelKey: 'nav.calendar', route: 'calendar', sectionKey: 'nav.section.main' },
  { key: 'property', icon: '🏠', labelKey: 'nav.property', route: 'property', sectionKey: 'nav.section.home' },
  { key: 'rooms', icon: '🛋️', labelKey: 'nav.rooms', route: 'rooms', sectionKey: 'nav.section.home' },
  { key: 'inventory', icon: '📦', labelKey: 'nav.inventory', route: 'inventory', sectionKey: 'nav.section.home' },
  { key: 'assets', icon: '📦', labelKey: 'nav.assets', route: 'assets', sectionKey: 'nav.section.maintenance' },
  { key: 'maintenance', icon: '🔧', labelKey: 'nav.maintenance', route: 'maintenance', sectionKey: 'nav.section.maintenance' },
  { key: 'routines', icon: '🔄', labelKey: 'nav.routines', route: 'routines', sectionKey: 'nav.section.maintenance' },
  { key: 'checklists', icon: '✅', labelKey: 'nav.checklists', route: 'checklists', sectionKey: 'nav.section.maintenance' },
  { key: 'meters', icon: '💧', labelKey: 'nav.meters', route: 'meters', sectionKey: 'nav.section.finance' },
  { key: 'utility', icon: '💰', labelKey: 'nav.utility', route: 'utility', sectionKey: 'nav.section.finance' },
  { key: 'goals', icon: '🎯', labelKey: 'nav.goals', route: 'goals', sectionKey: 'nav.section.finance' },
  { key: 'contacts', icon: '📞', labelKey: 'nav.contacts', route: 'contacts', sectionKey: 'nav.section.reference' },
  { key: 'documents', icon: '📄', labelKey: 'nav.documents', route: 'documents', sectionKey: 'nav.section.reference' },
  { key: 'analytics', icon: '📈', labelKey: 'nav.analytics', route: 'analytics', sectionKey: 'nav.section.system' },
  { key: 'stats', icon: '🏆', labelKey: 'nav.stats', route: 'stats', sectionKey: 'nav.section.system' },
  { key: 'settings', icon: '⚙️', labelKey: 'nav.settings', route: 'settings', sectionKey: 'nav.section.system' },
  { key: 'backup', icon: '💾', labelKey: 'nav.backup', route: 'backup', sectionKey: 'nav.section.system' }
];

let visibleModules = {};

async function loadVisibleModules() {
  const r = await api.settings.getVisibleModules();
  if (r.ok) {
    visibleModules = r.data;
  }
}

function renderNav() {
  const nav = $('#nav');
  if (!nav) return;

  const sections = {};
  MENU_MODULES.forEach(m => {
    if (visibleModules[m.key] !== false) {
      const sectionName = t(m.sectionKey);
      if (!sections[sectionName]) sections[sectionName] = [];
      sections[sectionName].push(m);
    }
  });

  let html = '';
  Object.keys(sections).forEach(sectionName => {
    html += `<div class="navSection">${sectionName}</div>`;
    sections[sectionName].forEach(m => {
      const label = t(m.labelKey);
      html += `<button class="navItem ${state.route === m.route ? 'active' : ''}" data-route="${m.route}">${m.icon} ${label}</button>`;
    });
  });

  nav.innerHTML = html;
}

function renderAppChrome() {
  const brandSub = document.querySelector('.brandSub');
  if (brandSub) brandSub.textContent = t('app.local_desktop');

  const openDataBtn = $('#openDataFolder');
  if (openDataBtn) openDataBtn.textContent = t('app.open_data_folder');

  const profileLabel = document.querySelector('.profileRow label');
  if (profileLabel) profileLabel.textContent = t('app.profile_label');

  const searchInput = $('#globalSearch');
  if (searchInput) searchInput.placeholder = t('app.search_placeholder');

  const actionsRow = $('.actionsRow');
  if (!actionsRow) return;

  let toggle = $('#langToggle');
  if (!toggle) {
    toggle = document.createElement('div');
    toggle.id = 'langToggle';
    toggle.className = 'langToggle';
    actionsRow.insertBefore(toggle, actionsRow.firstChild);
  }

  const currentLanguage = getCurrentLanguage ? getCurrentLanguage() : (state.userStats?.language || 'ru');
  toggle.classList.toggle('langToggle--en', currentLanguage === 'en');
  toggle.classList.toggle('langToggle--ru', currentLanguage !== 'en');

  toggle.innerHTML = `
    <span class="langToggleLabel">🇷🇺 RU</span>
    <label class="langSwitch">
      <input type="checkbox" ${currentLanguage === 'en' ? 'checked' : ''}>
      <span class="langSlider"></span>
    </label>
    <span class="langToggleLabel">🇬🇧 EN</span>
  `;

  const input = toggle.querySelector('input');
  input.onchange = () => {
    changeLanguage(input.checked ? 'en' : 'ru');
  };
}

function openMenuSettings() {
  const content = MENU_MODULES.map(m => {
    const label = t(m.labelKey);
    return `
    <div class="formRow">
      <label style="display:flex; align-items:center; gap:8px;">
        <input type="checkbox"
               ${visibleModules[m.key] !== false ? 'checked' : ''}
               data-module-key="${m.key}"
               ${m.key === 'dashboard' || m.key === 'settings' ? 'disabled' : ''}>
        <span>${m.icon} ${label}</span>
      </label>
    </div>
  `;
  }).join('');

  openModal(t('settings.menu'), `
    <div class="form">
      <p class="muted">${t('settings.menu_desc')}</p>
      ${content}
    </div>
  `, (root) => {
    $$('[data-module-key]', root).forEach(input => {
      input.onchange = () => toggleModule(input.dataset.moduleKey, input.checked);
    });
  });
}

async function toggleModule(key, visible) {
  await api.settings.setModuleVisibility(key, visible);
  visibleModules[key] = visible;
  renderNav();
}

// ===== THEME MANAGEMENT =====
function applyTheme(theme) {
  if (theme === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

async function setTheme(theme) {
  await api.stats.update({ theme });
  if (state.userStats) state.userStats.theme = theme;
  applyTheme(theme);
}

async function toggleTelegram(enabled) {
  if (state.userStats) {
    state.userStats.telegram_enabled = enabled;
  }
  const configDiv = $('#telegram-config');
  if (configDiv) {
    configDiv.style.display = enabled ? 'block' : 'none';
  }
}

async function toggleGamification(enabled) {
  await api.stats.update({ gamification_enabled: enabled });
  if (state.userStats) {
    state.userStats.gamification_enabled = enabled;
  }
  toast(enabled ? t('settings.gamification_enabled') : t('settings.gamification_disabled'));
  render();
}

async function toggleAnimations(enabled) {
  await api.stats.update({ animations_enabled: enabled });
  if (state.userStats) {
    state.userStats.animations_enabled = enabled;
  }
}

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (state.userStats && state.userStats.theme === 'auto') {
    applyTheme('auto');
  }
});

// ===== LANGUAGE MANAGEMENT =====
async function initLanguage() {
  try {
    const r = await api.settings.getLanguage();
    if (r.ok && r.data) {
      setLanguage(r.data);
    }
  } catch (e) {
    console.error('[i18n] Failed to load language from backend:', e);
  }
}

async function changeLanguage(lang) {
  try {
    // Update backend
    await api.settings.setLanguage(lang);
    // Update frontend
    setLanguage(lang);
    // Update state
    if (state.userStats) state.userStats.language = lang;
    // Refresh UI elements that depend on translations
    renderNav();
    // Reload the entire UI
    render();
    toast(lang === 'en' ? t('settings.language_changed_en') : t('settings.language_changed_ru'));
  } catch (e) {
    console.error('[i18n] Failed to change language:', e);
    toast(t('settings.language_change_failed'), 'error');
  }
}

function renderLanguageSwitcherCard({ compact = false } = {}) {
  const currentLanguage = getCurrentLanguage ? getCurrentLanguage() : (state.userStats?.language || 'ru');

  if (compact) {
    return `
      <div class="card">
        <div class="cardHeader">
          <div class="cardTitle">🌐 ${t('settings.language')}</div>
        </div>
        <div class="cardBody">
          <div class="row" style="gap:8px; align-items:center; flex-wrap:wrap;">
            <label class="badge" style="display:flex; gap:6px; align-items:center; cursor:pointer;">
              <input type="radio" name="language" value="ru"
                     ${currentLanguage === 'ru' ? 'checked' : ''}
                     data-lang-switch="ru" style="margin:0;">
              <span>🇷🇺 ${t('lang.ru')}</span>
            </label>
            <label class="badge" style="display:flex; gap:6px; align-items:center; cursor:pointer;">
              <input type="radio" name="language" value="en"
                     ${currentLanguage === 'en' ? 'checked' : ''}
                     data-lang-switch="en" style="margin:0;">
              <span>🇬🇧 ${t('lang.en')}</span>
            </label>
          </div>
        </div>
      </div>
    `;
  }

  return `
      <div class="card">
        <div class="cardHeader">
          <div class="cardTitle">🌐 ${t('settings.language')} / Language</div>
        </div>
        <div class="cardBody">
          <p class="muted">${t('settings.language_desc')}</p>
          <div class="formRow" style="margin-top:12px; flex-direction:column; gap:8px;">
            <label style="display:flex; align-items:center; gap:8px;">
              <input type="radio" name="language" value="ru"
                     ${currentLanguage === 'ru' ? 'checked' : ''}
                     data-lang-switch="ru">
              <span>🇷🇺 ${t('lang.ru')}</span>
            </label>
            <label style="display:flex; align-items:center; gap:8px;">
              <input type="radio" name="language" value="en"
                     ${currentLanguage === 'en' ? 'checked' : ''}
                     data-lang-switch="en">
              <span>🇬🇧 ${t('lang.en')}</span>
            </label>
          </div>
        </div>
      </div>
  `;
}

function bindLanguageSwitcher(root = document) {
  $$('input[data-lang-switch]', root).forEach((input) => {
    input.onchange = () => {
      if (input.checked) changeLanguage(input.dataset.langSwitch);
    };
  });
}

function getCurrentPropertyId(){
  return localStorage.getItem(STORAGE_KEYS.currentPropertyId);
}
function setCurrentPropertyId(id){
  if(id) localStorage.setItem(STORAGE_KEYS.currentPropertyId, id);
}
function clearCurrentPropertyId(){
  localStorage.removeItem(STORAGE_KEYS.currentPropertyId);
}
function resolveCurrentProperty(properties){
  if(!properties.length) return null;
  const storedId = getCurrentPropertyId();
  const primary = properties.find(p=>p.is_primary);
  const current = properties.find(p=>p.id===storedId) || primary || properties[0];
  if(current) setCurrentPropertyId(current.id);
  return current;
}
function propertySelectHtml(properties, selectedId){
  return `
    <select class="input" id="propertyPicker">
      ${properties.map(p=>`
        <option value="${p.id}" ${p.id===selectedId?'selected':''}>${escapeHtml(p.name)}${p.is_primary ? ' ★' : ''}</option>
      `).join('')}
    </select>
  `;
}

function toast(msg, type = 'info'){
  const el=$('#toast');
  el.textContent=msg;
  el.hidden=false;

  // Сброс классов
  el.className = 'toast';

  // Добавление типа
  if (type === 'success') el.style.borderLeftColor = 'var(--ok)';
  else if (type === 'error') el.style.borderLeftColor = 'var(--danger)';
  else if (type === 'warning') el.style.borderLeftColor = 'var(--warn)';
  else el.style.borderLeftColor = 'var(--accent)';

  clearTimeout(toast._t);
  const duration = type === 'error' ? 4000 : 2200; // Ошибки показываем дольше
  toast._t=setTimeout(()=>el.hidden=true, duration);
}
function todayISO(){
  const d=new Date(); const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function toISODate(d){
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function parseISODate(iso){
  if(!iso) return null;
  return new Date(`${iso}T00:00:00`);
}
function startOfDayLocal(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function startOfWeek(d){
  const day = d.getDay() || 7; // Monday=1..Sunday=7
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  start.setDate(start.getDate() - (day - 1));
  return start;
}
function startOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
function startOfYear(d){ return new Date(d.getFullYear(), 0, 1); }
function inRange(iso, from, to){
  if(!iso) return false;
  const d = parseISODate(iso);
  if(!d) return false;
  if(from && d < from) return false;
  if(to && d > to) return false;
  return true;
}
function clampNumber(n){ return Number.isFinite(n) ? n : 0; }
function makeBuckets(from, to, unit){
  const buckets = [];
  if(!from || !to) return buckets;
  const cursor = new Date(from.getTime());
  while(cursor <= to){
    const label = unit === 'day'
      ? toISODate(cursor)
      : `${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}`;
    const next = unit === 'day'
      ? new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()+1)
      : new Date(cursor.getFullYear(), cursor.getMonth()+1, 1);
    buckets.push({ label, from: new Date(cursor.getTime()), to: new Date(next.getTime()-1), spent:0, collected:0, done:0 });
    cursor.setTime(next.getTime());
  }
  return buckets;
}

function buildMonthGrid(year, monthIndex){
  const first = new Date(year, monthIndex, 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday start
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  const grid = [];
  for(let i = 0; i < cells; i++){
    const dayNumber = i - startOffset + 1;
    const date = new Date(year, monthIndex, dayNumber);
    grid.push({
      date,
      inMonth: dayNumber >= 1 && dayNumber <= daysInMonth
    });
  }
  return grid;
}

function monthLabel(year, monthIndex){
  return new Date(year, monthIndex, 1).toLocaleString('ru-RU', { month:'long', year:'numeric' });
}
function buildWeekGrid(anchorDate){
  const start = startOfWeek(anchorDate);
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { date, inMonth: true };
  });
}
function daysDiff(fromISO,toISO){
  const a=new Date(fromISO+'T00:00:00'); const b=new Date(toISO+'T00:00:00');
  return Math.floor((b-a)/(24*3600*1000));
}
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function profileName(id){ return state.profiles.find(p=>p.id===id)?.name || '—'; }
function formatMoneyRUB(value){
  return `${Math.round(value || 0).toLocaleString('ru-RU')} ₽`;
}

// ===== VALIDATION UTILITIES =====
const validators = {
  isRequired: (value) => value && value.trim().length > 0,
  maxLength: (value, max) => !value || value.length <= max,
  isPositiveNumber: (value) => {
    if (!value && value !== 0) return true; // Allow empty
    const num = parseFloat(value);
    return !isNaN(num) && num > 0;
  },
  isValidEmail: (email) => {
    if (!email || email.trim() === '') return true; // Allow empty
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  },
  isValidPhone: (phone) => {
    if (!phone || phone.trim() === '') return true; // Allow empty
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 20;
  },
  isValidDate: (dateStr) => {
    if (!dateStr || dateStr.trim() === '') return true; // Allow empty
    return !isNaN(Date.parse(dateStr));
  },
  isFutureDate: (dateStr) => {
    if (!dateStr || dateStr.trim() === '') return true; // Allow empty
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date >= today;
  },
  isGreaterThan: (value1, value2) => {
    const num1 = parseFloat(value1);
    const num2 = parseFloat(value2);
    if (isNaN(num1) || isNaN(num2)) return true; // Skip if not numbers
    return num1 > num2;
  }
};

// Helper to add visual feedback for invalid fields
function markFieldInvalid(fieldElement, message) {
  if (!fieldElement) return;
  fieldElement.style.border = '2px solid var(--danger)';
  fieldElement.style.backgroundColor = 'rgba(239, 68, 68, 0.05)';
  setTimeout(() => {
    fieldElement.style.border = '';
    fieldElement.style.backgroundColor = '';
  }, 3000);
  if (message) toast(message, 'error');
}

function setRoute(route){
  state.route=route;
  renderNav(); // Re-render nav to update active states
  render();
}

function isSameMonth(isoDate, refDate){
  if(!isoDate) return false;
  const prefix = isoDate.slice(0, 7);
  const refPrefix = refDate.toISOString().slice(0, 7);
  return prefix === refPrefix;
}
function openModal(title, innerHtml, onBind){
  const overlay=$('#modalOverlay'); const modal=$('#modal');
  modal.innerHTML=`
    <div class="modalHeader">
      <div class="modalTitle">${title}</div>
      <button class="iconBtn" id="modalClose">✕</button>
    </div>
    <div class="modalBody">${innerHtml}</div>
  `;
  overlay.hidden=false;
  $('#modalClose').onclick=closeModal;
  overlay.onclick=(e)=>{ if(e.target===overlay) closeModal(); };

  // Закрытие по Escape
  if(overlay._escHandler){
    document.removeEventListener('keydown', overlay._escHandler);
  }
  const escHandler = (e) => { if(e.key === 'Escape') closeModal(); };
  overlay._escHandler = escHandler;
  document.addEventListener('keydown', escHandler);

  onBind && onBind(modal);

  // Автофокус на первом поле ввода
  setTimeout(() => {
    const firstInput = modal.querySelector('input:not([type="hidden"]), textarea, select');
    if (firstInput) firstInput.focus();
  }, 50);
}

function closeModal(){
  const overlay = $('#modalOverlay');
  if (overlay._escHandler) {
    document.removeEventListener('keydown', overlay._escHandler);
    delete overlay._escHandler;
  }
  overlay.hidden=true;
  $('#modal').innerHTML='';
}

function profileOptions(selected){
  const all=[{id:'all',name:t('common.all')}, ...state.profiles.filter(p=>!p.is_archived)];
  return all.map(p=>`<option value="${p.id}" ${p.id===selected?'selected':''}>${escapeHtml(p.name)}</option>`).join('');
}
async function loadMeta(){
  const r=await api.meta.getAppInfo();
  if(r.ok) $('#appInfo').textContent=`v${r.data.version} • ${r.data.platform}`;
}
async function loadProfiles(){
  const r=await api.profiles.list();
  if(!r.ok) return toast(r.error, 'error');
  state.profiles=r.data;
  $('#profileSelect').innerHTML=profileOptions(state.profileId);
}
async function loadTags(){
  const r=await api.tags.list();
  if(r.ok) state.tags=r.data;
}

function tagPickerHtml(selectedIds=[]){
  const selected=new Set(selectedIds||[]);
  const options=state.tags.map(t=>`
    <label class="badge" style="border-color:${t.color};">
      <input type="checkbox" value="${t.id}" ${selected.has(t.id)?'checked':''} />
      ${escapeHtml(t.name)}
    </label>
  `).join(' ');
  return `
    <div class="card">
      <div class="muted">${t('tags.title')}</div>
      <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:8px;">${options || `<span class="muted">${t('tags.empty')}</span>`}</div>
      <div class="row" style="margin-top:10px; gap:8px;">
        <input class="input" id="newTagName" placeholder="${t('tags.new_placeholder')}" />
        <button class="btn" id="addTagBtn">${t('btn.add')}</button>
      </div>
    </div>
  `;
}
function readTagPicker(root){
  return $$('input[type="checkbox"]', root).filter(x=>x.checked).map(x=>x.value);
}

function isOverdue(t){ return t.due_at && t.status!=='done' && t.due_at < todayISO(); }

function normalizeChecklistProgress(progress, checklist){
  const completed = Array.isArray(progress?.completed_items)
    ? progress.completed_items
    : Array.isArray(progress?.completed)
      ? progress.completed
      : [];
  const total = Array.isArray(checklist?.items) ? checklist.items.length : (progress?.total || 0);
  return { completed, total };
}

// ============================================
// GAMIFICATION SYSTEM
// ============================================

const ACHIEVEMENTS = [
  // Задачи
  { id: 'first_task', nameKey: 'achievement.first_task.name', descKey: 'achievement.first_task.desc', icon: '🎯', xp: 10 },
  { id: 'tasks_10', nameKey: 'achievement.tasks_10.name', descKey: 'achievement.tasks_10.desc', icon: '📋', xp: 50 },
  { id: 'tasks_50', nameKey: 'achievement.tasks_50.name', descKey: 'achievement.tasks_50.desc', icon: '📚', xp: 200 },
  { id: 'tasks_100', nameKey: 'achievement.tasks_100.name', descKey: 'achievement.tasks_100.desc', icon: '🏅', xp: 500 },

  // Streak
  { id: 'streak_3', nameKey: 'achievement.streak_3.name', descKey: 'achievement.streak_3.desc', icon: '🔥', xp: 30 },
  { id: 'streak_7', nameKey: 'achievement.streak_7.name', descKey: 'achievement.streak_7.desc', icon: '💪', xp: 100 },
  { id: 'streak_30', nameKey: 'achievement.streak_30.name', descKey: 'achievement.streak_30.desc', icon: '🏆', xp: 500 },

  // Уровни
  { id: 'level_5', nameKey: 'achievement.level_5.name', descKey: 'achievement.level_5.desc', icon: '⭐', xp: 100 },
  { id: 'level_10', nameKey: 'achievement.level_10.name', descKey: 'achievement.level_10.desc', icon: '🌟', xp: 300 },
  { id: 'level_25', nameKey: 'achievement.level_25.name', descKey: 'achievement.level_25.desc', icon: '💫', xp: 1000 },

  // Счётчики
  { id: 'meter_first', nameKey: 'achievement.meter_first.name', descKey: 'achievement.meter_first.desc', icon: '💧', xp: 20 },
  { id: 'meter_streak_3', nameKey: 'achievement.meter_streak_3.name', descKey: 'achievement.meter_streak_3.desc', icon: '📊', xp: 100 },

  // Инвентарь
  { id: 'inventory_10', nameKey: 'achievement.inventory_10.name', descKey: 'achievement.inventory_10.desc', icon: '📦', xp: 50 },
  { id: 'inventory_50', nameKey: 'achievement.inventory_50.name', descKey: 'achievement.inventory_50.desc', icon: '🗃️', xp: 200 },

  // Чек-листы
  { id: 'checklist_first', nameKey: 'achievement.checklist_first.name', descKey: 'achievement.checklist_first.desc', icon: '✅', xp: 30 },

  // Обслуживание
  { id: 'maintenance_first', nameKey: 'achievement.maintenance_first.name', descKey: 'achievement.maintenance_first.desc', icon: '🔧', xp: 20 },
  { id: 'maintenance_10', nameKey: 'achievement.maintenance_10.name', descKey: 'achievement.maintenance_10.desc', icon: '⚙️', xp: 100 },

  // Цели
  { id: 'goal_first', nameKey: 'achievement.goal_first.name', descKey: 'achievement.goal_first.desc', icon: '🎯', xp: 50 },
  { id: 'goal_5', nameKey: 'achievement.goal_5.name', descKey: 'achievement.goal_5.desc', icon: '🏁', xp: 200 },

  // Недвижимость
  { id: 'first_property', nameKey: 'achievement.first_property.name', descKey: 'achievement.first_property.desc', icon: '🏠', xp: 20 },

  // Контакты
  { id: 'contact_keeper', nameKey: 'achievement.contact_keeper.name', descKey: 'achievement.contact_keeper.desc', icon: '📞', xp: 20 },

  // Специальные
  { id: 'organized', nameKey: 'achievement.organized.name', descKey: 'achievement.organized.desc', icon: '🗂️', xp: 100 },
  { id: 'early_bird', nameKey: 'achievement.early_bird.name', descKey: 'achievement.early_bird.desc', icon: '🌅', xp: 30 },
  { id: 'night_owl', nameKey: 'achievement.night_owl.name', descKey: 'achievement.night_owl.desc', icon: '🦉', xp: 30 }
];

function getLevelForXP(xp) {
  // Level formula: level = floor(sqrt(xp / 100)) + 1
  // Защита от некорректных значений
  const safeXP = Math.max(0, xp || 0);
  return Math.floor(Math.sqrt(safeXP / 100)) + 1;
}

function getXPForLevel(level) {
  // XP needed for level: (level - 1)^2 * 100
  return Math.pow(level - 1, 2) * 100;
}

function getXPProgressForCurrentLevel(xp) {
  const safeXP = Math.max(0, xp || 0);
  const currentLevel = getLevelForXP(safeXP);
  const currentLevelXP = getXPForLevel(currentLevel);
  const nextLevelXP = getXPForLevel(currentLevel + 1);
  const progressXP = safeXP - currentLevelXP;
  const requiredXP = nextLevelXP - currentLevelXP;
  const percentage = requiredXP > 0 ? Math.round((progressXP / requiredXP) * 100) : 0;
  return { progressXP, requiredXP, percentage: Math.max(0, Math.min(100, percentage)) };
}

async function loadUserStats() {
  const res = await api.stats.get();
  if (res.ok) {
    state.userStats = res.data;
    updateStatsDisplay();
  }
}

function updateStatsDisplay() {
  const statsEl = $('#statsDisplay');
  if (!statsEl) return;

  const stats = state.userStats;
  if (!stats || !stats.gamification_enabled) {
    statsEl.style.display = 'none';
    return;
  }

  const level = getLevelForXP(stats.xp);
  const { percentage } = getXPProgressForCurrentLevel(stats.xp);

  statsEl.style.display = 'flex';
  statsEl.style.alignItems = 'center';
  statsEl.style.gap = '12px';
  statsEl.style.cursor = 'pointer';
  statsEl.title = t('stats.open_achievements');

  statsEl.innerHTML = `
    <div style="display:flex; align-items:center; gap:8px; padding:6px 12px; border-radius:12px; background:rgba(96,165,250,0.1); border:1px solid rgba(96,165,250,0.3);">
      <span style="font-size:16px;">⭐</span>
      <div style="display:flex; flex-direction:column; gap:2px;">
        <div style="font-size:12px; font-weight:700; line-height:1;">${t('stats.level_short', { level })}</div>
        <div style="font-size:10px; color:var(--muted); line-height:1;">${stats.xp} XP</div>
      </div>
      <div style="width:40px; height:4px; background:var(--border); border-radius:999px; overflow:hidden;">
        <div style="width:${percentage}%; height:100%; background:linear-gradient(90deg, var(--accent), var(--ok)); transition:width 0.3s;"></div>
      </div>
    </div>
    ${stats.current_streak && stats.current_streak > 0 ? `
      <div style="font-size:16px;" title="${t('stats.streak_title', { count: stats.current_streak })}">🔥 ${stats.current_streak}</div>
    ` : ''}
  `;

  statsEl.onclick = () => setRoute('stats');
}

async function awardXP(amount, reason = '') {
  if (!state.userStats || !state.userStats.gamification_enabled) return;

  const currentXP = Math.max(0, state.userStats.xp || 0);
  const oldLevel = getLevelForXP(currentXP);
  const newXP = Math.max(0, currentXP + amount);
  const newLevel = getLevelForXP(newXP);

  const res = await api.stats.update({ xp: newXP });
  if (!res.ok) return;

  state.userStats.xp = newXP;
  updateStatsDisplay();

  // Check for level up
  if (newLevel > oldLevel) {
    toast(t('stats.level_up', { level: newLevel, amount }));
    checkAchievementsDebounced();
  } else {
    toast(t('stats.xp_gain', { amount, reason: reason ? ': ' + reason : '' }));
  }
}

// Debounce helper to avoid calling checkAchievements too frequently
let checkAchievementsTimeout = null;
function checkAchievementsDebounced() {
  if (checkAchievementsTimeout) clearTimeout(checkAchievementsTimeout);
  checkAchievementsTimeout = setTimeout(() => checkAchievements(), 1000);
}

async function checkAchievements() {
  if (!state.userStats || !state.userStats.gamification_enabled) return;

  const unlockedSet = new Set(state.userStats.unlocked_achievements || []);
  const newlyUnlocked = [];

  // Get counts for various achievements (all parallel for performance)
  const [tasksRes, propertiesRes, inventoryRes, readingsRes, contactsRes, checklistsRes, goalsRes, maintenanceLogsRes] = await Promise.all([
    api.tasks.list({ status: 'all', range: 'all' }),
    api.properties.list(),
    api.inventory.list({}),
    api.meters.getReadings({}),
    api.contacts.list({}),
    api.checklists.list(),
    api.goals.list({}),
    api.maintenance.logs.list({})
  ]);

  const tasksData = tasksRes.ok ? tasksRes.data : [];
  const tasksCompleted = tasksData.filter(t => t.status === 'done').length;
  const propertiesCount = propertiesRes.ok ? propertiesRes.data.length : 0;
  const inventoryCount = inventoryRes.ok ? inventoryRes.data.length : 0;
  const readingsCount = readingsRes.ok ? readingsRes.data.length : 0;
  const contactsCount = contactsRes.ok ? contactsRes.data.length : 0;
  const goalsData = goalsRes.ok ? goalsRes.data : [];
  const goalsAchieved = goalsData.filter(g => g.status === 'archived' && g.saved_amount >= g.target_amount).length;
  const maintenanceCount = maintenanceLogsRes.ok ? maintenanceLogsRes.data.length : 0;

  // Calculate checklists completed (parallel for performance)
  let checklistsCompleted = 0;
  if (checklistsRes.ok && checklistsRes.data.length > 0) {
    const progressResults = await Promise.all(
      checklistsRes.data.map(async (cl) => {
        const res = await api.checklists.getProgress({ id: cl.id });
        if (!res.ok) return null;
        const normalized = normalizeChecklistProgress(res.data, cl);
        return { completed: normalized.completed.length, total: normalized.total };
      })
    );
    checklistsCompleted = progressResults.filter(
      r => r && r.total > 0 && r.completed === r.total
    ).length;
  }

  // Calculate meter streak (consecutive months with readings)
  let meterStreak = 0;
  if (readingsRes.ok && readingsRes.data.length > 0) {
    const readings = readingsRes.data.sort((a, b) => b.reading_date.localeCompare(a.reading_date));
    const months = [...new Set(readings.map(r => r.reading_date.slice(0, 7)))].sort().reverse();
    for (let i = 0; i < months.length; i++) {
      if (i === 0 || months[i - 1].slice(0, 4) === months[i].slice(0, 4) &&
          parseInt(months[i - 1].slice(5)) - parseInt(months[i].slice(5)) === 1) {
        meterStreak++;
      } else {
        break;
      }
    }
  }

  // Check for early bird and night owl (if tasks have completion time)
  let hasEarlyBird = false;
  let hasNightOwl = false;
  for (const task of tasksData.filter(t => t.status === 'done' && t.done_at)) {
    if (task.done_at_time) {
      const hour = parseInt(task.done_at_time.split(':')[0]);
      if (hour < 8) hasEarlyBird = true;
      if (hour >= 0 && hour < 6) hasNightOwl = true;
    }
  }

  // Check if all modules have been used (organized achievement)
  const usedModules = new Set();
  if (tasksCompleted > 0) usedModules.add('tasks');
  if (propertiesCount > 0) usedModules.add('properties');
  if (inventoryCount > 0) usedModules.add('inventory');
  if (readingsCount > 0) usedModules.add('meters');
  if (contactsCount > 0) usedModules.add('contacts');
  if (checklistsCompleted > 0) usedModules.add('checklists');
  if (goalsData.length > 0) usedModules.add('goals');
  if (maintenanceCount > 0) usedModules.add('maintenance');
  const isOrganized = usedModules.size >= 6;

  const currentLevel = getLevelForXP(state.userStats.xp);
  const currentStreak = state.userStats.current_streak || 0;

  // Check each achievement
  for (const achievement of ACHIEVEMENTS) {
    if (unlockedSet.has(achievement.id)) continue;

    let unlocked = false;

    switch (achievement.id) {
      // Tasks
      case 'first_task': unlocked = tasksCompleted >= 1; break;
      case 'tasks_10': unlocked = tasksCompleted >= 10; break;
      case 'tasks_50': unlocked = tasksCompleted >= 50; break;
      case 'tasks_100': unlocked = tasksCompleted >= 100; break;

      // Streaks
      case 'streak_3': unlocked = currentStreak >= 3; break;
      case 'streak_7': unlocked = currentStreak >= 7; break;
      case 'streak_30': unlocked = currentStreak >= 30; break;

      // Levels
      case 'level_5': unlocked = currentLevel >= 5; break;
      case 'level_10': unlocked = currentLevel >= 10; break;
      case 'level_25': unlocked = currentLevel >= 25; break;

      // Meters
      case 'meter_first': unlocked = readingsCount >= 1; break;
      case 'meter_streak_3': unlocked = meterStreak >= 3; break;

      // Inventory
      case 'inventory_10': unlocked = inventoryCount >= 10; break;
      case 'inventory_50': unlocked = inventoryCount >= 50; break;

      // Checklists
      case 'checklist_first': unlocked = checklistsCompleted >= 1; break;

      // Maintenance
      case 'maintenance_first': unlocked = maintenanceCount >= 1; break;
      case 'maintenance_10': unlocked = maintenanceCount >= 10; break;

      // Goals
      case 'goal_first': unlocked = goalsAchieved >= 1; break;
      case 'goal_5': unlocked = goalsAchieved >= 5; break;

      // Properties
      case 'first_property': unlocked = propertiesCount >= 1; break;

      // Contacts
      case 'contact_keeper': unlocked = contactsCount >= 5; break;

      // Special
      case 'organized': unlocked = isOrganized; break;
      case 'early_bird': unlocked = hasEarlyBird; break;
      case 'night_owl': unlocked = hasNightOwl; break;
    }

    if (unlocked) {
      newlyUnlocked.push(achievement);
      unlockedSet.add(achievement.id);
    }
  }

  // Save newly unlocked achievements
  if (newlyUnlocked.length > 0) {
    await api.stats.update({ unlocked_achievements: Array.from(unlockedSet) });
    state.userStats.unlocked_achievements = Array.from(unlockedSet);

    // Award bonus XP for achievements
    for (const achievement of newlyUnlocked) {
      if (achievement.xp > 0) {
        await awardXP(achievement.xp, t(achievement.nameKey));
      }
      toast(t('achievement.unlocked', { name: t(achievement.nameKey) }));
    }
  }
}

async function updateStreak() {
  if (!state.userStats || !state.userStats.gamification_enabled) return;

  const today = todayISO();
  const lastActivity = state.userStats.last_activity_date;

  if (lastActivity === today) return; // Already active today

  let newStreak = 1;
  if (lastActivity) {
    const daysSince = daysDiff(lastActivity, today);
    if (daysSince === 1) {
      // Consecutive day
      newStreak = (state.userStats.current_streak || 0) + 1;
    } else if (daysSince > 1) {
      // Streak broken
      newStreak = 1;
    }
  }

  await api.stats.update({
    current_streak: newStreak,
    longest_streak: Math.max(newStreak, state.userStats.longest_streak || 0),
    last_activity_date: today
  });

  state.userStats.current_streak = newStreak;
  state.userStats.longest_streak = Math.max(newStreak, state.userStats.longest_streak || 0);
  state.userStats.last_activity_date = today;

  updateStatsDisplay();
  checkAchievementsDebounced();
}

function itemTaskHtml(task){
  const due = task.due_at ? `<span class="badge ${isOverdue(task)?'danger':''}">${task.due_at}</span>` : `<span class="badge">${t('tasks.no_due')}</span>`;
  return `
    <div class="item" data-task-id="${task.id}">
      <div class="itemMain">
        <div class="itemTitle">${escapeHtml(task.title)}</div>
        <div class="itemMeta">
          ${due}
          ${task.profile_id ? `<span class="badge">${escapeHtml(profileName(task.profile_id))}</span>`:''}
        </div>
      </div>
      <div class="itemActions">
        <button class="iconBtn" data-task-done="${task.id}">✓</button>
        <button class="iconBtn" data-task-edit="${task.id}">✎</button>
        <button class="iconBtn" data-task-del="${task.id}">🗑</button>
      </div>
    </div>
  `;
}
function bindTaskRowActions(root){
  $$('[data-task-done]', root).forEach(b=>b.onclick=async ()=>{
    const r=await api.tasks.setStatus({ id:b.dataset.taskDone, status:'done' });
    if(!r.ok) return toast(r.error, 'error');
    await updateStreak();
    await awardXP(5, t('tasks.completed_xp'));
    checkAchievementsDebounced();
    toast(t('tasks.done'), 'success'); render();
  });
  $$('[data-task-edit]', root).forEach(b=>b.onclick=async ()=>{
    const id=b.dataset.taskEdit;
    const all=await api.tasks.list({ profile_id: state.profileId, status:'all', range:'all' });
    const t=all.ok ? all.data.find(x=>x.id===id) : null;
    if(t) openTaskModal(t);
  });
  $$('[data-task-del]', root).forEach(b=>b.onclick=async ()=>{
    if(!confirm(t('tasks.delete_confirm'))) return;
    const r=await api.tasks.delete({ id:b.dataset.taskDel });
    if(!r.ok) return toast(r.error, 'error');
    toast(t('common.deleted'), 'success'); render();
  });
}

// Вспомогательные функции для умного Dashboard
function formatDateShort(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  const days = t('date.days_short').split('|');
  return `${days[d.getDay()]}, ${d.getDate()}`;
}

function formatMoney(amount) {
  return new Intl.NumberFormat('ru-RU').format(amount || 0) + ' ₽';
}

function renderSmartDashboardSections(data) {
  let html = '';

  // Срочные элементы (требуют внимания)
  if (data.urgent && data.urgent.length > 0) {
    html += `
      <div class="card" style="grid-column: 1 / -1; background: linear-gradient(135deg, #fff5f5, #fff); border-left: 4px solid #e53e3e;">
        <div class="cardHeader">
          <div class="cardTitle">⚠️ ${t('smart.urgent_title')}</div>
          <span class="badge danger">${data.urgent.length}</span>
        </div>
        <div class="cardBody">
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${data.urgent.slice(0, 5).map(item => `
              <div class="urgent-item priority-${item.priority}"
                   style="padding:10px; border-radius:6px; background: ${item.priority === 'high' ? '#fed7d7' : '#feebc8'}; cursor:pointer;"
                   data-route="${item.action.route}" style="cursor:pointer;">
                <div style="font-weight:600;">${escapeHtml(item.title)}</div>
                <div style="font-size:12px; color:#666; margin-top:4px;">${escapeHtml(item.subtitle)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // Задачи на сегодня
  if (data.today && data.today.length > 0) {
    html += `
      <div class="card">
        <div class="cardHeader">
          <div class="cardTitle">📋 ${t('smart.today_title')}</div>
          <span class="badge">${data.today.length}</span>
        </div>
        <div class="cardBody">
          ${data.today.slice(0, 5).map(t => `
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
              <input type="checkbox" onchange="completeTaskQuick('${t.id}')">
              <span style="flex:1;">${escapeHtml(t.title)}</span>
              <span class="badge priority-${t.priority}">${t.priority}</span>
            </div>
          `).join('')}
          ${data.today.length > 5 ? `<div class="muted" style="margin-top:8px;">${t('smart.more', { count: data.today.length - 5 })}</div>` : ''}
          <button class="btn" data-route="tasks" style="margin-top:8px; width:100%;">${t('smart.all_tasks')}</button>
        </div>
      </div>
    `;
  }

  // Статистика за неделю
  if (data.weekStats) {
    const s = data.weekStats;
    html += `
      <div class="card">
        <div class="cardHeader">
          <div class="cardTitle">📊 ${t('smart.week_title')}</div>
        </div>
        <div class="cardBody">
          <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:12px; margin-bottom:12px;">
            <div style="text-align:center;">
              <div style="font-size:24px; font-weight:700;">${s.tasks_completed}</div>
              <div style="font-size:11px; color:#666;">${t('smart.tasks')}</div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:24px; font-weight:700;">${s.maintenance_done}</div>
              <div style="font-size:11px; color:#666;">${t('smart.maintenance')}</div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:24px; font-weight:700;">🔥 ${s.current_streak}</div>
              <div style="font-size:11px; color:#666;">${t('smart.days_streak')}</div>
            </div>
          </div>
          <div style="background:#eee; height:8px; border-radius:999px; overflow:hidden;">
            <div style="background:linear-gradient(90deg, #3b82f6, #22c55e); height:100%; width:${(s.xp % 100)}%; transition:width 0.5s;"></div>
          </div>
          <div style="text-align:center; margin-top:6px; font-size:12px;">${t('smart.level_xp', { level: s.level, xp: s.xp })}</div>
        </div>
      </div>
    `;
  }

  // Счётчики
  if (data.meters && data.meters.length > 0) {
    const needsAttention = data.meters.filter(m => m.status !== 'ok');
    html += `
      <div class="card">
        <div class="cardHeader">
          <div class="cardTitle">💧 ${t('smart.meters_title')}</div>
          ${needsAttention.length > 0 ? `<span class="badge warn">${needsAttention.length}</span>` : '<span class="badge ok">✓</span>'}
        </div>
        <div class="cardBody">
          ${needsAttention.length > 0 ? `
            <div style="margin-bottom:8px; color:#d97706; font-weight:600;">${t('smart.meters_need', { count: needsAttention.length })}</div>
            ${needsAttention.slice(0, 3).map(m => `
              <div style="margin-bottom:6px; padding:8px; background:#fef3c7; border-radius:4px;">
                <div style="font-weight:600;">${escapeHtml(m.name)}</div>
                <div style="font-size:12px; color:#666;">${t('smart.meters_submission', { day: m.submission_period })}</div>
              </div>
            `).join('')}
            <button class="btn warn" data-route="meters" style="margin-top:8px; width:100%;">${t('smart.meters_submit')}</button>
          ` : `
            <div style="color:#22c55e; font-weight:600;">${t('smart.meters_all_done')}</div>
            <button class="btn" data-route="meters" style="margin-top:8px; width:100%;">${t('dashboard.open')}</button>
          `}
        </div>
      </div>
    `;
  }

  // Предстоящие события
  if (data.upcoming && data.upcoming.length > 0) {
    html += `
      <div class="card">
        <div class="cardHeader">
          <div class="cardTitle">📅 ${t('smart.upcoming_title')}</div>
          <span class="badge">${data.upcoming.length}</span>
        </div>
        <div class="cardBody">
          ${data.upcoming.slice(0, 5).map(item => `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid #eee;"
                 data-route="${item.action.route}" style="cursor:pointer;">
              <div>
                <div style="font-weight:600;">${escapeHtml(item.title)}</div>
                <div style="font-size:11px; color:#666;">${formatDateShort(item.date)}</div>
              </div>
              <span class="badge">${item.type === 'task' ? '📋' : '🔧'}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Цели
  if (data.goals && data.goals.length > 0) {
    html += `
      <div class="card">
        <div class="cardHeader">
          <div class="cardTitle">🎯 ${t('smart.goals_title')}</div>
          <span class="badge">${data.goals.length}</span>
        </div>
        <div class="cardBody">
          ${data.goals.map(g => `
            <div style="margin-bottom:12px;" data-route="goals" style="cursor:pointer;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <div style="font-weight:600; font-size:13px;">${escapeHtml(g.title)}</div>
                <div style="font-size:12px; font-weight:600; color:#3b82f6;">${g.progress}%</div>
              </div>
              <div style="background:#eee; height:6px; border-radius:999px; overflow:hidden;">
                <div style="background:linear-gradient(90deg, #3b82f6, #22c55e); height:100%; width:${g.progress}%; transition:width 0.3s;"></div>
              </div>
              <div style="font-size:11px; color:#666; margin-top:4px;">${formatMoney(g.saved)} / ${formatMoney(g.target)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  return html;
}

async function completeTaskQuick(id) {
  const r = await api.tasks.setStatus({ id, status: 'done' });
  if (!r.ok) return toast(r.error, 'error');
  await updateStreak();
  await awardXP(5, t('tasks.completed_xp'));
  checkAchievementsDebounced();
  toast(t('status.done'), 'success');
  render();
}

async function renderDashboard(){
  const prof=state.profileId;

  // Ensure routine instances for today exist before building the dashboard lists.
  await api.routines.generate({ daysAhead:14 });

  // Load all data in parallel
  const [
    tasksOverdue, plansOverdue, plansSoon, goals,
    properties, meters, inventory, contacts, checklists
  ] = await Promise.all([
    api.tasks.list({ profile_id: prof, status:'active', range:'overdue' }),
    api.maintenance.plans.list({ range:'overdue', daysSoon:14 }),
    api.maintenance.plans.list({ range:'soon', daysSoon:14 }),
    api.goals.list({ status:'active' }),
    api.properties.list(),
    api.meters.list({}),
    api.inventory.list({}),
    api.contacts.list({}),
    api.checklists.list()
  ]);

  const overdueCount=(tasksOverdue.ok?tasksOverdue.data.length:0)+(plansOverdue.ok?plansOverdue.data.length:0);
  const propertiesData = properties.ok ? properties.data : [];
  const metersData = meters.ok ? meters.data : [];
  const inventoryData = inventory.ok ? inventory.data : [];
  const contactsData = contacts.ok ? contacts.data : [];
  const checklistsData = checklists.ok ? checklists.data : [];

  // Calculate meters needing reading (day 15-25)
  const today = new Date();
  const dayOfMonth = today.getDate();
  const metersNeedingReading = metersData.filter(m => {
    const start = m.submission_day_start || 15;
    const end = m.submission_day_end || 25;
    const inWindow = dayOfMonth >= start && dayOfMonth <= end;
    const submittedThisMonth = isSameMonth(m.last_reading_date || '', today);
    return m.is_active && inWindow && !submittedThisMonth;
  });

  // Get gamification stats
  const stats = state.userStats;
  let levelWidget = '';
  let recentAchievements = [];

  if (stats && stats.gamification_enabled) {
    const level = getLevelForXP(stats.xp);
    const { progressXP, requiredXP, percentage } = getXPProgressForCurrentLevel(stats.xp);
    const unlockedSet = new Set(stats.unlocked_achievements || []);
    recentAchievements = ACHIEVEMENTS.filter(a => unlockedSet.has(a.id)).slice(-3).reverse();

    levelWidget = `
      <div class="card" style="background: linear-gradient(135deg, rgba(96,165,250,0.15) 0%, rgba(139,92,246,0.15) 100%); grid-column: span 2;">
        <div class="cardHeader">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:24px;">⭐</span>
            <div class="cardTitle">${t('dashboard.level_title', { level })}</div>
          </div>
          <span class="badge ok">${stats.xp} XP</span>
        </div>
        <div class="cardBody">
          <div style="display:flex; align-items:center; gap:16px; flex-wrap:wrap;">
            <div style="flex:1; min-width:200px;">
              <div style="margin-bottom:6px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                  <div class="muted" style="font-size:11px;">${t('dashboard.level_to', { level: level + 1 })}</div>
                  <div style="font-size:12px; font-weight:600;">${progressXP} / ${requiredXP}</div>
                </div>
                <div style="background:var(--border); height:8px; border-radius:999px; overflow:hidden;">
                  <div style="background:linear-gradient(90deg, var(--accent) 0%, var(--ok) 100%); height:100%; width:${percentage}%; transition:width 0.5s;"></div>
                </div>
              </div>
            </div>
            <div style="display:flex; gap:16px;">
              <div style="text-align:center;">
                <div class="muted" style="font-size:11px; margin-bottom:4px;">${t('dashboard.streak')}</div>
                <div style="font-size:24px; font-weight:700; color:var(--warn);">${stats.current_streak || 0} 🔥</div>
              </div>
              <div style="text-align:center;">
                <div class="muted" style="font-size:11px; margin-bottom:4px;">${t('dashboard.achievements')}</div>
                <div style="font-size:24px; font-weight:700; color:var(--ok);">${(stats.unlocked_achievements || []).length} 🏆</div>
              </div>
            </div>
          </div>
          ${recentAchievements.length > 0 ? `
            <div style="margin-top:12px; padding-top:12px; border-top:1px solid var(--border);">
              <div class="muted" style="font-size:11px; margin-bottom:8px;">${t('dashboard.recent_achievements')}</div>
              <div style="display:flex; gap:8px; flex-wrap:wrap;">
                ${recentAchievements.map(a => `
                  <div class="badge ok" style="font-size:16px;">${a.icon} ${escapeHtml(t(a.nameKey))}</div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  // Загружаем данные для умного Dashboard
  const dashData = await api.dashboard.getData();
  const smartDashboard = dashData.ok ? dashData.data : null;
  $('#content').innerHTML=`
    <div class="h1">${t('dashboard.title')}</div>
    <div class="muted">${t('dashboard.subtitle')}</div>

    <div class="grid" style="margin-top:12px;">
      ${smartDashboard ? renderSmartDashboardSections(smartDashboard) : ''}
      ${levelWidget}

      <div class="card">
        <div class="cardHeader">
          <div class="cardTitle">${t('dashboard.overdue')}</div>
          <span class="badge ${overdueCount > 0 ? 'danger' : ''}">${overdueCount}</span>
        </div>
        <div class="cardBody">
          <div class="muted">${t('dashboard.overdue_desc')}</div>
          ${overdueCount > 0 ? `
            <div class="row" style="margin-top:10px; gap:8px;">
              <button class="btn danger" id="goOverdueTasks">${t('dashboard.overdue_tasks')}</button>
              <button class="btn danger" id="goOverdueMaint">${t('dashboard.overdue_maintenance')}</button>
            </div>
          ` : `<div style="margin-top:10px; color:var(--ok);">${t('dashboard.overdue_ok')}</div>`}
        </div>
      </div>

      <div class="card">
        <div class="cardHeader">
          <div class="cardTitle">${t('dashboard.today')}</div>
          <span class="badge">${todayISO()}</span>
        </div>
        <div class="cardBody">
          <div class="muted">${t('dashboard.today_desc')}</div>
          <div class="list" id="todayList" style="margin-top:10px;"></div>
        </div>
      </div>

      <div class="card">
        <div class="cardHeader">
          <div class="cardTitle">${t('dashboard.soon_maintenance')}</div>
          <span class="badge ${plansSoon.ok && plansSoon.data.length > 0 ? 'warn' : ''}">${plansSoon.ok ? plansSoon.data.length : 0}</span>
        </div>
        <div class="cardBody">
          <div class="muted">${t('dashboard.soon_maintenance_desc')}</div>
          <div class="list" id="soonMaintList" style="margin-top:10px;"></div>
        </div>
      </div>

      <div class="card">
        <div class="cardHeader">
          <div style="display:flex; align-items:center; gap:8px;">
            <span>🏠</span>
            <div class="cardTitle">${t('dashboard.properties')}</div>
          </div>
          <span class="badge">${propertiesData.length}</span>
        </div>
        <div class="cardBody">
          ${propertiesData.length > 0 ? `
            <div class="muted" style="margin-bottom:8px;">${t('dashboard.properties_count', { count: propertiesData.length })}</div>
            <button class="btn" data-dash-route="property">${t('dashboard.properties_open')}</button>
          ` : `
            <div class="muted" style="margin-bottom:8px;">${t('dashboard.properties_empty')}</div>
            <button class="btn" data-dash-route="property">${t('dashboard.properties_add')}</button>
          `}
        </div>
      </div>

      <div class="card">
        <div class="cardHeader">
          <div style="display:flex; align-items:center; gap:8px;">
            <span>💧</span>
            <div class="cardTitle">${t('dashboard.meters')}</div>
          </div>
          <span class="badge ${metersNeedingReading.length > 0 ? 'warn' : ''}">${metersNeedingReading.length}</span>
        </div>
        <div class="cardBody">
          ${metersNeedingReading.length > 0 ? `
            <div class="muted" style="margin-bottom:8px;">${t('dashboard.meters_due')}</div>
            <button class="btn warn" data-dash-route="meters">${t('dashboard.meters_submit')}</button>
          ` : `
            <div class="muted" style="margin-bottom:8px;">${t('dashboard.meters_total', { count: metersData.length })}</div>
            <button class="btn" data-dash-route="meters">${t('dashboard.open')}</button>
          `}
        </div>
      </div>

      <div class="card">
        <div class="cardHeader">
          <div style="display:flex; align-items:center; gap:8px;">
            <span>📦</span>
            <div class="cardTitle">${t('dashboard.inventory')}</div>
          </div>
          <span class="badge">${inventoryData.length}</span>
        </div>
        <div class="cardBody">
          ${inventoryData.length > 0 ? `
            <div class="muted" style="margin-bottom:8px;">${t('dashboard.inventory_count', { count: inventoryData.length })}</div>
            ${inventoryData.reduce((sum, i) => sum + (i.purchase_price || 0), 0) > 0 ? `
              <div style="font-size:16px; font-weight:600; margin-bottom:8px;">
                ${inventoryData.reduce((sum, i) => sum + (i.purchase_price || 0), 0).toLocaleString('ru-RU')} ₽
              </div>
            ` : ''}
            <button class="btn" data-dash-route="inventory">${t('dashboard.open')}</button>
          ` : `
            <div class="muted" style="margin-bottom:8px;">${t('dashboard.inventory_empty')}</div>
            <button class="btn" data-dash-route="inventory">${t('dashboard.inventory_add')}</button>
          `}
        </div>
      </div>

      <div class="card">
        <div class="cardHeader">
          <div style="display:flex; align-items:center; gap:8px;">
            <span>📞</span>
            <div class="cardTitle">${t('dashboard.contacts')}</div>
          </div>
          <span class="badge">${contactsData.length}</span>
        </div>
        <div class="cardBody">
          ${contactsData.filter(c => c.is_favorite).length > 0 ? `
            <div class="muted" style="margin-bottom:8px;">${t('dashboard.contacts_favorites', { count: contactsData.filter(c => c.is_favorite).length })}</div>
          ` : `
            <div class="muted" style="margin-bottom:8px;">${t('dashboard.contacts_total', { count: contactsData.length })}</div>
          `}
          <button class="btn" data-dash-route="contacts">${t('dashboard.open')}</button>
        </div>
      </div>

      <div class="card" id="checklistsWidget">
        <div class="cardHeader">
          <div style="display:flex; align-items:center; gap:8px;">
            <span>✅</span>
            <div class="cardTitle">${t('dashboard.checklists')}</div>
          </div>
          <span class="badge">${checklistsData.length}</span>
        </div>
        <div class="cardBody" id="checklistsMini"></div>
      </div>

      <div class="card" style="grid-column: span 2;">
        <div class="cardHeader">
          <div class="cardTitle">${t('dashboard.quick_actions')}</div>
        </div>
        <div class="cardBody">
          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
            <button class="btn" id="quickTask">${t('dashboard.quick_task')}</button>
            <button class="btn" id="quickPlan">${t('dashboard.quick_plan')}</button>
            <button class="btn" id="quickDoc">${t('dashboard.quick_doc')}</button>
            <button class="btn" id="quickProperty">${t('dashboard.quick_property')}</button>
            <button class="btn" id="quickContact">${t('dashboard.quick_contact')}</button>
            <button class="btn" id="quickInventory">${t('dashboard.quick_inventory')}</button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="cardHeader">
          <div class="cardTitle">${t('dashboard.goals')}</div>
          <span class="badge">${goals.ok ? goals.data.length : 0}</span>
        </div>
        <div class="cardBody" id="goalsMini"></div>
      </div>
    </div>
  `;
  bindLanguageSwitcher($('#content'));

  // Bind overdue buttons
  if (overdueCount > 0) {
    $('#goOverdueTasks').onclick=()=>{ setRoute('tasks'); renderTasks({ range:'overdue' }); };
    $('#goOverdueMaint').onclick=()=>{ setRoute('maintenance'); renderMaintenance({ range:'overdue' }); };
  }

  // Bind quick action buttons
  $('#quickTask').onclick=()=>openTaskModal();
  $('#quickPlan').onclick=()=>openPlanModal();
  $('#quickDoc').onclick=()=>openDocModal();
  $('#quickProperty').onclick=()=>{ setRoute('property'); renderProperty(); };
  $('#quickContact').onclick=()=>{ setRoute('contacts'); };
  $('#quickInventory').onclick=()=>{ setRoute('inventory'); renderInventory(); };
  // Bind dashboard route buttons (after dynamic inserts)
  const bindDashboardRoutes = () => {
    $$('[data-dash-route]').forEach(b=>b.onclick=()=>setRoute(b.dataset.dashRoute));
    $$('[data-route]').forEach(b=>b.onclick=()=>setRoute(b.dataset.route));
  };

  // Today's tasks
  const todayTasks = await api.tasks.list({ profile_id: prof, status:'active', range:'today' });
  const todayEl=$('#todayList');
  if(todayTasks.ok && todayTasks.data.length){
    todayEl.innerHTML=todayTasks.data.slice(0,4).map(itemTaskHtml).join('');
    bindTaskRowActions(todayEl);
  } else todayEl.innerHTML=`<div class="muted">${t('dashboard.today_empty')}</div>`;

  // Soon maintenance
  const soonEl=$('#soonMaintList');
  if(plansSoon.ok && plansSoon.data.length){
    soonEl.innerHTML=plansSoon.data.slice(0,4).map(itemPlanMiniHtml).join('');
    bindPlanMiniActions(soonEl);
  } else soonEl.innerHTML=`<div class="muted">${t('dashboard.soon_empty')}</div>`;

  // Checklists progress (only active checklists)
  const checklistsEl = $('#checklistsMini');
  const activeChecklists = checklistsData.filter(cl => cl.is_active !== false);
  if (activeChecklists.length > 0) {
    const checklistsWithProgress = await Promise.all(activeChecklists.slice(0, 2).map(async (cl) => {
      const progRes = await api.checklists.getProgress({ id: cl.id });
      const progress = progRes.ok ? normalizeChecklistProgress(progRes.data, cl) : { completed: [], total: cl.items.length };
      return { ...cl, progress };
    }));

    checklistsEl.innerHTML = checklistsWithProgress.map(cl => {
      const pct = cl.progress.total > 0 ? Math.round((cl.progress.completed.length / cl.progress.total) * 100) : 0;
      return `
        <div style="margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <div style="font-size:13px; font-weight:600;">${escapeHtml(cl.name)}</div>
            <div style="font-size:12px;">${cl.progress.completed.length}/${cl.progress.total}</div>
          </div>
          <div style="background:var(--border); height:6px; border-radius:999px; overflow:hidden;">
            <div style="background:var(--ok); height:100%; width:${pct}%; transition:width 0.3s;"></div>
          </div>
        </div>
      `;
    }).join('');

    checklistsEl.innerHTML += `<button class="btn" data-dash-route="checklists" style="margin-top:8px; width:100%;">${t('btn.open')}</button>`;
  } else {
    checklistsEl.innerHTML = `
      <div class="muted" style="margin-bottom:8px;">${t('dashboard.checklists_empty')}</div>
      <button class="btn" data-dash-route="checklists">${t('btn.open')}</button>
    `;
  }

  bindDashboardRoutes();

  // Goals
  const goalsEl=$('#goalsMini');
  if(goals.ok && goals.data.length){
    goalsEl.innerHTML=goals.data.slice(0,2).map(g=>{
      const pct=g.target_amount?Math.min(100,Math.round((g.saved_amount/g.target_amount)*100)):0;
      return `<div class="item">
        <div class="itemMain">
          <div class="itemTitle">${escapeHtml(g.title)}</div>
          <div class="itemMeta">
            <span class="badge">${g.saved_amount} / ${g.target_amount}</span>
            <span class="badge ok">${pct}%</span>
          </div>
        </div>
        <div class="itemActions">
          <button class="iconBtn" data-goal-open="${g.id}">${t('btn.open')}</button>
        </div>
      </div>`;
    }).join('');
    $$('[data-goal-open]', goalsEl).forEach(b=>b.onclick=()=>{ setRoute('goals'); renderGoals({ openId:b.dataset.goalOpen }); });
  } else goalsEl.innerHTML=`<div class="muted">${t('goals.empty')}</div>`;
}

async function renderTasks(presetFilter){
  await api.routines.generate({ daysAhead:14 });
  const filter=Object.assign({ profile_id:state.profileId, status:'active', range:'all', tag_ids:[] }, presetFilter||{});
  $('#content').innerHTML=`
    <div class="row" style="justify-content:space-between;">
      <div>
        <div class="h1">${t('tasks.title')}</div>
        <div class="muted">${t('tasks.subtitle')}</div>
      </div>
      <button class="btn" id="addTaskBtn">${t('tasks.add')}</button>
    </div>

    <div class="card" style="margin-top:12px;">
      <div class="row">
        <select id="taskStatus">
          <option value="active">${t('tasks.status_active')}</option>
          <option value="done">${t('tasks.status_done')}</option>
          <option value="all">${t('tasks.status_all')}</option>
        </select>
        <select id="taskRange">
          <option value="all">${t('tasks.range_all')}</option>
          <option value="today">${t('tasks.range_today')}</option>
          <option value="week">${t('tasks.range_week')}</option>
          <option value="overdue">${t('tasks.range_overdue')}</option>
        </select>
        <input class="input" id="taskQ" placeholder="${t('tasks.search_placeholder')}" />
        <label style="display:flex; align-items:center; gap:8px;">
          <input type="checkbox" id="taskShowDone" />
          <span class="muted">${t('tasks.show_done')}</span>
        </label>
      </div>
      <div style="margin-top:10px;" id="taskTags"></div>
    </div>

    <div class="list" id="taskList" style="margin-top:12px;"></div>
  `;
  $('#addTaskBtn').onclick=()=>openTaskModal();
  $('#taskStatus').value=filter.status;
  $('#taskRange').value=filter.range;
  $('#taskShowDone').checked = filter.status !== 'active';

  const tagWrap=$('#taskTags');
  tagWrap.innerHTML=tagPickerHtml([]);
  $('#addTagBtn', tagWrap).onclick=async ()=>{
    const name=$('#newTagName', tagWrap).value.trim(); if(!name) return;
    const r=await api.tags.create({ name }); if(!r.ok) return toast(r.error, 'error');
    await loadTags(); render();
  };
  $('#newTagName', tagWrap).onkeydown=(e)=>{ if(e.key==='Enter') $('#addTagBtn', tagWrap).click(); };

  async function refresh(){
    const tag_ids=readTagPicker(tagWrap);
    const q=$('#taskQ').value.trim();
    const status=$('#taskStatus').value;
    const range=$('#taskRange').value;

    const r=await api.tasks.list({ profile_id:state.profileId, status, range, tag_ids, q });
    const listEl=$('#taskList');
    if(!r.ok) return listEl.innerHTML=`<div class="muted">${escapeHtml(r.error)}</div>`;
    if(!r.data.length) return listEl.innerHTML=`<div class="muted">${t('common.empty')}</div>`;
    listEl.innerHTML=r.data.map(itemTaskHtml).join('');
    bindTaskRowActions(listEl);
  }

  $('#taskStatus').onchange=()=>{
    $('#taskShowDone').checked = $('#taskStatus').value !== 'active';
    refresh();
  };
  $('#taskShowDone').onchange=()=>{
    $('#taskStatus').value = $('#taskShowDone').checked ? 'all' : 'active';
    refresh();
  };
  $('#taskRange').onchange=refresh;
  $('#taskQ').oninput=()=>{ clearTimeout(refresh._t); refresh._t=setTimeout(refresh, 200); };
  $$('input[type="checkbox"]', tagWrap).forEach(ch=>ch.onchange=refresh);

  await refresh();
}

async function openTaskModal(existing){
  const task = existing || { title:'', description:'', due_at:'', priority:'med', profile_id: state.profileId==='all'?null:state.profileId, tag_ids:[] };
  openModal(existing ? t('tasks.edit_title') : t('tasks.new_title'), `
    <div class="form">
      <div class="formRow">
        <input class="input" id="tTitle" placeholder="${t('label.title')}" value="${escapeHtml(task.title)}" />
        <select id="tPriority">
          <option value="low">${t('priority.low')}</option>
          <option value="med">${t('priority.med')}</option>
          <option value="high">${t('priority.high')}</option>
        </select>
      </div>
      <textarea class="input" id="tDesc" placeholder="${t('label.description')}">${escapeHtml(task.description||'')}</textarea>
      <div class="formRow">
        <input type="date" class="input" id="tDue" placeholder="${t('tasks.due')}" value="${escapeHtml(task.due_at||'')}" />
        <select id="tProfile"></select>
      </div>
      <div id="tTags"></div>
      <div class="row" style="justify-content:flex-end;">
        <button class="btn" id="saveTask">${t('btn.save')}</button>
      </div>
    </div>
  `, (root)=>{
    $('#tPriority', root).value=task.priority||'med';
    const pSel=$('#tProfile', root);
    pSel.innerHTML=[{id:'',name:t('common.none')}, ...state.profiles.filter(p=>!p.is_archived)]
      .map(p=>`<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
    pSel.value=task.profile_id||'';

    const tagsRoot=$('#tTags', root);
    tagsRoot.innerHTML=tagPickerHtml(task.tag_ids||[]);
    $('#addTagBtn', tagsRoot).onclick=async ()=>{
      const name=$('#newTagName', tagsRoot).value.trim(); if(!name) return;
      const r=await api.tags.create({ name }); if(!r.ok) return toast(r.error, 'error');
      await loadTags(); closeModal(); openTaskModal(existing);
    };
    $('#newTagName', tagsRoot).onkeydown=(e)=>{ if(e.key==='Enter') $('#addTagBtn', tagsRoot).click(); };

    $('#saveTask', root).onclick=async ()=>{
      const titleField = $('#tTitle', root);
      const descField = $('#tDesc', root);
      const dueField = $('#tDue', root);

      const title = titleField.value.trim();
      const description = descField.value.trim();
      const due_at = dueField.value.trim() || null;
      const priority = $('#tPriority', root).value;
      const profile_id = pSel.value || null;
      const tag_ids = readTagPicker(tagsRoot);

      // Validation
      if (!validators.isRequired(title)) {
        markFieldInvalid(titleField, t('validation.title_required'));
        return;
      }

      if (!validators.maxLength(title, 200)) {
        markFieldInvalid(titleField, t('validation.title_max', { max: 200 }));
        return;
      }

      if (!validators.maxLength(description, 2000)) {
        markFieldInvalid(descField, t('validation.desc_max', { max: 2000 }));
        return;
      }

      if (due_at && !validators.isValidDate(due_at)) {
        markFieldInvalid(dueField, t('validation.invalid_date'));
        return;
      }

      // Warn if date is in the past (but allow saving)
      if (due_at && !validators.isFutureDate(due_at)) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const selectedDate = new Date(due_at);
        if (selectedDate < today) {
          toast(t('tasks.past_date_warning'), 'warning');
        }
      }

      if(existing){
        const r=await api.tasks.update({ id: existing.id, patch:{ title, description, due_at, priority, profile_id, tag_ids }});
        if(!r.ok) return toast(r.error, 'error');
      } else {
        const r=await api.tasks.create({ title, description, due_at, priority, profile_id, tag_ids });
        if(!r.ok) return toast(r.error, 'error');
      }
      closeModal(); toast(t('msg.saved'), 'success'); render();
    };
  });
}

function itemPlanMiniHtml(p){
  const today=todayISO();
  const overdue=p.next_due_at < today;
  const badgeClass=overdue?'danger':(daysDiff(today,p.next_due_at)<=7?'warn':'');
  return `
    <div class="item">
      <div class="itemMain">
        <div class="itemTitle">${escapeHtml(p.title)}</div>
        <div class="itemMeta"><span class="badge ${badgeClass}">${p.next_due_at}</span></div>
      </div>
      <div class="itemActions"><button class="iconBtn" data-plan-done="${p.id}">✓</button></div>
    </div>
  `;
}
function bindPlanMiniActions(root){
  $$('[data-plan-done]', root).forEach(b=>b.onclick=()=>openLogModal(b.dataset.planDone));
}
function planCardHtml(p){
  const today=todayISO();
  const overdue=p.next_due_at < today;
  const diff=daysDiff(today,p.next_due_at);
  const badgeClass=overdue?'danger':(diff<=7?'warn':'ok');
  const hint=overdue
    ? t('maintenance.overdue_by', { days: Math.abs(diff) })
    : (diff===0 ? t('maintenance.today') : t('maintenance.in_days', { days: diff }));
  return `
    <div class="item">
      <div class="itemMain">
        <div class="itemTitle">${escapeHtml(p.title)}</div>
        <div class="itemMeta">
          <span class="badge ${badgeClass}">${p.next_due_at}</span>
          <span class="badge">${hint}</span>
        </div>
      </div>
      <div class="itemActions">
        <button class="iconBtn" data-plan-done="${p.id}">✓</button>
        <button class="iconBtn" data-plan-edit="${p.id}">✎</button>
        <button class="iconBtn" data-plan-del="${p.id}">🗑</button>
      </div>
    </div>
  `;
}
function bindPlanActions(root){
  $$('[data-plan-done]', root).forEach(b=>b.onclick=()=>openLogModal(b.dataset.planDone));
  $$('[data-plan-edit]', root).forEach(b=>b.onclick=async ()=>{
    const all=await api.maintenance.plans.list({ range:'all', daysSoon:14, is_active:true });
    const p=all.ok ? all.data.find(x=>x.id===b.dataset.planEdit) : null;
    if(p) openPlanModal(p);
  });
  $$('[data-plan-del]', root).forEach(b=>b.onclick=async ()=>{
    if(!confirm(t('plans.delete_confirm'))) return;
    const r=await api.maintenance.plans.delete({ id:b.dataset.planDel });
    if(!r.ok) return toast(r.error, 'error');
    toast(t('common.deleted'), 'success'); render();
  });
}

function logRowHtml(l, planName){
  const cost=(l.cost??null)!==null ? `<span class="badge">${l.cost} ₽</span>` : '';
  const planBadge = planName ? `<span class="badge">${t('logs.plan_badge', { name: escapeHtml(planName) })}</span>` : '';
  return `
    <div class="item">
      <div class="itemMain">
        <div class="itemTitle">${escapeHtml(l.done_at)}</div>
        <div class="itemMeta">
          ${cost}
          ${planBadge}
          ${l.note ? `<span class="badge">${escapeHtml(l.note)}</span>`:''}
        </div>
      </div>
      <div class="itemActions"><button class="iconBtn" data-log-del="${l.id}">🗑</button></div>
    </div>
  `;
}
function bindLogActions(root){
  $$('[data-log-del]', root).forEach(b=>b.onclick=async ()=>{
    if(!confirm(t('logs.delete_confirm'))) return;
    const r=await api.maintenance.logs.delete({ id:b.dataset.logDel });
    if(!r.ok) return toast(r.error, 'error');
    toast(t('common.deleted'), 'success'); render();
  });
}

async function renderMaintenance(preset){
  $('#content').innerHTML=`
    <div class="row" style="justify-content:space-between;">
      <div>
        <div class="h1">${t('maintenance.title')}</div>
        <div class="muted">${t('maintenance.subtitle')}</div>
      </div>
      <div class="row">
        <button class="btn" id="addAssetBtn">${t('maintenance.add_asset')}</button>
        <button class="btn" id="addPlanBtn">${t('maintenance.add_plan')}</button>
      </div>
    </div>

    <div class="card" style="margin-top:12px;">
      <div class="row">
        <select id="maintRange">
          <option value="all">${t('maintenance.range_all')}</option>
          <option value="soon">${t('maintenance.range_soon')}</option>
          <option value="overdue">${t('maintenance.range_overdue')}</option>
        </select>
        <select id="maintAsset"></select>
        <label style="display:flex; align-items:center; gap:8px;">
          <input type="checkbox" id="maintShowInactive" />
          <span class="muted">${t('maintenance.show_inactive')}</span>
        </label>
        <button class="btn" id="refreshMaint">${t('maintenance.refresh')}</button>
      </div>
    </div>

    <div class="grid" style="margin-top:12px;">
      <div class="card">
        <div class="cardHeader">
          <div class="cardTitle">${t('maintenance.plans')}</div>
          <span class="badge" id="planCount">—</span>
        </div>
        <div class="cardBody"><div class="list" id="planList"></div></div>
      </div>

      <div class="card" style="grid-column: span 2;">
        <div class="cardHeader">
          <div class="cardTitle">${t('maintenance.logs')}</div>
          <button class="btn" id="addLogBtn">${t('maintenance.add_log')}</button>
          <span class="badge" id="logCount">—</span>
        </div>
        <div class="cardBody"><div class="list" id="logList"></div></div>
      </div>
    </div>
  `;
  $('#addAssetBtn').onclick=()=>openAssetModal();
  $('#addPlanBtn').onclick=()=>openPlanModal();
  const addLogBtn = $('#addLogBtn');
  if(addLogBtn) addLogBtn.onclick=()=>openLogModal(null, $('#maintAsset')?.value || null);
  const assetsR=await api.assets.list();
  if(!assetsR.ok) return toast(assetsR.error);
  const assets=assetsR.data;
  const assetSel=$('#maintAsset');
  assetSel.innerHTML=`<option value="">${t('maintenance.assets_all')}</option>` + assets.map(a=>`<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
  const rangeSel=$('#maintRange');
  if(preset?.range) rangeSel.value=preset.range;
  const showInactive = $('#maintShowInactive');
  if(showInactive) showInactive.checked = !!state.maintenanceShowInactive;

  async function refresh(){
    const range=rangeSel.value;
    const asset_id=assetSel.value || null;
    const is_active = showInactive && showInactive.checked ? undefined : true;
    const plansR=await api.maintenance.plans.list({ range, daysSoon:14, asset_id, is_active });
    const logsR=await api.maintenance.logs.list({ asset_id });
    const planMap = plansR.ok ? new Map(plansR.data.map(p=>[p.id, p.title])) : new Map();

    const planList=$('#planList');
    if(!plansR.ok) planList.innerHTML=`<div class="muted">${escapeHtml(plansR.error)}</div>`;
    else {
      $('#planCount').textContent=String(plansR.data.length);
      planList.innerHTML = plansR.data.length ? plansR.data.map(planCardHtml).join('') : `<div class="muted">${t('maintenance.plans_empty')}</div>`;
      bindPlanActions(planList);
    }

    const logList=$('#logList');
    if(!logsR.ok) logList.innerHTML=`<div class="muted">${escapeHtml(logsR.error)}</div>`;
    else {
      $('#logCount').textContent=String(logsR.data.length);
      logList.innerHTML = logsR.data.length
        ? logsR.data.slice(0,30).map(l => logRowHtml(l, planMap.get(l.plan_id))).join('')
        : `<div class="muted">${t('maintenance.logs_empty')}</div>`;
      bindLogActions(logList);
    }
  }

  $('#refreshMaint').onclick=refresh;
  rangeSel.onchange=refresh;
  assetSel.onchange=refresh;
  if(showInactive) showInactive.onchange=()=>{
    state.maintenanceShowInactive = showInactive.checked;
    refresh();
  };
  await refresh();
}

async function openAssetModal(existing){
  const a=existing || { name:'', type:'home', note:'' };
  openModal(existing ? t('assets.edit_title') : t('assets.new_title'), `
    <div class="form">
      <div class="formRow">
        <input class="input" id="aName" placeholder="${t('assets.name_placeholder')}" value="${escapeHtml(a.name)}" />
        <select id="aType">
          <option value="home">${t('assets.type.home')}</option>
          <option value="car">${t('assets.type.car')}</option>
          <option value="appliance">${t('assets.type.appliance')}</option>
          <option value="filter">${t('assets.type.filter')}</option>
          <option value="other">${t('assets.type.other')}</option>
        </select>
      </div>
      <textarea class="input" id="aNote" placeholder="${t('label.notes')}">${escapeHtml(a.note||'')}</textarea>
      <div class="row" style="justify-content:${existing ? 'space-between' : 'flex-end'};">
        ${existing ? `<button class="btn danger" id="delAsset">${t('btn.delete')}</button>` : ''}
        <button class="btn" id="saveAsset">${t('btn.save')}</button>
      </div>
    </div>
  `, (root)=>{
    $('#aType', root).value=a.type||'home';
    $('#saveAsset', root).onclick=async ()=>{
      const name=$('#aName', root).value.trim();
      const type=$('#aType', root).value;
      const note=$('#aNote', root).value.trim();
      if(!name) return toast(t('assets.name_required'), 'warning');
      if(existing){
        const r=await api.assets.update({ id:existing.id, patch:{ name, type, note }});
        if(!r.ok) return toast(r.error, 'error');
      } else {
        const r=await api.assets.create({ name, type, note });
        if(!r.ok) return toast(r.error, 'error');
      }
      closeModal(); toast(t('msg.saved'), 'success');
      if(state.route === 'asset-detail') renderAssetDetail();
      else if(state.route === 'assets') renderAssets();
      else render();
    };
    if(existing){
      const delBtn = $('#delAsset', root);
      if(delBtn){
        delBtn.onclick=async ()=>{
          if(!confirm(t('assets.delete_confirm'))) return;
          const r=await api.assets.delete({ id:existing.id });
          if(!r.ok) return toast(r.error, 'error');
          closeModal(); toast(t('common.deleted'), 'success');
          if(state.route === 'asset-detail') setRoute('assets');
          else if(state.route === 'assets') renderAssets();
          else render();
        };
      }
    }
  });
}

async function openPlanModal(existing){
  const assetsR=await api.assets.list();
  if(!assetsR.ok) return toast(assetsR.error);
  const assets=assetsR.data;
  const isEdit = Boolean(existing?.id);
  const p = isEdit
    ? existing
    : { asset_id: existing?.asset_id || assets[0]?.id, title:'', interval_days:90, last_done_at:'', expected_cost:'', note:'', next_due_at:'' };

  openModal(isEdit ? t('plans.edit_title') : t('plans.new_title'), `
    <div class="form">
      <div class="formRow">
        <select id="pAsset"></select>
        <input class="input" id="pTitle" placeholder="${t('plans.title_placeholder')}" value="${escapeHtml(p.title)}" />
      </div>
      <div class="formRow">
        <input class="input" id="pInterval" placeholder="${t('plans.interval_days')}" value="${escapeHtml(String(p.interval_days||90))}" />
        <input type="date" class="input" id="pLast" placeholder="${t('plans.last_done')}" value="${escapeHtml(p.last_done_at||'')}" />
      </div>
      <div class="formRow">
        <input class="input" id="pCost" placeholder="${t('plans.expected_cost')}" value="${escapeHtml(p.expected_cost ?? '')}" />
        <input type="date" class="input" id="pNext" placeholder="${t('plans.next_due')}" value="${escapeHtml(p.next_due_at||'')}" />
      </div>
      <textarea class="input" id="pNote" placeholder="${t('label.notes')}">${escapeHtml(p.note||'')}</textarea>
      <div class="row" style="justify-content:flex-end;"><button class="btn" id="savePlan">${t('btn.save')}</button></div>
    </div>
  `, (root)=>{
    const aSel=$('#pAsset', root);
    aSel.innerHTML = assets.map(a=>`<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
    aSel.value = p.asset_id || assets[0]?.id;

    $('#savePlan', root).onclick=async ()=>{
      const asset_id=aSel.value;
      const title=$('#pTitle', root).value.trim();
      const interval_days=Number($('#pInterval', root).value.trim()||0);
      const last_done_at=$('#pLast', root).value.trim()||null;
      const expected_cost=$('#pCost', root).value.trim();
      const next_due_at=$('#pNext', root).value.trim()||null;
      const note=$('#pNote', root).value.trim();
      if(!asset_id) return toast(t('plans.asset_required'), 'warning');
      if(!title) return toast(t('plans.title_required'), 'warning');
      if(!interval_days || interval_days<1) return toast(t('plans.interval_min'), 'warning');

      const payload={ asset_id, title, interval_days, last_done_at, expected_cost: expected_cost?Number(expected_cost):null, next_due_at, note };
      if(isEdit){
        const r=await api.maintenance.plans.update({ id: p.id, patch: payload });
        if(!r.ok) return toast(r.error, 'error');
      } else {
        const r=await api.maintenance.plans.create(payload);
        if(!r.ok) return toast(r.error, 'error');
      }
      closeModal(); toast(t('msg.saved'), 'success'); render();
    };
  });
}

async function openLogModal(planId, assetId=null){
  const plansR=await api.maintenance.plans.list({ range:'all', daysSoon:14, is_active:true });
  if(!plansR.ok) return toast(plansR.error);
  const plans = assetId ? plansR.data.filter(p=>p.asset_id===assetId) : plansR.data;
  if(plans.length === 0) return toast(t('logs.need_plan_first'), 'warning');

  const selectedPlan = planId ? plans.find(p=>p.id===planId) : plans[0];
  if(!selectedPlan) return toast(t('logs.plan_not_found'));

  openModal(t('logs.mark_done_title'), `
    <div class="form">
      <div class="card">
        <div class="cardTitle">${escapeHtml(selectedPlan.title)}</div>
        <div class="muted" style="margin-top:6px;">${t('logs.next_date_auto')}</div>
      </div>
      ${planId ? '' : `
        <div>
          <label class="muted">${t('logs.plan_label')}</label>
          <select class="input" id="logPlanSelect">
            ${plans.map(p=>`<option value="${p.id}" ${p.id===selectedPlan.id?'selected':''}>${escapeHtml(p.title)}</option>`).join('')}
          </select>
        </div>
      `}
      <div class="formRow">
        <input type="date" class="input" id="lDate" placeholder="${t('label.date')}" value="${todayISO()}" />
        <input class="input" id="lCost" placeholder="${t('logs.cost_optional')}" />
      </div>
      <textarea class="input" id="lNote" placeholder="${t('logs.note_optional')}"></textarea>
      <label class="row" style="gap:8px;">
        <input type="checkbox" id="lCreateExpense" checked />
        <span class="muted">${t('logs.create_expense')}</span>
      </label>
      <div class="row" style="justify-content:flex-end;"><button class="btn" id="saveLog">${t('btn.save')}</button></div>
    </div>
  `, (root)=>{
    $('#saveLog', root).onclick=async ()=>{
      const done_at=$('#lDate', root).value.trim() || todayISO();
      const costRaw=$('#lCost', root).value.trim();
      const cost=costRaw ? Number(costRaw) : null;
      const note=$('#lNote', root).value.trim();
      const create_expense=$('#lCreateExpense', root).checked && cost!==null;
      const planIdToUse = planId || $('#logPlanSelect', root)?.value;
      if(!planIdToUse) return toast(t('logs.select_plan'), 'warning');
      const r=await api.maintenance.logs.create({ plan_id: planIdToUse, done_at, cost, note, create_expense });
      if(!r.ok) return toast(r.error, 'error');

      // Gamification for maintenance log
      await updateStreak();
      await awardXP(10, t('logs.xp_reason'));
      checkAchievementsDebounced();

      closeModal(); toast(t('logs.saved'), 'success'); render();
    };
  });
}

function goalRowHtml(g){
  const pct=g.target_amount?Math.min(100,Math.round((g.saved_amount/g.target_amount)*100)):0;
  const badgeClass=g.status==='active'?'ok':'';
  return `
    <div class="item">
      <div class="itemMain">
        <div class="itemTitle">${escapeHtml(g.title)}</div>
        <div class="itemMeta">
          <span class="badge ${badgeClass}">${g.saved_amount} / ${g.target_amount}</span>
          <span class="badge">${pct}%</span>
          ${g.due_at ? `<span class="badge">${g.due_at}</span>`:''}
        </div>
      </div>
      <div class="itemActions">
        <button class="iconBtn" data-goal-add="${g.id}">${t('goals.add_contribution')}</button>
        <button class="iconBtn" data-goal-open="${g.id}">✎</button>
        <button class="iconBtn" data-goal-del="${g.id}">🗑</button>
      </div>
    </div>
  `;
}

// ========== ASSETS (Объекты) ==========

async function renderAssets(){
  const assetsR = await api.assets.list();
  if(!assetsR.ok) return toast(assetsR.error, 'error');
  const assets = assetsR.data;

  $('#content').innerHTML=`
    <div class="row" style="justify-content:space-between;">
      <div>
        <div class="h1">${t('assets.title')}</div>
        <div class="muted">${t('assets.subtitle')}</div>
      </div>
      <button class="btn" id="addAssetBtn">${t('assets.add')}</button>
    </div>

    <div class="grid" style="margin-top:16px;" id="assetCards"></div>
  `;

  $('#addAssetBtn').onclick = () => openAssetModal();

  const assetCards = $('#assetCards');
  if (assets.length === 0) {
    assetCards.innerHTML = `<div class="card"><div class="cardBody muted">${t('assets.empty')}</div></div>`;
    return;
  }

  assetCards.innerHTML = assets.map(asset => {
    const typeIcon = {
      'home': '🏠',
      'car': '🚗',
      'appliance': '🔧',
      'filter': '💧',
      'other': '📦'
    }[asset.type] || '📦';

    return `
      <div class="card" style="cursor:pointer;" data-asset-id="${asset.id}">
        <div class="cardHeader">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:24px;">${typeIcon}</span>
            <div class="cardTitle">${escapeHtml(asset.name)}</div>
          </div>
          <span class="badge ok">${t('common.ok')}</span>
        </div>
        <div class="cardBody">
          ${asset.note ? `<div class="muted" style="margin-bottom:10px;">${escapeHtml(asset.note)}</div>` : ''}
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div class="muted" id="assetPlansCount${asset.id}">${t('assets.plans_count', { count: '—' })}</div>
            <button class="btn" data-asset-open="${asset.id}">${t('btn.open')}</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Загрузка количества планов для каждого объекта
  assets.forEach(async (asset) => {
    const plansR = await api.maintenance.plans.list({ asset_id: asset.id });
    if (plansR.ok) {
      const countEl = $('#assetPlansCount' + asset.id);
      if (countEl) {
        countEl.textContent = t('assets.plans_count', { count: plansR.data.length });
      }
    }
  });

  // Обработка кликов
  $$('[data-asset-open]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const assetId = btn.dataset.assetOpen;
      state.selectedAssetId = assetId;
      setRoute('asset-detail');
    };
  });

  // Клик по карточке тоже открывает детали
  $$('[data-asset-id]').forEach(card => {
    card.onclick = () => {
      const assetId = card.dataset.assetId;
      state.selectedAssetId = assetId;
      setRoute('asset-detail');
    };
  });
}

async function renderAssetDetail(){
  const assetId = state.selectedAssetId;
  if (!assetId) {
    setRoute('assets');
    return;
  }

  const assetR = await api.assets.get({ id: assetId });
  if (!assetR.ok) {
    toast(assetR.error, 'error');
    setRoute('assets');
    return;
  }

  const asset = assetR.data.asset || assetR.data;
  const typeIcon = {
    'home': '🏠',
    'car': '🚗',
    'appliance': '🔧',
    'filter': '💧',
    'other': '📦'
  }[asset.type] || '📦';

  $('#content').innerHTML = `
    <div class="row" style="justify-content:space-between; align-items:flex-start;">
      <div>
        <button class="btn" id="backToAssets">${t('assets.back')}</button>
      </div>
      <div class="row">
        <button class="btn" id="editAssetBtn">${t('btn.edit')}</button>
        <button class="btn" id="addPlanBtn">${t('plans.add')}</button>
        <button class="btn" id="addDocumentBtn">${t('documents.add')}</button>
      </div>
    </div>

    <div class="card" style="margin-top:12px;">
      <div class="cardHeader">
        <div style="display:flex; align-items:center; gap:12px;">
          <span style="font-size:32px;">${typeIcon}</span>
          <div>
            <div class="h1" style="margin:0;">${escapeHtml(asset.name)}</div>
            <div class="muted">${t(`assets.type.${asset.type || 'other'}`)}</div>
          </div>
        </div>
      </div>
      ${asset.note ? `<div class="cardBody"><div>${escapeHtml(asset.note)}</div></div>` : ''}
    </div>

    <div class="grid" style="margin-top:16px;">
      <div class="card">
        <div class="cardHeader">
          <div class="cardTitle">${t('maintenance.plans')}</div>
          <span class="badge" id="planCount">—</span>
        </div>
        <div class="cardBody"><div class="list" id="planList"></div></div>
      </div>

      <div class="card" style="grid-column: span 2;">
        <div class="cardHeader">
          <div class="cardTitle">${t('maintenance.logs')}</div>
          <span class="badge" id="logCount">—</span>
        </div>
        <div class="cardBody"><div class="list" id="logList"></div></div>
      </div>
    </div>

    <div class="card" style="margin-top:16px;">
      <div class="cardHeader">
        <div class="cardTitle">${t('assets.documents')}</div>
        <span class="badge" id="docCount">—</span>
      </div>
      <div class="cardBody"><div class="list" id="docList"></div></div>
    </div>
  `;

  $('#backToAssets').onclick = () => setRoute('assets');
  $('#editAssetBtn').onclick = () => openAssetModal(asset);
  $('#addPlanBtn').onclick = () => openPlanModal({ asset_id: assetId });
  $('#addDocumentBtn').onclick = async () => {
    const fileR = await api.documents.pickFile();
    if (!fileR.ok) return;
    const attachR = await api.documents.attach({
      file_path: fileR.data.path,
      title: fileR.data.name,
      link: `asset:${assetId}`,
      tag_ids: []
    });
    if (!attachR.ok) return toast(attachR.error, 'error');
    toast(t('documents.added'), 'success');
    renderAssetDetail();
  };

  // Загрузка планов
  const plansR = await api.maintenance.plans.list({ asset_id: assetId });
  const planList = $('#planList');
  if (!plansR.ok) {
    planList.innerHTML = `<div class="muted">${escapeHtml(plansR.error)}</div>`;
  } else {
    $('#planCount').textContent = String(plansR.data.length);
    planList.innerHTML = plansR.data.length
      ? plansR.data.map(planCardHtml).join('')
      : `<div class="muted">${t('maintenance.plans_empty')}</div>`;
    bindPlanActions(planList);
  }

  // Загрузка журнала
  const logsR = await api.maintenance.logs.list({ asset_id: assetId });
  const planMap = plansR.ok ? new Map(plansR.data.map(p=>[p.id, p.title])) : new Map();
  const logList = $('#logList');
  if (!logsR.ok) {
    logList.innerHTML = `<div class="muted">${escapeHtml(logsR.error)}</div>`;
  } else {
    $('#logCount').textContent = String(logsR.data.length);
    logList.innerHTML = logsR.data.length
      ? logsR.data.slice(0, 20).map(l => logRowHtml(l, planMap.get(l.plan_id))).join('')
      : `<div class="muted">${t('maintenance.logs_empty')}</div>`;
    bindLogActions(logList);
  }

  // Загрузка документов
  const docsR = await api.documents.list({ link: `asset:${assetId}` });
  const docList = $('#docList');
  if (!docsR.ok) {
    docList.innerHTML = `<div class="muted">${escapeHtml(docsR.error)}</div>`;
  } else {
    $('#docCount').textContent = String(docsR.data.length);
    docList.innerHTML = docsR.data.length
      ? docsR.data.map(doc => `
          <div class="item">
            <div class="itemMain">
              <div class="itemTitle">${escapeHtml(doc.title)}</div>
              <div class="itemMeta">
                <span class="muted">${doc.created_at}</span>
              </div>
            </div>
            <div class="itemActions">
              <button class="iconBtn" data-doc-open="${doc.id}">📄</button>
              <button class="iconBtn" data-doc-del="${doc.id}">🗑</button>
            </div>
          </div>
        `).join('')
      : `<div class="muted">${t('documents.empty')}</div>`;

    $$('[data-doc-open]', docList).forEach(b => {
      b.onclick = async () => {
        const r = await api.documents.open({ id: b.dataset.docOpen });
        if (!r.ok) toast(r.error, 'error');
      };
    });

    $$('[data-doc-del]', docList).forEach(b => {
      b.onclick = async () => {
        if (!confirm(t('documents.delete_confirm'))) return;
        const r = await api.documents.delete({ id: b.dataset.docDel });
        if (!r.ok) return toast(r.error, 'error');
        toast(t('documents.deleted'), 'success');
        renderAssetDetail();
      };
    });
  }
}

async function renderGoals(opts){
  const showArchived = !!state.goalsShowArchived;
  const r=await api.goals.list({ status: showArchived ? 'all' : 'active' });
  $('#content').innerHTML=`
    <div class="row" style="justify-content:space-between;">
      <div>
        <div class="h1">${t('goals.title')}</div>
        <div class="muted">${t('goals.subtitle')}</div>
      </div>
      <div class="row" style="gap:8px;">
        <label style="display:flex; align-items:center; gap:8px;">
          <input type="checkbox" id="goalsShowArchived" ${showArchived ? 'checked' : ''} />
          <span class="muted">${t('goals.show_archived')}</span>
        </label>
        <button class="btn" id="addGoalBtn">${t('goals.add')}</button>
      </div>
    </div>
    <div class="list" id="goalList" style="margin-top:12px;"></div>
  `;
  $('#addGoalBtn').onclick=()=>openGoalModal();
  $('#goalsShowArchived').onchange=()=>{
    state.goalsShowArchived = $('#goalsShowArchived').checked;
    renderGoals();
  };
  const list=$('#goalList');
  if(!r.ok) return list.innerHTML=`<div class="muted">${escapeHtml(r.error)}</div>`;
  if(!r.data.length) return list.innerHTML=`<div class="muted">${t('goals.empty')}</div>`;
  list.innerHTML=r.data.map(goalRowHtml).join('');
  $$('[data-goal-open]', list).forEach(b=>b.onclick=()=>openGoalModal(r.data.find(x=>x.id===b.dataset.goalOpen)));
  $$('[data-goal-add]', list).forEach(b=>b.onclick=()=>openContributionModal(b.dataset.goalAdd));
  $$('[data-goal-del]', list).forEach(b=>b.onclick=async ()=>{
    if(!confirm(t('goals.delete_confirm'))) return;
    const rr=await api.goals.update({ id:b.dataset.goalDel, patch:{ status:'archived' }});
    if(!rr.ok) return toast(rr.error);
    toast(t('goals.archived')); render();
  });
  if(opts?.openId){
    const g=r.data.find(x=>x.id===opts.openId);
    if(g) openGoalModal(g);
  }
}
function openGoalModal(existing){
  const g=existing || { title:'', target_amount:0, saved_amount:0, due_at:'', status:'active', note:'' };
  openModal(existing ? t('goals.edit_title') : t('goals.new_title'), `
    <div class="form">
      <div class="formRow">
        <input class="input" id="gTitle" placeholder="${t('label.title')}" value="${escapeHtml(g.title)}" />
        <input class="input" id="gTarget" placeholder="${t('label.amount')}" value="${escapeHtml(String(g.target_amount||0))}" />
      </div>
      <div class="formRow">
        <input class="input" id="gSaved" placeholder="${t('goals.saved_amount')}" value="${escapeHtml(String(g.saved_amount||0))}" />
        <input type="date" class="input" id="gDue" placeholder="${t('goals.due_optional')}" value="${escapeHtml(g.due_at||'')}" />
      </div>
      <textarea class="input" id="gNote" placeholder="${t('label.notes')}">${escapeHtml(g.note||'')}</textarea>
      <div class="row" style="justify-content:flex-end;"><button class="btn" id="saveGoal">${t('btn.save')}</button></div>
    </div>
  `, (root)=>{
    $('#saveGoal', root).onclick=async ()=>{
      const titleField = $('#gTitle', root);
      const targetField = $('#gTarget', root);
      const savedField = $('#gSaved', root);

      const title = titleField.value.trim();
      const target_amount_str = targetField.value.trim();
      const saved_amount_str = savedField.value.trim();
      const target_amount = Number(target_amount_str || 0);
      const saved_amount = Number(saved_amount_str || 0);
      const due_at = $('#gDue', root).value.trim() || null;
      const note = $('#gNote', root).value.trim();

      // Validation
      if (!validators.isRequired(title)) {
        markFieldInvalid(titleField, t('validation.title_required'));
        return;
      }

      if (target_amount_str && !validators.isPositiveNumber(target_amount_str)) {
        markFieldInvalid(targetField, t('goals.target_positive'));
        return;
      }

      if (saved_amount_str && saved_amount < 0) {
        markFieldInvalid(savedField, t('goals.saved_non_negative'));
        return;
      }

      if (target_amount_str && saved_amount_str && !validators.isGreaterThan(target_amount, saved_amount)) {
        markFieldInvalid(targetField, t('goals.target_gt_saved'));
        return;
      }

      const payload = { title, target_amount, saved_amount, due_at, note, status: g.status || 'active' };
      if(existing){
        const r=await api.goals.update({ id: existing.id, patch: payload });
        if(!r.ok) return toast(r.error, 'error');
      } else {
        const r=await api.goals.create(payload);
        if(!r.ok) return toast(r.error, 'error');
      }
      closeModal(); toast(t('msg.saved'), 'success'); render();
    };
  });
}
function openContributionModal(goalId){
  openModal(t('goals.contribution_title'), `
    <div class="form">
      <div class="formRow">
        <input class="input" id="cAmount" placeholder="${t('label.amount')}" />
        <input type="date" class="input" id="cDate" placeholder="${t('label.date')}" value="${todayISO()}" />
      </div>
      <input class="input" id="cNote" placeholder="${t('logs.note_optional')}" />
      <div class="row" style="justify-content:flex-end;"><button class="btn" id="saveContrib">${t('btn.save')}</button></div>
    </div>
  `, (root)=>{
    $('#saveContrib', root).onclick=async ()=>{
      const amountField = $('#cAmount', root);
      const amount_str = amountField.value.trim();
      const amount = Number(amount_str || 0);
      const date = $('#cDate', root).value.trim() || todayISO();
      const note = $('#cNote', root).value.trim();

      // Validation
      if (!amount_str || !validators.isPositiveNumber(amount_str)) {
        markFieldInvalid(amountField, t('goals.amount_positive'));
        return;
      }

      const r=await api.goals.addContribution({ goal_id:goalId, amount, date, note });
      if(!r.ok) return toast(r.error, 'error');

      // Check if goal is achieved
      const updatedGoal = r.data;
      if (updatedGoal && updatedGoal.saved_amount >= updatedGoal.target_amount && updatedGoal.status === 'active') {
        // Mark goal as achieved
        await api.goals.setStatus({ id: goalId, status: 'achieved' });

        // Award XP
        await updateStreak();
        await awardXP(50, t('goals.achieved_xp'));

        // Check for first_goal achievement
        checkAchievementsDebounced();

        toast(t('goals.achieved_toast'), 'success');
      } else {
        toast(t('logs.saved'), 'success');
      }

      closeModal(); render();
    };
  });
}

function docRowHtml(d){
  const tags=(d.tag_ids||[]).map(id=>state.tags.find(t=>t.id===id)?.name).filter(Boolean).slice(0,3);
  return `
    <div class="item">
      <div class="itemMain">
        <div class="itemTitle">${escapeHtml(d.title || d.file_name)}</div>
        <div class="itemMeta">
          <span class="badge">${escapeHtml(d.file_ext || '')}</span>
          ${tags.map(t=>`<span class="badge">${escapeHtml(t)}</span>`).join('')}
        </div>
      </div>
      <div class="itemActions">
        <button class="iconBtn" data-doc-open="${d.id}">${t('btn.open')}</button>
        <button class="iconBtn" data-doc-del="${d.id}">🗑</button>
      </div>
    </div>
  `;

}
async function renderDocuments(){
  $('#content').innerHTML=`
    <div class="row" style="justify-content:space-between;">
      <div>
        <div class="h1">${t('documents.title')}</div>
        <div class="muted">${t('documents.subtitle')}</div>
      </div>
      <button class="btn" id="addDocBtn">${t('documents.add')}</button>
    </div>
    <div class="card" style="margin-top:12px;">
      <div class="row">
        <input class="input" id="docQ" placeholder="${t('documents.search_placeholder')}" />
        <button class="btn" id="docRefresh">${t('documents.refresh')}</button>
      </div>
    </div>
    <div class="list" id="docList" style="margin-top:12px;"></div>
  `;
  $('#addDocBtn').onclick=()=>openDocModal();
  $('#docRefresh').onclick=()=>refreshDocs();
  $('#docQ').oninput=()=>{ clearTimeout(refreshDocs._t); refreshDocs._t=setTimeout(refreshDocs,200); };

  async function refreshDocs(){
    const q=$('#docQ').value.trim();
    const r=await api.documents.list({ q });
    const list=$('#docList');
    if(!r.ok) return list.innerHTML=`<div class="muted">${escapeHtml(r.error)}</div>`;
    if(!r.data.length) return list.innerHTML=`<div class="muted">${t('documents.empty')}</div>`;
    list.innerHTML=r.data.slice(0,60).map(docRowHtml).join('');
    $$('[data-doc-open]', list).forEach(b=>b.onclick=async ()=>{
      const rr=await api.documents.open({ id:b.dataset.docOpen });
      if(!rr.ok) toast(rr.error);
    });
    $$('[data-doc-del]', list).forEach(b=>b.onclick=async ()=>{
      if(!confirm(t('documents.delete_confirm'))) return;
      const rr=await api.documents.delete({ id:b.dataset.docDel });
      if(!rr.ok) return toast(rr.error);
      toast(t('documents.deleted'), 'success'); refreshDocs();
    });
  }

  await refreshDocs();
}
async function openDocModal(){
  const picked=await api.documents.pickFile();
  if(!picked.ok) return toast(picked.error);
  if(!picked.data) return;
  const info=picked.data;

  openModal(t('documents.modal_add'), `
    <div class="form">
      <div class="card">
        <div class="cardTitle">${escapeHtml(info.fileName)}</div>
        <div class="muted" style="margin-top:6px;">${t('documents.modal_desc')}</div>
      </div>
      <input class="input" id="dTitle" placeholder="${t('label.title')}" value="${escapeHtml(info.fileName)}" />
      <div id="dTags"></div>
      <div class="row" style="justify-content:flex-end;"><button class="btn" id="saveDoc">${t('btn.save')}</button></div>
    </div>
  `, (root)=>{
    const tagsRoot=$('#dTags', root);
    tagsRoot.innerHTML=tagPickerHtml([]);
    $('#addTagBtn', tagsRoot).onclick=async ()=>{
      const name=$('#newTagName', tagsRoot).value.trim(); if(!name) return;
      const r=await api.tags.create({ name }); if(!r.ok) return toast(r.error, 'error');
      await loadTags(); closeModal(); openDocModal();
    };
    $('#newTagName', tagsRoot).onkeydown=(e)=>{ if(e.key==='Enter') $('#addTagBtn', tagsRoot).click(); };

    $('#saveDoc', root).onclick=async ()=>{
      const title=$('#dTitle', root).value.trim();
      const tag_ids=readTagPicker(tagsRoot);
      const r=await api.documents.attach({ tempPath: info.tempPath, fileName: info.fileName, title, tag_ids, linked:null });
      if(!r.ok) return toast(r.error, 'error');
      closeModal(); toast(t('documents.added'), 'success'); renderDocuments();
    };
  });
}

async function renderNotificationSettings() {
  const r = await api.notifications.getSettings();
  if (!r.ok) {
    showToast(t('notifications.load_error'), 'error');
    return '';
  }

  const s = r.data;

  return `
    <div class="cardHeader">
      <div class="cardTitle">${t('notifications.title')}</div>
    </div>
    <div class="cardBody">
      <div class="setting-row" style="margin-bottom:12px;">
        <label style="display:flex; align-items:center;">
          <input type="checkbox" id="notif-enabled" ${s.enabled ? 'checked' : ''} style="margin-right:8px;">
          ${t('notifications.enable')}
        </label>
      </div>

      <div class="setting-row" style="margin-bottom:12px;">
        <label style="margin-bottom:4px; display:block;">${t('notifications.quiet_hours')}</label>
        <div style="display:flex; align-items:center; gap:8px;">
          <input type="number" id="notif-quiet-start" value="${s.quiet_start}" min="0" max="23" style="width:60px;" class="input">
          <span>:00 —</span>
          <input type="number" id="notif-quiet-end" value="${s.quiet_end}" min="0" max="23" style="width:60px;" class="input">
          <span>:00</span>
        </div>
      </div>

      <h4 style="margin:16px 0 8px 0;">${t('notifications.types')}</h4>

      <div class="setting-row" style="margin-bottom:8px;">
        <label style="display:flex; align-items:center;">
          <input type="checkbox" id="notif-tasks" ${s.tasks ? 'checked' : ''} style="margin-right:8px;">
          ${t('notifications.tasks')}
        </label>
      </div>

      <div class="setting-row" style="margin-bottom:8px;">
        <label style="display:flex; align-items:center;">
          <input type="checkbox" id="notif-meters" ${s.meters ? 'checked' : ''} style="margin-right:8px;">
          ${t('notifications.meters')}
        </label>
      </div>

      <div class="setting-row" style="margin-bottom:8px;">
        <label style="display:flex; align-items:center;">
          <input type="checkbox" id="notif-warranty" ${s.warranty ? 'checked' : ''} style="margin-right:8px;">
          ${t('notifications.warranty')}
        </label>
      </div>

      <div class="setting-row" style="margin-bottom:16px;">
        <label style="display:flex; align-items:center;">
          <input type="checkbox" id="notif-maintenance" ${s.maintenance ? 'checked' : ''} style="margin-right:8px;">
          ${t('notifications.maintenance')}
        </label>
      </div>

      <div class="setting-actions" style="display:flex; gap:8px;">
        <button data-action="save-notifications" class="btn">
          ${t('notifications.save')}
        </button>
        <button data-action="test-notification" class="btn">
          ${t('notifications.test')}
        </button>
      </div>
    </div>
  `;
}

async function saveNotificationSettings() {
  const settings = {
    notifications_enabled: $('#notif-enabled').checked,
    notifications_quiet_start: parseInt($('#notif-quiet-start').value),
    notifications_quiet_end: parseInt($('#notif-quiet-end').value),
    notifications_tasks: $('#notif-tasks').checked,
    notifications_meters: $('#notif-meters').checked,
    notifications_warranty: $('#notif-warranty').checked,
    notifications_maintenance: $('#notif-maintenance').checked
  };

  const r = await api.notifications.updateSettings(settings);
  if (r.ok) {
    toast(t('notifications.saved'), 'success');
  } else {
    toast(t('notifications.save_error'), 'error');
  }
}

async function testNotification() {
  await api.notifications.test();
  toast(t('notifications.sent'), 'info');
}

// ===== UTILITY CALCULATOR =====
function getMeterIcon(type) {
  const icons = {
    cold_water: '🚰',
    hot_water: '♨️',
    gas: '🔥',
    electricity: '⚡',
    heating: '🌡️'
  };
  return icons[type] || '📊';
}

function formatMonth(month) {
  const [year, m] = month.split('-');
  const months = [
    t('date.month_jan'),
    t('date.month_feb'),
    t('date.month_mar'),
    t('date.month_apr'),
    t('date.month_may'),
    t('date.month_jun'),
    t('date.month_jul'),
    t('date.month_aug'),
    t('date.month_sep'),
    t('date.month_oct'),
    t('date.month_nov'),
    t('date.month_dec')
  ];
  return `${months[parseInt(m) - 1]} ${year}`;
}

function formatMonthShort(month) {
  const [year, m] = month.split('-');
  const months = [
    t('date.month_short_jan'),
    t('date.month_short_feb'),
    t('date.month_short_mar'),
    t('date.month_short_apr'),
    t('date.month_short_may'),
    t('date.month_short_jun'),
    t('date.month_short_jul'),
    t('date.month_short_aug'),
    t('date.month_short_sep'),
    t('date.month_short_oct'),
    t('date.month_short_nov'),
    t('date.month_short_dec')
  ];
  return months[parseInt(m) - 1];
}

async function saveTariff(type) {
  const input = document.getElementById(`tariff-${type}`);
  const price = parseFloat(input.value);

  if (isNaN(price) || price < 0) {
    toast(t('tariffs.invalid_price'), 'error');
    return;
  }

  const r = await api.tariffs.update(type, price);
  if (r.ok) {
    toast(t('tariffs.saved'), 'success');
  } else {
    toast(t('tariffs.save_error'), 'error');
  }
}

async function renderUtilityCalculator() {
  const currentMonth = new Date().toISOString().slice(0, 7);

  const [calcResult, historyResult, tariffsResult] = await Promise.all([
    api.utility.calculateMonth(currentMonth),
    api.utility.getHistory(6),
    api.tariffs.list()
  ]);

  const calc = calcResult.ok ? calcResult.data : { items: [], total: 0 };
  const history = historyResult.ok ? historyResult.data : [];
  const tariffs = tariffsResult.ok ? tariffsResult.data : [];

  $('#content').innerHTML = `
    <div class="utility-calculator">
      <div class="h1">💰 ${t('utility.title')}</div>

      <!-- Текущий месяц -->
      <section class="calc-section card">
        <div class="cardTitle">${t('utility.calculation_for', { month: formatMonth(currentMonth) })}</div>

        ${calc.items.length === 0 ? `
          <div class="cardBody">
            <p class="muted">${t('utility.no_readings')}</p>
            <button class="btn" id="goToMetersBtn">${t('utility.add_readings')}</button>
          </div>
        ` : `
          <div class="cardBody">
            <table class="utility-table">
              <thead>
                <tr>
                  <th>${t('utility.service')}</th>
                  <th>${t('utility.consumption')}</th>
                  <th>${t('utility.rate')}</th>
                  <th style="text-align:right;">${t('utility.amount')}</th>
                </tr>
              </thead>
              <tbody>
                ${calc.items.map(item => `
                  <tr>
                    <td>${getMeterIcon(item.meter_type)} ${escapeHtml(item.meter_name)}</td>
                    <td>${item.consumption} ${item.unit}</td>
                    <td>${item.price_per_unit} ₽/${item.unit}</td>
                    <td style="text-align:right; font-family:monospace;">${formatMoneyRUB(item.total_cost)}</td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr style="font-weight:700;">
                  <td colspan="3">${t('utility.total')}</td>
                  <td style="text-align:right; font-family:monospace; color:var(--accent); font-size:18px;">
                    ${formatMoneyRUB(calc.total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        `}
      </section>

      <!-- История по месяцам -->
      <section class="calc-section card">
        <div class="cardTitle">📊 ${t('utility.history_title')}</div>
        <div class="cardBody">
          ${history.length === 0 ? `
            <p class="muted">${t('utility.history_empty')}</p>
          ` : `
            <div class="history-chart">
              ${history.map(h => `
                <div class="history-bar">
                  <div class="bar-value">${formatMoneyRUB(h.total)}</div>
                  <div class="bar-fill" style="--height: ${(h.total / Math.max(...history.map(x => x.total))) * 100}%"></div>
                  <div class="bar-label">${formatMonthShort(h.month)}</div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </section>

      <!-- Настройка тарифов -->
      <section class="calc-section card">
        <div class="cardTitle">⚙️ ${t('utility.tariffs_title')}</div>
        <div class="cardBody">
          <p class="muted" style="margin-bottom:16px;">${t('utility.tariffs_desc')}</p>

          <div class="tariffs-grid">
            ${tariffs.map(t => `
              <div class="tariff-item">
                <label>${getMeterIcon(t.type)} ${escapeHtml(t.name)}</label>
                <div class="tariff-input">
                  <input type="number"
                         id="tariff-${t.type}"
                         value="${t.price}"
                         step="0.01"
                         min="0"
                         class="input">
                  <span>₽ / ${t.unit}</span>
                </div>
                <button class="btn saveTariffBtn" data-tariff-type="${t.type}">
                  ${t('btn.save')}
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      </section>
    </div>
  `;

  // Attach event listeners
  const goToMetersBtn = $('#goToMetersBtn');
  if (goToMetersBtn) {
    goToMetersBtn.onclick = () => setRoute('meters');
  }

  $$('.saveTariffBtn').forEach(btn => {
    btn.onclick = () => saveTariff(btn.dataset.tariffType);
  });
}

// ===== ANALYTICS =====
let productivityChart = null;
let costsChart = null;

async function renderAnalytics() {
  const [productivityRes, costsRes, goalsRes, summaryRes] = await Promise.all([
    api.analytics.productivity(30),
    api.analytics.maintenanceCosts(6),
    api.analytics.goals(),
    api.analytics.summary()
  ]);

  const productivity = productivityRes.ok ? productivityRes.data : [];
  const costs = costsRes.ok ? costsRes.data : [];
  const goals = goalsRes.ok ? goalsRes.data : {};
  const summary = summaryRes.ok ? summaryRes.data : {};

  $('#content').innerHTML = `
    <div class="analytics-page">
      <div class="h1">📈 ${t('analytics.title')}</div>

      <!-- Сводка -->
      <section class="analytics-section summary-cards card">
        <div class="summary-card">
          <div class="summary-icon">📋</div>
          <div class="summary-value">${summary.tasks?.completed || 0}</div>
          <div class="summary-label">${t('analytics.summary.tasks_completed')}</div>
        </div>
        <div class="summary-card">
          <div class="summary-icon">📦</div>
          <div class="summary-value">${formatMoneyRUB(summary.inventory?.totalValue || 0)}</div>
          <div class="summary-label">${t('analytics.summary.inventory_value')}</div>
        </div>
        <div class="summary-card">
          <div class="summary-icon">🏆</div>
          <div class="summary-value">${summary.gamification?.level || 1}</div>
          <div class="summary-label">${t('analytics.summary.level')}</div>
        </div>
        <div class="summary-card">
          <div class="summary-icon">🔥</div>
          <div class="summary-value">${summary.gamification?.streak || 0}</div>
          <div class="summary-label">${t('analytics.summary.streak_days')}</div>
        </div>
      </section>

      <!-- График продуктивности -->
      <section class="analytics-section card">
        <div class="cardTitle">📊 ${t('analytics.productivity_title')}</div>
        <div class="cardBody">
          <div class="chart-container">
            <canvas id="productivityChart"></canvas>
          </div>
        </div>
      </section>

      <!-- Расходы на обслуживание -->
      <section class="analytics-section card">
        <div class="cardTitle">💰 ${t('analytics.maintenance_costs_title')}</div>
        <div class="cardBody">
          ${costs.length === 0 ? `
            <p class="muted">${t('analytics.costs_empty')}</p>
          ` : `
            <div class="chart-container chart-small">
              <canvas id="costsChart"></canvas>
            </div>
          `}
        </div>
      </section>

      <!-- Цели -->
      <section class="analytics-section card">
        <div class="cardTitle">🎯 ${t('analytics.goals_title')}</div>
        <div class="cardBody">
          ${(goals.goals?.length || 0) === 0 ? `
            <p class="muted">${t('analytics.goals_empty')}</p>
          ` : `
            <div class="goals-summary" style="margin-bottom:16px;">
              <p>${t('analytics.goals_summary', { saved: formatMoneyRUB(goals.totalSaved || 0), target: formatMoneyRUB(goals.totalTarget || 0) })}</p>
            </div>
            <div class="goals-list">
              ${(goals.goals || []).map(g => `
                <div class="goal-analytics-item">
                  <div class="goal-info">
                    <span class="goal-title">${escapeHtml(g.title)}</span>
                    <span class="goal-remaining">${t('analytics.goals_remaining', { value: formatMoneyRUB(g.remaining) })}</span>
                  </div>
                  <div class="goal-bar">
                    <div class="goal-progress" style="width: ${g.progress}%"></div>
                  </div>
                  <span class="goal-percent">${g.progress}%</span>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </section>
    </div>
  `;

  // Initialize charts after rendering
  setTimeout(initAnalyticsCharts, 100);
}

async function initAnalyticsCharts() {
  const productivityRes = await api.analytics.productivity(30);
  const costsRes = await api.analytics.maintenanceCosts(6);

  if (productivityRes.ok) {
    const ctx = document.getElementById('productivityChart');
    if (ctx) {
      if (productivityChart) productivityChart.destroy();

      productivityChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: productivityRes.data.map(d => d.date.slice(5)), // MM-DD
          datasets: [{
            label: t('analytics.completed_label'),
            data: productivityRes.data.map(d => d.completed),
            borderColor: '#48bb78',
            backgroundColor: 'rgba(72, 187, 120, 0.1)',
            fill: true,
            tension: 0.3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: { beginAtZero: true }
          }
        }
      });
    }
  }

  if (costsRes.ok && costsRes.data.length > 0) {
    const ctx = document.getElementById('costsChart');
    if (ctx) {
      if (costsChart) costsChart.destroy();

      const categoryNames = {
        home: t('analytics.category.home'),
        car: t('analytics.category.car'),
        appliance: t('analytics.category.appliance'),
        garden: t('analytics.category.garden'),
        other: t('analytics.category.other')
      };

      costsChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: costsRes.data.map(d => categoryNames[d.category] || d.category),
          datasets: [{
            data: costsRes.data.map(d => d.total),
            backgroundColor: ['#4299e1', '#48bb78', '#ed8936', '#9f7aea', '#718096']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false
        }
      });
    }
  }
}

async function renderSettings(){
  const [profilesR, tagsR] = await Promise.all([api.profiles.list(), api.tags.list()]);

  const notifSettingsHTML = await renderNotificationSettings();

  $('#content').innerHTML=`
    <div class="h1">${t('settings.title')}</div>
    <div class="muted">${t('settings.subtitle')}</div>
    <div class="grid" style="margin-top:12px;">
      <div class="card">
        <div class="cardHeader">
          <div class="cardTitle">${t('settings.profiles')}</div>
          <button class="btn" id="addProfile">${t('settings.add_profile')}</button>
        </div>
        <div class="cardBody" id="profileList"></div>
      </div>

      <div class="card" style="grid-column: span 2;">
        <div class="cardHeader">
          <div class="cardTitle">${t('settings.tags')}</div>
          <button class="btn" id="addTag">${t('settings.add_tag')}</button>
        </div>
        <div class="cardBody" id="tagList"></div>
      </div>

      <div class="card" style="grid-column: span 3;">
        ${notifSettingsHTML}
      </div>

      <div class="card">
        <div class="cardHeader">
          <div class="cardTitle">${t('settings.menu_title')}</div>
        </div>
        <div class="cardBody">
          <p class="muted">${t('settings.menu_desc')}</p>
          <button class="btn" id="openMenuSettingsBtn" style="margin-top:12px;">${t('settings.menu_button')}</button>
        </div>
      </div>

      ${renderLanguageSwitcherCard()}

      <div class="card">
        <div class="cardHeader">
          <div class="cardTitle">${t('settings.theme_title')}</div>
        </div>
        <div class="cardBody">
          <p class="muted">${t('settings.theme_desc')}</p>
          <div class="formRow" style="margin-top:12px; flex-direction:column; gap:8px;">
            <label style="display:flex; align-items:center; gap:8px;">
              <input type="radio" name="theme" value="light"
                     ${(state.userStats?.theme || 'dark') === 'light' ? 'checked' : ''}
                     onchange="setTheme('light')">
              <span>${t('settings.theme_light')}</span>
            </label>
            <label style="display:flex; align-items:center; gap:8px;">
              <input type="radio" name="theme" value="dark"
                     ${(state.userStats?.theme || 'dark') === 'dark' ? 'checked' : ''}
                     onchange="setTheme('dark')">
              <span>${t('settings.theme_dark')}</span>
            </label>
            <label style="display:flex; align-items:center; gap:8px;">
              <input type="radio" name="theme" value="auto"
                     ${(state.userStats?.theme || 'dark') === 'auto' ? 'checked' : ''}
                     onchange="setTheme('auto')">
              <span>${t('settings.theme_auto')}</span>
            </label>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="cardHeader">
          <div class="cardTitle">${t('settings.telegram_title')}</div>
        </div>
        <div class="cardBody">
          <p class="muted">${t('settings.telegram_desc')}</p>

          <div class="formRow" style="margin-top:12px;">
            <label style="display:flex; align-items:center; gap:8px;">
              <input type="checkbox" id="tg-enabled"
                     ${state.userStats?.telegram_enabled ? 'checked' : ''}
                     onchange="toggleTelegram(this.checked)">
              <span>${t('settings.telegram_enable')}</span>
            </label>
          </div>

          <div id="telegram-config" style="display: ${state.userStats?.telegram_enabled ? 'block' : 'none'}; margin-top:12px;">
            <div class="formRow">
              <label>${t('settings.telegram_bot_token')}</label>
              <input type="text" id="tg-token"
                     value="${state.userStats?.telegram_bot_token || ''}"
                     placeholder="123456:ABC-DEF...">
              <small class="muted">${t('settings.telegram_bot_help')}</small>
            </div>

            <div class="formRow" style="margin-top:8px;">
              <label>${t('settings.telegram_chat_id')}</label>
              <input type="text" id="tg-chat-id"
                     value="${state.userStats?.telegram_chat_id || ''}"
                     placeholder="123456789">
              <small class="muted">${t('settings.telegram_chat_help')}</small>
            </div>

            <div class="formRow" style="margin-top:12px; gap:8px;">
              <button class="btn btn-primary" id="saveTelegramBtn">
                ${t('settings.telegram_save')}
              </button>
              <button class="btn" id="testTelegramBtn">
                ${t('settings.telegram_test')}
              </button>
              <button class="btn" id="sendTelegramSummaryBtn">
                ${t('settings.telegram_summary')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="cardHeader">
          <div class="cardTitle">${t('settings.gamification_title')}</div>
        </div>
        <div class="cardBody">
          <p class="muted">${t('settings.gamification_desc')}</p>

          <div class="formRow" style="margin-top:12px; flex-direction:column; gap:8px;">
            <label style="display:flex; align-items:center; gap:8px;">
              <input type="checkbox" id="gamification-enabled"
                     ${state.userStats?.gamification_enabled ? 'checked' : ''}
                     onchange="toggleGamification(this.checked)">
              <span>${t('settings.gamification_enable')}</span>
            </label>

            <label style="display:flex; align-items:center; gap:8px;">
              <input type="checkbox" id="animations-enabled"
                     ${state.userStats?.animations_enabled ? 'checked' : ''}
                     onchange="toggleAnimations(this.checked)">
              <span>${t('settings.gamification_animations')}</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  `;
  bindLanguageSwitcher($('#content'));
  $('#addProfile').onclick=()=>openProfileModal();
  $('#openMenuSettingsBtn').onclick=()=>openMenuSettings();
  $('#addTag').onclick=()=>openTagModal();

  const pList=$('#profileList');
  if(profilesR.ok){
    pList.innerHTML=profilesR.data.map(p=>`
      <div class="item">
        <div class="itemMain">
          <div class="itemTitle">${escapeHtml(p.icon||'👤')} ${escapeHtml(p.name)}</div>
          <div class="itemMeta">
            ${state.profileId === p.id ? `<span class="badge ok">${t('profiles.active')}</span>` : ''}
            <span class="badge">${p.is_archived ? t('profiles.archived') : ''}</span>
          </div>
        </div>
        <div class="itemActions">
          ${state.profileId === p.id ? '' : `<button class="iconBtn" data-prof-activate="${p.id}" title="${t('profiles.set_active')}">✓</button>`}
          <button class="iconBtn" data-prof-edit="${p.id}">✎</button>
          <button class="iconBtn" data-prof-arch="${p.id}">${p.is_archived?'↩':'🗄'}</button>
          <button class="iconBtn danger" data-prof-del="${p.id}" title="${t('btn.delete')}">🗑</button>
        </div>
      </div>
    `).join('');
    $$('[data-prof-activate]', pList).forEach(b=>b.onclick=()=>{
      state.profileId = b.dataset.profActivate;
      const select = $('#profileSelect');
      if (select) select.value = state.profileId;
      render();
      renderSettings();
    });
    $$('[data-prof-edit]', pList).forEach(b=>b.onclick=()=>openProfileModal(profilesR.data.find(x=>x.id===b.dataset.profEdit)));
    $$('[data-prof-arch]', pList).forEach(b=>b.onclick=async ()=>{
      const p=profilesR.data.find(x=>x.id===b.dataset.profArch);
      const r=await api.profiles.archive({ id:p.id, is_archived: !p.is_archived });
      if(!r.ok) return toast(r.error, 'error');
      await loadProfiles(); toast(t('common.ok'), 'success'); renderSettings();
    });
    $$('[data-prof-del]', pList).forEach(b=>b.onclick=async ()=>{
      const id = b.dataset.profDel;
      if(!confirm(t('profiles.delete_confirm'))) return;
      const r = await api.profiles.delete({ id });
      if(!r.ok) return toast(r.error, 'error');
      if(state.profileId === id) state.profileId = 'all';
      await loadProfiles();
      toast(t('common.deleted'), 'success');
      renderSettings();
    });
  }

  const tList=$('#tagList');
  if(tagsR.ok){
    tList.innerHTML = tagsR.data.length ? tagsR.data.map(t=>`
      <div class="item">
        <div class="itemMain">
          <span class="badge" style="border-color:${t.color};">${escapeHtml(t.name)}</span>
        </div>
        <div class="itemActions">
          <button class="iconBtn" data-tag-del="${t.id}">🗑</button>
        </div>
      </div>
    `).join('') : `<div class="muted">${t('tags.empty')}</div>`;
    $$('[data-tag-del]', tList).forEach(b=>b.onclick=async ()=>{
      if(!confirm(t('tags.delete_confirm'))) return;
      const r=await api.tags.delete({ id:b.dataset.tagDel });
      if(!r.ok) return toast(r.error, 'error');
      await loadTags(); toast(t('common.deleted'), 'success'); renderSettings();
    });
  }

  // Telegram button handlers
  const saveTelegramBtn = $('#saveTelegramBtn');
  if (saveTelegramBtn) {
    saveTelegramBtn.onclick = async () => {
      const enabled = $('#tg-enabled').checked;
      const token = $('#tg-token').value.trim();
      const chatId = $('#tg-chat-id').value.trim();

      // Validate if enabled
      if (enabled) {
        if (!token) {
          return toast(t('telegram.token_required'), 'warning');
        }
        if (!chatId) {
          return toast(t('telegram.chat_id_required'), 'warning');
        }
        // Basic token format validation
        if (!token.includes(':')) {
          return toast(t('telegram.token_invalid'), 'warning');
        }
        // Basic chat ID validation (should be numeric or start with -)
        if (!/^-?\d+$/.test(chatId)) {
          return toast(t('telegram.chat_id_invalid'), 'warning');
        }
      }

      const settings = {
        telegram_enabled: enabled,
        telegram_bot_token: token,
        telegram_chat_id: chatId
      };
      const r = await api.telegram.updateSettings(settings);
      if (r.ok) {
        state.userStats.telegram_enabled = settings.telegram_enabled;
        state.userStats.telegram_bot_token = settings.telegram_bot_token;
        state.userStats.telegram_chat_id = settings.telegram_chat_id;
        toast(t('telegram.settings_saved'), 'success');
      } else {
        toast(t('telegram.save_error', { error: r.error || t('common.unknown_error') }), 'error');
      }
    };
  }

  const testTelegramBtn = $('#testTelegramBtn');
  if (testTelegramBtn) {
    testTelegramBtn.onclick = async () => {
      const r = await api.telegram.test();
      if (r.ok) {
        toast(t('telegram.test_sent'), 'success');
      } else {
        toast(t('telegram.test_error', { error: r.error || t('telegram.send_failed') }), 'error');
      }
    };
  }

  const sendTelegramSummaryBtn = $('#sendTelegramSummaryBtn');
  if (sendTelegramSummaryBtn) {
    sendTelegramSummaryBtn.onclick = async () => {
      const r = await api.telegram.sendSummary();
      if (r.ok) {
        toast(t('telegram.summary_sent'), 'success');
      } else {
        toast(t('telegram.summary_error', { error: r.error || t('common.unknown_error') }), 'error');
      }
    };
  }

  // Notification settings handlers
  const saveNotifBtn = document.querySelector('[data-action="save-notifications"]');
  if (saveNotifBtn) {
    saveNotifBtn.onclick = () => saveNotificationSettings();
  }

  const testNotifBtn = document.querySelector('[data-action="test-notification"]');
  if (testNotifBtn) {
    testNotifBtn.onclick = () => testNotification();
  }
}
function openProfileModal(existing){
  const p=existing || { name:'', color:'#93c5fd', icon:'👤' };
  openModal(existing ? t('profiles.edit_title') : t('profiles.new_title'), `
    <div class="form">
      <div class="formRow">
        <input class="input" id="pName" placeholder="${t('label.name')}" value="${escapeHtml(p.name)}" />
        <input class="input" id="pIcon" placeholder="${t('profiles.icon_placeholder')}" value="${escapeHtml(p.icon||'👤')}" />
      </div>
      <input class="input" id="pColor" placeholder="${t('profiles.color_placeholder')}" value="${escapeHtml(p.color||'#93c5fd')}" />
      <div class="row" style="justify-content:flex-end;"><button class="btn" id="saveProf">${t('btn.save')}</button></div>
    </div>
  `, (root)=>{
    $('#saveProf', root).onclick=async ()=>{
      const name=$('#pName', root).value.trim();
      const icon=$('#pIcon', root).value.trim() || '👤';
      const color=$('#pColor', root).value.trim() || '#93c5fd';
      if(!name) return toast(t('profiles.name_required'), 'warning');
      if(existing){
        const r=await api.profiles.update({ id: existing.id, patch:{ name, icon, color }});
        if(!r.ok) return toast(r.error, 'error');
      } else {
        const r=await api.profiles.create({ name, icon, color });
        if(!r.ok) return toast(r.error, 'error');
      }
      closeModal(); await loadProfiles(); toast(t('msg.saved'), 'success'); renderSettings();
    };
  });
}
function openTagModal(){
  openModal(t('tags.new_title'), `
    <div class="form">
      <input class="input" id="tName" placeholder="${t('tags.name_placeholder')}" />
      <input class="input" id="tColor" placeholder="${t('tags.color_placeholder')}" value="#fca5a5" />
      <div class="row" style="justify-content:flex-end;"><button class="btn" id="saveTag">${t('btn.save')}</button></div>
    </div>
  `, (root)=>{
    $('#saveTag', root).onclick=async ()=>{
      const name=$('#tName', root).value.trim();
      const color=$('#tColor', root).value.trim();
      if(!name) return toast(t('tags.name_required'), 'warning');
      const r=await api.tags.create({ name, color });
      if(!r.ok) return toast(r.error, 'error');
      closeModal(); await loadTags(); toast(t('documents.added'), 'success'); renderSettings();
    };
  });
}

async function renderBackup(){
  $('#content').innerHTML=`
    <div class="h1">${t('backup.title')}</div>
    <div class="muted">${t('backup.subtitle')}</div>
    <div class="grid" style="margin-top:12px;">
      <div class="card">
        <div class="cardHeader"><div class="cardTitle">${t('backup.export_title')}</div></div>
        <div class="cardBody"><button class="btn" id="exportBtn">${t('backup.export_button')}</button></div>
      </div>
      <div class="card">
        <div class="cardHeader"><div class="cardTitle">${t('backup.import_title')}</div></div>
        <div class="cardBody"><button class="btn danger" id="importBtn">${t('backup.import_button')}</button></div>
      </div>
    </div>
  `;
  $('#exportBtn').onclick=async ()=>{
    const pick=await api.backup.exportPickPath();
    if(!pick.ok) return toast(pick.error);
    if(!pick.data) return;
    const r=await api.backup.exportTo({ targetPath: pick.data.targetPath });
    if(!r.ok) return toast(r.error, 'error');
    toast(t('backup.export_ready'));
  };
  $('#importBtn').onclick=async ()=>{
    if(!confirm(t('backup.import_confirm'))) return;
    const pick=await api.backup.importPickFile();
    if(!pick.ok) return toast(pick.error);
    if(!pick.data) return;
    const r=await api.backup.importFrom({ sourcePath: pick.data.sourcePath });
    if(!r.ok) return toast(r.error, 'error');

    // Reload all state after import
    await loadProfiles();
    await loadTags();
    await loadVisibleModules();

    // Reset profile selection to trigger full reload
    state.profileId = null;

    // Navigate to dashboard to show imported data
    setRoute('dashboard');
    render();

    toast(t('backup.import_success'), 'success');
  };
}

async function renderSearchResults(q){
  const r=await api.search.query({ q, options:{ profile_id: state.profileId, limit: 15 } });
  $('#content').innerHTML=`
    <div class="h1">${t('search.title')}</div>
    <div class="muted">${t('search.query', { q: escapeHtml(q) })}</div>
    <div class="grid" style="margin-top:12px;">
      <div class="card"><div class="cardHeader"><div class="cardTitle">${t('search.tasks')}</div></div><div class="cardBody" id="sTasks"></div></div>
      <div class="card"><div class="cardHeader"><div class="cardTitle">${t('search.maintenance')}</div></div><div class="cardBody" id="sPlans"></div></div>
      <div class="card"><div class="cardHeader"><div class="cardTitle">${t('search.documents')}</div></div><div class="cardBody" id="sDocs"></div></div>
    </div>
  `;
  if(!r.ok) return toast(r.error, 'error');
  $('#sTasks').innerHTML = r.data.tasks.length ? r.data.tasks.map(itemTaskHtml).join('') : `<div class="muted">${t('search.none')}</div>`;
  bindTaskRowActions($('#sTasks'));
  $('#sPlans').innerHTML = r.data.plans.length ? r.data.plans.map(planCardHtml).join('') : `<div class="muted">${t('search.none')}</div>`;
  bindPlanActions($('#sPlans'));
  $('#sDocs').innerHTML = r.data.docs.length ? r.data.docs.map(docRowHtml).join('') : `<div class="muted">${t('search.none')}</div>`;
  $$('[data-doc-open]', $('#sDocs')).forEach(b=>b.onclick=async ()=>{
    const rr=await api.documents.open({ id:b.dataset.docOpen });
    if(!rr.ok) toast(rr.error);
  });
}

async function renderRoutines(){
  $('#content').innerHTML=`
    <div class="h1">${t('routines.title')}</div>
    <div class="muted">${t('routines.subtitle')}</div>
    <div class="card" style="margin-top:12px;">
      <div class="cardHeader"><div class="cardTitle">${t('routines.manage')}</div></div>
      <div class="cardBody">
        <div class="row" style="margin-top:10px;">
          <button class="btn" id="genRoutines">${t('routines.generate')}</button>
          <button class="btn" id="addRoutine">${t('routines.add')}</button>
        </div>
        <div id="routineList" style="margin-top:12px;"></div>
      </div>
    </div>
  `;
  $('#genRoutines').onclick=async ()=>{
    const r=await api.routines.generate({ daysAhead:14 });
    if(!r.ok) return toast(r.error, 'error');
    toast(t('routines.generated', { count: r.data.generatedTasks }));
    setRoute('dashboard');
  };
  $('#addRoutine').onclick=()=>openRoutineModal();

  const listEl=$('#routineList');
  const rr=await api.routines.list({ profile_id: state.profileId });
  if(!rr.ok) return listEl.innerHTML=`<div class="muted">${escapeHtml(rr.error)}</div>`;
  listEl.innerHTML = rr.data.length ? rr.data.map(r=>`
    <div class="item">
      <div class="itemMain">
        <div class="itemTitle">${escapeHtml(r.title)}</div>
        <div class="itemMeta">
          <span class="badge">${escapeHtml(r.rule?.freq||'daily')} / ${escapeHtml(String(r.rule?.interval||1))}</span>
          ${r.profile_id ? `<span class="badge">${escapeHtml(profileName(r.profile_id))}</span>`:''}
          <span class="badge">${r.is_active ? t('routines.status_active') : t('routines.status_paused')}</span>
        </div>
      </div>
      <div class="itemActions">
        <button class="iconBtn" data-r-edit="${r.id}">✎</button>
        <button class="iconBtn" data-r-toggle="${r.id}">${r.is_active?'⏸':'▶'}</button>
        <button class="iconBtn" data-r-del="${r.id}">🗑</button>
      </div>
    </div>
  `).join('') : `<div class="muted">${t('routines.empty')}</div>`;

  $$('[data-r-edit]', listEl).forEach(b=>b.onclick=async ()=>{
    const one=await api.routines.get({ id:b.dataset.rEdit });
    if(!one.ok) return toast(one.error);
    openRoutineModal(one.data.routine);
  });
  $$('[data-r-toggle]', listEl).forEach(b=>b.onclick=async ()=>{
    const one=await api.routines.get({ id:b.dataset.rToggle });
    if(!one.ok) return toast(one.error);
    const r=one.data.routine;
    const upd=await api.routines.setActive({ id:r.id, is_active: !r.is_active });
    if(!upd.ok) return toast(upd.error);
    toast(t('common.ok'), 'success'); renderRoutines();
  });
  $$('[data-r-del]', listEl).forEach(b=>b.onclick=async ()=>{
    if(!confirm(t('routines.delete_confirm'))) return;
    const r=await api.routines.delete({ id:b.dataset.rDel });
    if(!r.ok) return toast(r.error, 'error');
    toast(t('common.deleted'), 'success'); renderRoutines();
  });
}
function openRoutineModal(existing){
  const r=existing || { title:'', description:'', is_active:true, profile_id: state.profileId==='all'?null:state.profileId, rule:{freq:'daily', interval:2}, start_date: todayISO() };
  openModal(existing ? t('routines.edit_title') : t('routines.new_title'), `
    <div class="form">
      <input class="input" id="rTitle" placeholder="${t('routines.title_placeholder')}" value="${escapeHtml(r.title)}" />
      <textarea class="input" id="rDesc" placeholder="${t('routines.desc_placeholder')}">${escapeHtml(r.description||'')}</textarea>
      <div class="formRow">
        <select id="rFreq">
          <option value="daily">${t('routines.freq_daily')}</option>
          <option value="weekly">${t('routines.freq_weekly')}</option>
          <option value="monthly">${t('routines.freq_monthly')}</option>
        </select>
        <input class="input" id="rInterval" placeholder="${t('routines.interval_placeholder')}" value="${escapeHtml(String(r.rule?.interval||1))}" />
      </div>
      <div class="formRow">
        <input type="date" class="input" id="rStart" placeholder="${t('routines.start_date')}" value="${escapeHtml(r.start_date||todayISO())}" />
        <select id="rProfile"></select>
      </div>
      <label class="row" style="gap:8px;">
        <input type="checkbox" id="rActive" ${r.is_active?'checked':''} />
        <span class="muted">${t('routines.active')}</span>
      </label>
      <div class="row" style="justify-content:flex-end;"><button class="btn" id="saveRoutine">${t('btn.save')}</button></div>
    </div>
  `, (root)=>{
    $('#rFreq', root).value=r.rule?.freq||'daily';
    const pSel=$('#rProfile', root);
    pSel.innerHTML=[{id:'',name:t('common.none')}, ...state.profiles.filter(p=>!p.is_archived)]
      .map(p=>`<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
    pSel.value=r.profile_id||'';

    $('#saveRoutine', root).onclick=async ()=>{
      const title=$('#rTitle', root).value.trim();
      const description=$('#rDesc', root).value.trim();
      const freq=$('#rFreq', root).value;
      const interval=Math.max(1, Number($('#rInterval', root).value.trim()||1));
      const start_date=$('#rStart', root).value.trim()||todayISO();
      const profile_id=pSel.value||null;
      const is_active=$('#rActive', root).checked;
      if(!title) return toast(t('routines.title_required'), 'warning');

      const payload={ title, description, rule:{freq, interval}, start_date, profile_id, is_active };
      let res;
      if(existing) res=await api.routines.update({ id: existing.id, patch: payload });
      else res=await api.routines.create(payload);
      if(!res.ok) return toast(res.error);

      closeModal(); toast(t('msg.saved'), 'success'); renderRoutines();
    };
  });
}

// ============================================
// NEW MODULES FOR v2.0: PROPERTY & ROOMS
// ============================================

async function renderProperty(){
  const r = await api.properties.list();
  if(!r.ok) return $('#content').innerHTML=`<div class="h1">${t('common.error')}: ${escapeHtml(r.error)}</div>`;

  const properties = r.data;

  const html = `
    <div class="h1">🏠 ${t('property.title')}</div>
    <div class="row" style="margin-bottom:20px;">
      <button class="btn" id="addPropertyBtn">${t('property.add')}</button>
    </div>

    ${properties.length === 0 ? `
      <div class="card" style="padding:60px; text-align:center;">
        <div style="font-size:48px; margin-bottom:16px;">🏠</div>
        <div class="h1" style="margin-bottom:10px;">${t('property.welcome_title')}</div>
        <p style="color:var(--muted); margin-bottom:24px;">
          ${t('property.welcome_desc')}
        </p>
        <button class="btn" id="welcomeAddBtn">${t('property.welcome_add')}</button>
      </div>
    ` : `
      <div class="grid">
        ${properties.map(p=>`
          <div class="card">
            <div class="row" style="justify-content:space-between; margin-bottom:10px;">
              <div style="font-size:18px; font-weight:600;">
                ${p.is_primary ? '⭐ ' : ''}${escapeHtml(p.name)}
              </div>
              <div class="row" style="gap:4px;">
                <button class="iconBtn editPropertyBtn" data-id="${p.id}">✎</button>
                <button class="iconBtn danger deletePropertyBtn" data-id="${p.id}">🗑</button>
              </div>
            </div>

            <div class="muted" style="margin-bottom:12px;">
              ${t(`property.type.${p.type || 'other'}`)}
            </div>

            ${p.address ? `<div style="margin-bottom:8px;">📍 ${escapeHtml(p.address)}</div>` : ''}

            <div class="row" style="gap:20px; margin-top:12px;">
              ${p.area ? `<div><div class="muted">${t('property.area')}</div><div>${p.area} ${t('units.area_m2')}</div></div>` : ''}
              ${p.rooms_count ? `<div><div class="muted">${t('property.rooms')}</div><div>${p.rooms_count}</div></div>` : ''}
              ${p.floor ? `<div><div class="muted">${t('property.floor')}</div><div>${p.floor}</div></div>` : ''}
            </div>

            ${p.management_company ? `
              <div style="margin-top:12px; padding-top:12px; border-top:1px solid var(--border);">
                <div class="muted">${t('property.management_company')}</div>
                <div>${escapeHtml(p.management_company)}</div>
                ${p.management_phone ? `<div class="muted">${escapeHtml(p.management_phone)}</div>` : ''}
              </div>
            ` : ''}

            <div class="row" style="gap:8px; margin-top:12px;">
              <button class="btn" data-id="${p.id}" data-property-id="${p.id}" data-route="rooms">🛋️ ${t('property.rooms_button')}</button>
            </div>
          </div>
        `).join('')}
      </div>
    `}
  `;

  $('#content').innerHTML = html;
  $$('[data-route]').forEach(btn => {
    btn.onclick = () => setRoute(btn.dataset.route);
  });
  $$('[data-route]').forEach(btn => {
    btn.onclick = () => setRoute(btn.dataset.route);
  });

  $$('.editPropertyBtn').forEach(btn=>{
    btn.onclick=async ()=>{
      const propertyId=btn.dataset.id;
      const property = properties.find(p=>p.id===propertyId);
      openPropertyModal(property);
    };
  });

  $$('.deletePropertyBtn').forEach(btn=>{
    btn.onclick=async ()=>{
      const propertyId=btn.dataset.id;
      const property = properties.find(p=>p.id===propertyId);
      if(!confirm(t('property.delete_confirm', { name: property.name }))) return;
      const r = await api.properties.delete({ id: propertyId });
      if(!r.ok) return toast(r.error, 'error');
      if(getCurrentPropertyId() === propertyId) clearCurrentPropertyId();
      toast(t('common.deleted'), 'success');
      renderProperty();
    };
  });

  const addBtn = $('#addPropertyBtn');
  if(addBtn) addBtn.onclick = ()=>openPropertyModal();

  const welcomeBtn = $('#welcomeAddBtn');
  if(welcomeBtn) welcomeBtn.onclick = ()=>openPropertyModal();

  // Property rooms handler
  $$('[data-property-id][data-route="rooms"]').forEach(btn => {
    btn.onclick = () => {
      setCurrentPropertyId(btn.dataset.propertyId);
      setRoute('rooms');
    };
  });
}

// Bind close modal buttons (after modals render)
const bindCloseModalButtons = () => {
  $$('[data-action="close-modal"]').forEach(b => b.onclick = closeModal);
};

function openPropertyModal(existing=null){
  const title = existing ? t('property.edit_title') : t('property.new_title');

  const html = `
    <div class="list">
      <div>
        <label class="muted">${t('property.name_label')} *</label>
        <input class="input" id="propName" value="${escapeHtml(existing?.name||'')}" placeholder="${t('property.name_placeholder')}" />
      </div>

      <div>
        <label class="muted">${t('label.type')}</label>
        <select class="input" id="propType">
          <option value="apartment" ${existing?.type==='apartment'?'selected':''}>${t('property.type.apartment')}</option>
          <option value="house" ${existing?.type==='house'?'selected':''}>${t('property.type.house')}</option>
          <option value="dacha" ${existing?.type==='dacha'?'selected':''}>${t('property.type.dacha')}</option>
          <option value="garage" ${existing?.type==='garage'?'selected':''}>${t('property.type.garage')}</option>
          <option value="other" ${existing?.type==='other'?'selected':''}>${t('property.type.other')}</option>
        </select>
      </div>

      <div>
        <label class="muted">${t('label.address')}</label>
        <input class="input" id="propAddress" value="${escapeHtml(existing?.address||'')}" placeholder="${t('property.address_placeholder')}" />
      </div>

      <div class="row" style="gap:12px;">
        <div style="flex:1;">
          <label class="muted">${t('property.area_label')}</label>
          <input type="number" class="input" id="propArea" value="${existing?.area||''}" placeholder="${t('property.area_placeholder')}" />
        </div>
        <div style="flex:1;">
          <label class="muted">${t('property.rooms_label')}</label>
          <input type="number" class="input" id="propRooms" value="${existing?.rooms_count||''}" placeholder="${t('property.rooms_placeholder')}" />
        </div>
        <div style="flex:1;">
          <label class="muted">${t('property.floor_label')}</label>
          <input type="number" class="input" id="propFloor" value="${existing?.floor||''}" placeholder="${t('property.floor_placeholder')}" />
        </div>
      </div>

      <div>
        <label class="muted">${t('property.management_company')}</label>
        <input class="input" id="propMC" value="${escapeHtml(existing?.management_company||'')}" placeholder="${t('property.management_company_placeholder')}" />
      </div>

      <div>
        <label class="muted">${t('property.management_phone')}</label>
        <input class="input" id="propMCPhone" value="${escapeHtml(existing?.management_phone||'')}" placeholder="${t('property.management_phone_placeholder')}" />
      </div>

      <div>
        <label class="muted">${t('property.account_label')}</label>
        <input class="input" id="propAccount" value="${escapeHtml(existing?.management_account||'')}" placeholder="${t('property.account_placeholder')}" />
      </div>

      <div>
        <label class="muted">${t('label.notes')}</label>
        <textarea class="input" id="propNotes" rows="3" placeholder="${t('property.notes_placeholder')}">${escapeHtml(existing?.notes||'')}</textarea>
      </div>

      <div>
        <label>
          <input type="checkbox" id="propPrimary" ${existing?.is_primary?'checked':''} />
          <span class="muted">${t('property.primary_label')}</span>
        </label>
      </div>

      <div class="row" style="gap:12px; margin-top:12px;">
        <button class="btn" id="savePropertyBtn">${t('btn.save')}</button>
        <button class="btn" data-action="close-modal">${t('btn.cancel')}</button>
      </div>
    </div>
  `;

  openModal(title, html, (root)=>{
    $('#savePropertyBtn', root).onclick = async ()=>{
      const name = $('#propName', root).value.trim();
      if(!name) return toast(t('property.name_required'));

      const payload = {
        name,
        type: $('#propType', root).value,
        address: $('#propAddress', root).value.trim(),
        area: parseFloat($('#propArea', root).value) || null,
        rooms_count: parseInt($('#propRooms', root).value) || null,
        floor: parseInt($('#propFloor', root).value) || null,
        management_company: $('#propMC', root).value.trim(),
        management_phone: $('#propMCPhone', root).value.trim(),
        management_account: $('#propAccount', root).value.trim(),
        notes: $('#propNotes', root).value.trim(),
        is_primary: $('#propPrimary', root).checked
      };

      let res;
      if(existing) res = await api.properties.update({ id: existing.id, patch: payload });
      else res = await api.properties.create(payload);

      if(!res.ok) return toast(res.error);

      closeModal();
      toast(t('msg.saved'), 'success');
      renderProperty();
      checkAchievementsDebounced();
    };
  });
}

async function renderRooms(){
  // Get current property (for now, just use first one or show selector later)
  const propRes = await api.properties.list();
  if(!propRes.ok) return $('#content').innerHTML=`<div class="h1">${t('common.error')}: ${escapeHtml(propRes.error)}</div>`;

  const properties = propRes.data;
  if(properties.length === 0){
    $('#content').innerHTML = `
      <div class="h1">🛋️ ${t('rooms.title')}</div>
      <div class="card" style="padding:60px; text-align:center;">
        <div style="font-size:48px; margin-bottom:16px;">🏠</div>
        <div class="h1" style="margin-bottom:10px;">${t('rooms.need_property_title')}</div>
        <p style="color:var(--muted); margin-bottom:24px;">
          ${t('rooms.need_property_desc')}
        </p>
        <button class="btn" data-route="property">${t('rooms.need_property_button')}</button>
      </div>
    `;
    $$('[data-route]').forEach(btn => {
      btn.onclick = () => setRoute(btn.dataset.route);
    });
    return;
  }

  const currentProperty = resolveCurrentProperty(properties);
  if(!currentProperty) return;

  const roomsRes = await api.rooms.list({ property_id: currentProperty.id });
  if(!roomsRes.ok) return $('#content').innerHTML=`<div class="h1">${t('common.error')}: ${escapeHtml(roomsRes.error)}</div>`;

  const rooms = roomsRes.data;

  const roomTypes = {
    kitchen: { name: t('rooms.type.kitchen'), icon: '🍳' },
    bedroom: { name: t('rooms.type.bedroom'), icon: '🛏️' },
    living: { name: t('rooms.type.living'), icon: '🛋️' },
    bathroom: { name: t('rooms.type.bathroom'), icon: '🚿' },
    toilet: { name: t('rooms.type.toilet'), icon: '🚽' },
    corridor: { name: t('rooms.type.corridor'), icon: '🚪' },
    balcony: { name: t('rooms.type.balcony'), icon: '🌅' },
    children: { name: t('rooms.type.children'), icon: '🧸' },
    office: { name: t('rooms.type.office'), icon: '💼' },
    storage: { name: t('rooms.type.storage'), icon: '📦' },
    garage: { name: t('rooms.type.garage'), icon: '🚗' },
    other: { name: t('rooms.type.other'), icon: '📍' }
  };

  const html = `
    <div class="h1">🛋️ ${t('rooms.title_with_property', { name: escapeHtml(currentProperty.name) })}</div>
    <div class="row" style="margin-bottom:20px; gap:12px; flex-wrap:wrap;">
      <button class="btn" id="backToPropertyBtn">${t('rooms.back_to_property')}</button>
      <div>
        <div class="muted" style="font-size:12px; margin-bottom:4px;">${t('rooms.property_label')}</div>
        ${propertySelectHtml(properties, currentProperty.id)}
      </div>
      <button class="btn" id="addRoomBtn">${t('rooms.add')}</button>
    </div>

    ${rooms.length === 0 ? `
      <div class="card" style="padding:40px; text-align:center;">
        <div style="font-size:36px; margin-bottom:12px;">🛋️</div>
        <div class="h1" style="margin-bottom:8px;">${t('rooms.empty_title')}</div>
        <p style="color:var(--muted); margin-bottom:20px;">
          ${t('rooms.empty_desc')}
        </p>
        <button class="btn" id="welcomeRoomBtn">${t('rooms.add')}</button>
      </div>
    ` : `
      <div class="grid">
        ${rooms.map(room=>{
          const type = roomTypes[room.type] || roomTypes.other;
          return `
            <div class="card">
              <div class="row" style="justify-content:space-between; margin-bottom:10px;">
                <div style="font-size:18px; font-weight:600;">
                  ${type.icon} ${escapeHtml(room.name)}
                </div>
                <div class="row" style="gap:4px;">
                  <button class="iconBtn editRoomBtn" data-id="${room.id}">✎</button>
                  <button class="iconBtn danger deleteRoomBtn" data-id="${room.id}">🗑</button>
                </div>
              </div>

              <div class="muted">${type.name}</div>

              ${room.area ? `
                <div style="margin-top:12px;">
                  <div class="muted">${t('rooms.area')}</div>
                  <div>${room.area} ${t('units.area_m2')}</div>
                </div>
              ` : ''}

              ${room.notes ? `
                <div style="margin-top:12px;">
                  <div class="muted">${t('rooms.notes')}</div>
                  <div style="font-size:13px;">${escapeHtml(room.notes)}</div>
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `}
  `;

  $('#content').innerHTML = html;

  const backBtn = $('#backToPropertyBtn');
  if(backBtn) backBtn.onclick = () => setRoute('property');

  const propertyPicker = $('#propertyPicker');
  if(propertyPicker){
    propertyPicker.onchange = () => {
      setCurrentPropertyId(propertyPicker.value);
      renderRooms();
    };
  }

  $$('.editRoomBtn').forEach(btn=>{
    btn.onclick=()=>{
      const room = rooms.find(r=>r.id===btn.dataset.id);
      openRoomModal(currentProperty.id, room);
    };
  });

  $$('.deleteRoomBtn').forEach(btn=>{
    btn.onclick=async ()=>{
      const room = rooms.find(r=>r.id===btn.dataset.id);
      if(!confirm(t('rooms.delete_confirm', { name: room.name }))) return;
      const r = await api.rooms.delete({ id: room.id });
      if(!r.ok) return toast(r.error, 'error');
      toast(t('msg.deleted'), 'success');
      renderRooms();
    };
  });

  const addBtn = $('#addRoomBtn');
  if(addBtn) addBtn.onclick = ()=>openRoomModal(currentProperty.id);

  const welcomeBtn = $('#welcomeRoomBtn');
  if(welcomeBtn) welcomeBtn.onclick = ()=>openRoomModal(currentProperty.id);
}

function openRoomModal(propertyId, existing=null){
  const title = existing ? t('rooms.edit_title') : t('rooms.new_title');

  const roomTypes = [
    { value: 'kitchen', label: t('rooms.type.kitchen') },
    { value: 'bedroom', label: t('rooms.type.bedroom') },
    { value: 'living', label: t('rooms.type.living') },
    { value: 'bathroom', label: t('rooms.type.bathroom') },
    { value: 'toilet', label: t('rooms.type.toilet') },
    { value: 'corridor', label: t('rooms.type.corridor') },
    { value: 'balcony', label: t('rooms.type.balcony') },
    { value: 'children', label: t('rooms.type.children') },
    { value: 'office', label: t('rooms.type.office') },
    { value: 'storage', label: t('rooms.type.storage') },
    { value: 'garage', label: t('rooms.type.garage') },
    { value: 'other', label: t('rooms.type.other') }
  ];

  const html = `
    <div class="list">
      <div>
        <label class="muted">${t('rooms.type_label')} *</label>
        <select class="input" id="roomType">
          ${roomTypes.map(t=>`<option value="${t.value}" ${existing?.type===t.value?'selected':''}>${t.label}</option>`).join('')}
        </select>
      </div>

      <div>
        <label class="muted">${t('label.title')} *</label>
        <input class="input" id="roomName" value="${escapeHtml(existing?.name||'')}" placeholder="${t('rooms.name_placeholder')}" />
      </div>

      <div>
        <label class="muted">${t('rooms.area_label')}</label>
        <input type="number" class="input" id="roomArea" value="${existing?.area||''}" placeholder="${t('rooms.area_placeholder')}" />
      </div>

      <div>
        <label class="muted">${t('label.notes')}</label>
        <textarea class="input" id="roomNotes" rows="3" placeholder="${t('rooms.notes_placeholder')}">${escapeHtml(existing?.notes||'')}</textarea>
      </div>

      <div class="row" style="gap:12px; margin-top:12px;">
        <button class="btn" id="saveRoomBtn">${t('btn.save')}</button>
        <button class="btn" data-action="close-modal">${t('btn.cancel')}</button>
      </div>
    </div>
  `;

  openModal(title, html, (root)=>{
    const typeSelect = $('#roomType', root);
    const nameInput = $('#roomName', root);

    // Auto-fill name when type changes
    typeSelect.onchange = ()=>{
      if(!existing && !nameInput.value.trim()){
        const selectedType = roomTypes.find(t=>t.value===typeSelect.value);
        if(selectedType) nameInput.value = selectedType.label;
      }
    };

    // Trigger initial auto-fill for new rooms
    if(!existing) typeSelect.onchange();

    $('#saveRoomBtn', root).onclick = async ()=>{
      const name = nameInput.value.trim();
      if(!name) return toast(t('rooms.name_required'));

      const payload = {
        property_id: propertyId,
        type: typeSelect.value,
        name,
        area: parseFloat($('#roomArea', root).value) || null,
        notes: $('#roomNotes', root).value.trim()
      };

      let res;
      if(existing) res = await api.rooms.update({ id: existing.id, patch: payload });
      else res = await api.rooms.create(payload);

      if(!res.ok) return toast(res.error);

      closeModal();
      toast(t('msg.saved'), 'success');
      renderRooms();
    };
  });
}

// ============================================
// NEW MODULE: METERS (v2.0)
// ============================================

async function renderMeters(){
  const propRes = await api.properties.list();
  if(!propRes.ok) return $('#content').innerHTML=`<div class="h1">${t('common.error')}: ${escapeHtml(propRes.error)}</div>`;

  const properties = propRes.data;
  if(properties.length === 0){
    $('#content').innerHTML = `
      <div class="h1">💧 ${t('meters.title')}</div>
      <div class="card" style="padding:60px; text-align:center;">
        <div style="font-size:48px; margin-bottom:16px;">🏠</div>
        <div class="h1" style="margin-bottom:10px;">${t('meters.need_property_title')}</div>
        <p style="color:var(--muted); margin-bottom:24px;">
          ${t('meters.need_property_desc')}
        </p>
        <button class="btn" data-route="property">${t('meters.need_property_button')}</button>
      </div>
    `;
    return;
  }

  const currentProperty = resolveCurrentProperty(properties);
  if(!currentProperty) return;

  if(!state.metersFilter) state.metersFilter = { showInactive:false };
  const metersRes = await api.meters.list({ property_id: currentProperty.id, is_active: state.metersFilter.showInactive ? undefined : true });
  if(!metersRes.ok) return $('#content').innerHTML=`<div class="h1">${t('common.error')}: ${escapeHtml(metersRes.error)}</div>`;

  const meters = metersRes.data;

  // Default meter types
  const meterTypes = {
    cold_water: { name: t('meter.type.cold_water'), icon: '💧', color: '#3b82f6', unit: t('meters.unit_m3') },
    hot_water: { name: t('meter.type.hot_water'), icon: '🔥', color: '#ef4444', unit: t('meters.unit_m3') },
    electricity: { name: t('meter.type.electricity'), icon: '⚡', color: '#eab308', unit: t('meters.unit_kwh') },
    gas: { name: t('meter.type.gas'), icon: '🔵', color: '#8b5cf6', unit: t('meters.unit_m3') },
    heating: { name: t('meter.type.heating'), icon: '🌡️', color: '#f97316', unit: t('meters.unit_gcal') }
  };

  // Load and merge custom meter types
  const customTypesRes = await api.customMeterTypes.list();
  if(customTypesRes.ok){
    customTypesRes.data.forEach(customType => {
      meterTypes[customType.id] = {
        name: customType.name,
        icon: '📊',
        color: '#6b7280',
        unit: customType.unit,
        isCustom: true
      };
    });
  }

  // Check if need to submit readings (per-meter period)
  const today = new Date();
  const dayOfMonth = today.getDate();
  const metersNeedingReading = meters.filter(m => {
    if (m.is_active === false) return false;
    const start = m.submission_day_start || 15;
    const end = m.submission_day_end || 25;
    const inWindow = dayOfMonth >= start && dayOfMonth <= end;
    const submittedThisMonth = isSameMonth(m.last_reading_date || '', today);
    return inWindow && !submittedThisMonth;
  });

  const html = `
    <div class="h1">💧 ${t('meters.title_with_property', { name: escapeHtml(currentProperty.name) })}</div>
    <div class="row" style="margin-bottom:20px; gap:12px; flex-wrap:wrap;">
      <div>
        <div class="muted" style="font-size:12px; margin-bottom:4px;">${t('meters.property_label')}</div>
        ${propertySelectHtml(properties, currentProperty.id)}
      </div>
      <label style="display:flex; align-items:center; gap:8px;">
        <input type="checkbox" id="metersShowInactive" ${state.metersFilter.showInactive ? 'checked' : ''} />
        <span class="muted">${t('meters.show_inactive')}</span>
      </label>
      <button class="btn" id="addMeterBtn">${t('meters.add')}</button>
      <button class="btn" id="manageMeterTypesBtn" style="background:var(--card-bg); border:1px solid var(--border);">⚙️ ${t('meters.manage_types')}</button>
    </div>

    ${metersNeedingReading.length > 0 ? `
      <div class="card" style="border-color:var(--warn); background:rgba(245,158,11,.08); margin-bottom:20px;">
        <div style="display:flex; gap:12px; align-items:center;">
          <div style="font-size:24px;">⚠️</div>
          <div>
            <div style="font-weight:700;">${t('meters.alert_title')}</div>
            <div class="muted">${t('meters.alert_count', { count: metersNeedingReading.length })}</div>
          </div>
        </div>
      </div>
    ` : ''}

    ${meters.length === 0 ? `
      <div class="card" style="padding:40px; text-align:center;">
        <div style="font-size:36px; margin-bottom:12px;">💧</div>
        <div class="h1" style="margin-bottom:8px;">${t('meters.empty_title')}</div>
        <p style="color:var(--muted); margin-bottom:20px;">
          ${t('meters.empty_desc')}
        </p>
        <button class="btn" id="welcomeMeterBtn">${t('meters.add')}</button>
      </div>
    ` : `
      <div class="list">
        ${meters.map(meter=>{
          const type = meterTypes[meter.type] || { name: t('meters.type_other'), icon: '📊', color: '#6b7280', unit: '' };
          const needsReading = metersNeedingReading.some(m => m.id === meter.id);

          // Check verification warning
          const verificationWarning = meter.next_verification &&
            new Date(meter.next_verification) < new Date(Date.now() + 90*24*3600*1000);

          // Visual indicator for inactive meters
          const isInactive = meter.is_active === false;
          const cardOpacity = isInactive ? 'opacity:0.6;' : '';

          return `
            <div class="card" style="border-left:3px solid ${type.color}; ${cardOpacity}">
              <div class="row" style="justify-content:space-between; margin-bottom:10px;">
                <div style="flex:1;">
                  <div class="row" style="gap:8px; align-items:center; flex-wrap:wrap;">
                    <div style="font-size:18px; font-weight:600;">
                      ${type.icon} ${escapeHtml(meter.name)}
                    </div>
                    ${isInactive ? `<span class="badge" style="background:rgba(107,114,128,0.15); border-color:rgba(107,114,128,0.3); font-size:11px;">${t('meters.inactive')}</span>` : ''}
                  </div>
                <div class="row" style="gap:8px; align-items:center; margin-top:4px;">
                  <div class="muted">${type.name}</div>
                  ${meter.property_id && currentProperty ? `<span class="badge" style="font-size:10px; padding:2px 6px;">🏠 ${escapeHtml(currentProperty.name)}</span>` : ''}
                  ${needsReading ? `<span class="badge warn" style="font-size:10px; padding:2px 6px;">${t('meters.needs_reading')}</span>` : ''}
                </div>
              </div>
                <div class="row" style="gap:4px;">
                  <button class="btn addReadingBtn" style="padding:8px 12px;" data-meter-id="${meter.id}">${t('meters.add_reading')}</button>
                  <button class="iconBtn editMeterBtn" data-id="${meter.id}">✎</button>
                  <button class="iconBtn danger deleteMeterBtn" data-id="${meter.id}">🗑</button>
                </div>
              </div>

              <div class="row" style="gap:30px; margin-top:12px;">
                ${meter.last_reading !== null ? `
                  <div>
                    <div class="muted">${t('meters.current_reading')}</div>
                    <div style="font-size:20px; font-weight:700;">${meter.last_reading} <span class="muted" style="font-size:14px;">${type.unit}</span></div>
                    ${meter.last_reading_date ? `<div class="muted" style="font-size:11px;">${meter.last_reading_date}</div>` : ''}
                  </div>
                ` : `
                  <div>
                    <div class="muted">${t('meters.readings')}</div>
                    <div style="color:var(--warn);">${t('meters.readings_missing')}</div>
                  </div>
                `}

                ${meter.serial_number ? `
                  <div>
                    <div class="muted">${t('meters.serial_number')}</div>
                    <div style="font-size:13px;">${escapeHtml(meter.serial_number)}</div>
                  </div>
                ` : ''}
              </div>

              ${verificationWarning ? `
                <div style="margin-top:12px; padding:8px; background:rgba(245,158,11,.08); border-radius:8px; border:1px solid rgba(245,158,11,.3);">
                  <div style="font-size:13px;">⚠️ ${t('meters.verification_until', { date: meter.next_verification })}</div>
                </div>
              ` : ''}

              <div class="row" style="gap:8px; margin-top:12px;">
                <button class="btn showHistoryBtn" data-meter-id="${meter.id}" style="font-size:13px; padding:6px 10px;">📊 ${t('meters.history')}</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `}
  `;

  $('#content').innerHTML = html;

  const propertyPicker = $('#propertyPicker');
  if(propertyPicker){
    propertyPicker.onchange = () => {
      setCurrentPropertyId(propertyPicker.value);
      renderMeters();
    };
  }

  $$('.editMeterBtn').forEach(btn=>{
    btn.onclick=()=>{
      const meter = meters.find(m=>m.id===btn.dataset.id);
      openMeterModal(currentProperty.id, meter);
    };
  });

  $$('.deleteMeterBtn').forEach(btn=>{
    btn.onclick=async ()=>{
      const meter = meters.find(m=>m.id===btn.dataset.id);
      if(!confirm(t('meters.delete_confirm', { name: meter.name }))) return;
      const r = await api.meters.delete({ id: meter.id });
      if(!r.ok) return toast(r.error, 'error');
      toast(t('common.deleted'), 'success');
      renderMeters();
    };
  });

  $$('.addReadingBtn').forEach(btn=>{
    btn.onclick = () => openAddReadingModal(btn.dataset.meterId);
  });

  $$('.showHistoryBtn').forEach(btn=>{
    btn.onclick = () => showMeterHistory(btn.dataset.meterId);
  });

  const addBtn = $('#addMeterBtn');
  if(addBtn) addBtn.onclick = ()=>openMeterModal(currentProperty.id);

  const welcomeBtn = $('#welcomeMeterBtn');
  if(welcomeBtn) welcomeBtn.onclick = ()=>openMeterModal(currentProperty.id);

  const manageMeterTypesBtn = $('#manageMeterTypesBtn');
  if(manageMeterTypesBtn) manageMeterTypesBtn.onclick = ()=>openManageCustomMeterTypesModal();

  const showInactive = $('#metersShowInactive');
  if(showInactive){
    showInactive.onchange = ()=>{
      state.metersFilter.showInactive = showInactive.checked;
      renderMeters();
    };
  }
}

async function openMeterModal(propertyId, existing=null){
  const title = existing ? t('meters.edit_title') : t('meters.new_title');

  // Default meter types
  const meterTypes = [
    { value: 'cold_water', label: `💧 ${t('meter.type.cold_water')}` },
    { value: 'hot_water', label: `🔥 ${t('meter.type.hot_water')}` },
    { value: 'electricity', label: `⚡ ${t('meter.type.electricity')}` },
    { value: 'gas', label: `🔵 ${t('meter.type.gas')}` },
    { value: 'heating', label: `🌡️ ${t('meter.type.heating')}` }
  ];

  // Load and add custom meter types
  const customTypesRes = await api.customMeterTypes.list();
  if(customTypesRes.ok && customTypesRes.data.length > 0){
    // Add separator
    meterTypes.push({ value: '', label: '---', disabled: true });
    // Add custom types
    customTypesRes.data.forEach(customType => {
      meterTypes.push({
        value: customType.id,
        label: `📊 ${customType.name}`,
        unit: customType.unit
      });
    });
  }

  const html = `
    <div class="list">
      <div>
        <label class="muted">${t('meters.type_label')} *</label>
        <select class="input" id="meterType">
          ${meterTypes.map(t=>`<option value="${t.value}" ${existing?.type===t.value?'selected':''} ${t.disabled?'disabled':''}>${t.label}</option>`).join('')}
        </select>
      </div>

      <div>
        <label class="muted">${t('label.title')} *</label>
        <input class="input" id="meterName" value="${escapeHtml(existing?.name||'')}" placeholder="${t('meters.name_placeholder')}" />
      </div>

      <div>
        <label class="muted">${t('meters.serial_label')}</label>
        <input class="input" id="meterSerial" value="${escapeHtml(existing?.serial_number||'')}" placeholder="${t('meters.serial_placeholder')}" />
      </div>

      <div class="row" style="gap:12px;">
        <div style="flex:1;">
          <label class="muted">${t('meters.install_date')}</label>
          <input type="date" class="input" id="meterInstall" value="${existing?.installation_date||''}" />
        </div>
        <div style="flex:1;">
          <label class="muted">${t('meters.verify_date')}</label>
          <input type="date" class="input" id="meterVerify" value="${existing?.next_verification||''}" />
        </div>
      </div>

      <div>
        <label class="muted">${t('meters.location_label')}</label>
        <input class="input" id="meterLocation" value="${escapeHtml(existing?.location||'')}" placeholder="${t('meters.location_placeholder')}" />
      </div>

      <div class="row" style="gap:12px;">
        <div style="flex:1;">
          <label class="muted">${t('meters.submit_start')}</label>
          <input type="number" class="input" id="meterDayStart" value="${existing?.submission_day_start||15}" min="1" max="31" />
        </div>
        <div style="flex:1;">
          <label class="muted">${t('meters.submit_end')}</label>
          <input type="number" class="input" id="meterDayEnd" value="${existing?.submission_day_end||25}" min="1" max="31" />
        </div>
      </div>

      <div>
        <label>
          <input type="checkbox" id="meterActive" ${existing?.is_active !== false ? 'checked' : ''} />
          <span class="muted">${t('meters.active_label')}</span>
        </label>
      </div>

      <div class="row" style="gap:12px; margin-top:12px;">
        <button class="btn" id="saveMeterBtn">${t('btn.save')}</button>
        <button class="btn" id="cancelMeterBtn">${t('btn.cancel')}</button>
      </div>
    </div>
  `;

  openModal(title, html, (root)=>{
    const typeSelect = $('#meterType', root);
    const nameInput = $('#meterName', root);

    // Auto-fill meter name based on selected type
    typeSelect.onchange = ()=>{
      // Only auto-fill for new meters or when name is empty/was previously auto-filled
      if(!existing && !nameInput.value.trim()){
        const selectedType = meterTypes.find(t=>t.value===typeSelect.value);
        if(selectedType && selectedType.label) {
          // Remove emoji and extract clean name
          const cleanName = selectedType.label.replace(/^[^\s]+\s/, '').trim();
          nameInput.value = cleanName;
          // Select the text so user can easily override
          nameInput.select();
        }
      }
    };

    // Trigger auto-fill on modal open for new meters
    if(!existing) typeSelect.onchange();

    $('#saveMeterBtn', root).onclick = async ()=>{
      const name = nameInput.value.trim();
      if(!name) return toast(t('meters.name_required'));

      const payload = {
        property_id: propertyId,
        type: typeSelect.value,
        name,
        serial_number: $('#meterSerial', root).value.trim(),
        installation_date: $('#meterInstall', root).value || null,
        next_verification: $('#meterVerify', root).value || null,
        location: $('#meterLocation', root).value.trim(),
        submission_day_start: parseInt($('#meterDayStart', root).value) || 15,
        submission_day_end: parseInt($('#meterDayEnd', root).value) || 25,
        is_active: $('#meterActive', root).checked
      };

      let res;
      if(existing) res = await api.meters.update({ id: existing.id, patch: payload });
      else res = await api.meters.create(payload);

      if(!res.ok) return toast(res.error);

      closeModal();
      toast(t('msg.saved'), 'success');
      renderMeters();
    };

    $('#cancelMeterBtn', root).onclick = () => closeModal();
  });
}

async function openAddReadingModal(meterId){
  const meterRes = await api.meters.get({ id: meterId });
  if(!meterRes.ok) return toast(meterRes.error);

  const meter = meterRes.data;

  const html = `
    <div class="list">
      <div>
        <div style="font-size:18px; font-weight:600; margin-bottom:8px;">${escapeHtml(meter.name)}</div>
        ${meter.last_reading !== null ? `
          <div class="muted">${t('meters.prev_reading', { value: meter.last_reading })}</div>
        ` : ''}
      </div>

      <div>
        <label class="muted">${t('meters.reading_label')} *</label>
        <input type="number" step="0.01" class="input" id="readingValue" placeholder="${meter.last_reading || '0'}" autofocus />
      </div>

      <div>
        <label class="muted">${t('meters.reading_date')}</label>
        <input type="date" class="input" id="readingDate" value="${todayISO()}" />
      </div>

      <div>
        <label class="muted">${t('label.notes')}</label>
        <textarea class="input" id="readingNotes" rows="2" placeholder="${t('meters.reading_notes_placeholder')}"></textarea>
      </div>

      <div class="row" style="gap:12px; margin-top:12px;">
        <button class="btn" id="saveReadingBtn">${t('meters.add_reading')}</button>
        <button class="btn" data-action="close-modal">${t('btn.cancel')}</button>
      </div>
    </div>
  `;

  openModal(t('meters.add_reading_title'), html, (root)=>{
    $('#saveReadingBtn', root).onclick = async ()=>{
      const value = parseFloat($('#readingValue', root).value);
      if(isNaN(value)) return toast(t('meters.reading_required'));

      const payload = {
        meter_id: meterId,
        value,
        reading_date: $('#readingDate', root).value || todayISO(),
        notes: $('#readingNotes', root).value.trim()
      };

      const res = await api.meters.addReading(payload);
      if(!res.ok) return toast(res.error);

      closeModal();
      toast(t('meters.reading_added'));
      renderMeters();
      checkAchievementsDebounced();
    };
  });
}

async function showMeterHistory(meterId){
  const meterRes = await api.meters.get({ id: meterId });
  if(!meterRes.ok) return toast(meterRes.error);

  const meter = meterRes.data;

  const readingsRes = await api.meters.getReadings({ meter_id: meterId, limit: 30 });
  if(!readingsRes.ok) return toast(readingsRes.error);

  const readings = readingsRes.data;

  const html = `
    <div>
      <div style="font-size:18px; font-weight:600; margin-bottom:16px;">${escapeHtml(meter.name)}</div>

      ${readings.length === 0 ? `
        <div class="card" style="padding:40px; text-align:center;">
          <div class="muted">${t('meters.history_empty')}</div>
        </div>
      ` : `
        <div class="list" style="max-height:60vh; overflow:auto;">
          ${readings.map(r=>`
            <div class="card">
              <div class="row" style="justify-content:space-between;">
                <div>
                  <div style="font-size:16px; font-weight:600;">${r.value}</div>
                  <div class="muted" style="font-size:12px;">${r.reading_date}</div>
                </div>
                <div style="text-align:right;">
                  ${r.consumption !== null ? `
                    <div style="font-size:14px; color:var(--muted);">${t('meters.consumption', { value: r.consumption })}</div>
                  ` : ''}
                </div>
              </div>
              ${r.notes ? `<div class="muted" style="font-size:12px; margin-top:6px;">${escapeHtml(r.notes)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      `}

      <div class="row" style="gap:12px; margin-top:16px;">
        <button class="btn" data-action="close-modal">${t('btn.close')}</button>
      </div>
    </div>
  `;

  openModal(t('meters.history_title', { name: meter.name }), html);
}

// ============================================
// CUSTOM METER TYPES MANAGEMENT
// ============================================

async function openManageCustomMeterTypesModal(){
  const customTypesRes = await api.customMeterTypes.listAll();
  if(!customTypesRes.ok) return toast(customTypesRes.error, 'error');

  const customTypes = customTypesRes.data;

  const html = `
    <div class="list">
      <div class="row" style="justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div style="font-size:16px; font-weight:600;">${t('meters.custom_title')}</div>
        <button class="btn" id="addCustomTypeBtn">${t('meters.custom_add')}</button>
      </div>

      ${customTypes.length === 0 ? `
        <div class="card" style="padding:40px; text-align:center;">
          <div style="font-size:36px; margin-bottom:12px;">📊</div>
          <div class="muted">${t('meters.custom_empty')}</div>
          <p style="color:var(--muted); font-size:13px; margin-top:8px;">
            ${t('meters.custom_empty_desc')}
          </p>
        </div>
      ` : `
        <div class="list">
          ${customTypes.map(type => `
            <div class="card">
              <div class="row" style="justify-content:space-between; align-items:center;">
                <div>
                  <div style="font-size:16px; font-weight:600;">📊 ${escapeHtml(type.name)}</div>
                  <div class="muted" style="font-size:13px;">${t('meters.custom_unit', { unit: escapeHtml(type.unit) })}</div>
                  ${!type.is_active ? `<div style="color:var(--warn); font-size:12px; margin-top:4px;">${t('meters.custom_inactive')}</div>` : ''}
                </div>
                <div class="row" style="gap:4px;">
                  <button class="iconBtn editCustomTypeBtn" data-id="${type.id}">✎</button>
                  <button class="iconBtn danger deleteCustomTypeBtn" data-id="${type.id}">🗑</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `}

      <div class="row" style="gap:12px; margin-top:16px;">
        <button class="btn" data-action="close-modal">${t('btn.close')}</button>
      </div>
    </div>
  `;

  openModal(t('meters.custom_manage_title'), html, (root) => {
    const addBtn = $('#addCustomTypeBtn', root);
    if(addBtn) addBtn.onclick = () => openCustomMeterTypeModal();

    $$('.editCustomTypeBtn', root).forEach(btn => {
      btn.onclick = () => {
        const type = customTypes.find(t => t.id === btn.dataset.id);
        openCustomMeterTypeModal(type);
      };
    });

    $$('.deleteCustomTypeBtn', root).forEach(btn => {
      btn.onclick = async () => {
        const type = customTypes.find(t => t.id === btn.dataset.id);
        if(!confirm(t('meters.custom_delete_confirm', { name: type.name }))) return;

        const r = await api.customMeterTypes.delete({ id: btn.dataset.id });
        if(!r.ok) return toast(r.error, 'error');

        toast(t('meters.custom_deleted'), 'success');
        openManageCustomMeterTypesModal();
      };
    });
  });
}

async function openCustomMeterTypeModal(existing = null){
  const title = existing ? t('meters.custom_edit_title') : t('meters.custom_new_title');

  const html = `
    <div class="list">
      <div>
        <label class="muted">${t('meters.custom_name_label')} *</label>
        <input class="input" id="customTypeName" value="${escapeHtml(existing?.name || '')}" placeholder="${t('meters.custom_name_placeholder')}" autofocus />
      </div>

      <div>
        <label class="muted">${t('meters.custom_unit_label')} *</label>
        <input class="input" id="customTypeUnit" value="${escapeHtml(existing?.unit || '')}" placeholder="${t('meters.custom_unit_placeholder')}" />
      </div>

      <div class="row" style="gap:12px; margin-top:12px;">
        <button class="btn" id="saveCustomTypeBtn">${t('btn.save')}</button>
        <button class="btn" data-action="close-modal">${t('btn.cancel')}</button>
      </div>
    </div>
  `;

  openModal(title, html, (root) => {
    $('#saveCustomTypeBtn', root).onclick = async () => {
      const name = $('#customTypeName', root).value.trim();
      const unit = $('#customTypeUnit', root).value.trim();

      if(!name) return toast(t('meters.custom_name_required'), 'error');
      if(!unit) return toast(t('meters.custom_unit_required'), 'error');

      let res;
      if(existing){
        res = await api.customMeterTypes.update({ id: existing.id, name, unit });
      } else {
        res = await api.customMeterTypes.create({ name, unit });
      }

      if(!res.ok) return toast(res.error, 'error');

      closeModal();
      toast(t('meters.custom_saved'), 'success');
      openManageCustomMeterTypesModal();
    };
  });
}

// ============================================
// NEW MODULE: INVENTORY (v2.0)
// ============================================

async function renderInventory(){
  const propRes = await api.properties.list();
  if(!propRes.ok) return $('#content').innerHTML=`<div class="h1">${t('common.error')}: ${escapeHtml(propRes.error)}</div>`;

  const properties = propRes.data;
  if(properties.length === 0){
    $('#content').innerHTML = `
      <div class="h1">📦 ${t('inventory.title')}</div>
      <div class="card" style="padding:60px; text-align:center;">
        <div style="font-size:48px; margin-bottom:16px;">🏠</div>
        <div class="h1" style="margin-bottom:10px;">${t('inventory.need_property_title')}</div>
        <p style="color:var(--muted); margin-bottom:24px;">
          ${t('inventory.need_property_desc')}
        </p>
        <button class="btn" id="goToPropertyFromInventory">${t('inventory.need_property_button')}</button>
      </div>
    `;
    const goBtn = $('#goToPropertyFromInventory');
    if(goBtn) goBtn.onclick = () => setRoute('property');
    return;
  }

  const currentProperty = resolveCurrentProperty(properties);
  if(!currentProperty) return;

  const roomsRes = await api.rooms.list({ property_id: currentProperty.id });
  const rooms = roomsRes.ok ? roomsRes.data : [];

  const inventoryRes = await api.inventory.list({ property_id: currentProperty.id });
  if(!inventoryRes.ok) return $('#content').innerHTML=`<div class="h1">${t('common.error')}: ${escapeHtml(inventoryRes.error)}</div>`;

  const items = inventoryRes.data;

  const categories = {
    electronics: { name: t('inventory.category.electronics'), icon: '📱', color: '#3b82f6' },
    appliances: { name: t('inventory.category.appliances'), icon: '🔌', color: '#8b5cf6' },
    furniture: { name: t('inventory.category.furniture'), icon: '🛋️', color: '#f59e0b' },
    tools: { name: t('inventory.category.tools'), icon: '🔧', color: '#ef4444' },
    kitchen: { name: t('inventory.category.kitchen'), icon: '🍳', color: '#10b981' },
    decor: { name: t('inventory.category.decor'), icon: '🖼️', color: '#ec4899' },
    other: { name: t('inventory.category.other'), icon: '📦', color: '#6b7280' }
  };
  const statusMap = {
    active: { label: t('inventory.status.active'), color: 'var(--ok)' },
    repair: { label: t('inventory.status.repair'), color: 'var(--warn)' },
    disposed: { label: t('inventory.status.disposed'), color: 'var(--muted)' }
  };

  const today = new Date();
  const filterCategory = state.inventoryFilter?.category || 'all';
  const filterRoom = state.inventoryFilter?.room || 'all';
  const filterStatus = state.inventoryFilter?.status || 'all';

  let filteredItems = items;
  if(filterCategory !== 'all') filteredItems = filteredItems.filter(i => i.category === filterCategory);
  if(filterRoom !== 'all') filteredItems = filteredItems.filter(i => i.room_id === filterRoom);
  if(filterStatus !== 'all') filteredItems = filteredItems.filter(i => (i.status || 'active') === filterStatus);

  const totalValue = items.reduce((sum, item) => sum + (item.purchase_price || 0), 0);

  $('#content').innerHTML = `
    <div class="h1">📦 ${t('inventory.title_with_property', { name: escapeHtml(currentProperty.name) })}</div>

    <div class="card" style="margin-bottom:16px;">
      <div class="row" style="flex-wrap:wrap; gap:12px;">
        <div style="flex:1; min-width:200px;">
          <label class="muted" style="display:block; margin-bottom:6px;">${t('inventory.property_label')}</label>
          ${propertySelectHtml(properties, currentProperty.id)}
        </div>
        <div style="flex:1; min-width:200px;">
          <div class="muted" style="margin-bottom:6px;">${t('inventory.total_items')}</div>
          <div style="font-size:24px; font-weight:700;">${items.length}</div>
        </div>
        <div style="flex:1; min-width:200px;">
          <div class="muted" style="margin-bottom:6px;">${t('inventory.total_value')}</div>
          <div style="font-size:24px; font-weight:700;">${totalValue.toLocaleString('ru-RU')} ₽</div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <div class="row" style="flex-wrap:wrap; gap:12px;">
        <div style="flex:1; min-width:200px;">
          <label class="muted" style="display:block; margin-bottom:6px;">${t('inventory.category')}</label>
          <select class="input" id="filterCategory">
            <option value="all">${t('inventory.category_all')}</option>
            ${Object.entries(categories).map(([k,v])=>`
              <option value="${k}" ${filterCategory===k?'selected':''}>${v.icon} ${v.name}</option>
            `).join('')}
          </select>
        </div>
        <div style="flex:1; min-width:200px;">
          <label class="muted" style="display:block; margin-bottom:6px;">${t('inventory.room')}</label>
          <select class="input" id="filterRoom">
            <option value="all">${t('inventory.room_all')}</option>
            ${rooms.map(r=>`
              <option value="${r.id}" ${filterRoom===r.id?'selected':''}>${escapeHtml(r.name)}</option>
            `).join('')}
          </select>
        </div>
        <div style="flex:1; min-width:200px;">
          <label class="muted" style="display:block; margin-bottom:6px;">${t('inventory.status')}</label>
          <select class="input" id="filterStatus">
            <option value="all">${t('inventory.status_all')}</option>
            <option value="active" ${filterStatus==='active'?'selected':''}>${t('inventory.status.active')}</option>
            <option value="repair" ${filterStatus==='repair'?'selected':''}>${t('inventory.status.repair')}</option>
            <option value="disposed" ${filterStatus==='disposed'?'selected':''}>${t('inventory.status.disposed')}</option>
          </select>
        </div>
        <div style="display:flex; align-items:flex-end;">
          <button class="btn" data-action="add-inventory" data-property-id="${currentProperty.id}">${t('inventory.add')}</button>
        </div>
      </div>
    </div>

    ${filteredItems.length === 0 ? `
      <div class="card" style="padding:60px; text-align:center;">
        <div style="font-size:48px; margin-bottom:16px;">📦</div>
        <div class="h1" style="margin-bottom:10px;">${t('inventory.empty_title')}</div>
        <p style="color:var(--muted); margin-bottom:24px;">
          ${t('inventory.empty_desc')}
        </p>
        <button class="btn" data-action="add-inventory" data-property-id="${currentProperty.id}">${t('inventory.add')}</button>
      </div>
    ` : `
      <div class="grid">
        ${filteredItems.map(item=>{
          const cat = categories[item.category] || categories.other;
          const room = rooms.find(r=>r.id===item.room_id);
          const status = statusMap[item.status || 'active'] || statusMap.active;

          let warrantyStatus = null;
          if(item.warranty_until){
            const warrantyDate = new Date(item.warranty_until);
            const daysLeft = Math.floor((warrantyDate - today) / (1000*60*60*24));
            if(daysLeft < 0) warrantyStatus = { text: t('inventory.warranty_expired'), color: 'var(--muted)' };
            else if(daysLeft <= 30) warrantyStatus = { text: t('inventory.days_short', { count: daysLeft }), color: 'var(--warn)' };
            else warrantyStatus = { text: t('inventory.days_short', { count: daysLeft }), color: 'var(--ok)' };
          }

          return `
            <div class="card" style="border-left:4px solid ${cat.color};">
              <div class="cardHeader">
                <div>
                  <div style="font-size:24px; margin-bottom:4px;">${cat.icon}</div>
                  <div class="cardTitle">${escapeHtml(item.name)}</div>
                  <div class="muted" style="font-size:12px; margin-top:2px;">${cat.name}</div>
                </div>
                <div class="itemActions">
                  <button class="iconBtn" data-action="edit-inventory" data-property-id="${currentProperty.id}" data-item-id="${item.id}" title="${t('btn.edit')}">✏️</button>
                  <button class="iconBtn" data-action="delete-inventory" data-item-id="${item.id}" title="${t('btn.delete')}">🗑️</button>
                </div>
              </div>
              <div class="cardBody">
                <div class="badge" style="border-color:${status.color}; background:${status.color}22; margin-bottom:8px;">
                  ${escapeHtml(status.label)}
                </div>
                ${item.brand ? `<div class="muted" style="margin-bottom:4px;">${t('inventory.brand')}: ${escapeHtml(item.brand)}</div>` : ''}
                ${item.model ? `<div class="muted" style="margin-bottom:4px;">${t('inventory.model')}: ${escapeHtml(item.model)}</div>` : ''}
                ${room ? `<div class="muted" style="margin-bottom:4px;">📍 ${escapeHtml(room.name)}</div>` : ''}
                ${item.purchase_price ? `<div style="font-size:18px; font-weight:600; margin-top:8px;">${item.purchase_price.toLocaleString('ru-RU')} ₽</div>` : ''}
                ${item.purchase_date ? `<div class="muted" style="font-size:11px; margin-top:2px;">${t('inventory.purchase_date')}: ${item.purchase_date}</div>` : ''}
                ${warrantyStatus ? `
                  <div class="badge" style="margin-top:8px; border-color:${warrantyStatus.color}; background:${warrantyStatus.color}22;">
                    🛡️ ${t('inventory.warranty')}: ${warrantyStatus.text}
                  </div>
                ` : ''}
                ${item.serial_number ? `<div class="muted" style="margin-top:8px; font-size:11px;">${t('inventory.serial_number')}: ${escapeHtml(item.serial_number)}</div>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `}
  `;

  $('#filterCategory').onchange = (e)=>{
    if(!state.inventoryFilter) state.inventoryFilter = {};
    state.inventoryFilter.category = e.target.value;
    renderInventory();
  };

  const propertyPicker = $('#propertyPicker');
  if(propertyPicker){
    propertyPicker.onchange = () => {
      setCurrentPropertyId(propertyPicker.value);
      if(!state.inventoryFilter) state.inventoryFilter = {};
      state.inventoryFilter.room = 'all';
      renderInventory();
    };
  }

  $('#filterRoom').onchange = (e)=>{
    if(!state.inventoryFilter) state.inventoryFilter = {};
    state.inventoryFilter.room = e.target.value;
    renderInventory();
  };
  $('#filterStatus').onchange = (e)=>{
    if(!state.inventoryFilter) state.inventoryFilter = {};
    state.inventoryFilter.status = e.target.value;
    renderInventory();
  };

  // Inventory action handlers
  $$('[data-action="add-inventory"]').forEach(btn => {
    btn.onclick = () => {
      const propertyId = btn.dataset.propertyId;
      openInventoryModal(propertyId);
    };
  });

  $$('[data-action="edit-inventory"]').forEach(btn => {
    btn.onclick = () => {
      const propertyId = btn.dataset.propertyId;
      const itemId = btn.dataset.itemId;
      openInventoryModal(propertyId, itemId);
    };
  });

  $$('[data-action="delete-inventory"]').forEach(btn => {
    btn.onclick = () => {
      const itemId = btn.dataset.itemId;
      deleteInventoryItem(itemId);
    };
  });
}

async function deleteInventoryItem(itemId){
  if(!confirm(t('inventory.delete_confirm'))) return;
  const res = await api.inventory.delete({ id: itemId });
  if(!res.ok) return toast(res.error);
  toast(t('common.deleted'), 'success');
  renderInventory();
}

async function openInventoryModal(propertyId, itemId = null){
  const roomsRes = await api.rooms.list({ property_id: propertyId });
  const rooms = roomsRes.ok ? roomsRes.data : [];

  let existing = null;
  if(itemId){
    const res = await api.inventory.get({ id: itemId });
    if(!res.ok) return toast(res.error);
    existing = res.data;
  }

  const categories = [
    { value: 'electronics', label: `📱 ${t('inventory.category.electronics')}` },
    { value: 'appliances', label: `🔌 ${t('inventory.category.appliances')}` },
    { value: 'furniture', label: `🛋️ ${t('inventory.category.furniture')}` },
    { value: 'tools', label: `🔧 ${t('inventory.category.tools')}` },
    { value: 'kitchen', label: `🍳 ${t('inventory.category.kitchen')}` },
    { value: 'decor', label: `🖼️ ${t('inventory.category.decor')}` },
    { value: 'other', label: `📦 ${t('inventory.category.other')}` }
  ];
  const statuses = [
    { value: 'active', label: t('inventory.status.active') },
    { value: 'repair', label: t('inventory.status.repair') },
    { value: 'disposed', label: t('inventory.status.disposed') }
  ];

  const title = existing ? t('inventory.edit_title') : t('inventory.new_title');

  const html = `
    <div class="form">
      <div>
        <label class="muted">${t('inventory.category_required')}</label>
        <select class="input" id="itemCategory">
          ${categories.map(c=>`<option value="${c.value}" ${existing?.category===c.value?'selected':''}>${c.label}</option>`).join('')}
        </select>
      </div>

      <div>
        <label class="muted">${t('inventory.name_required')}</label>
        <input class="input" id="itemName" value="${escapeHtml(existing?.name||'')}" placeholder="${t('inventory.name_placeholder')}" />
      </div>

      <div class="formRow">
        <div>
          <label class="muted">${t('inventory.brand')}</label>
          <input class="input" id="itemBrand" value="${escapeHtml(existing?.brand||'')}" placeholder="Samsung" />
        </div>
        <div>
          <label class="muted">${t('inventory.model')}</label>
          <input class="input" id="itemModel" value="${escapeHtml(existing?.model||'')}" placeholder="RB37J5000SA" />
        </div>
      </div>

      <div>
        <label class="muted">${t('inventory.room')}</label>
        <select class="input" id="itemRoom">
          <option value="">${t('inventory.room_unspecified')}</option>
          ${rooms.map(r=>`<option value="${r.id}" ${existing?.room_id===r.id?'selected':''}>${escapeHtml(r.name)}</option>`).join('')}
        </select>
      </div>

      <div>
        <label class="muted">${t('inventory.status')}</label>
        <select class="input" id="itemStatus">
          ${statuses.map(s=>`<option value="${s.value}" ${(existing?.status || 'active')===s.value?'selected':''}>${s.label}</option>`).join('')}
        </select>
      </div>

      <div class="formRow">
        <div>
          <label class="muted">${t('inventory.price_label')}</label>
          <input type="number" class="input" id="itemPrice" value="${existing?.purchase_price||''}" placeholder="50000" />
        </div>
        <div>
          <label class="muted">${t('inventory.purchase_date')}</label>
          <input type="date" class="input" id="itemPurchaseDate" value="${existing?.purchase_date||''}" />
        </div>
      </div>

      <div class="formRow">
        <div>
          <label class="muted">${t('inventory.serial_number')}</label>
          <input class="input" id="itemSerial" value="${escapeHtml(existing?.serial_number||'')}" placeholder="ABC123456789" />
        </div>
        <div>
          <label class="muted">${t('inventory.warranty_until')}</label>
          <input type="date" class="input" id="itemWarranty" value="${existing?.warranty_until||''}" />
        </div>
      </div>

      <div>
        <label class="muted">${t('label.notes')}</label>
        <textarea class="input" id="itemNotes" rows="3" placeholder="${t('inventory.notes_placeholder')}">${escapeHtml(existing?.notes||'')}</textarea>
      </div>

      <div class="row" style="gap:12px; margin-top:12px;">
        <button class="btn" id="saveItemBtn">${t('btn.save')}</button>
        <button class="btn" data-action="close-modal">${t('btn.cancel')}</button>
      </div>
    </div>
  `;

  openModal(title, html, (root)=>{
    $('#saveItemBtn', root).onclick = async ()=>{
      const name = $('#itemName', root).value.trim();
      if(!name) return toast(t('inventory.name_required_short'));

      const payload = {
        property_id: propertyId,
        category: $('#itemCategory', root).value,
        name,
        brand: $('#itemBrand', root).value.trim(),
        model: $('#itemModel', root).value.trim(),
        room_id: $('#itemRoom', root).value || null,
        status: $('#itemStatus', root).value,
        purchase_price: parseFloat($('#itemPrice', root).value) || null,
        purchase_date: $('#itemPurchaseDate', root).value || null,
        serial_number: $('#itemSerial', root).value.trim(),
        warranty_until: $('#itemWarranty', root).value || null,
        notes: $('#itemNotes', root).value.trim()
      };

      let res;
      if(existing) res = await api.inventory.update({ id: existing.id, patch: payload });
      else res = await api.inventory.create(payload);

      if(!res.ok) return toast(res.error);

      closeModal();
      toast(t('msg.saved'), 'success');
      renderInventory();
      checkAchievementsDebounced();
    };
  });
}

// ============================================
// NEW MODULE: CONTACTS (v2.0)
// ============================================

async function renderContacts(){
  const contactsRes = await api.contacts.list({});
  if(!contactsRes.ok) return $('#content').innerHTML=`<div class="h1">${t('common.error')}: ${escapeHtml(contactsRes.error)}</div>`;

  const contacts = contactsRes.data;

  const contactTypes = {
    property_manager: { name: t('contacts.type.property_manager'), icon: '🏢', color: '#3b82f6' },
    repair_service: { name: t('contacts.type.repair_service'), icon: '🔧', color: '#ef4444' },
    utility_company: { name: t('contacts.type.utility_company'), icon: '💡', color: '#f59e0b' },
    emergency: { name: t('contacts.type.emergency'), icon: '🚨', color: '#dc2626' },
    other: { name: t('contacts.type.other'), icon: '📞', color: '#6b7280' }
  };

  const filterType = state.contactsFilter?.type || 'all';

  let filteredContacts = contacts;
  if(filterType !== 'all') filteredContacts = filteredContacts.filter(c => c.type === filterType);

  // Sort favorites first
  filteredContacts.sort((a, b) => {
    if(a.is_favorite && !b.is_favorite) return -1;
    if(!a.is_favorite && b.is_favorite) return 1;
    return 0;
  });
  const favoriteContacts = filteredContacts.filter(c => c.is_favorite);
  const nonFavoriteContacts = filteredContacts.filter(c => !c.is_favorite);

  const renderContactCard = (contact) => {
    const type = contactTypes[contact.type] || contactTypes.other;
    return `
      <div class="card" style="border-left:4px solid ${type.color};">
        <div class="cardHeader">
          <div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
              <div style="font-size:20px;">${type.icon}</div>
              ${contact.is_favorite ? `<div style="font-size:16px;">⭐</div>` : ''}
            </div>
            <div class="cardTitle">${escapeHtml(contact.name)}</div>
            <div class="muted" style="font-size:12px; margin-top:2px;">${type.name}</div>
          </div>
          <div class="itemActions">
            <button class="iconBtn" data-contact-edit="${contact.id}" title="${t('btn.edit')}">✏️</button>
            <button class="iconBtn" data-contact-delete="${contact.id}" title="${t('btn.delete')}">🗑️</button>
          </div>
        </div>
        <div class="cardBody">
          ${contact.company ? `<div style="font-weight:600; margin-bottom:8px;">${escapeHtml(contact.company)}</div>` : ''}
          ${contact.phone ? `
            <div style="margin-bottom:6px;">
              <a href="tel:${escapeHtml(contact.phone)}" style="color:var(--accent); text-decoration:none;">
                📱 ${escapeHtml(contact.phone)}
              </a>
            </div>
          ` : ''}
          ${contact.email ? `
            <div style="margin-bottom:6px;">
              <a href="mailto:${escapeHtml(contact.email)}" style="color:var(--accent); text-decoration:none; font-size:12px;">
                ✉️ ${escapeHtml(contact.email)}
              </a>
            </div>
          ` : ''}
          ${contact.address ? `<div class="muted" style="font-size:12px; margin-top:8px;">📍 ${escapeHtml(contact.address)}</div>` : ''}
          ${contact.notes ? `<div class="muted" style="font-size:12px; margin-top:8px; font-style:italic;">${escapeHtml(contact.notes)}</div>` : ''}
        </div>
      </div>
    `;
  };

  $('#content').innerHTML = `
    <div class="h1">📞 ${t('contacts.title')}</div>

    <div class="card" style="margin-bottom:16px;">
      <div class="row" style="flex-wrap:wrap; gap:12px;">
        <div style="flex:1; min-width:200px;">
          <label class="muted" style="display:block; margin-bottom:6px;">${t('contacts.type_label')}</label>
          <select class="input" id="filterType">
            <option value="all">${t('contacts.type_all')}</option>
            ${Object.entries(contactTypes).map(([k,v])=>`
              <option value="${k}" ${filterType===k?'selected':''}>${v.icon} ${v.name}</option>
            `).join('')}
          </select>
        </div>
        <div style="display:flex; align-items:flex-end;">
          <button class="btn" id="btnAddContact">${t('contacts.add')}</button>
        </div>
      </div>
    </div>

    ${favoriteContacts.length > 0 ? `
      <div class="card" style="margin-bottom:16px;">
        <div class="cardHeader">
          <div class="cardTitle">⭐ ${t('contacts.favorites')}</div>
          <span class="badge">${favoriteContacts.length}</span>
        </div>
        <div class="cardBody">
          <div class="grid">
            ${favoriteContacts.map(renderContactCard).join('')}
          </div>
        </div>
      </div>
    ` : ''}

    ${favoriteContacts.length === 0 && nonFavoriteContacts.length === 0 ? `
      <div class="card" style="padding:60px; text-align:center;">
        <div style="font-size:48px; margin-bottom:16px;">📞</div>
        <div class="h1" style="margin-bottom:10px;">${t('contacts.empty_title')}</div>
        <p style="color:var(--muted); margin-bottom:24px;">
          ${filterType === 'all' ? t('contacts.empty_desc') : t('contacts.empty_filtered')}
        </p>
        ${filterType === 'all' ? `<button class="btn" id="btnAddContactEmpty">${t('contacts.add')}</button>` : ''}
      </div>
    ` : `
      <div class="grid">
        ${(favoriteContacts.length > 0 ? nonFavoriteContacts : filteredContacts).map(renderContactCard).join('')}
      </div>
    `}
  `;

  $('#filterType').onchange = (e)=>{
    if(!state.contactsFilter) state.contactsFilter = {};
    state.contactsFilter.type = e.target.value;
    renderContacts();
  };

  // Attach event listeners (CSP-compliant)
  const btnAdd = $('#btnAddContact');
  if(btnAdd) btnAdd.onclick = () => openContactModal();

  const btnAddEmpty = $('#btnAddContactEmpty');
  if(btnAddEmpty) btnAddEmpty.onclick = () => openContactModal();

  $$('[data-contact-edit]').forEach(btn => {
    btn.onclick = () => openContactModal(btn.dataset.contactEdit);
  });

  $$('[data-contact-delete]').forEach(btn => {
    btn.onclick = () => deleteContact(btn.dataset.contactDelete);
  });
}

async function deleteContact(contactId){
  if(!confirm(t('contacts.delete_confirm'))) return;
  const res = await api.contacts.delete({ id: contactId });
  if(!res.ok) return toast(res.error);
  toast(t('common.deleted'), 'success');
  renderContacts();
}

async function openContactModal(contactId = null){
  let existing = null;
  if(contactId){
    const res = await api.contacts.get({ id: contactId });
    if(!res.ok) return toast(res.error);
    existing = res.data;
  }

  const contactTypes = [
    { value: 'property_manager', label: `🏢 ${t('contacts.type.property_manager')}` },
    { value: 'repair_service', label: `🔧 ${t('contacts.type.repair_service')}` },
    { value: 'utility_company', label: `💡 ${t('contacts.type.utility_company')}` },
    { value: 'emergency', label: `🚨 ${t('contacts.type.emergency')}` },
    { value: 'other', label: `📞 ${t('contacts.type.other')}` }
  ];

  const title = existing ? t('contacts.edit_title') : t('contacts.new_title');

  const html = `
    <div class="form">
      <div>
        <label class="muted">${t('contacts.type_required')}</label>
        <select class="input" id="contactType">
          ${contactTypes.map(c=>`<option value="${c.value}" ${existing?.type===c.value?'selected':''}>${c.label}</option>`).join('')}
        </select>
      </div>

      <div>
        <label class="muted">${t('contacts.name_required')}</label>
        <input class="input" id="contactName" value="${escapeHtml(existing?.name||'')}" placeholder="${t('contacts.name_placeholder')}" />
      </div>

      <div>
        <label class="muted">${t('contacts.company')}</label>
        <input class="input" id="contactCompany" value="${escapeHtml(existing?.company||'')}" placeholder="${t('contacts.company_placeholder')}" />
      </div>

      <div class="formRow">
        <div>
          <label class="muted">${t('contacts.phone_required')}</label>
          <input type="tel" class="input" id="contactPhone" value="${escapeHtml(existing?.phone||'')}" placeholder="${t('contacts.phone_placeholder')}" />
        </div>
        <div>
          <label class="muted">${t('contacts.email')}</label>
          <input type="email" class="input" id="contactEmail" value="${escapeHtml(existing?.email||'')}" placeholder="info@example.com" />
        </div>
      </div>

      <div>
        <label class="muted">${t('contacts.address')}</label>
        <input class="input" id="contactAddress" value="${escapeHtml(existing?.address||'')}" placeholder="${t('contacts.address_placeholder')}" />
      </div>

      <div>
        <label class="muted">${t('label.notes')}</label>
        <textarea class="input" id="contactNotes" rows="3" placeholder="${t('contacts.notes_placeholder')}">${escapeHtml(existing?.notes||'')}</textarea>
      </div>

      <div>
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
          <input type="checkbox" id="contactFavorite" ${existing?.is_favorite?'checked':''} />
          <span>⭐ ${t('contacts.add_favorite')}</span>
        </label>
      </div>

      <div class="row" style="gap:12px; margin-top:12px;">
        <button class="btn" id="saveContactBtn">${t('btn.save')}</button>
        <button class="btn" data-action="close-modal">${t('btn.cancel')}</button>
      </div>
    </div>
  `;

  openModal(title, html, (root)=>{
    $('#saveContactBtn', root).onclick = async ()=>{
      const nameField = $('#contactName', root);
      const phoneField = $('#contactPhone', root);
      const emailField = $('#contactEmail', root);

      const name = nameField.value.trim();
      const phone = phoneField.value.trim();
      const email = emailField.value.trim();

      // Validation
      if (!validators.isRequired(name)) {
        markFieldInvalid(nameField, t('contacts.name_required_error'));
        return;
      }

      if (!validators.maxLength(name, 100)) {
        markFieldInvalid(nameField, t('contacts.name_max'));
        return;
      }

      if (!validators.isRequired(phone)) {
        markFieldInvalid(phoneField, t('contacts.phone_required_error'));
        return;
      }

      if (!validators.isValidPhone(phone)) {
        markFieldInvalid(phoneField, t('contacts.phone_invalid'));
        return;
      }

      if (email && !validators.isValidEmail(email)) {
        markFieldInvalid(emailField, t('contacts.email_invalid'));
        return;
      }

      const payload = {
        type: $('#contactType', root).value,
        name,
        company: $('#contactCompany', root).value.trim(),
        phone,
        email,
        address: $('#contactAddress', root).value.trim(),
        notes: $('#contactNotes', root).value.trim(),
        is_favorite: $('#contactFavorite', root).checked
      };

      let res;
      if(existing) res = await api.contacts.update({ id: existing.id, patch: payload });
      else res = await api.contacts.create(payload);

      if(!res.ok) return toast(res.error);

      closeModal();
      toast(t('msg.saved'), 'success');
      renderContacts();
      checkAchievementsDebounced();
    };
  });
}

// ============================================
// NEW MODULE: CHECKLISTS (v2.0)
// ============================================

async function renderChecklists(){
  const checklistsRes = await api.checklists.list();
  if(!checklistsRes.ok) return $('#content').innerHTML=`<div class="h1">${t('common.error')}: ${escapeHtml(checklistsRes.error)}</div>`;

  const checklists = checklistsRes.data;
  if(!state.checklistsFilter) state.checklistsFilter = { status: 'all' };
  const checklistStatus = state.checklistsFilter.status || 'all';

  // Get progress for all checklists
  const checklistsWithProgress = await Promise.all(checklists.map(async (cl)=>{
    const progRes = await api.checklists.getProgress({ id: cl.id });
    const progress = progRes.ok ? normalizeChecklistProgress(progRes.data, cl) : { completed: [], total: cl.items.length };
    return { ...cl, progress };
  }));

  const checklistCategories = {
    moving: { name: t('checklists.category.moving'), icon: '📦', color: '#3b82f6' },
    seasonal: { name: t('checklists.category.seasonal'), icon: '🍂', color: '#f59e0b' },
    safety: { name: t('checklists.category.safety'), icon: '🛡️', color: '#ef4444' },
    maintenance: { name: t('checklists.category.maintenance'), icon: '🔧', color: '#8b5cf6' },
    other: { name: t('checklists.category.other'), icon: '✅', color: '#6b7280' }
  };

  const filteredChecklists = checklistsWithProgress.filter(cl=>{
    if(checklistStatus === 'all') return true;
    const completed = cl.progress.completed.length;
    const total = cl.progress.total;
    if(checklistStatus === 'done') return total > 0 && completed === total;
    if(checklistStatus === 'active') return total > 0 && completed < total;
    return true;
  });

  $('#content').innerHTML = `
    <div class="row" style="justify-content:space-between; align-items:center;">
      <div class="h1">✅ ${t('checklists.title')}</div>
      <button class="btn" id="addChecklistBtn">${t('checklists.add')}</button>
    </div>
    <div class="row" style="margin-top:8px; gap:8px;">
      <button class="btn ${checklistStatus==='all'?'warn':''}" data-checklist-filter="all">${t('checklists.filter_all')}</button>
      <button class="btn ${checklistStatus==='done'?'warn':''}" data-checklist-filter="done">${t('checklists.filter_done')}</button>
      <button class="btn ${checklistStatus==='active'?'warn':''}" data-checklist-filter="active">${t('checklists.filter_active')}</button>
    </div>

    <div class="card" style="margin-bottom:16px; padding:20px;">
      <div class="muted" style="margin-bottom:8px;">${t('checklists.info_title')}</div>
      <div style="font-size:14px;">
        ${t('checklists.info_desc')}
      </div>
    </div>

    ${filteredChecklists.length === 0 ? `
      <div class="card" style="padding:60px; text-align:center;">
        <div style="font-size:48px; margin-bottom:16px;">✅</div>
        <div class="h1" style="margin-bottom:10px;">${t('checklists.empty_title')}</div>
        <p style="color:var(--muted);">
          ${t('checklists.empty_desc')}
        </p>
      </div>
    ` : `
      <div class="grid">
        ${filteredChecklists.map(checklist=>{
          const cat = checklistCategories[checklist.category] || checklistCategories.other;
          const completedCount = checklist.progress.completed.length;
          const totalCount = checklist.progress.total;
          const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

          return `
            <div class="card" style="border-left:4px solid ${cat.color};">
              <div class="cardHeader" style="justify-content:space-between;">
                <div>
                  <div style="font-size:24px; margin-bottom:4px;">${cat.icon}</div>
                  <div class="cardTitle">${escapeHtml(checklist.name)}</div>
                  <div class="muted" style="font-size:12px; margin-top:2px;">${cat.name}</div>
                </div>
                <div class="itemActions">
                  <label style="display:flex; align-items:center; gap:6px; cursor:pointer; margin-right:8px;" title="${t('checklists.show_on_dashboard')}">
                    <input type="checkbox" ${checklist.is_active ? 'checked' : ''} data-checklist-toggle="${checklist.id}" style="cursor:pointer;">
                    <span style="font-size:12px; color:var(--muted);">${t('checklists.active')}</span>
                  </label>
                  <button class="iconBtn" data-checklist-edit="${checklist.id}" title="${t('btn.edit')}">✎</button>
                  <button class="iconBtn danger" data-checklist-del="${checklist.id}" title="${t('btn.delete')}">🗑</button>
                </div>
              </div>
              <div class="cardBody">
                ${checklist.description ? `<div class="muted" style="margin-bottom:12px; font-size:13px;">${escapeHtml(checklist.description)}</div>` : ''}

                <div style="margin-bottom:12px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <div class="muted" style="font-size:12px;">${t('checklists.progress')}</div>
                    <div style="font-size:14px; font-weight:600;">${completedCount} / ${totalCount}</div>
                  </div>
                  <div style="background:var(--border); height:8px; border-radius:999px; overflow:hidden;">
                    <div style="background:var(--ok); height:100%; width:${percentage}%; transition:width 0.3s;"></div>
                  </div>
                  <div class="muted" style="font-size:11px; margin-top:4px; text-align:right;">${percentage}%</div>
                </div>

                <div class="row" style="gap:8px;">
                  <button class="btn" data-checklist-open="${checklist.id}" style="flex:1;">${t('btn.open')}</button>
                  ${completedCount > 0 ? `
                    <button class="iconBtn" data-checklist-reset="${checklist.id}" title="${t('checklists.reset_progress')}">🔄</button>
                  ` : ''}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `}
  `;

  const addBtn = $('#addChecklistBtn');
  if(addBtn) addBtn.onclick = ()=>openChecklistModal();
  $$('[data-checklist-filter]').forEach(btn=>{
    btn.onclick=()=>{
      state.checklistsFilter.status = btn.dataset.checklistFilter;
      renderChecklists();
    };
  });

  $$('[data-checklist-open]').forEach(btn=>{
    btn.onclick=()=>viewChecklist(btn.dataset.checklistOpen);
  });
  $$('[data-checklist-reset]').forEach(btn=>{
    btn.onclick=()=>resetChecklistProgress(btn.dataset.checklistReset);
  });
  $$('[data-checklist-edit]').forEach(btn=>{
    const cl = checklistsWithProgress.find(c=>c.id===btn.dataset.checklistEdit);
    if(cl) btn.onclick=()=>openChecklistModal(cl);
  });
  $$('[data-checklist-del]').forEach(btn=>{
    btn.onclick=async ()=>{
      if(!confirm(t('checklists.delete_confirm'))) return;
      const r = await api.checklists.delete({ id: btn.dataset.checklistDel });
      if(!r.ok) return toast(r.error, 'error');
      toast(t('common.deleted'), 'success');
      renderChecklists();
    };
  });
  $$('[data-checklist-toggle]').forEach(checkbox=>{
    checkbox.onchange=async ()=>{
      const id = checkbox.dataset.checklistToggle;
      const is_active = checkbox.checked;
      const r = await api.checklists.update({ id, patch: { is_active } });
      if(!r.ok) return toast(r.error, 'error');
      toast(is_active ? t('checklists.activated') : t('checklists.deactivated'), 'success');
    };
  });
}

function openChecklistModal(existing=null){
  const isEdit = Boolean(existing?.id);
  const categories = [
    { value: 'moving', label: `📦 ${t('checklists.category.moving')}` },
    { value: 'seasonal', label: `🍂 ${t('checklists.category.seasonal')}` },
    { value: 'safety', label: `🛡️ ${t('checklists.category.safety')}` },
    { value: 'maintenance', label: `🔧 ${t('checklists.category.maintenance')}` },
    { value: 'other', label: `✅ ${t('checklists.category.other')}` }
  ];
  const templates = [
    {
      id: 'moving_basic',
      name: `📦 ${t('checklists.template.moving_basic')}`,
      category: 'moving',
      items: [
        t('checklists.template.moving_item_1'),
        t('checklists.template.moving_item_2'),
        t('checklists.template.moving_item_3'),
        t('checklists.template.moving_item_4'),
        t('checklists.template.moving_item_5')
      ]
    },
    {
      id: 'seasonal_winter',
      name: `❄️ ${t('checklists.template.seasonal_winter')}`,
      category: 'seasonal',
      items: [
        t('checklists.template.seasonal_item_1'),
        t('checklists.template.seasonal_item_2'),
        t('checklists.template.seasonal_item_3'),
        t('checklists.template.seasonal_item_4')
      ]
    },
    {
      id: 'safety_home',
      name: `🛡️ ${t('checklists.template.safety_home')}`,
      category: 'safety',
      items: [
        t('checklists.template.safety_item_1'),
        t('checklists.template.safety_item_2'),
        t('checklists.template.safety_item_3'),
        t('checklists.template.safety_item_4')
      ]
    }
  ];

  const itemsText = (existing?.items || [])
    .map(item => (typeof item === 'string' ? item : (item?.text || '')).trim())
    .filter(Boolean)
    .join('\n');

  const html = `
    <div class="form">
      ${isEdit ? '' : `
        <div class="formRow">
          <select class="input" id="checklistTemplate">
            <option value="">${t('checklists.template_optional')}</option>
            ${templates.map(t=>`<option value="${t.id}">${t.name}</option>`).join('')}
          </select>
        </div>
      `}
      <div class="formRow">
        <input class="input" id="checklistName" placeholder="${t('label.title')}" value="${escapeHtml(existing?.name||'')}" />
        <select id="checklistCategory">
          ${categories.map(c=>`<option value="${c.value}" ${existing?.category===c.value?'selected':''}>${c.label}</option>`).join('')}
        </select>
      </div>
      <textarea class="input" id="checklistDesc" placeholder="${t('checklists.desc_optional')}">${escapeHtml(existing?.description||'')}</textarea>
      <textarea class="input" id="checklistItems" rows="8" placeholder="${t('checklists.items_placeholder')}">${escapeHtml(itemsText)}</textarea>
      <div class="row" style="justify-content:flex-end;">
        <button class="btn" id="saveChecklistBtn">${t('btn.save')}</button>
      </div>
    </div>
  `;

  openModal(isEdit ? t('checklists.edit_title') : t('checklists.new_title'), html, (root)=>{
    const templateSelect = $('#checklistTemplate', root);
    if(templateSelect){
      templateSelect.onchange = ()=>{
        const tpl = templates.find(t=>t.id===templateSelect.value);
        if(!tpl) return;
        const nameField = $('#checklistName', root);
        const itemsField = $('#checklistItems', root);
        const descField = $('#checklistDesc', root);
        const hasContent = nameField.value.trim() || itemsField.value.trim() || descField.value.trim();
        if(hasContent && !confirm(t('checklists.template_confirm'))) return;
        nameField.value = tpl.name.replace(/^[^\s]+\s/, '').trim();
        $('#checklistCategory', root).value = tpl.category;
        itemsField.value = tpl.items.join('\n');
      };
    }
    $('#saveChecklistBtn', root).onclick = async ()=>{
      const name = $('#checklistName', root).value.trim();
      const category = $('#checklistCategory', root).value;
      const description = $('#checklistDesc', root).value.trim();
      const items = $('#checklistItems', root).value
        .split('\n')
        .map(s=>s.trim())
        .filter(Boolean);

      if(!name) return toast(t('checklists.name_required'));
      if(items.length === 0) return toast(t('checklists.items_required'));

      const payload = { name, category, description, items };
      let res;
      if(isEdit) res = await api.checklists.update({ id: existing.id, patch: payload });
      else res = await api.checklists.create(payload);

      if(!res.ok) return toast(res.error);
      closeModal();
      toast(t('msg.saved'), 'success');
      renderChecklists();
    };
  });
}

function openExpenseModal(existing){
  if(!existing) return;
  openModal(t('expenses.title'), `
    <div class="form">
      <div class="formRow">
        <input class="input" id="expenseAmount" placeholder="${t('expenses.amount_placeholder')}" value="${escapeHtml(String(existing.amount ?? 0))}" />
        <input type="date" class="input" id="expenseDate" value="${escapeHtml(existing.spent_at||todayISO())}" />
      </div>
      <textarea class="input" id="expenseNote" placeholder="${t('expenses.note_placeholder')}">${escapeHtml(existing.note||'')}</textarea>
      <div class="muted" style="font-size:12px;">${t('expenses.negative_hint')}</div>
      <div class="row" style="justify-content:space-between;">
        <button class="btn danger" id="expenseDeleteBtn">${t('btn.delete')}</button>
        <button class="btn" id="expenseSaveBtn">${t('btn.save')}</button>
      </div>
    </div>
  `, (root)=>{
    $('#expenseSaveBtn', root).onclick = async ()=>{
      const amount = Number($('#expenseAmount', root).value.trim());
      const spent_at = $('#expenseDate', root).value.trim() || todayISO();
      const note = $('#expenseNote', root).value.trim();
      if(Number.isNaN(amount)) return toast(t('expenses.amount_invalid'));
      const r = await api.expenses.update({ id: existing.id, patch: { amount, spent_at, note } });
      if(!r.ok) return toast(r.error, 'error');
      closeModal();
      toast(t('msg.saved'), 'success');
      renderCalendar();
    };
    $('#expenseDeleteBtn', root).onclick = async ()=>{
      if(!confirm(t('expenses.delete_confirm'))) return;
      const r = await api.expenses.delete({ id: existing.id });
      if(!r.ok) return toast(r.error, 'error');
      closeModal();
      toast(t('common.deleted'), 'success');
      renderCalendar();
    };
  });
}

async function viewChecklist(checklistId){
  const clRes = await api.checklists.get({ id: checklistId });
  if(!clRes.ok) return toast(clRes.error);

  const checklist = clRes.data;

  const progRes = await api.checklists.getProgress({ id: checklistId });
  const progress = progRes.ok ? normalizeChecklistProgress(progRes.data, checklist) : { completed: [], total: checklist.items.length };

  const html = `
    <div>
      <div style="font-size:20px; font-weight:700; margin-bottom:8px;">${escapeHtml(checklist.name)}</div>
      ${checklist.description ? `<div class="muted" style="margin-bottom:16px;">${escapeHtml(checklist.description)}</div>` : ''}

      <div style="margin-bottom:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <div class="muted">${t('checklists.progress')}</div>
          <div style="font-weight:600;">${progress.completed.length} / ${progress.total}</div>
        </div>
        <div style="background:var(--border); height:10px; border-radius:999px; overflow:hidden;">
          <div style="background:var(--ok); height:100%; width:${Math.round((progress.completed.length / progress.total) * 100)}%; transition:width 0.3s;"></div>
        </div>
      </div>

      <div class="list" style="max-height:60vh; overflow:auto;">
        ${checklist.items.map((item, idx)=>{
          const text = typeof item === 'string' ? item : (item?.text || '');
          const isCompleted = progress.completed.includes(idx);
          return `
            <label class="item" style="cursor:pointer; ${isCompleted ? 'opacity:0.6;' : ''}">
              <div class="row" style="align-items:flex-start; gap:12px;">
                <input
                  type="checkbox"
                  ${isCompleted ? 'checked' : ''}
                  data-checklist-toggle="${checklistId}"
                  data-item-index="${idx}"
                  style="margin-top:4px; cursor:pointer;"
                />
                <div style="flex:1; ${isCompleted ? 'text-decoration:line-through;' : ''}">${escapeHtml(text)}</div>
              </div>
            </label>
          `;
        }).join('')}
      </div>

      <div class="row" style="gap:12px; margin-top:16px;">
        <button class="btn" id="closeChecklistModal">${t('btn.close')}</button>
        ${progress.completed.length > 0 ? `
          <button class="btn" id="resetChecklistProgressBtn">🔄 ${t('checklists.reset_progress')}</button>
        ` : ''}
      </div>
    </div>
  `;

  openModal(t('checklists.view_title', { name: checklist.name }), html, (root)=>{
    const closeBtn = $('#closeChecklistModal', root);
    if(closeBtn) closeBtn.onclick = closeModal;
    const resetBtn = $('#resetChecklistProgressBtn', root);
    if(resetBtn){
      resetBtn.onclick = async ()=>{
        await resetChecklistProgress(checklistId);
        closeModal();
      };
    }
    $$('[data-checklist-toggle]', root).forEach(input=>{
      input.onchange = () => toggleChecklistItem(
        input.dataset.checklistToggle,
        Number(input.dataset.itemIndex)
      );
    });
  });
}

async function toggleChecklistItem(checklistId, itemIndex){
  const res = await api.checklists.toggleItem({ checklistId, itemIndex });
  if(!res.ok) return toast(res.error);

  // Refresh the modal view
  await renderChecklists();
  checkAchievementsDebounced();
  viewChecklist(checklistId);
}

async function resetChecklistProgress(checklistId){
  if(!confirm(t('checklists.reset_confirm'))) return;
  const res = await api.checklists.resetProgress({ id: checklistId });
  if(!res.ok) return toast(res.error);
  toast(t('checklists.reset_done'));
  renderChecklists();
  checkAchievementsDebounced();
}

async function computeStatsData(filter){
  const now = new Date();
  const range = filter.range || 'month';
  let from = null;
  let to = startOfDayLocal(now);

  if(range === 'today') from = startOfDayLocal(now);
  if(range === 'week') from = startOfWeek(now);
  if(range === 'month') from = startOfMonth(now);
  if(range === 'quarter') from = startOfQuarter(now);
  if(range === 'year') from = startOfYear(now);
  if(range === 'custom'){
    from = filter.from ? parseISODate(filter.from) : startOfMonth(now);
    to = filter.to ? parseISODate(filter.to) : startOfDayLocal(now);
  }
  if(range === 'all'){
    from = null;
    to = null;
  }

  const [
    tasksRes, expensesRes, logsRes,
    inventoryRes, roomsRes, metersRes, propertiesRes,
    contactsRes, documentsRes, checklistsRes, assetsRes, goalsRes
  ] = await Promise.all([
    api.tasks.list({ profile_id: state.profileId, status:'all', range:'all' }),
    api.expenses.list({}),
    api.maintenance.logs.list({}),
    api.inventory.list({}),
    api.rooms.list({}),
    api.meters.list({}),
    api.properties.list(),
    api.contacts.list({}),
    api.documents.list({}),
    api.checklists.list(),
    api.assets.list(),
    api.goals.list({ status:'all' })
  ]);

  const tasks = tasksRes.ok ? tasksRes.data : [];
  const expenses = expensesRes.ok ? expensesRes.data : [];
  const logs = logsRes.ok ? logsRes.data : [];
  const inventory = inventoryRes.ok ? inventoryRes.data : [];
  const rooms = roomsRes.ok ? roomsRes.data : [];
  const meters = metersRes.ok ? metersRes.data : [];
  const properties = propertiesRes.ok ? propertiesRes.data : [];
  const contacts = contactsRes.ok ? contactsRes.data : [];
  const documents = documentsRes.ok ? documentsRes.data : [];
  const checklists = checklistsRes.ok ? checklistsRes.data : [];
  const assets = assetsRes.ok ? assetsRes.data : [];
  const goals = goalsRes.ok ? goalsRes.data : [];

  const propertyId = filter.propertyId && filter.propertyId !== 'all' ? filter.propertyId : null;
  const assetId = filter.assetId && filter.assetId !== 'all' ? filter.assetId : null;
  const onlyCurrent = filter.onlyCurrent !== false;
  const filteredInventory = propertyId ? inventory.filter(i=>i.property_id===propertyId) : inventory;
  const filteredRooms = propertyId ? rooms.filter(r=>r.property_id===propertyId) : rooms;
  const filteredMeters = propertyId ? meters.filter(m=>m.property_id===propertyId) : meters;

  const tasksDone = tasks.filter(t => t.status === 'done' && inRange(t.done_at, from, to));
  const routinesDone = tasksDone.filter(t => t.linked?.type === 'routine').length;
  const tasksDonePlain = tasksDone.filter(t => t.linked?.type !== 'routine').length;

  const checklistProgress = await Promise.all(checklists.map(async (cl)=>{
    const progRes = await api.checklists.getProgress({ id: cl.id });
    return { checklist: cl, progress: progRes.ok ? progRes.data : null };
  }));

  const checklistsCompleted = checklistProgress.filter(({ checklist, progress })=>{
    if(!progress) return false;
    const completed = progress.completed_items || [];
    const total = Array.isArray(checklist.items) ? checklist.items.length : 0;
    if(total === 0 || completed.length !== total) return false;
    return inRange(progress.last_updated, from, to);
  }).length;

  const existingAssetIds = new Set(assets.map(a=>a.id));
  const existingGoalIds = new Set(
    goals.filter(g=>!onlyCurrent || g.status !== 'archived').map(g=>g.id)
  );
  const expenseLogIds = new Set(expenses.map(e=>e.log_id).filter(Boolean));
  const expenseFilter = (e) => {
    if(assetId && e.asset_id !== assetId) return false;
    if(onlyCurrent){
      if(e.asset_id && !existingAssetIds.has(e.asset_id)) return false;
      if(e.goal_id && !existingGoalIds.has(e.goal_id)) return false;
      if(e.amount < 0 && !e.goal_id) return false;
    }
    return true;
  };
  const logFilter = (l) => {
    if(assetId && l.asset_id !== assetId) return false;
    if(onlyCurrent && l.asset_id && !existingAssetIds.has(l.asset_id)) return false;
    return true;
  };

  const spentFromExpenses = expenses
    .filter(expenseFilter)
    .filter(e => e.amount > 0 && inRange(e.spent_at, from, to))
    .reduce((sum, e)=>sum + clampNumber(Number(e.amount)), 0);
  const collected = expenses
    .filter(expenseFilter)
    .filter(e => e.amount < 0 && inRange(e.spent_at, from, to))
    .reduce((sum, e)=>sum + Math.abs(clampNumber(Number(e.amount))), 0);
  const spentFromLogs = logs
    .filter(logFilter)
    .filter(l => l.cost != null && Number(l.cost) > 0 && inRange(l.done_at, from, to) && !expenseLogIds.has(l.id))
    .reduce((sum, l)=>sum + clampNumber(Number(l.cost)), 0);
  const spent = spentFromExpenses + spentFromLogs;

  const totalDoneCombined = tasksDonePlain + routinesDone + checklistsCompleted;

  const inventoryValue = filteredInventory.reduce((sum, item)=>sum + (Number(item.purchase_price) || 0), 0);

  let chartFrom = from;
  let chartTo = to;
  if(!chartFrom || !chartTo){
    chartTo = startOfDayLocal(now);
    chartFrom = new Date(chartTo.getFullYear(), chartTo.getMonth()-5, 1);
  }
  const unit = (chartTo - chartFrom) / (24*3600*1000) <= 62 ? 'day' : 'month';
  const buckets = makeBuckets(chartFrom, chartTo, unit);
  const bucketMap = new Map(buckets.map(b=>[b.label, b]));

  const addToBucket = (iso, field, value) => {
    if(!iso) return;
    const label = unit === 'day' ? iso : iso.slice(0,7);
    const bucket = bucketMap.get(label);
    if(bucket) bucket[field] += value;
  };

  expenses.filter(expenseFilter).forEach(e=>{
    if(!inRange(e.spent_at, chartFrom, chartTo)) return;
    if(e.amount > 0) addToBucket(e.spent_at, 'spent', clampNumber(Number(e.amount)));
    if(e.amount < 0) addToBucket(e.spent_at, 'collected', Math.abs(clampNumber(Number(e.amount))));
  });
  logs.filter(logFilter).forEach(l=>{
    if(l.cost == null || Number(l.cost) <= 0) return;
    if(expenseLogIds.has(l.id)) return;
    if(!inRange(l.done_at, chartFrom, chartTo)) return;
    addToBucket(l.done_at, 'spent', clampNumber(Number(l.cost)));
  });
  tasks.forEach(t=>{
    if(t.status !== 'done') return;
    if(!inRange(t.done_at, chartFrom, chartTo)) return;
    addToBucket(t.done_at, 'done', 1);
  });
  checklistProgress.forEach(({ checklist, progress })=>{
    if(!progress) return;
    const completed = progress.completed_items || [];
    const total = Array.isArray(checklist.items) ? checklist.items.length : 0;
    if(total === 0 || completed.length !== total) return;
    if(!inRange(progress.last_updated, chartFrom, chartTo)) return;
    addToBucket(progress.last_updated, 'done', 1);
  });

  return {
    range,
    from: from ? toISODate(from) : '',
    to: to ? toISODate(to) : '',
    propertyId: propertyId || 'all',
    properties,
    assets,
    totals: {
      spent,
      collected,
      done: totalDoneCombined,
      tasksDone: tasksDonePlain,
      routinesDone,
      checklistsDone: checklistsCompleted,
      inventoryValue,
      inventoryCount: filteredInventory.length,
      roomsCount: filteredRooms.length,
      metersCount: filteredMeters.length,
      propertiesCount: propertyId ? 1 : properties.length,
      contactsCount: contacts.length,
      documentsCount: documents.length
    },
    series: buckets
  };
}

// ============================================
// STATS & ACHIEVEMENTS UI
// ============================================

async function renderStats(){
  if (!state.userStats) {
    await loadUserStats();
  }

  const stats = state.userStats;
  if (!stats) {
    $('#content').innerHTML = `
      <div class="h1">🏆 ${t('stats.achievements_title')}</div>
      <div class="card" style="padding:60px; text-align:center;">
        <div class="muted">${t('stats.load_error')}</div>
      </div>
    `;
    return;
  }

  if (stats.gamification_enabled) {
    await checkAchievements();
  }

  const level = getLevelForXP(stats.xp);
  const { progressXP, requiredXP, percentage } = getXPProgressForCurrentLevel(stats.xp);

  const unlockedSet = new Set(stats.unlocked_achievements || []);
  const unlockedAchievements = ACHIEVEMENTS.filter(a => unlockedSet.has(a.id));
  const lockedAchievements = ACHIEVEMENTS.filter(a => !unlockedSet.has(a.id));

  if(!state.statsFilter){
    state.statsFilter = { range:'month', from:'', to: todayISO(), propertyId:'all', assetId:'all', segmented:false, onlyCurrent:true };
  }
  const statsFilter = state.statsFilter;
  if(!statsFilter.to) statsFilter.to = todayISO();
  const statsData = await computeStatsData(statsFilter);
  const formatMoney = (n) => `${Math.round(n).toLocaleString('ru-RU')} ₽`;
  const propertyOptions = [`<option value="all">${t('stats.all')}</option>`]
    .concat(statsData.properties.map(p=>`<option value="${p.id}" ${statsFilter.propertyId===p.id?'selected':''}>${escapeHtml(p.name)}</option>`))
    .join('');
  const assetOptions = [`<option value="all">${t('stats.all')}</option>`]
    .concat(statsData.assets.map(a=>`<option value="${a.id}" ${statsFilter.assetId===a.id?'selected':''}>${escapeHtml(a.name)}</option>`))
    .join('');

  const statsSection = `
    <div class="h1">📊 ${t('stats.title')}</div>

    <div class="card" style="margin-bottom:16px;">
      <div class="row" style="flex-wrap:wrap; gap:12px;">
        <div style="flex:1; min-width:180px;">
          <label class="muted" style="display:block; margin-bottom:6px;">${t('stats.range')}</label>
          <select class="input" id="statsRange">
            <option value="today" ${statsFilter.range==='today'?'selected':''}>${t('stats.range_today')}</option>
            <option value="week" ${statsFilter.range==='week'?'selected':''}>${t('stats.range_week')}</option>
            <option value="month" ${statsFilter.range==='month'?'selected':''}>${t('stats.range_month')}</option>
            <option value="quarter" ${statsFilter.range==='quarter'?'selected':''}>${t('stats.range_quarter')}</option>
            <option value="year" ${statsFilter.range==='year'?'selected':''}>${t('stats.range_year')}</option>
            <option value="custom" ${statsFilter.range==='custom'?'selected':''}>${t('stats.range_custom')}</option>
            <option value="all" ${statsFilter.range==='all'?'selected':''}>${t('stats.range_all')}</option>
          </select>
        </div>
        <div style="flex:1; min-width:160px;">
          <label class="muted" style="display:block; margin-bottom:6px;">${t('stats.from')}</label>
          <input type="date" class="input" id="statsFrom" value="${escapeHtml(statsFilter.from||'')}" />
        </div>
        <div style="flex:1; min-width:160px;">
          <label class="muted" style="display:block; margin-bottom:6px;">${t('stats.to')}</label>
          <input type="date" class="input" id="statsTo" value="${escapeHtml(statsFilter.to||'')}" />
        </div>
        <div style="flex:1; min-width:200px;">
          <label class="muted" style="display:block; margin-bottom:6px;">${t('stats.property')}</label>
          <select class="input" id="statsProperty">
            ${propertyOptions}
          </select>
        </div>
        <div style="flex:1; min-width:200px;">
          <label class="muted" style="display:block; margin-bottom:6px;">${t('stats.asset')}</label>
          <select class="input" id="statsAsset">
            ${assetOptions}
          </select>
        </div>
        <div style="display:flex; align-items:flex-end;">
          <button class="btn" id="statsRefreshBtn">${t('stats.refresh')}</button>
        </div>
      </div>
      <label style="display:flex; align-items:center; gap:8px; margin-top:12px;">
        <input type="checkbox" id="statsSegmented" ${statsFilter.segmented ? 'checked' : ''} />
        <span class="muted">${t('stats.segmented')}</span>
      </label>
      <label style="display:flex; align-items:center; gap:8px; margin-top:8px;">
        <input type="checkbox" id="statsOnlyCurrent" ${statsFilter.onlyCurrent ? 'checked' : ''} />
        <span class="muted">${t('stats.only_current')}</span>
      </label>
    </div>

    <div class="grid" style="margin-bottom:16px;">
      <div class="card">
        <div class="cardHeader">
          <div class="cardTitle">${t('stats.spent')}</div>
        </div>
        <div class="cardBody" style="font-size:22px; font-weight:700;">${formatMoney(statsData.totals.spent)}</div>
      </div>
      <div class="card">
        <div class="cardHeader">
          <div class="cardTitle">${t('stats.collected')}</div>
        </div>
        <div class="cardBody" style="font-size:22px; font-weight:700;">${formatMoney(statsData.totals.collected)}</div>
      </div>
      <div class="card">
        <div class="cardHeader">
          <div class="cardTitle">${t('stats.done_total')}</div>
        </div>
        <div class="cardBody" style="font-size:22px; font-weight:700;">${statsData.totals.done}</div>
      </div>
      <div class="card">
        <div class="cardHeader">
          <div class="cardTitle">${t('stats.inventory')}</div>
        </div>
        <div class="cardBody">
          <div style="font-size:18px; font-weight:700;">${statsData.totals.inventoryCount}</div>
          <div class="muted">${t('stats.inventory_value', { value: formatMoney(statsData.totals.inventoryValue) })}</div>
        </div>
      </div>
      <div class="card">
        <div class="cardHeader">
          <div class="cardTitle">${t('stats.rooms_meters')}</div>
        </div>
        <div class="cardBody">
          <div class="muted">${t('stats.rooms_count', { count: statsData.totals.roomsCount })}</div>
          <div class="muted">${t('stats.meters_count', { count: statsData.totals.metersCount })}</div>
        </div>
      </div>
      <div class="card">
        <div class="cardHeader">
          <div class="cardTitle">${t('stats.docs_contacts')}</div>
        </div>
        <div class="cardBody">
          <div class="muted">${t('stats.docs_count', { count: statsData.totals.documentsCount })}</div>
          <div class="muted">${t('stats.contacts_count', { count: statsData.totals.contactsCount })}</div>
        </div>
      </div>
    </div>

    ${statsFilter.segmented ? `
      <div class="card" style="margin-bottom:16px;">
        <div class="cardHeader"><div class="cardTitle">${t('stats.done_by_source')}</div></div>
        <div class="cardBody">
          <div class="row" style="flex-wrap:wrap; gap:16px;">
            <div>${t('stats.tasks')}: <strong>${statsData.totals.tasksDone}</strong></div>
            <div>${t('stats.routines')}: <strong>${statsData.totals.routinesDone}</strong></div>
            <div>${t('stats.checklists')}: <strong>${statsData.totals.checklistsDone}</strong></div>
          </div>
        </div>
      </div>
    ` : ''}

    <div class="card" style="margin-bottom:24px;">
      <div class="cardHeader">
        <div class="cardTitle">${t('stats.trends')}</div>
      </div>
      <div class="cardBody">
        ${statsData.series.length === 0 ? `<div class="muted">${t('stats.no_data_period')}</div>` : `
          <div class="list">
            ${statsData.series.map(row=>`
              <div class="item">
                <div class="itemMain">
                  <div class="itemTitle">${row.label}</div>
                  <div class="itemMeta">
                    <span class="badge">${t('stats.spent_label', { value: formatMoney(row.spent) })}</span>
                    <span class="badge">${t('stats.collected_label', { value: formatMoney(row.collected) })}</span>
                    <span class="badge ok">${t('stats.done_label', { count: row.done })}</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    </div>
  `;

  $('#content').innerHTML = `
    ${statsSection}
    <div class="h1">🏆 ${t('stats.achievements_progress')}</div>

    <!-- Level & XP Card -->
    <div class="card" style="margin-bottom:16px; background: linear-gradient(135deg, rgba(96,165,250,0.1) 0%, rgba(139,92,246,0.1) 100%);">
      <div class="row" style="align-items:center; flex-wrap:wrap; gap:20px;">
        <div style="flex:1; min-width:250px;">
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
            <div style="font-size:48px;">⭐</div>
            <div>
              <div style="font-size:28px; font-weight:700;">${t('stats.level', { level })}</div>
              <div class="muted">${stats.xp.toLocaleString('ru-RU')} XP</div>
            </div>
          </div>

          <div style="margin-bottom:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <div class="muted" style="font-size:12px;">${t('stats.progress_to_level', { level: level + 1 })}</div>
              <div style="font-size:14px; font-weight:600;">${progressXP} / ${requiredXP} XP</div>
            </div>
            <div style="background:var(--border); height:12px; border-radius:999px; overflow:hidden;">
              <div style="background:linear-gradient(90deg, var(--accent) 0%, var(--ok) 100%); height:100%; width:${percentage}%; transition:width 0.5s;"></div>
            </div>
            <div class="muted" style="font-size:11px; margin-top:4px; text-align:right;">${percentage}%</div>
          </div>
        </div>

        <div style="flex:1; min-width:250px;">
          <div class="row" style="gap:20px; flex-wrap:wrap;">
            <div style="flex:1; min-width:100px;">
              <div class="muted" style="margin-bottom:6px;">${t('stats.current_streak')}</div>
              <div style="font-size:32px; font-weight:700; color:var(--warn);">${stats.current_streak || 0} 🔥</div>
            </div>
            <div style="flex:1; min-width:100px;">
              <div class="muted" style="margin-bottom:6px;">${t('stats.longest_streak')}</div>
              <div style="font-size:32px; font-weight:700; color:var(--ok);">${stats.longest_streak || 0} 🏆</div>
            </div>
          </div>
          <div style="margin-top:12px;">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="gamificationToggle" ${stats.gamification_enabled ? 'checked' : ''} />
              <span class="muted" style="font-size:13px;">${t('stats.gamification_enabled')}</span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- Achievements Section -->
    <div style="margin-bottom:16px;">
      <div style="font-size:20px; font-weight:700; margin-bottom:12px;">
        ${t('stats.achievements_count', { unlocked: unlockedAchievements.length, total: ACHIEVEMENTS.length })}
      </div>
    </div>

    ${unlockedAchievements.length === 0 && lockedAchievements.length === 0 ? `
      <div class="card" style="padding:60px; text-align:center;">
        <div class="muted">${t('stats.no_achievements')}</div>
      </div>
    ` : `
      ${unlockedAchievements.length > 0 ? `
        <div style="margin-bottom:24px;">
          <div class="muted" style="margin-bottom:8px; font-size:12px; text-transform:uppercase; letter-spacing:0.8px;">${t('stats.unlocked')}</div>
          <div class="grid">
            ${unlockedAchievements.map(achievement => `
              <div class="card" style="border-left:4px solid var(--ok);">
                <div class="cardHeader">
                  <div>
                    <div style="font-size:32px; margin-bottom:4px;">${achievement.icon}</div>
                    <div class="cardTitle">${escapeHtml(t(achievement.nameKey))}</div>
                  </div>
                  ${achievement.xp > 0 ? `<div class="badge ok">+${achievement.xp} XP</div>` : ''}
                </div>
                <div class="cardBody">
                  <div class="muted" style="font-size:13px;">${escapeHtml(t(achievement.descKey))}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${lockedAchievements.length > 0 ? `
        <div>
          <div class="muted" style="margin-bottom:8px; font-size:12px; text-transform:uppercase; letter-spacing:0.8px;">${t('stats.locked')}</div>
          <div class="grid">
            ${lockedAchievements.map(achievement => `
              <div class="card" style="opacity:0.5; border-left:4px solid var(--border);">
                <div class="cardHeader">
                  <div>
                    <div style="font-size:32px; margin-bottom:4px; filter:grayscale(100%);">${achievement.icon}</div>
                    <div class="cardTitle">${escapeHtml(t(achievement.nameKey))}</div>
                  </div>
                  ${achievement.xp > 0 ? `<div class="badge">+${achievement.xp} XP</div>` : ''}
                </div>
                <div class="cardBody">
                  <div class="muted" style="font-size:13px;">${escapeHtml(t(achievement.descKey))}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `}
  `;

  // Bind stats filters
  $('#statsRange').onchange = (e)=>{
    statsFilter.range = e.target.value;
    renderStats();
  };
  $('#statsFrom').onchange = (e)=>{
    statsFilter.from = e.target.value;
  };
  $('#statsTo').onchange = (e)=>{
    statsFilter.to = e.target.value;
  };
  $('#statsProperty').onchange = (e)=>{
    statsFilter.propertyId = e.target.value;
    renderStats();
  };
  $('#statsAsset').onchange = (e)=>{
    statsFilter.assetId = e.target.value;
    renderStats();
  };
  $('#statsSegmented').onchange = (e)=>{
    statsFilter.segmented = e.target.checked;
    renderStats();
  };
  $('#statsOnlyCurrent').onchange = (e)=>{
    statsFilter.onlyCurrent = e.target.checked;
    renderStats();
  };
  $('#statsRefreshBtn').onclick = ()=>renderStats();

  // Bind gamification toggle
  $('#gamificationToggle').onchange = async (e) => {
    const enabled = e.target.checked;
    await api.stats.update({ gamification_enabled: enabled });
    state.userStats.gamification_enabled = enabled;
    toast(enabled ? t('settings.gamification_enabled') : t('settings.gamification_disabled'));
  };
}

async function renderCalendar(){
  if(!state.calendar) state.calendar = { month: todayISO().slice(0,7), selected: todayISO(), view:'month', showCompleted:false };
  const [y, m] = state.calendar.month.split('-').map(Number);
  const year = y;
  const monthIndex = m - 1;
  const selectedDate = state.calendar.selected || todayISO();
  const selectedDateObj = parseISODate(selectedDate) || new Date();
  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = new Date(year, monthIndex + 1, 0);

  const [
    tasksRes, plansRes, logsRes, expensesRes,
    goalsRes, metersRes, readingsRes, checklistsRes
  ] = await Promise.all([
    api.tasks.list({ profile_id: state.profileId, status:'all', range:'all' }),
    api.maintenance.plans.list({ range:'all', daysSoon:14, is_active:true }),
    api.maintenance.logs.list({}),
    api.expenses.list({}),
    api.goals.list({ status:'all' }),
    api.meters.list({}),
    api.meters.getReadings({}),
    api.checklists.list()
  ]);

  const tasks = tasksRes.ok ? tasksRes.data : [];
  const plans = plansRes.ok ? plansRes.data : [];
  const logs = logsRes.ok ? logsRes.data : [];
  const expenses = expensesRes.ok ? expensesRes.data : [];
  const goals = goalsRes.ok ? goalsRes.data : [];
  const meters = metersRes.ok ? metersRes.data : [];
  const readings = readingsRes.ok ? readingsRes.data : [];
  const checklists = checklistsRes.ok ? checklistsRes.data : [];

  const dayCounts = new Map();
  const addCount = (iso) => {
    if(!iso) return;
    const d = parseISODate(iso);
    if(!d || d < monthStart || d > monthEnd) return;
    const key = toISODate(d);
    dayCounts.set(key, (dayCounts.get(key) || 0) + 1);
  };

  tasks.forEach(t=>addCount(t.due_at));
  plans.forEach(p=>addCount(p.next_due_at));
  logs.forEach(l=>addCount(l.done_at));
  expenses.forEach(e=>addCount(e.spent_at));
  goals.forEach(g=>addCount(g.due_at));
  readings.forEach(r=>addCount(r.reading_date));

  const view = state.calendar.view || 'month';
  const grid = view === 'week' ? buildWeekGrid(selectedDateObj) : buildMonthGrid(year, monthIndex);
  const locale = getCurrentLanguage && getCurrentLanguage() === 'en' ? 'en-US' : 'ru-RU';

  $('#content').innerHTML = `
    <div class="row" style="justify-content:space-between; align-items:center;">
      <div class="h1">📅 ${t('calendar.title')}</div>
      <div class="row" style="gap:8px;">
        <button class="btn" data-cal-nav="prev">←</button>
        <div style="font-weight:700;">${view === 'month' ? monthLabel(year, monthIndex) : selectedDateObj.toLocaleDateString(locale)}</div>
        <button class="btn" data-cal-nav="next">→</button>
      </div>
    </div>

    <div class="card" style="margin-top:12px;">
      <div class="row" style="justify-content:space-between; align-items:center;">
        <div class="muted">${t('calendar.select_hint')}</div>
        <div class="row" style="gap:8px;">
          <button class="btn ${view==='day'?'warn':''}" data-cal-view="day">${t('calendar.view_day')}</button>
          <button class="btn ${view==='week'?'warn':''}" data-cal-view="week">${t('calendar.view_week')}</button>
          <button class="btn ${view==='month'?'warn':''}" data-cal-view="month">${t('calendar.view_month')}</button>
          <button class="btn" data-cal-today>${t('calendar.today')}</button>
        </div>
      </div>
      <label style="display:flex; align-items:center; gap:8px; margin-top:8px;">
        <input type="checkbox" id="calendarShowCompleted" ${state.calendar.showCompleted ? 'checked' : ''} />
        <span class="muted">${t('calendar.show_completed')}</span>
      </label>
    </div>

    ${view === 'day' ? '' : `
      <div class="card" style="margin-top:12px;">
        <div class="calendarHeader">
          ${t('date.weekdays_short_mon').split('|').map(d=>`<div class="calendarDayHeader">${d}</div>`).join('')}
        </div>
        <div class="calendar">
          ${grid.map(cell=>{
            const iso = toISODate(cell.date);
            const count = dayCounts.get(iso) || 0;
            const dots = Math.min(4, count);
            return `
              <div class="calendarDay ${cell.inMonth ? '' : 'mutedDay'} ${iso===selectedDate ? 'selected' : ''}" data-cal-day="${iso}">
                <div class="calendarDayNumber">${cell.date.getDate()}</div>
                ${count > 0 ? `
                  <div class="calendarDots">
                    ${Array.from({ length: dots }).map(()=>'<span class="calendarDot"></span>').join('')}
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `}

    <div class="card" style="margin-top:12px;">
      <div class="cardHeader">
        <div class="cardTitle">${t('calendar.events_on', { date: selectedDate })}</div>
      </div>
      <div class="cardBody" id="calendarDetails"></div>
    </div>
  `;

  $$('[data-cal-nav]').forEach(btn=>{
    btn.onclick = ()=>{
      const dir = btn.dataset.calNav === 'prev' ? -1 : 1;
      if(view === 'month'){
        const next = new Date(year, monthIndex + dir, 1);
        state.calendar.month = `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}`;
      } else if(view === 'week') {
        const next = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), selectedDateObj.getDate() + (dir * 7));
        state.calendar.selected = toISODate(next);
        state.calendar.month = `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}`;
      } else {
        const next = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), selectedDateObj.getDate() + dir);
        state.calendar.selected = toISODate(next);
        state.calendar.month = `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}`;
      }
      renderCalendar();
    };
  });
  $$('[data-cal-day]').forEach(cell=>{
    cell.onclick = ()=>{
      state.calendar.selected = cell.dataset.calDay;
      renderCalendar();
    };
  });
  const todayBtn = $('[data-cal-today]');
  if(todayBtn){
    todayBtn.onclick = ()=>{
      state.calendar.month = todayISO().slice(0,7);
      state.calendar.selected = todayISO();
      renderCalendar();
    };
  }
  const completedToggle = $('#calendarShowCompleted');
  if(completedToggle){
    completedToggle.onchange = ()=>{
      state.calendar.showCompleted = completedToggle.checked;
      renderCalendar();
    };
  }
  $$('[data-cal-view]').forEach(btn=>{
    btn.onclick = ()=>{
      state.calendar.view = btn.dataset.calView;
      renderCalendar();
    };
  });

  const details = $('#calendarDetails');
  const filterDate = selectedDate;

  const tasksOnDay = tasks.filter(t=>t.due_at === filterDate);
  const doneTasksOnDay = state.calendar.showCompleted
    ? tasks.filter(t=>t.status === 'done' && t.done_at === filterDate)
    : [];
  const plansOnDay = plans.filter(p=>p.next_due_at === filterDate);
  const logsOnDay = logs.filter(l=>l.done_at === filterDate);
  const expensesOnDay = expenses.filter(e=>e.spent_at === filterDate);
  const goalsOnDay = goals.filter(g=>g.due_at === filterDate);
  const readingsOnDay = readings.filter(r=>r.reading_date === filterDate);

  const meterById = new Map(meters.map(m=>[m.id, m]));

  details.innerHTML = `
    ${tasksOnDay.length ? `
      <div class="card" style="margin-bottom:8px;">
        <div class="cardHeader"><div class="cardTitle">${t('calendar.tasks', { count: tasksOnDay.length })}</div></div>
        <div class="cardBody">
          <div class="list">
            ${tasksOnDay.map(t=>`
              <div class="item">
                <div class="itemMain">
                  <div class="itemTitle">${escapeHtml(t.title)}</div>
                  <div class="itemMeta">
                    ${t.due_at ? `<span class="badge">${t.due_at}</span>` : ''}
                  </div>
                </div>
                <div class="itemActions">
                  <button class="iconBtn" data-cal-task-open="${t.id}">${t('btn.open')}</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    ` : ''}
    ${doneTasksOnDay.length ? `
      <div class="card" style="margin-bottom:8px;">
        <div class="cardHeader"><div class="cardTitle">${t('calendar.done', { count: doneTasksOnDay.length })}</div></div>
        <div class="cardBody">
          <div class="list">
            ${doneTasksOnDay.map(t=>`
              <div class="item">
                <div class="itemMain">
                  <div class="itemTitle">${escapeHtml(t.title)}</div>
                  <div class="itemMeta">
                    <span class="badge ok">${t('calendar.done_badge')}</span>
                    ${t.done_at ? `<span class="badge">${t.done_at}</span>` : ''}
                  </div>
                </div>
                <div class="itemActions">
                  <button class="iconBtn" data-cal-task-open="${t.id}">${t('btn.open')}</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    ` : ''}
    ${plansOnDay.length ? `
      <div class="card" style="margin-bottom:8px;">
        <div class="cardHeader"><div class="cardTitle">${t('calendar.plans', { count: plansOnDay.length })}</div></div>
        <div class="cardBody">${plansOnDay.map(planCardHtml).join('')}</div>
      </div>
    ` : ''}
    ${logsOnDay.length ? `
      <div class="card" style="margin-bottom:8px;">
        <div class="cardHeader"><div class="cardTitle">${t('calendar.logs', { count: logsOnDay.length })}</div></div>
        <div class="cardBody">${logsOnDay.map(logRowHtml).join('')}</div>
      </div>
    ` : ''}
    ${expensesOnDay.length ? `
      <div class="card" style="margin-bottom:8px;">
        <div class="cardHeader"><div class="cardTitle">${t('calendar.expenses', { count: expensesOnDay.length })}</div></div>
        <div class="cardBody">
          <div class="list">
            ${expensesOnDay.map(e=>`
              <div class="item">
                <div class="itemMain">
                  <div class="itemTitle">${escapeHtml(e.note || t('calendar.no_comment'))}</div>
                  <div class="itemMeta">
                    <span class="badge">${e.amount < 0 ? t('calendar.collected', { value: formatMoneyRUB(Math.abs(e.amount)) }) : t('calendar.spent', { value: formatMoneyRUB(e.amount) })}</span>
                  </div>
                </div>
                <div class="itemActions">
                  <button class="iconBtn" data-cal-expense-open="${e.id}">${t('btn.open')}</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    ` : ''}
    ${goalsOnDay.length ? `
      <div class="card" style="margin-bottom:8px;">
        <div class="cardHeader"><div class="cardTitle">${t('calendar.goals', { count: goalsOnDay.length })}</div></div>
        <div class="cardBody">
          <div class="list">
            ${goalsOnDay.map(g=>`
              <div class="item">
                <div class="itemMain">
                  <div class="itemTitle">${escapeHtml(g.title)}</div>
                  <div class="itemMeta"><span class="badge">${g.target_amount} ₽</span></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    ` : ''}
    ${readingsOnDay.length ? `
      <div class="card" style="margin-bottom:8px;">
        <div class="cardHeader"><div class="cardTitle">${t('calendar.readings', { count: readingsOnDay.length })}</div></div>
        <div class="cardBody">
          <div class="list">
            ${readingsOnDay.map(r=>{
              const meter = meterById.get(r.meter_id);
              return `
                <div class="item">
                  <div class="itemMain">
                    <div class="itemTitle">${escapeHtml(meter?.name || t('calendar.meter_default'))}</div>
                    <div class="itemMeta"><span class="badge">${r.value}</span></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    ` : ''}
    ${checklists.length ? `
      <div class="card">
        <div class="cardHeader"><div class="cardTitle">${t('calendar.checklists', { count: checklists.length })}</div></div>
        <div class="cardBody">
          <div class="list">
            ${checklists.map(cl=>`
              <div class="item">
                <div class="itemMain">
                  <div class="itemTitle">${escapeHtml(cl.name)}</div>
                  <div class="itemMeta"><span class="badge">${t('calendar.items_count', { count: (cl.items || []).length })}</span></div>
                </div>
                <div class="itemActions">
                  <button class="iconBtn" data-cal-checklist-open="${cl.id}">${t('btn.open')}</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    ` : `<div class="muted">${t('calendar.none_day')}</div>`}
  `;

  $$('[data-cal-task-open]').forEach(btn=>{
    btn.onclick = async ()=>{
      const taskId = btn.dataset.calTaskOpen;
      const all = await api.tasks.list({ profile_id: state.profileId, status:'all', range:'all' });
      const task = all.ok ? all.data.find(t=>t.id===taskId) : null;
      setRoute('tasks');
      await renderTasks({ status:'all', range:'all' });
      if(task) openTaskModal(task);
    };
  });
  $$('[data-cal-checklist-open]').forEach(btn=>{
    btn.onclick = ()=>{
      setRoute('checklists');
      renderChecklists();
      viewChecklist(btn.dataset.calChecklistOpen);
    };
  });
  $$('[data-cal-expense-open]').forEach(btn=>{
    btn.onclick = ()=>{
      const expense = expensesOnDay.find(e=>e.id===btn.dataset.calExpenseOpen);
      openExpenseModal(expense);
    };
  });
  const planLists = $$('.cardBody', details).filter(el=>el.querySelector('[data-plan-del]'));
  planLists.forEach(list=>bindPlanActions(list));
  const logLists = $$('.cardBody', details).filter(el=>el.querySelector('[data-log-del]'));
  logLists.forEach(list=>bindLogActions(list));
}

// ============================================
// ROUTER
// ============================================

async function render(){
  renderAppChrome();
  if(state.route==='dashboard') return renderDashboard();
  if(state.route==='tasks') return renderTasks();
  if(state.route==='calendar') return renderCalendar();
  if(state.route==='routines') return renderRoutines();
  if(state.route==='assets') return renderAssets();
  if(state.route==='asset-detail') return renderAssetDetail();
  if(state.route==='maintenance') return renderMaintenance();
  if(state.route==='goals') return renderGoals();
  if(state.route==='documents') return renderDocuments();
  if(state.route==='utility') return renderUtilityCalculator();
  if(state.route==='analytics') return renderAnalytics();
  if(state.route==='settings') return renderSettings();
  if(state.route==='backup') return renderBackup();

  // New routes v2.0
  if(state.route==='property') return renderProperty();
  if(state.route==='rooms') return renderRooms();
  if(state.route==='inventory') return renderInventory();
  if(state.route==='meters') return renderMeters();
  if(state.route==='contacts') return renderContacts();
  if(state.route==='checklists') return renderChecklists();
  if(state.route==='stats') return renderStats();
}

// ===== ONBOARDING =====
let onboardingStep = 1;
let onboardingData = { templateKey: null, userName: '', userIcon: '👤' };

async function showOnboarding() {
  onboardingStep = 1;
  onboardingData = { templateKey: null, userName: '', userIcon: '👤' };
  window.onboardingData = onboardingData; // Re-expose after reassignment
  renderOnboarding();
}

function renderOnboarding() {
  const container = document.getElementById('app');

  container.innerHTML = `
    <div class="onboarding">
      <div class="onboarding-card">
        ${onboardingStep === 1 ? renderOnboardingStep1() : ''}
        ${onboardingStep === 2 ? renderOnboardingStep2() : ''}
        ${onboardingStep === 3 ? renderOnboardingStep3() : ''}
      </div>
    </div>
  `;

  // Attach event listeners after rendering (CSP prevents inline onclick)
  const nextBtn = container.querySelector('#onboarding-next-btn');
  const prevBtn = container.querySelector('#onboarding-prev-btn');
  const finishBtn = container.querySelector('#onboarding-finish-btn');
  const nameInput = container.querySelector('#onboarding-name');
  const avatarOptions = container.querySelectorAll('.avatar-option');
  const templateOptions = container.querySelectorAll('.template-option');

  if (nextBtn) nextBtn.onclick = () => nextOnboardingStep();
  if (prevBtn) prevBtn.onclick = () => prevOnboardingStep();
  if (finishBtn) finishBtn.onclick = () => finishOnboarding();
  if (nameInput) nameInput.oninput = (e) => { onboardingData.userName = e.target.value; };

  avatarOptions.forEach(opt => {
    opt.onclick = () => {
      onboardingData.userIcon = opt.dataset.avatar;
      renderOnboarding();
    };
  });

  templateOptions.forEach(opt => {
    opt.onclick = () => {
      const key = opt.dataset.template;
      selectTemplate(key);
    };
  });
}

function renderOnboardingStep1() {
  return `
    <div class="onboarding-step">
      <div class="onboarding-emoji">🏠</div>
      <h1>${t('onboarding.welcome_title')}</h1>
      <p>${t('onboarding.welcome_desc')}</p>
      <p>${t('onboarding.local_desc')}</p>
      <button id="onboarding-next-btn" class="btn btn-large" style="margin-top:20px; background:#667eea; color:white; font-size:16px; padding:12px 24px;">
        ${t('onboarding.start_setup')}
      </button>
    </div>
  `;
}

function renderOnboardingStep2() {
  const avatars = ['👤','🙂','😀','😎','👩','👨','🧑','👩‍💻','👨‍💻','🧑‍🎨'];
  return `
    <div class="onboarding-step">
      <h2>${t('onboarding.name_title')}</h2>
      <input
        type="text"
        id="onboarding-name"
        class="input"
        style="width:100%; font-size:16px; padding:12px;"
        placeholder="${t('onboarding.name_placeholder')}"
        value="${escapeHtml(onboardingData.userName)}"
      >

      <h2 style="margin-top: 24px;">${t('onboarding.avatar_title')}</h2>
      <div class="avatar-options">
        ${avatars.map(a=>`
          <div class="avatar-option ${onboardingData.userIcon===a?'selected':''}" data-avatar="${a}">
            ${a}
          </div>
        `).join('')}
      </div>

      <h2 style="margin-top: 24px;">${t('onboarding.template_title')}</h2>
      <p>${t('onboarding.template_desc')}</p>

      <div class="template-options">
        <div class="template-option ${onboardingData.templateKey === 'basic' ? 'selected' : ''}" data-template="basic">
          <div class="template-icon">✨</div>
          <div class="template-name">${t('onboarding.template_basic')}</div>
        </div>
        <div class="template-option ${onboardingData.templateKey === 'apartment' ? 'selected' : ''}" data-template="apartment">
          <div class="template-icon">🏢</div>
          <div class="template-name">${t('onboarding.template_apartment')}</div>
        </div>
        <div class="template-option ${onboardingData.templateKey === 'house' ? 'selected' : ''}" data-template="house">
          <div class="template-icon">🏡</div>
          <div class="template-name">${t('onboarding.template_house')}</div>
        </div>
        <div class="template-option ${onboardingData.templateKey === 'dacha' ? 'selected' : ''}" data-template="dacha">
          <div class="template-icon">🌳</div>
          <div class="template-name">${t('onboarding.template_dacha')}</div>
        </div>
      </div>

      <div class="onboarding-actions" style="margin-top:24px;">
        <button id="onboarding-prev-btn" class="btn secondary">
          ${t('btn.back')}
        </button>
        <button id="onboarding-next-btn" class="btn" style="background:#667eea; color:white;">
          ${t('onboarding.next')}
        </button>
      </div>
    </div>
  `;
}

function renderOnboardingStep3() {
  const templateName = onboardingData.templateKey
    ? { basic: t('onboarding.template_basic'), apartment: t('onboarding.template_apartment'), house: t('onboarding.template_house'), dacha: t('onboarding.template_dacha') }[onboardingData.templateKey]
    : t('onboarding.template_none');

  return `
    <div class="onboarding-step">
      <div class="onboarding-emoji">${onboardingData.userIcon || '✅'}</div>
      <h2>${t('onboarding.ready_title')}</h2>

      <div class="onboarding-summary" style="background:#f7fafc; padding:16px; border-radius:8px; margin:16px 0;">
        <p><strong>${t('onboarding.summary_name')}:</strong> ${escapeHtml(onboardingData.userName) || t('onboarding.summary_name_fallback')}</p>
        <p style="margin-top:8px;"><strong>${t('onboarding.summary_avatar')}:</strong> ${onboardingData.userIcon || '👤'}</p>
        <p style="margin-top:8px;"><strong>${t('onboarding.summary_template')}:</strong> ${templateName}</p>
      </div>

      <p>${t('onboarding.summary_intro')}</p>
      <ul style="text-align:left; margin:16px 0;">
        <li>${t('onboarding.summary_item_property')}</li>
        <li>${t('onboarding.summary_item_rooms')}</li>
        <li>${t('onboarding.summary_item_meters')}</li>
        <li>${t('onboarding.summary_item_checklists')}</li>
      </ul>

      <div class="onboarding-actions" style="margin-top:24px;">
        <button id="onboarding-prev-btn" class="btn secondary">
          ${t('btn.back')}
        </button>
        <button id="onboarding-finish-btn" class="btn btn-large" style="background:#667eea; color:white; font-size:16px; padding:12px 24px;">
          🚀 ${t('onboarding.finish')}
        </button>
      </div>
    </div>
  `;
}

function selectTemplate(key) {
  onboardingData.templateKey = key;
  renderOnboarding();
}

function nextOnboardingStep() {
  if (onboardingStep === 2) {
    onboardingData.userName = document.getElementById('onboarding-name')?.value || '';
  }
  onboardingStep++;
  renderOnboarding();
}

function prevOnboardingStep() {
  onboardingStep--;
  renderOnboarding();
}

function restoreMainAppUI() {
  const appContainer = document.getElementById('app');
  appContainer.innerHTML = `
    <aside class="sidebar">
      <div class="brand">
        <div class="logo">🏠</div>
        <div class="brandText">
          <div class="brandTitle">Home Manager</div>
          <div class="brandSub">${t('app.local_desktop')}</div>
        </div>
      </div>
      <nav class="nav" id="nav"></nav>
      <div class="sidebarFooter">
        <div class="muted" id="appInfo">—</div>
        <button class="linkBtn" id="openDataFolder">${t('app.open_data_folder')}</button>
      </div>
    </aside>
    <main class="main">
      <header class="header">
        <div class="profileRow">
          <label class="muted">${t('app.profile_label')}</label>
          <select id="profileSelect"></select>
        </div>
        <div class="searchRow">
          <input id="globalSearch" class="input" placeholder="${t('app.search_placeholder')}" />
        </div>
        <div class="actionsRow">
          <div id="statsDisplay" style="display:none; margin-right:12px;"></div>
          <button class="btn" id="quickAddBtn">＋</button>
        </div>
      </header>
      <section class="content" id="content"></section>
    </main>
  `;
}

async function finishOnboarding() {
  const btn = event.target;
  btn.disabled = true;
  btn.textContent = t('onboarding.setting_up');

  const result = await api.onboarding.complete(onboardingData);

  if (result.ok) {
    // Restore main app UI
    restoreMainAppUI();

    // Re-attach event handlers after restoring UI
    $('#profileSelect').onchange=(e)=>{ state.profileId=e.target.value; render(); };
    $('#openDataFolder').onclick=async ()=>{ const r=await api.meta.openDataFolder(); if(!r.ok) toast(r.error); };
    $('#quickAddBtn').onclick=()=>openModal(t('quick_add.title'), `
      <div class="list">
        <button class="btn" id="qaTask">${t('quick_add.task')}</button>
        <button class="btn" id="qaRoutine">${t('quick_add.routine')}</button>
        <button class="btn" id="qaPlan">${t('quick_add.plan')}</button>
        <button class="btn" id="qaDoc">${t('quick_add.doc')}</button>
      </div>
    `, (root)=>{
      $('#qaTask', root).onclick=()=>{ closeModal(); openTaskModal(); };
      $('#qaRoutine', root).onclick=()=>{ closeModal(); setRoute('routines'); openRoutineModal(); };
      $('#qaPlan', root).onclick=()=>{ closeModal(); openPlanModal(); };
      $('#qaDoc', root).onclick=()=>{ closeModal(); openDocModal(); };
    });
    $('#globalSearch').onkeydown=(e)=>{ if(e.key==='Enter'){ const q=e.target.value.trim(); if(q) renderSearchResults(q); } };
    $('#nav').onclick=(e)=>{ const btn=e.target.closest('.navItem'); if(btn) setRoute(btn.dataset.route); };
    api.events.onDataChanged(async ()=>{ await loadProfiles(); await loadTags(); });

    toast(t('onboarding.welcome_toast'), 'success');

    // Reload data and render
    await loadMeta();
    await loadProfiles();
    await loadTags();
    await loadUserStats();
    await loadVisibleModules();

    // Apply theme
    if (state.userStats && state.userStats.theme) {
      applyTheme(state.userStats.theme);
    }

    renderNav();
    setRoute('dashboard');
  } else {
    toast(t('onboarding.setup_error'), 'error');
    btn.disabled = false;
    btn.textContent = `🚀 ${t('onboarding.finish')}`;
  }
}

// Expose onboarding functions and data globally for inline onclick handlers
window.nextOnboardingStep = nextOnboardingStep;
window.prevOnboardingStep = prevOnboardingStep;
window.finishOnboarding = finishOnboarding;
window.selectTemplate = selectTemplate;
window.onboardingData = onboardingData;
window.changeLanguage = changeLanguage;

async function init(){
  await loadMeta(); await loadProfiles(); await loadTags(); await loadUserStats();
  await loadVisibleModules();

  // Инициализировать язык
  await initLanguage();

  renderNav();

  // Применить тему
  if (state.userStats && state.userStats.theme) {
    applyTheme(state.userStats.theme);
  }

  // Set up event handlers BEFORE onboarding check
  $('#profileSelect').onchange=(e)=>{ state.profileId=e.target.value; render(); };
  $('#openDataFolder').onclick=async ()=>{ const r=await api.meta.openDataFolder(); if(!r.ok) toast(r.error); };

  $('#quickAddBtn').onclick=()=>openModal(t('quick_add.title'), `
      <div class="list">
        <button class="btn" id="qaTask">${t('quick_add.task')}</button>
        <button class="btn" id="qaRoutine">${t('quick_add.routine')}</button>
        <button class="btn" id="qaPlan">${t('quick_add.plan')}</button>
        <button class="btn" id="qaDoc">${t('quick_add.doc')}</button>
      </div>
    `, (root)=>{
      $('#qaTask', root).onclick=()=>{ closeModal(); openTaskModal(); };
      $('#qaRoutine', root).onclick=()=>{ closeModal(); setRoute('routines'); openRoutineModal(); };
      $('#qaPlan', root).onclick=()=>{ closeModal(); openPlanModal(); };
      $('#qaDoc', root).onclick=()=>{ closeModal(); openDocModal(); };
    });

  $('#globalSearch').onkeydown=(e)=>{ if(e.key==='Enter'){ const q=e.target.value.trim(); if(q) renderSearchResults(q); } };

  $('#nav').onclick=(e)=>{ const btn=e.target.closest('.navItem'); if(btn) setRoute(btn.dataset.route); };

  api.events.onDataChanged(async ()=>{ await loadProfiles(); await loadTags(); });

  // Проверить онбординг
  const onboardingStatus = await api.onboarding.getStatus();
  if (onboardingStatus.ok && !onboardingStatus.data.completed) {
    showOnboarding();
    return;
  }

  api.routines.generate({ daysAhead:14 }).catch(()=>{});
  render();
}
init();
