// electron/services/AnalyticsService.js
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

class AnalyticsService {

  /**
   * Продуктивность: задачи по дням за последние N дней
   */
  getTasksProductivity(days = 30) {
    const data = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = addDays(now, -i).toISOString().slice(0, 10);

      const tasks = db.tasks.list({});
      const completed = tasks.filter(t => t.done_at === date).length;
      const created = tasks.filter(t => t.created_at.startsWith(date)).length;

      data.push({ date, completed, created });
    }

    return data;
  }

  /**
   * Расходы на обслуживание по категориям
   */
  getMaintenanceCostsByCategory(months = 6) {
    const logs = db.maintenance.logs.list({});
    const now = new Date();
    const startDate = addDays(now, -months * 30).toISOString().slice(0, 10);

    const recentLogs = logs.filter(l => l.done_at >= startDate && l.cost);

    const byCategory = {};

    for (const log of recentLogs) {
      const asset = db.assets.get(log.asset_id);
      const category = asset?.type || 'other';

      if (!byCategory[category]) {
        byCategory[category] = 0;
      }
      byCategory[category] += log.cost;
    }

    return Object.entries(byCategory).map(([category, total]) => ({
      category,
      total: Math.round(total * 100) / 100
    }));
  }

  /**
   * Прогресс по целям
   */
  getGoalsAnalytics() {
    const goals = db.goals.list({});

    return {
      active: goals.filter(g => g.status === 'active').length,
      achieved: goals.filter(g => g.status === 'archived' && g.saved_amount >= g.target_amount).length,
      totalTarget: goals.filter(g => g.status === 'active').reduce((sum, g) => sum + g.target_amount, 0),
      totalSaved: goals.filter(g => g.status === 'active').reduce((sum, g) => sum + g.saved_amount, 0),
      goals: goals.filter(g => g.status === 'active').map(g => ({
        id: g.id,
        title: g.title,
        progress: g.target_amount > 0 ? Math.round((g.saved_amount / g.target_amount) * 100) : 0,
        remaining: g.target_amount - g.saved_amount,
        due_at: g.due_at
      }))
    };
  }

  /**
   * Общая статистика
   */
  getSummaryStats() {
    const tasks = db.tasks.list({});
    const inventory = db.inventory.list({});
    const meters = db.meters.list({});
    const goals = db.goals.list({});
    const stats = db.stats.get();

    return {
      tasks: {
        total: tasks.length,
        completed: tasks.filter(t => t.status === 'done').length,
        active: tasks.filter(t => t.status === 'active').length
      },
      inventory: {
        total: inventory.length,
        totalValue: inventory.reduce((sum, i) => sum + (i.purchase_price || 0), 0),
        expiringWarranty: inventory.filter(i => {
          if (!i.warranty_until) return false;
          const today = todayISO();
          const in30days = addDays(new Date(), 30).toISOString().slice(0, 10);
          return i.warranty_until >= today && i.warranty_until <= in30days;
        }).length
      },
      meters: {
        total: meters.length,
        active: meters.filter(m => m.is_active).length
      },
      goals: {
        total: goals.length,
        active: goals.filter(g => g.status === 'active').length
      },
      gamification: {
        level: stats.level,
        xp: stats.xp,
        streak: stats.current_streak,
        achievements: stats.unlocked_achievements?.length || 0
      }
    };
  }
}

module.exports = new AnalyticsService();
