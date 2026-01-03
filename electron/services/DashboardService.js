// electron/services/DashboardService.js
const { db } = require('../storage/jsonDb');

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

function parseISODate(iso) {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00`);
}

class DashboardService {

  /**
   * Получить все данные для Dashboard
   */
  getData() {
    return {
      urgent: this.getUrgentItems(),
      today: this.getTodayItems(),
      meters: this.getMeterStatus(),
      weekStats: this.getWeekStats(),
      upcoming: this.getUpcomingItems(),
      goals: this.getGoalsProgress()
    };
  }

  /**
   * Срочные элементы (требуют внимания)
   */
  getUrgentItems() {
    const today = todayISO();
    const items = [];

    // Просроченные задачи
    const overdueTasks = db.tasks.list({ status: 'active' })
      .filter(t => t.due_at && t.due_at < today);

    overdueTasks.forEach(t => {
      items.push({
        type: 'overdue_task',
        priority: 'high',
        title: t.title,
        subtitle: `Просрочено: ${t.due_at}`,
        action: { route: 'tasks', id: t.id }
      });
    });

    // Истекающая гарантия (в течение 7 дней)
    const in7days = addDays(new Date(), 7).toISOString().slice(0, 10);
    const expiringWarranty = db.inventory.list({ status: 'active' })
      .filter(i => i.warranty_until && i.warranty_until >= today && i.warranty_until <= in7days);

    expiringWarranty.forEach(i => {
      items.push({
        type: 'warranty_expiring',
        priority: 'medium',
        title: `Гарантия: ${i.name}`,
        subtitle: `Истекает: ${i.warranty_until}`,
        action: { route: 'inventory', id: i.id }
      });
    });

    // Просроченное обслуживание
    const overdueMaintenance = db.maintenance.plans.list({ is_active: true })
      .filter(p => p.next_due_at && p.next_due_at < today);

    overdueMaintenance.forEach(p => {
      const asset = db.assets.get({ id: p.asset_id });
      items.push({
        type: 'overdue_maintenance',
        priority: 'medium',
        title: p.title,
        subtitle: `${asset?.name || 'Объект'} — просрочено`,
        action: { route: 'maintenance', id: p.id }
      });
    });

    // Сортировка по приоритету
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return items;
  }

  /**
   * Задачи на сегодня
   */
  getTodayItems() {
    const today = todayISO();

    const tasks = db.tasks.list({ status: 'active' })
      .filter(t => t.due_at === today)
      .map(t => ({
        type: 'task',
        id: t.id,
        title: t.title,
        priority: t.priority,
        profile_id: t.profile_id
      }));

    return tasks;
  }

  /**
   * Статус счётчиков
   */
  getMeterStatus() {
    const today = new Date();
    const dayOfMonth = today.getDate();
    const currentMonth = today.toISOString().slice(0, 7);

    const meters = db.meters.list({ is_active: true });

    return meters.map(m => {
      const isSubmissionPeriod = dayOfMonth >= m.submission_day_start &&
                                  dayOfMonth <= m.submission_day_end;

      const hasCurrentReading = m.last_reading_date &&
                                 m.last_reading_date.startsWith(currentMonth);

      let status = 'ok';
      if (isSubmissionPeriod && !hasCurrentReading) {
        status = 'needs_reading';
      } else if (!hasCurrentReading && dayOfMonth > m.submission_day_end) {
        status = 'missed';
      }

      return {
        id: m.id,
        name: m.name,
        type: m.type,
        status,
        last_reading: m.last_reading,
        last_reading_date: m.last_reading_date,
        submission_period: `${m.submission_day_start}-${m.submission_day_end}`
      };
    });
  }

  /**
   * Статистика за неделю
   */
  getWeekStats() {
    const today = new Date();
    const weekAgo = addDays(today, -7).toISOString().slice(0, 10);

    const tasks = db.tasks.list({});
    const completedThisWeek = tasks.filter(t =>
      t.status === 'done' && t.done_at && t.done_at >= weekAgo
    ).length;

    const logs = db.maintenance_logs.list({});
    const maintenanceThisWeek = logs.filter(l =>
      l.done_at && l.done_at >= weekAgo
    ).length;

    const stats = db.stats.get();

    return {
      tasks_completed: completedThisWeek,
      maintenance_done: maintenanceThisWeek,
      current_streak: stats.current_streak,
      xp: stats.xp,
      level: stats.level
    };
  }

  /**
   * Предстоящие события (7 дней)
   */
  getUpcomingItems() {
    const today = todayISO();
    const in7days = addDays(new Date(), 7).toISOString().slice(0, 10);
    const items = [];

    // Задачи на неделю
    const upcomingTasks = db.tasks.list({ status: 'active' })
      .filter(t => t.due_at && t.due_at > today && t.due_at <= in7days);

    upcomingTasks.forEach(t => {
      items.push({
        type: 'task',
        date: t.due_at,
        title: t.title,
        action: { route: 'tasks', id: t.id }
      });
    });

    // Обслуживание на неделю
    const upcomingMaintenance = db.maintenance.plans.list({ is_active: true })
      .filter(p => p.next_due_at && p.next_due_at > today && p.next_due_at <= in7days);

    upcomingMaintenance.forEach(p => {
      items.push({
        type: 'maintenance',
        date: p.next_due_at,
        title: p.title,
        action: { route: 'maintenance', id: p.id }
      });
    });

    // Сортировка по дате
    items.sort((a, b) => a.date.localeCompare(b.date));

    return items;
  }

  /**
   * Прогресс по целям
   */
  getGoalsProgress() {
    const goals = db.goals.list({ status: 'active' });

    return goals.map(g => ({
      id: g.id,
      title: g.title,
      target: g.target_amount,
      saved: g.saved_amount,
      progress: g.target_amount > 0 ? Math.round((g.saved_amount / g.target_amount) * 100) : 0,
      due_at: g.due_at
    })).slice(0, 3); // Топ 3 цели
  }
}

module.exports = new DashboardService();
