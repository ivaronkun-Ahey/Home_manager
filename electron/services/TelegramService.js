// electron/services/TelegramService.js
const https = require('https');
const db = require('../storage/jsonDb');

class TelegramService {

  async sendMessage(text) {
    const stats = db.stats.get();

    if (!stats.telegram_enabled || !stats.telegram_bot_token || !stats.telegram_chat_id) {
      console.log('[Telegram] Not configured, skipping message');
      return false;
    }

    const url = `https://api.telegram.org/bot${stats.telegram_bot_token}/sendMessage`;

    const data = JSON.stringify({
      chat_id: stats.telegram_chat_id,
      text: text,
      parse_mode: 'HTML'
    });

    return new Promise((resolve, reject) => {
      const req = https.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(true);
          } else {
            console.error('[Telegram] Error:', body);
            resolve(false);
          }
        });
      });

      req.on('error', (e) => {
        console.error('[Telegram] Request error:', e);
        resolve(false);
      });

      req.write(data);
      req.end();
    });
  }

  async sendDailySummary() {
    const today = new Date().toISOString().slice(0, 10);
    const tasks = db.tasks.list({ status: 'active' });
    const todayTasks = tasks.filter(t => t.due_at === today);
    const overdueTasks = tasks.filter(t => t.due_at && t.due_at < today);

    let message = `🏠 <b>Home Manager — ${today}</b>\n\n`;

    if (overdueTasks.length > 0) {
      message += `⚠️ <b>Просрочено:</b> ${overdueTasks.length} задач\n`;
    }

    if (todayTasks.length > 0) {
      message += `📋 <b>На сегодня:</b>\n`;
      todayTasks.forEach(t => {
        message += `• ${t.title}\n`;
      });
    } else {
      message += `✅ На сегодня задач нет\n`;
    }

    // Проверить счётчики
    const dayOfMonth = new Date().getDate();
    const meters = db.meters.list({ is_active: true });
    const needReadings = meters.filter(m =>
      dayOfMonth >= m.submission_day_start && dayOfMonth <= m.submission_day_end
    );

    if (needReadings.length > 0) {
      message += `\n💧 <b>Подать показания:</b> ${needReadings.length} счётчиков`;
    }

    return this.sendMessage(message);
  }

  async testConnection() {
    const stats = db.stats.get();

    if (!stats.telegram_bot_token || !stats.telegram_chat_id) {
      return { ok: false, error: 'Не настроен токен или chat_id' };
    }

    const success = await this.sendMessage('✅ Home Manager подключен!');
    return { ok: success };
  }
}

module.exports = new TelegramService();
