// electron/services/UtilityCalculator.js
const { db } = require('../storage/jsonDb');

class UtilityCalculator {

  /**
   * Рассчитать стоимость по одному счётчику за период
   */
  calculateMeterCost(meterId, month) {
    const meter = db.meters.get(meterId);
    if (!meter) {
      return null;
    }

    const tariff = db.tariffs.get(meter.type);
    if (!tariff) {
      return null;
    }

    // Получить показания за месяц
    const readings = db.meters.getReadings({ meter_id: meterId });
    const monthReadings = readings.filter(r => r.reading_date.startsWith(month));

    if (monthReadings.length === 0) {
      return null;
    }

    // Взять последнее показание месяца
    const lastReading = monthReadings.sort((a, b) =>
      b.reading_date.localeCompare(a.reading_date)
    )[0];

    const consumption = lastReading.consumption || 0;
    const cost = consumption * tariff.price;

    return {
      meter_id: meterId,
      meter_name: meter.name,
      meter_type: meter.type,
      month,
      consumption,
      unit: tariff.unit,
      price_per_unit: tariff.price,
      total_cost: Math.round(cost * 100) / 100
    };
  }

  /**
   * Рассчитать все коммунальные услуги за месяц
   */
  calculateMonthTotal(month) {
    const meters = db.meters.list({ is_active: true });
    const results = [];
    let totalCost = 0;

    for (const meter of meters) {
      const calc = this.calculateMeterCost(meter.id, month);
      if (calc) {
        results.push(calc);
        totalCost += calc.total_cost;
      }
    }

    return {
      month,
      items: results,
      total: Math.round(totalCost * 100) / 100
    };
  }

  /**
   * Получить историю расходов по месяцам
   */
  getMonthlyHistory(monthsCount = 12) {
    const history = [];
    const now = new Date();

    for (let i = 0; i < monthsCount; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = date.toISOString().slice(0, 7); // YYYY-MM

      const calc = this.calculateMonthTotal(month);
      if (calc.items.length > 0) {
        history.push(calc);
      }
    }

    return history;
  }

  /**
   * Получить статистику потребления
   */
  getConsumptionStats(meterType, monthsCount = 6) {
    const meters = db.meters.list({ is_active: true })
      .filter(m => m.type === meterType);

    if (meters.length === 0) return null;

    const monthlyData = [];
    const now = new Date();

    for (let i = 0; i < monthsCount; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = date.toISOString().slice(0, 7);

      let totalConsumption = 0;

      for (const meter of meters) {
        const calc = this.calculateMeterCost(meter.id, month);
        if (calc) {
          totalConsumption += calc.consumption;
        }
      }

      monthlyData.push({
        month,
        consumption: totalConsumption
      });
    }

    // Рассчитать среднее
    const values = monthlyData.map(d => d.consumption).filter(v => v > 0);
    const average = values.length > 0 ?
      values.reduce((a, b) => a + b, 0) / values.length : 0;

    return {
      type: meterType,
      history: monthlyData.reverse(),
      average: Math.round(average * 100) / 100
    };
  }
}

module.exports = new UtilityCalculator();
