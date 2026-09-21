import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from './types.js';
import { db } from '../database/db.js';

export const antiscamCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('antiscam')
    .setDescription('Configura las defensas contra enlaces phishing, invitaciones no autorizadas y spam')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setDescription('Activa o desactiva la suite Anti-Scam')
        .addBooleanOption((opt) =>
          opt.setName('activado').setDescription('¿Activar módulo Anti-Scam?').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('rules')
        .setDescription('Activa o desactiva filtros específicos de contenido')
        .addBooleanOption((opt) =>
          opt.setName('bloquear_phishing').setDescription('Bloquear enlaces sospechosos y falsos Nitro/Steam')
        )
        .addBooleanOption((opt) =>
          opt.setName('bloquear_invitaciones').setDescription('Bloquear enlaces de otros servidores de Discord')
        )
        .addBooleanOption((opt) =>
          opt.setName('bloquear_flood').setDescription('Bloquear spam y envío masivo y veloz de mensajes')
        )
        .addIntegerOption((opt) =>
          opt.setName('max_menciones').setDescription('Límite de menciones (@everyone o usuarios) por mensaje').setMinValue(1).setMaxValue(20)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guild = interaction.guild;
    if (!guild) return;

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'toggle') {
      const enabled = interaction.options.getBoolean('activado', true);
      db.updateGuildSettings(guild.id, { antiscam_enabled: enabled ? 1 : 0 });

      const embed = new EmbedBuilder()
        .setColor(enabled ? 0x57f287 : 0xed4245)
        .setTitle(`Protección Anti-Scam ${enabled ? 'Activada 🟢' : 'Desactivada 🔴'}`)
        .setDescription(
          enabled
            ? 'El servidor ahora vigila mensajes en tiempo real contra phishing, clones maliciosos de Discord/Steam y flooding.'
            : '⚠️ El escudo Anti-Scam ha sido desactivado.'
        );

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'rules') {
      const links = interaction.options.getBoolean('bloquear_phishing');
      const invites = interaction.options.getBoolean('bloquear_invitaciones');
      const flood = interaction.options.getBoolean('bloquear_flood');
      const mentions = interaction.options.getInteger('max_menciones');

      const updates: any = {};
      const changes: string[] = [];

      if (links !== null) {
        updates.anti_links_enabled = links ? 1 : 0;
        changes.push(`• Filtro de Phishing / Typosquatting: ${links ? '✅ Activado' : '❌ Desactivado'}`);
      }
      if (invites !== null) {
        updates.anti_invites_enabled = invites ? 1 : 0;
        changes.push(`• Bloqueo de invitaciones externas: ${invites ? '✅ Activado' : '❌ Desactivado'}`);
      }
      if (flood !== null) {
        updates.anti_spam_enabled = flood ? 1 : 0;
        changes.push(`• Bloqueo de flood / spam rápido: ${flood ? '✅ Activado' : '❌ Desactivado'}`);
      }
      if (mentions !== null) {
        updates.max_mentions = mentions;
        changes.push(`• Límite máximo de menciones: \`${mentions}\``);
      }

      if (changes.length === 0) {
        await interaction.reply({ content: 'No indicaste ninguna regla para modificar.', ephemeral: true });
        return;
      }

      db.updateGuildSettings(guild.id, updates);

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('⚙️ Reglas Anti-Scam Actualizadas')
        .setDescription(changes.join('\n'))
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }
  },
};
