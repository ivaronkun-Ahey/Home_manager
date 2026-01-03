// electron/services/NotificationScheduler.js
const NotificationService = require('./NotificationService');
const { db } = require('../storage/jsonDb');

// Configuration constants
const INITIAL_CHECK_DELAY_MS = 5000; // 5 seconds
const CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const MORNING_NOTIFICATION_START = 8; // 8 AM
const MORNING_NOTIFICATION_END = 10; // 10 AM
const METER_WARNING_DAYS = 60; // 60 days before verification
const MAINTENANCE_WARNING_DAYS = 7; // 7 days before due
const WARRANTY_WARNING_DAYS = 30; // 30 days before expiry

// Helper functions
function todayISO() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

class NotificationScheduler {
  constructor() {
    this.checkInterval = null;
    this.lastCheck = null;
  }

  /**
   * Запустить планировщик
   * Проверяет каждые 15 минут
   */
  start() {
    console.log('[Scheduler] Starting notification scheduler');

    // Первая проверка через несколько секунд после запуска
    setTimeout(() => this.checkAll(), INITIAL_CHECK_DELAY_MS);

    // Затем каждые 15 минут
    this.checkInterval = setInterval(() => {
      this.checkAll();
    }, CHECK_INTERVAL_MS);
  }

  /**
   * Остановить планировщик
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Проверить все типы напоминаний
   */
  checkAll() {
    const now = new Date();
    console.log('[Scheduler] Running checks at', now.toISOString());

    this.checkOverdueTasks();
    this.checkTodayTasks();
    this.checkMeterReadings();
    this.checkWarrantyExpiring();
    this.checkMaintenanceDue();
    this.checkMeterVerification();

    this.lastCheck = now;
  }

  /**
   * Проверка просроченных задач
   */
  checkOverdueTasks() {
    const today = todayISO();
    const tasks = db.tasks.list({ status: 'active' });

    const overdue = tasks.filter(t => t.due_at && t.due_at < today);

    if (overdue.length > 0) {
      NotificationService.send({
        title: '⚠️ Просроченные задачи',
        body: `У вас ${overdue.length} просроченных задач`,
        type: 'task',
        data: { route: 'tasks', filter: 'overdue' }
      });
    }
  }

  /**
   * Проверка задач на сегодня (утреннее напоминание)
   */
  checkTodayTasks() {
    const hour = new Date().getHours();

    // Показываем только утром
    if (hour < MORNING_NOTIFICATION_START || hour > MORNING_NOTIFICATION_END) return;

    // Проверяем, не показывали ли уже сегодня
    if (this.lastCheck && this.lastCheck.toDateString() === new Date().toDateString()) {
      return;
    }

    const today = todayISO();
    const tasks = db.tasks.list({ status: 'active' });
    const todayTasks = tasks.filter(t => t.due_at === today);

    if (todayTasks.length > 0) {
      NotificationService.send({
        title: '📋 Задачи на сегодня',
        body: `${todayTasks.length} задач запланировано на сегодня`,
        type: 'task',
        data: { route: 'tasks', filter: 'today' }
      });
    }
  }

  /**
   * Проверка необходимости подачи показаний счётчиков
   */
  checkMeterReadings() {
    const today = new Date();
    const dayOfMonth = today.getDate();

    const meters = db.meters.list({ is_active: true });

    const needReadings = meters.filter(m => {
      return dayOfMonth >= m.submission_day_start &&
             dayOfMonth <= m.submission_day_end;
    });

    if (needReadings.length > 0) {
      // Проверяем, есть ли показания за этот месяц
      const currentMonth = today.toISOString().slice(0, 7); // YYYY-MM

      const metersWithoutReading = needReadings.filter(m => {
        if (!m.last_reading_date) return true;
        return !m.last_reading_date.startsWith(currentMonth);
      });

      if (metersWithoutReading.length > 0) {
        NotificationService.send({
          title: '💧 Подайте показания счётчиков',
          body: `${metersWithoutReading.length} счётчиков ждут показания`,
          type: 'meter',
          data: { route: 'meters' }
        });
      }
    }
  }

  /**
   * Проверка истекающих гарантий
   */
  checkWarrantyExpiring() {
    const today = todayISO();
    const in30days = addDays(new Date(), WARRANTY_WARNING_DAYS).toISOString().slice(0, 10);

    const inventory = db.inventory.list({ status: 'active' });

    const expiringSoon = inventory.filter(item => {
      if (!item.warranty_until) return false;
      return item.warranty_until >= today && item.warranty_until <= in30days;
    });

    if (expiringSoon.length > 0) {
      NotificationService.send({
        title: '🛡️ Истекает гарантия',
        body: `Гарантия заканчивается у ${expiringSoon.length} предметов в течение 30 дней`,
        type: 'warranty',
        data: { route: 'inventory' }
      });
    }
  }

  /**
   * Проверка плановых обслуживаний
   */
  checkMaintenanceDue() {
    const today = todayISO();
    const in7days = addDays(new Date(), MAINTENANCE_WARNING_DAYS).toISOString().slice(0, 10);

    const plans = db.maintenance.plans.list({ is_active: true });

    const dueSoon = plans.filter(p => {
      return p.next_due_at && p.next_due_at >= today && p.next_due_at <= in7days;
    });

    if (dueSoon.length > 0) {
      NotificationService.send({
        title: '🔧 Плановое обслуживание',
        body: `${dueSoon.length} обслуживаний запланировано на эту неделю`,
        type: 'maintenance',
        data: { route: 'maintenance' }
      });
    }
  }

  /**
   * Проверка поверки счётчиков
   */
  checkMeterVerification() {
    const today = todayISO();
    const in60days = addDays(new Date(), METER_WARNING_DAYS).toISOString().slice(0, 10);

    const meters = db.meters.list({ is_active: true });

    const needVerification = meters.filter(m => {
      if (!m.next_verification) return false;
      return m.next_verification >= today && m.next_verification <= in60days;
    });

    if (needVerification.length > 0) {
      NotificationService.send({
        title: '📅 Поверка счётчиков',
        body: `${needVerification.length} счётчиков требуют поверки в ближайшие 2 месяца`,
        type: 'meter',
        data: { route: 'meters' }
      });
    }
  }
}

module.exports = new NotificationScheduler();
