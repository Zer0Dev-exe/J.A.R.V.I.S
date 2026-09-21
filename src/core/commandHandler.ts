import {
  ChatInputCommandInteraction,
  Client,
  Collection,
  REST,
  Routes,
} from 'discord.js';
import { Command } from '../commands/types.js';
import { securityCommand } from '../commands/security.js';
import { antinukeCommand } from '../commands/antinuke.js';
import { antiraidCommand } from '../commands/antiraid.js';
import { antiscamCommand } from '../commands/antiscam.js';
import { whitelistCommand } from '../commands/whitelist.js';
import { lockdownCommand } from '../commands/lockdown.js';
import { backupCommand } from '../commands/backup.js';
import { helpCommand } from '../commands/help.js';
import { statsCommand } from '../commands/stats.js';
import { config } from '../config/config.js';
import { Logger } from '../utils/logger.js';

export class CommandHandler {
  private commands: Collection<string, Command> = new Collection();

  constructor() {
    this.registerCommand(helpCommand);
    this.registerCommand(statsCommand);
    this.registerCommand(securityCommand);
    this.registerCommand(antinukeCommand);
    this.registerCommand(antiraidCommand);
    this.registerCommand(antiscamCommand);
    this.registerCommand(whitelistCommand);
    this.registerCommand(lockdownCommand);
    this.registerCommand(backupCommand);
  }

  private registerCommand(cmd: Command): void {
    this.commands.set(cmd.data.name, cmd);
  }

  public getCommands(): Collection<string, Command> {
    return this.commands;
  }

  /**
   * Registra los comandos Slash en el API global de Discord.
   */
  public async deploySlashCommands(): Promise<void> {
    if (!config.token || !config.clientId) {
      Logger.warn('DISCORD_TOKEN o CLIENT_ID no configurados. Omitiendo registro de comandos Slash en Discord API.', 'CommandHandler');
      return;
    }

    try {
      const rest = new REST({ version: '10' }).setToken(config.token);
      const commandData = this.commands.map((c) => c.data.toJSON());

      Logger.log(`Iniciando registro de ${commandData.length} comandos Slash en Discord...`, 'CommandHandler');

      await rest.put(Routes.applicationCommands(config.clientId), {
        body: commandData,
      });

      Logger.log(`¡${commandData.length} comandos Slash registrados exitosamente!`, 'CommandHandler');
    } catch (err) {
      Logger.error('Error al registrar comandos Slash en Discord:', err, 'CommandHandler');
    }
  }

  /**
   * Procesa la ejecución de un comando Slash
   */
  public async handleInteraction(interaction: ChatInputCommandInteraction): Promise<void> {
    const cmd = this.commands.get(interaction.commandName);
    if (!cmd) return;

    try {
      await cmd.execute(interaction);
    } catch (err) {
      Logger.error(`Error ejecutando comando /${interaction.commandName}:`, err, 'CommandHandler');
      const msg = '❌ Ocurrió un error inesperado al ejecutar esta acción de seguridad.';
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: msg, ephemeral: true }).catch(() => null);
      } else {
        await interaction.reply({ content: msg, ephemeral: true }).catch(() => null);
      }
    }
  }
}
