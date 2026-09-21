import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from './types.js';
import { db } from '../database/db.js';
import { PenaltyType } from '../config/config.js';

export const antinukeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('antinuke')
    .setDescription('Configura y calibra las protecciones Anti-Nuke de J.A.R.V.I.S')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setDescription('Activa o desactiva la protección Anti-Nuke')
        .addBooleanOption((opt) =>
          opt.setName('activado').setDescription('¿Activar módulo Anti-Nuke?').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('limits')
        .setDescription('Personaliza los umbrales de detección y tiempo')
        .addIntegerOption((opt) =>
          opt.setName('borrar_canales').setDescription('Límite de borrado de canales').setMinValue(1).setMaxValue(20)
        )
        .addIntegerOption((opt) =>
          opt.setName('crear_canales').setDescription('Límite de creación de canales').setMinValue(1).setMaxValue(20)
        )
        .addIntegerOption((opt) =>
          opt.setName('borrar_roles').setDescription('Límite de borrado de roles').setMinValue(1).setMaxValue(20)
        )
        .addIntegerOption((opt) =>
          opt.setName('crear_roles').setDescription('Límite de creación de roles').setMinValue(1).setMaxValue(20)
        )
        .addIntegerOption((opt) =>
          opt.setName('baneos').setDescription('Límite de baneos masivos').setMinValue(1).setMaxValue(30)
        )
        .addIntegerOption((opt) =>
          opt.setName('expulsiones').setDescription('Límite de expulsiones masivas').setMinValue(1).setMaxValue(30)
        )
        .addIntegerOption((opt) =>
          opt.setName('webhooks').setDescription('Límite de creación de webhooks').setMinValue(1).setMaxValue(10)
        )
        .addIntegerOption((opt) =>
          opt.setName('segundos').setDescription('Ventana de tiempo en segundos para los límites').setMinValue(3).setMaxValue(60)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('penalty')
        .setDescription('Elige la sanción inmediata al activarse el Anti-Nuke')
        .addStringOption((opt) =>
          opt
            .setName('tipo')
            .setDescription('Tipo de sanción a aplicar')
            .setRequired(true)
            .addChoices(
              { name: 'Cuarentena (Aislamiento y Timeout)', value: 'QUARANTINE' },
              { name: 'Baneo Permanente', value: 'BAN' },
              { name: 'Expulsión (Kick)', value: 'KICK' },
              { name: 'Despojar Roles Peligrosos (Strip Roles)', value: 'STRIP_ROLES' }
            )
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guild = interaction.guild;
    if (!guild) return;

    const subcommand = interaction.options.getSubcommand();
    const settings = db.getGuildSettings(guild.id);

    if (subcommand === 'toggle') {
      const enabled = interaction.options.getBoolean('activado', true);
      db.updateGuildSettings(guild.id, { antinuke_enabled: enabled ? 1 : 0 });

      const embed = new EmbedBuilder()
        .setColor(enabled ? 0x57f287 : 0xed4245)
        .setTitle(`Protección Anti-Nuke ${enabled ? 'Activada 🟢' : 'Desactivada 🔴'}`)
        .setDescription(
          enabled
            ? 'El servidor ahora está protegido contra destrucción masiva de canales, roles, bots no autorizados y expulsiones/baneos masivos.'
            : '⚠️ El escudo Anti-Nuke ha sido desactivado. Las acciones masivas de moderadores no serán supervisadas por este módulo.'
        );

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'limits') {
      const updates: any = {};
      const changes: string[] = [];

      const chDel = interaction.options.getInteger('borrar_canales');
      const chCre = interaction.options.getInteger('crear_canales');
      const roDel = interaction.options.getInteger('borrar_roles');
      const roCre = interaction.options.getInteger('crear_roles');
      const bans = interaction.options.getInteger('baneos');
      const kicks = interaction.options.getInteger('expulsiones');
      const webhooks = interaction.options.getInteger('webhooks');
      const secs = interaction.options.getInteger('segundos');

      if (chDel !== null) {
        updates.channel_delete_limit = chDel;
        changes.push(`• Borrado de canales: \`${chDel}\``);
      }
      if (chCre !== null) {
        updates.channel_create_limit = chCre;
        changes.push(`• Creación de canales: \`${chCre}\``);
      }
      if (roDel !== null) {
        updates.role_delete_limit = roDel;
        changes.push(`• Borrado de roles: \`${roDel}\``);
      }
      if (roCre !== null) {
        updates.role_create_limit = roCre;
        changes.push(`• Creación de roles: \`${roCre}\``);
      }
      if (bans !== null) {
        updates.ban_limit = bans;
        changes.push(`• Baneos masivos: \`${bans}\``);
      }
      if (kicks !== null) {
        updates.kick_limit = kicks;
        changes.push(`• Expulsiones masivas: \`${kicks}\``);
      }
      if (webhooks !== null) {
        updates.webhook_limit = webhooks;
        changes.push(`• Webhooks: \`${webhooks}\``);
      }
      if (secs !== null) {
        updates.limit_window_seconds = secs;
        changes.push(`• Ventana de tiempo: \`${secs} segundos\``);
      }

      if (changes.length === 0) {
        await interaction.reply({ content: 'No indicaste ningún límite para actualizar.', ephemeral: true });
        return;
      }

      db.updateGuildSettings(guild.id, updates);

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('⚙️ Umbrales Anti-Nuke Actualizados')
        .setDescription(changes.join('\n'))
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'penalty') {
      const penalty = interaction.options.getString('tipo', true) as PenaltyType;
      db.updateGuildSettings(guild.id, { default_penalty: penalty });

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('🔨 Penalización Anti-Nuke Modificada')
        .setDescription(`La sanción inmediata ante vulneraciones Anti-Nuke ahora es: **${penalty}**`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }
  },
};
