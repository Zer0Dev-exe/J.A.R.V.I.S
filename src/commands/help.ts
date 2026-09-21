import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  ComponentType,
  EmbedBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { Command } from './types.js';

export const helpCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Centro de comando interactivo y guía completa de J.A.R.V.I.S Security'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const client = interaction.client;
    const guild = interaction.guild;

    // Embed Inicial (Visión General)
    const getOverviewEmbed = () =>
      new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('🛡️ J.A.R.V.I.S Security • Centro de Defensa Cuántica')
        .setDescription(
          `Bienvenido al sistema de protección de vanguardia para Discord. **J.A.R.V.I.S Security** opera con análisis en memoria de **< 1ms** y persistencia en **SQLite WAL**, previniendo ataques destructivos antes de que causen daños.\n\n` +
          `Selecciona una categoría en el menú desplegable inferior para explorar cada subsistema de defensa.`
        )
        .addFields(
          {
            name: '⚡ Subsistemas Activos',
            value: [
              '• 💣 **Anti-Nuke:** Canales, roles, baneos/kicks, webhooks y bots.',
              '• 🚨 **Anti-Raid:** Join-burst masivo, filtro de cuentas nuevas y lockdown.',
              '• 🎣 **Anti-Scam:** Typosquatting de Nitro/Steam, anti-invites y flood.',
              '• 👑 **Whitelist:** Jerarquía dinámica multiguild para dueños y confianza.',
              '• 💾 **Auto-Recovery:** Snapshots instantáneos y reconstrucción de canales.',
            ].join('\n'),
            inline: false,
          },
          {
            name: '🚀 Inicio Rápido Recomendado',
            value: [
              '1️⃣ Configura tu canal de alertas con `/security setup`.',
              '2️⃣ Crea un snapshot inicial de tus canales con `/backup create`.',
              '3️⃣ Añade a tus administradores de confianza a `/whitelist add`.',
              '4️⃣ Revisa el estado de salud de tus defensas con `/security status`.',
            ].join('\n'),
            inline: false,
          }
        )
        .setThumbnail(client.user?.displayAvatarURL() || null)
        .setFooter({ text: 'J.A.R.V.I.S Shield Engine • Usa el menú inferior para navegar' })
        .setTimestamp();

    // Embeds por categoría
    const categoryEmbeds: Record<string, EmbedBuilder> = {
      overview: getOverviewEmbed(),

      antinuke: new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('💣 Módulo Anti-Nuke • Protección Estructural')
        .setDescription(
          'Monitorea en tiempo real cualquier acción administrativa destructiva. Si un usuario o token comprometido supera los umbrales configurados, se le aplican sanciones inmediatas y se neutraliza la amenaza.'
        )
        .addFields(
          {
            name: '🛡️ Comandos del Módulo',
            value: [
              '• `/antinuke toggle` ➔ Activa o suspende el escudo Anti-Nuke global.',
              '• `/antinuke limits` ➔ Calibra límites de borrado/creación de canales, roles, bans, kicks y webhooks en segundos.',
              '• `/antinuke penalty` ➔ Elige la sanción: `QUARANTINE`, `BAN`, `KICK` o `STRIP_ROLES`.',
            ].join('\n'),
            inline: false,
          },
          {
            name: '⚡ Defensas Automáticas Integradas',
            value: [
              '• **Anti-Bot No Autorizado:** Baneo preventivo automático de cualquier bot añadido sin whitelist previa.',
              '• **Auto-Restauración:** Reconstrucción instantánea de canales borrados con sus permisos originales.',
              '• **Anti-Escalada de Privilegios:** Revocación inmediata si un rol regular intenta ganar permisos de Administrador.',
            ].join('\n'),
            inline: false,
          }
        )
        .setFooter({ text: 'J.A.R.V.I.S Anti-Nuke • Latencia de detección < 1ms' }),

      antiraid: new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle('🚨 Módulo Anti-Raid • Control de Fronteras')
        .setDescription(
          'Evita oleadas coordinadas de bots o usuarios maliciosos. Evalúa ráfagas de entrada (join-burst) y antigüedad de cuentas nuevas.'
        )
        .addFields(
          {
            name: '🛡️ Comandos del Módulo',
            value: [
              '• `/antiraid toggle` ➔ Activa o desactiva la supervisión de entradas.',
              '• `/antiraid config` ➔ Define el umbral de miembros en ráfaga (Join-burst) y días mínimos de antigüedad de cuenta.',
              '• `/lockdown enable` ➔ Bloqueo de emergencia inmediato de todos los canales de texto.',
              '• `/lockdown disable` ➔ Restaura la actividad habitual de todos los canales.',
            ].join('\n'),
            inline: false,
          },
          {
            name: '⚡ Mecanismos de Contención',
            value: [
              '• **Auto-Lockdown:** Si entra una ráfaga que supera el límite, el bot cierra los canales automáticamente.',
              '• **Filtro de Cuentas Nuevas:** Cuentas con menos días de vida que los fijados son expulsadas o enviadas a cuarentena.',
            ].join('\n'),
            inline: false,
          }
        )
        .setFooter({ text: 'J.A.R.V.I.S Anti-Raid • Control de Infiltraciones' }),

      antiscam: new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle('🎣 Módulo Anti-Scam & Phishing • Cero Confianza')
        .setDescription(
          'Inspecciona cada mensaje en busca de enlaces fraudulentos (Fake Nitro, clones de Steam), spam masivo e invitaciones no autorizadas.'
        )
        .addFields(
          {
            name: '🛡️ Comandos del Módulo',
            value: [
              '• `/antiscam toggle` ➔ Activa o suspende el análisis de mensajes.',
              '• `/antiscam rules` ➔ Configura filtros de phishing, bloqueo de invitaciones, anti-flood y límite de menciones.',
            ].join('\n'),
            inline: false,
          },
          {
            name: '⚡ Tecnologías de Detección',
            value: [
              '• **Levenshtein Distance:** Detecta dominios con typosquatting como `dlscord.gift` o `steamcomunlty.com`.',
              '• **Anti-Token-Grabber:** Aislamiento con timeout de 24h a usuarios con cuentas hackeadas que propagan phishing.',
              '• **Anti-Ghost Ping / Mass-Mention:** Bloqueo de menciones a `@everyone`, `@here` o ráfagas masivas de usuarios.',
            ].join('\n'),
            inline: false,
          }
        )
        .setFooter({ text: 'J.A.R.V.I.S Anti-Scam • Protección de Chat' }),

      whitelist: new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('👑 Sistema de Whitelist • Jerarquía Multiguild')
        .setDescription(
          'Permite delegar confianza con precisión militar. Cada servidor tiene su propio dueño dinámico (`guild.ownerId`) que tiene control exclusivo sobre la Whitelist.'
        )
        .addFields(
          {
            name: '🛡️ Comandos del Módulo',
            value: [
              '• `/whitelist add` ➔ Concede inmunidad completa (`FULL`) o por módulo (`CHANNELS`, `ROLES`, `MEMBERS`, `BOTS`, `WEBHOOKS`).',
              '• `/whitelist remove` ➔ Revoca el acceso de confianza a un usuario.',
              '• `/whitelist list` ➔ Visualiza los usuarios autorizados en este servidor.',
            ].join('\n'),
            inline: false,
          },
          {
            name: '🔒 Principio de Máxima Seguridad',
            value: [
              '• Los administradores normales **NO** pueden añadir usuarios a la Whitelist ni a sí mismos.',
              '• Únicamente el **Dueño del Servidor** (`guild.ownerId`) o los desarrolladores globales de la App poseen esta facultad.',
            ].join('\n'),
            inline: false,
          }
        )
        .setFooter({ text: 'J.A.R.V.I.S Whitelist • Aislamiento Seguro por Servidor' }),

      recovery: new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle('💾 Módulo de Recuperación • Snapshots Cuánticos')
        .setDescription(
          'Crea copias de seguridad de la arquitectura completa del servidor y permite reconstruir canales con sus permisos en milisegundos.'
        )
        .addFields(
          {
            name: '🛡️ Comandos del Módulo',
            value: [
              '• `/backup create` ➔ Genera un snapshot instantáneo de todos los canales, categorías y permisos.',
              '• `/backup restore` ➔ Reconstruye un canal borrado usando su ID histórico.',
            ].join('\n'),
            inline: false,
          },
          {
            name: '⚡ Auto-Copia Continua',
            value: [
              '• Cada vez que un canal se crea o edita, J.A.R.V.I.S actualiza automáticamente su copia en SQLite.',
              '• Si el Anti-Nuke detecta un borrado ilícito, puede recrear el canal automáticamente si está habilitado.',
            ].join('\n'),
            inline: false,
          }
        )
        .setFooter({ text: 'J.A.R.V.I.S Snapshots • SQLite WAL Local' }),

      stats: new EmbedBuilder()
        .setColor(0x00f0ff)
        .setTitle('📊 Diagnóstico y Estado del Sistema')
        .setDescription('Herramientas para inspeccionar el rendimiento del bot y el historial de alertas.')
        .addFields(
          {
            name: '🛡️ Comandos',
            value: [
              '• `/stats` ➔ Muestra el panel HUD épico con telemetría de CPU, RAM, latencia y servidores.',
              '• `/security status` ➔ Cuadro de mando con todos los ajustes de seguridad del servidor.',
              '• `/security logs` ➔ Registro de las últimas amenazas neutralizadas.',
            ].join('\n'),
            inline: false,
          }
        )
        .setFooter({ text: 'J.A.R.V.I.S Telemetry • HUD en Tiempo Real' }),
    };

    // Menú desplegable interactivo
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('help_select')
      .setPlaceholder('📂 Selecciona un subsistema de defensa...')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Visión General')
          .setDescription('Introducción, resumen de escudos e inicio rápido')
          .setValue('overview')
          .setEmoji('🛡️'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Anti-Nuke')
          .setDescription('Límites de canales, roles, bans, kicks y anti-bot')
          .setValue('antinuke')
          .setEmoji('💣'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Anti-Raid')
          .setDescription('Join burst, filtro de edad de cuenta y lockdown')
          .setValue('antiraid')
          .setEmoji('🚨'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Anti-Scam')
          .setDescription('Phishing, clones de Nitro/Steam, spam y menciones')
          .setValue('antiscam')
          .setEmoji('🎣'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Whitelist')
          .setDescription('Gestión de personal de confianza y permisos')
          .setValue('whitelist')
          .setEmoji('👑'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Recuperación & Backups')
          .setDescription('Snapshots automáticos y restauración de canales')
          .setValue('recovery')
          .setEmoji('💾'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Estadísticas & HUD')
          .setDescription('Telemetría en tiempo real y diagnóstico del sistema')
          .setValue('stats')
          .setEmoji('📊')
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    const response = await interaction.reply({
      embeds: [categoryEmbeds.overview],
      components: [row],
      fetchReply: true,
    });

    // Colector de eventos del menú interactivo (activo durante 3 minutos)
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 180_000,
    });

    collector.on('collect', async (menuInteraction) => {
      // Solo quien ejecutó el comando puede interactuar
      if (menuInteraction.user.id !== interaction.user.id) {
        await menuInteraction.reply({
          content: '❌ Solo la persona que abrió el panel de ayuda puede interactuar con este menú.',
          ephemeral: true,
        });
        return;
      }

      const selectedValue = menuInteraction.values[0];
      const targetEmbed = categoryEmbeds[selectedValue] || categoryEmbeds.overview;

      await menuInteraction.update({
        embeds: [targetEmbed],
        components: [row],
      });
    });

    collector.on('end', async () => {
      // Deshabilitar el select menu al expirar el tiempo
      selectMenu.setDisabled(true).setPlaceholder('🔒 Sesión del panel de ayuda expirada.');
      const disabledRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
      await interaction.editReply({ components: [disabledRow] }).catch(() => null);
    });
  },
};
