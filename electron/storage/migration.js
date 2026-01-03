const { nanoid } = require('./nanoid');
const { nowISO } = require('./time');

/**
 * Система миграций для Home Manager
 * Версия схемы: v1.0 → v2.0 → v3.0 → v4.0
 *
 * v1 = оригинальная схема
 * v2 = добавлены: properties, rooms, inventory, meters, meter_readings,
 *      contacts, checklists, checklist_progress, user_stats
 * v3 = добавлено поле is_active для checklists
 * v4 = добавлены custom_meter_types (кастомные типы счётчиков)
 */

const CURRENT_SCHEMA_VERSION = 4;

/**
 * Миграция с версии 1 на версию 2
 * Добавляет новые таблицы для модулей v2.0
 */
function migrateV1toV2(data) {
  console.log('[Migration] Starting v1 → v2 migration...');

  // Добавляем новые таблицы с пустыми массивами
  data.properties = data.properties || [];
  data.rooms = data.rooms || [];
  data.inventory = data.inventory || [];
  data.meters = data.meters || [];
  data.meter_readings = data.meter_readings || [];
  data.contacts = data.contacts || [];
  data.checklists = data.checklists || [];
  data.checklist_progress = data.checklist_progress || [];

  // Инициализируем user_stats (единственная запись)
  if (!data.user_stats) {
    data.user_stats = {
      // XP и уровни
      xp: 0,
      level: 1,

      // Streak
      current_streak: 0,
      longest_streak: 0,
      last_activity_date: null,

      // Счетчики достижений
      total_tasks_completed: 0,
      total_maintenance_logged: 0,
      total_goals_achieved: 0,

      // Достижения (array of achievement IDs)
      unlocked_achievements: [],

      // Настройки
      gamification_enabled: true,
      animations_enabled: true,

      // Метаданные
      created_at: nowISO(),
      updated_at: nowISO()
    };
  }

  // Добавляем предустановленные контакты (аварийные службы)
  if (data.contacts.length === 0) {
    const emergencyContacts = [
      {
        id: nanoid(),
        name: 'Единая служба спасения',
        category: 'emergency',
        specialty: 'Экстренная помощь',
        phone: '112',
        phone_alt: '',
        email: '',
        website: '',
        address: '',
        work_hours: 'Круглосуточно',
        is_24h: true,
        rating: 5,
        last_used: null,
        price_info: 'Бесплатно',
        notes: 'Единый номер экстренных служб',
        is_favorite: true,
        created_at: nowISO(),
        updated_at: nowISO()
      },
      {
        id: nanoid(),
        name: 'Газовая служба (аварийная)',
        category: 'emergency',
        specialty: 'Газовое оборудование',
        phone: '104',
        phone_alt: '',
        email: '',
        website: '',
        address: '',
        work_hours: 'Круглосуточно',
        is_24h: true,
        rating: 5,
        last_used: null,
        price_info: 'Бесплатно',
        notes: 'При запахе газа',
        is_favorite: true,
        created_at: nowISO(),
        updated_at: nowISO()
      }
    ];

    data.contacts.push(...emergencyContacts);
  }

  // Добавляем предустановленные чек-листы
  if (data.checklists.length === 0) {
    const presetChecklists = [
      {
        id: nanoid(),
        name: '💧 Протечка воды',
        category: 'emergency',
        description: 'Экстренные действия при протечке',
        items: [
          { text: 'ПЕРЕКРЫТЬ ВОДУ (вентиль в туалете/ванной)', priority: 'critical' },
          { text: 'Отключить электричество в зоне протечки', priority: 'critical' },
          { text: 'Собрать воду тряпками/вёдрами', priority: 'high' },
          { text: 'Позвонить в аварийную службу', priority: 'high' },
          { text: 'Предупредить соседей снизу', priority: 'high' },
          { text: 'Сфотографировать повреждения (для страховой)', priority: 'medium' },
          { text: 'Вызвать сантехника', priority: 'high' }
        ],
        is_preset: true,
        is_active: true,
        created_at: nowISO(),
        updated_at: nowISO()
      },
      {
        id: nanoid(),
        name: '🔵 Запах газа',
        category: 'emergency',
        description: 'Критические действия при утечке газа',
        items: [
          { text: 'НЕ ВКЛЮЧАТЬ свет и электроприборы!', priority: 'critical' },
          { text: 'НЕ ЗАЖИГАТЬ спички/зажигалки!', priority: 'critical' },
          { text: 'Открыть окна для проветривания', priority: 'critical' },
          { text: 'Перекрыть газовый кран', priority: 'critical' },
          { text: 'Покинуть помещение', priority: 'critical' },
          { text: 'Вызвать газовую службу (104)', priority: 'critical' },
          { text: 'Предупредить соседей', priority: 'high' }
        ],
        is_preset: true,
        is_active: true,
        created_at: nowISO(),
        updated_at: nowISO()
      },
      {
        id: nanoid(),
        name: '❄️ Подготовка к зиме',
        category: 'seasonal',
        description: 'Сезонные работы перед зимой',
        items: [
          { text: 'Проверить и утеплить окна', priority: 'high' },
          { text: 'Проверить отопление', priority: 'high' },
          { text: 'Проверить утепление входной двери', priority: 'medium' },
          { text: 'Проверить теплоизоляцию труб', priority: 'medium' },
          { text: 'Слить воду из системы на даче', priority: 'high' },
          { text: 'Заменить летнюю резину на зимнюю', priority: 'high' }
        ],
        is_preset: true,
        is_active: true,
        created_at: nowISO(),
        updated_at: nowISO()
      },
      {
        id: nanoid(),
        name: '✈️ Перед отпуском',
        category: 'other',
        description: 'Чек-лист перед отъездом',
        items: [
          { text: 'Перекрыть воду', priority: 'high' },
          { text: 'Проверить, выключены ли все приборы', priority: 'high' },
          { text: 'Выбросить скоропортящиеся продукты', priority: 'medium' },
          { text: 'Отключить газовую плиту (если есть)', priority: 'high' },
          { text: 'Закрыть все окна', priority: 'high' },
          { text: 'Попросить соседей/родственников присмотреть', priority: 'medium' }
        ],
        is_preset: true,
        is_active: true,
        created_at: nowISO(),
        updated_at: nowISO()
      }
    ];

    data.checklists.push(...presetChecklists);
  }

  // Обновляем версию схемы
  data.schema_version = 2;
  data.migrated_at = nowISO();

  console.log('[Migration] v1 → v2 migration completed successfully');
  console.log(`[Migration] Added: properties, rooms, inventory, meters, contacts, checklists, user_stats`);

  return data;
}

/**
 * Миграция с версии 2 на версию 3
 * Добавляет поле is_active для чек-листов
 */
function migrateV2toV3(data) {
  console.log('[Migration] Starting v2 → v3 migration...');

  // Добавляем is_active ко всем существующим чек-листам
  if (Array.isArray(data.checklists)) {
    data.checklists.forEach(checklist => {
      if (checklist.is_active === undefined) {
        checklist.is_active = true; // По умолчанию все чек-листы активны
      }
    });
  }

  // Обновляем версию схемы
  data.schema_version = 3;
  data.migrated_at = nowISO();

  console.log('[Migration] v2 → v3 migration completed successfully');
  console.log(`[Migration] Added is_active field to ${data.checklists?.length || 0} checklists`);

  return data;
}

/**
 * Миграция с версии 3 на версию 4
 * Добавляет поддержку кастомных типов счётчиков
 */
function migrateV3toV4(data) {
  console.log('[Migration] Starting v3 → v4 migration...');

  // Добавляем новую таблицу для кастомных типов счётчиков
  if (!data.custom_meter_types) {
    data.custom_meter_types = [];
  }

  // Обновляем версию схемы
  data.schema_version = 4;
  data.migrated_at = nowISO();

  console.log('[Migration] v3 → v4 migration completed successfully');
  console.log('[Migration] Added custom_meter_types table');

  return data;
}

/**
 * Откат миграции v2 → v1 (для безопасности)
 * ВНИМАНИЕ: Удаляет данные новых таблиц!
 */
function rollbackV2toV1(data) {
  console.warn('[Migration] Rolling back v2 → v1 (this will delete new data!)');

  // Удаляем новые таблицы
  delete data.properties;
  delete data.rooms;
  delete data.inventory;
  delete data.meters;
  delete data.meter_readings;
  delete data.contacts;
  delete data.checklists;
  delete data.checklist_progress;
  delete data.user_stats;
  delete data.migrated_at;

  // Возвращаем версию
  data.schema_version = 1;

  console.warn('[Migration] Rollback completed. Version reverted to v1');

  return data;
}

/**
 * Главная функция миграции
 * Автоматически применяет все необходимые миграции
 */
function applyMigrations(data) {
  let currentVersion = data.schema_version || 1;

  if (currentVersion === CURRENT_SCHEMA_VERSION) {
    console.log(`[Migration] Schema is up to date (v${currentVersion})`);
    return data;
  }

  if (currentVersion < CURRENT_SCHEMA_VERSION) {
    console.log(`[Migration] Schema needs upgrade: v${currentVersion} → v${CURRENT_SCHEMA_VERSION}`);

    // Применяем миграции последовательно
    if (currentVersion === 1) {
      data = migrateV1toV2(data);
      currentVersion = 2;
    }

    if (currentVersion === 2) {
      data = migrateV2toV3(data);
      currentVersion = 3;
    }

    if (currentVersion === 3) {
      data = migrateV3toV4(data);
      currentVersion = 4;
    }

    // Здесь можно добавить будущие миграции:
    // if (currentVersion === 4) { data = migrateV4toV5(data); }

    return data;
  }

  if (currentVersion > CURRENT_SCHEMA_VERSION) {
    console.error(`[Migration] ERROR: Database version (v${currentVersion}) is newer than app version (v${CURRENT_SCHEMA_VERSION})`);
    console.error('[Migration] Please update the application to the latest version');
    throw new Error(`Database version mismatch: db=v${currentVersion}, app=v${CURRENT_SCHEMA_VERSION}`);
  }

  return data;
}

/**
 * Проверка совместимости схемы
 */
function checkSchemaCompatibility(data) {
  const dbVersion = data.schema_version || 1;

  return {
    compatible: dbVersion <= CURRENT_SCHEMA_VERSION,
    currentVersion: dbVersion,
    targetVersion: CURRENT_SCHEMA_VERSION,
    needsMigration: dbVersion < CURRENT_SCHEMA_VERSION,
    canMigrate: dbVersion < CURRENT_SCHEMA_VERSION,
    message: dbVersion === CURRENT_SCHEMA_VERSION
      ? 'Schema is up to date'
      : dbVersion < CURRENT_SCHEMA_VERSION
        ? 'Migration available'
        : 'Database is from newer version of the app'
  };
}

module.exports = {
  CURRENT_SCHEMA_VERSION,
  applyMigrations,
  checkSchemaCompatibility,
  rollbackV2toV1,

  // Экспортируем отдельные миграции для тестирования
  migrateV1toV2,
  migrateV2toV3,
  migrateV3toV4
};
