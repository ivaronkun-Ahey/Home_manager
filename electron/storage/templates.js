// electron/storage/templates.js

const TEMPLATES = {
  basic: {
    name: 'Базовый'
  },
  apartment: {
    name: 'Квартира',
    properties: [
      { name: 'Моя квартира', type: 'apartment' }
    ],
    rooms: [
      { name: 'Кухня', type: 'kitchen' },
      { name: 'Гостиная', type: 'living_room' },
      { name: 'Спальня', type: 'bedroom' },
      { name: 'Ванная', type: 'bathroom' },
      { name: 'Прихожая', type: 'other' }
    ],
    meters: [
      { name: 'Холодная вода', type: 'cold_water', submission_day_start: 15, submission_day_end: 25 },
      { name: 'Горячая вода', type: 'hot_water', submission_day_start: 15, submission_day_end: 25 },
      { name: 'Электричество', type: 'electricity', submission_day_start: 15, submission_day_end: 25 }
    ],
    checklists: [
      {
        name: '🧹 Еженедельная уборка',
        category: 'cleaning',
        items: [
          { text: 'Пропылесосить все комнаты', priority: 'medium' },
          { text: 'Помыть полы', priority: 'medium' },
          { text: 'Протереть пыль', priority: 'low' },
          { text: 'Убрать ванную', priority: 'high' },
          { text: 'Вынести мусор', priority: 'high' }
        ]
      }
    ],
    routines: [
      { title: 'Проверить почтовый ящик', rule: { freq: 'daily', interval: 1 } },
      { title: 'Полить цветы', rule: { freq: 'weekly', interval: 1 } }
    ]
  },

  house: {
    name: 'Частный дом',
    properties: [
      { name: 'Мой дом', type: 'house' }
    ],
    rooms: [
      { name: 'Кухня', type: 'kitchen' },
      { name: 'Гостиная', type: 'living_room' },
      { name: 'Спальня 1', type: 'bedroom' },
      { name: 'Спальня 2', type: 'bedroom' },
      { name: 'Ванная', type: 'bathroom' },
      { name: 'Котельная', type: 'other' },
      { name: 'Гараж', type: 'other' }
    ],
    meters: [
      { name: 'Холодная вода', type: 'cold_water', submission_day_start: 15, submission_day_end: 25 },
      { name: 'Электричество', type: 'electricity', submission_day_start: 15, submission_day_end: 25 },
      { name: 'Газ', type: 'gas', submission_day_start: 15, submission_day_end: 25 }
    ],
    assets: [
      { name: 'Дом', type: 'home' },
      { name: 'Участок', type: 'garden' }
    ],
    maintenance_plans: [
      { title: 'Проверка отопления', interval_days: 365, asset_type: 'home' },
      { title: 'Чистка дымохода', interval_days: 365, asset_type: 'home' },
      { title: 'Стрижка газона', interval_days: 14, asset_type: 'garden' }
    ],
    checklists: [
      {
        name: '❄️ Подготовка к зиме',
        category: 'seasonal',
        items: [
          { text: 'Слить воду из летнего водопровода', priority: 'critical' },
          { text: 'Проверить отопление', priority: 'critical' },
          { text: 'Утеплить окна', priority: 'high' },
          { text: 'Подготовить снегоуборочный инвентарь', priority: 'medium' }
        ]
      }
    ]
  },

  dacha: {
    name: 'Дача',
    properties: [
      { name: 'Дача', type: 'cottage' }
    ],
    rooms: [
      { name: 'Комната', type: 'living_room' },
      { name: 'Кухня', type: 'kitchen' },
      { name: 'Веранда', type: 'other' }
    ],
    meters: [
      { name: 'Электричество', type: 'electricity', submission_day_start: 20, submission_day_end: 25 }
    ],
    assets: [
      { name: 'Дачный домик', type: 'home' },
      { name: 'Огород', type: 'garden' }
    ],
    checklists: [
      {
        name: '🌱 Открытие сезона',
        category: 'seasonal',
        items: [
          { text: 'Проверить состояние дома после зимы', priority: 'high' },
          { text: 'Включить воду', priority: 'high' },
          { text: 'Проверить электричество', priority: 'high' },
          { text: 'Подготовить грядки', priority: 'medium' }
        ]
      },
      {
        name: '🍂 Закрытие сезона',
        category: 'seasonal',
        items: [
          { text: 'Слить воду из системы', priority: 'critical' },
          { text: 'Убрать урожай', priority: 'high' },
          { text: 'Закрыть дом', priority: 'high' },
          { text: 'Отключить электричество', priority: 'medium' }
        ]
      }
    ]
  }
};

function applyTemplate(templateKey, db) {
  const template = TEMPLATES[templateKey];
  if (!template) return false;

  const results = {
    properties: [],
    rooms: [],
    meters: [],
    assets: [],
    maintenance_plans: [],
    checklists: [],
    routines: []
  };

  // Создать недвижимость
  if (template.properties) {
    template.properties.forEach(p => {
      const created = db.properties.create(p);
      results.properties.push(created);
    });
  }

  // Создать комнаты (привязать к первой недвижимости)
  if (template.rooms && results.properties.length > 0) {
    const propertyId = results.properties[0].id;
    template.rooms.forEach(r => {
      const created = db.rooms.create({ ...r, property_id: propertyId });
      results.rooms.push(created);
    });
  }

  // Создать счётчики
  if (template.meters && results.properties.length > 0) {
    const propertyId = results.properties[0].id;
    template.meters.forEach(m => {
      const created = db.meters.create({ ...m, property_id: propertyId, is_active: true });
      results.meters.push(created);
    });
  }

  // Создать объекты обслуживания
  if (template.assets) {
    template.assets.forEach(a => {
      const created = db.assets.create(a);
      results.assets.push(created);
    });
  }

  // Создать планы обслуживания
  if (template.maintenance_plans && results.assets.length > 0) {
    template.maintenance_plans.forEach(p => {
      const asset = results.assets.find(a => a.type === p.asset_type) || results.assets[0];
      const created = db.maintenance_plans.create({
        title: p.title,
        interval_days: p.interval_days,
        asset_id: asset.id,
        is_active: true
      });
      results.maintenance_plans.push(created);
    });
  }

  // Создать чек-листы
  if (template.checklists) {
    template.checklists.forEach(c => {
      const created = db.checklists.create({
        name: c.name,
        category: c.category,
        items: c.items,
        is_preset: false
      });
      results.checklists.push(created);
    });
  }

  // Создать рутины
  if (template.routines) {
    template.routines.forEach(r => {
      const created = db.routines.create({
        title: r.title,
        rule: r.rule,
        is_active: true,
        start_date: new Date().toISOString().slice(0, 10)
      });
      results.routines.push(created);
    });
  }

  return results;
}

module.exports = { TEMPLATES, applyTemplate };
