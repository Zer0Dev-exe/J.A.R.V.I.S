import {
  ActivityType,
  Client,
  GatewayIntentBits,
  Partials,
  Team,
  User,
} from 'discord.js';
import { CommandHandler } from './commandHandler.js';
import { EventHandler } from './eventHandler.js';
import { Logger } from '../utils/logger.js';
import { config } from '../config/config.js';
import { SnapshotManager } from '../modules/recovery/snapshotManager.js';

export class JarvisSecurityClient extends Client {
  public commandHandler: CommandHandler;
  public botOwnerIds: Set<string> = new Set();
  private statusInterval?: NodeJS.Timeout;

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildWebhooks,
      ],
      partials: [
        Partials.GuildMember,
        Partials.Message,
        Partials.Channel,
        Partials.User,
      ],
    });

    this.commandHandler = new CommandHandler();
  }

  /**
   * Resuelve dinámicamente los dueños de la aplicación de Discord (usuario individual o miembros de Team)
   * sin depender de ningún ID estático en archivos de configuración.
   */
  public async fetchApplicationOwners(): Promise<void> {
    try {
      await this.application?.fetch();
      const owner = this.application?.owner;

      if (owner instanceof Team) {
        for (const member of owner.members.values()) {
          this.botOwnerIds.add(member.id);
        }
      } else if (owner instanceof User) {
        this.botOwnerIds.add(owner.id);
      }

      // Desarrolladores adicionales opcionales configurados
      for (const devId of config.developerIds) {
        this.botOwnerIds.add(devId);
      }

      Logger.log(
        `Dueños globales de la aplicación detectados dinámicamente: [${Array.from(this.botOwnerIds).join(', ')}]`,
        'Client'
      );
    } catch (err) {
      Logger.warn(`No se pudieron obtener los dueños de la aplicación vía API: ${err}`, 'Client');
    }
  }

  public isBotDeveloper(userId: string): boolean {
    return this.botOwnerIds.has(userId);
  }

  /**
   * Rotador épico de presencia y estados en Discord (cambio dinámico cada 20 segundos).
   */
  public startStatusRotator(): void {
    if (this.statusInterval) clearInterval(this.statusInterval);

    let step = 0;
    const updatePresence = () => {
      if (!this.user) return;

      const totalGuilds = this.guilds.cache.size;
      const totalUsers = this.guilds.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0);
      const ping = this.ws.ping >= 0 ? `${this.ws.ping}ms` : '<1ms';

      const statuses = [
        {
          name: `🛡️ ${totalGuilds} servidores | Escudos al 100%`,
          type: ActivityType.Watching,
        },
        {
          name: `⚡ Anti-Nuke Activo | Ping: ${ping}`,
          type: ActivityType.Custom,
        },
        {
          name: `⚔️ Neutralizando raids & scams | /help`,
          type: ActivityType.Competing,
        },
        {
          name: `🔒 Protegiendo a ${totalUsers.toLocaleString()} miembros`,
          type: ActivityType.Watching,
        },
        {
          name: `🤖 J.A.R.V.I.S Security • /stats`,
          type: ActivityType.Playing,
        },
      ];

      const current = statuses[step % statuses.length];
      this.user.setPresence({
        activities: [current],
        status: 'dnd', // Modo 'Do Not Disturb' (icono rojo elegante de alta seguridad)
      });

      step++;
    };

    updatePresence();
    this.statusInterval = setInterval(updatePresence, 20_000);
    if (this.statusInterval.unref) this.statusInterval.unref();
  }

  public async start(): Promise<void> {
    if (!config.token) {
      Logger.warn(
        '⚠️ DISCORD_TOKEN no configurado en el archivo .env. Configúralo para iniciar la sesión de Discord.',
        'Client'
      );
      return;
    }

    // Registrar eventos del ciclo de vida
    this.once('ready', async () => {
      Logger.log(`🤖 ¡J.A.R.V.I.S Security está en línea como ${this.user?.tag}!`, 'Client');
      Logger.log(`🛡️ Vigilando ${this.guilds.cache.size} servidores con escudos activos.`, 'Client');

      // Detectar dinámicamente los desarrolladores/dueños globales
      await this.fetchApplicationOwners();

      // Iniciar presencia épica rotativa
      this.startStatusRotator();

      // Desplegar comandos Slash
      await this.commandHandler.deploySlashCommands();

      // Tomar snapshots iniciales de todos los servidores
      for (const [, guild] of this.guilds.cache) {
        await SnapshotManager.backupGuildChannels(guild);
      }
    });

    // Registrar manejador de eventos y seguridad
    EventHandler.registerEvents(this, this.commandHandler);

    // Iniciar sesión
    await this.login(config.token);
  }
}
