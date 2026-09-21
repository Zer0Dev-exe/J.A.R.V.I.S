/**
 * Limitador de tasa por ventana deslizante en memoria de latencia sub-milisegundo (< 1ms).
 * Registra marcas de tiempo y calcula con precisión si se supera el umbral en una ventana dada.
 */
export class SlidingWindowLimiter {
  private windows: Map<string, number[]> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor(cleanupIntervalMs: number = 60_000) {
    // Limpieza periódica de claves inactivas para evitar fugas de memoria
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Registra un nuevo evento y comprueba si ha superado el límite.
   * @param key Identificador único (ej: "guildId:userId:channel_delete")
   * @param limit Cantidad máxima permitida de eventos en la ventana
   * @param windowMs Tamaño de la ventana en milisegundos
   * @returns { exceeded: boolean, currentCount: number }
   */
  public hit(key: string, limit: number, windowMs: number): { exceeded: boolean; currentCount: number } {
    const now = Date.now();
    const threshold = now - windowMs;

    let timestamps = this.windows.get(key);
    if (!timestamps) {
      timestamps = [];
      this.windows.set(key, timestamps);
    }

    // Filtrar marcas de tiempo anteriores al umbral
    const validTimestamps = timestamps.filter((t) => t > threshold);
    validTimestamps.push(now);
    this.windows.set(key, validTimestamps);

    const currentCount = validTimestamps.length;
    const exceeded = currentCount > limit;

    return { exceeded, currentCount };
  }

  /**
   * Resetea el contador para una clave específica.
   */
  public reset(key: string): void {
    this.windows.delete(key);
  }

  /**
   * Limpia registros antiguos que ya no son relevantes.
   */
  private cleanup(): void {
    const now = Date.now();
    const maxRetention = 120_000; // 2 minutos

    for (const [key, timestamps] of this.windows.entries()) {
      const active = timestamps.filter((t) => now - t < maxRetention);
      if (active.length === 0) {
        this.windows.delete(key);
      } else {
        this.windows.set(key, active);
      }
    }
  }

  public destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}

export const rateLimiter = new SlidingWindowLimiter();
