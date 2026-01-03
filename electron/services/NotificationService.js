// electron/services/NotificationService.js
const { Notification, nativeImage } = require('electron');
const path = require('path');

class NotificationService {
  constructor() {
    this.enabled = true;
    this.quiet_hours = { start: 22, end: 8 }; // 22:00 - 08:00
  }

  /**
   * Проверка, можно ли отправлять уведомления
   */
  canNotify() {
    if (!this.enabled) return false;

    const hour = new Date().getHours();
    const { start, end } = this.quiet_hours;

    // Тихие часы: с 22:00 до 08:00
    if (start > end) {
      // Переход через полночь
      if (hour >= start || hour < end) return false;
    } else {
      if (hour >= start && hour < end) return false;
    }

    return true;
  }

  /**
   * Отправить уведомление
   * @param {Object} options - { title, body, type, data }
   * type: 'task' | 'meter' | 'warranty' | 'maintenance' | 'general'
   */
  send(options) {
    if (!this.canNotify()) {
      console.log('[Notifications] Skipped (quiet hours):', options.title);
      return null;
    }

    const notification = new Notification({
      title: options.title,
      body: options.body,
      icon: this._getIcon(options.type),
      silent: options.silent || false,
      urgency: options.urgent ? 'critical' : 'normal',
      timeoutType: 'default'
    });

    notification.on('click', () => {
      if (options.onClick) {
        options.onClick(options.data);
      }
    });

    notification.show();
    return notification;
  }

  /**
   * Получить иконку по типу уведомления
   */
  _getIcon(type) {
    const icons = {
      task: '📋',
      meter: '💧',
      warranty: '🛡️',
      maintenance: '🔧',
      general: '🏠'
    };
    // В production использовать реальные PNG иконки
    // return nativeImage.createFromPath(path.join(__dirname, `../assets/icons/${type}.png`));
    return null; // Пока используем системную иконку
  }

  /**
   * Настройки уведомлений
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  setQuietHours(start, end) {
    this.quiet_hours = { start, end };
  }
}

module.exports = new NotificationService();
