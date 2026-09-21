// ==========================================================================
// J.A.R.V.I.S SECURITY • DASHBOARD CLIENT ENGINE
// ==========================================================================

const state = {
  user: null,
  currentGuild: null,
  guilds: [],
  isLockedDown: false,
};

// ==========================================================================
// Toast Notificaciones
// ==========================================================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ==========================================================================
// Gestión de Vistas
// ==========================================================================
function switchView(viewId) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  const target = document.getElementById(viewId);
  if (target) target.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================================================
// Inicialización y Carga de Telemetría
// ==========================================================================
async function initApp() {
  await fetchTelemetry();
  setInterval(fetchTelemetry, 15_000);

  // Comprobar autenticación
  await checkAuth();

  setupEventListeners();
}

async function fetchTelemetry() {
  try {
    const res = await fetch('/api/stats');
    if (!res.ok) return;
    const data = await res.json();

    if (data.success && data.telemetry) {
      document.getElementById('nav-ping').textContent = `${data.telemetry.wsPing} ms`;
      document.getElementById('nav-guilds').textContent = `${data.telemetry.totalGuilds} Servidores`;

      // Telemetría en pestaña de sistema
      const wsPingEl = document.getElementById('telemetry-ws-ping');
      if (wsPingEl) wsPingEl.textContent = `${data.telemetry.wsPing} ms`;

      const ramEl = document.getElementById('telemetry-ram');
      if (ramEl) ramEl.textContent = `${data.telemetry.memory.heapUsedMb} MB`;

      const uptimeEl = document.getElementById('telemetry-uptime');
      if (uptimeEl) {
        const s = data.telemetry.uptimeSeconds;
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        uptimeEl.textContent = `${h}h ${m}m ${s % 60}s`;
      }
    }
  } catch (err) {
    console.warn('Error al obtener telemetría:', err);
  }
}

async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();

    if (data.authenticated && data.user) {
      state.user = data.user;
      renderUserProfile(data.user);
      await loadGuilds();
      switchView('view-guilds');
    } else {
      state.user = null;
      document.getElementById('btn-login-nav').classList.remove('hidden');
      document.getElementById('user-profile-menu').classList.add('hidden');
      switchView('view-landing');
    }
  } catch (err) {
    console.error('Error verificando sesión:', err);
    switchView('view-landing');
  }
}

function renderUserProfile(user) {
  document.getElementById('btn-login-nav').classList.add('hidden');
  const menu = document.getElementById('user-profile-menu');
  menu.classList.remove('hidden');

  document.getElementById('user-name').textContent = user.username;
  if (user.avatar) {
    document.getElementById('user-avatar').src = user.avatar;
  } else {
    document.getElementById('user-avatar').src = 'https://cdn.discordapp.com/embed/avatars/0.png';
  }
}

// ==========================================================================
// Carga de Servidores
// ==========================================================================
async function loadGuilds() {
  const container = document.getElementById('guilds-container');
  container.innerHTML = '<div class="skeleton-card"></div><div class="skeleton-card"></div>';

  try {
    const res = await fetch('/api/guilds');
    const data = await res.json();

    if (!data.success || !data.guilds) {
      container.innerHTML = '<p class="text-muted">No se pudieron cargar los servidores.</p>';
      return;
    }

    state.guilds = data.guilds;

    if (data.guilds.length === 0) {
      container.innerHTML = '<p class="text-muted">No administras ningún servidor en Discord actualmente.</p>';
      return;
    }

    container.innerHTML = '';
    data.guilds.forEach((guild) => {
      const card = document.createElement('div');
      card.className = 'guild-card';

      const avatarHtml = guild.icon
        ? `<img src="${guild.icon}" class="guild-avatar" alt="${guild.name}">`
        : `<div class="guild-avatar">${guild.name.charAt(0).toUpperCase()}</div>`;

      const badgeHtml = guild.hasBot
        ? '<span class="badge badge-success">PROTEGIDO</span>'
        : '<span class="badge badge-warning">INVITAR BOT</span>';

      const metaHtml = guild.hasBot
        ? `<span>${guild.memberCount || 0} miembros</span>`
        : '<span>Bot no conectado</span>';

      card.innerHTML = `
        ${avatarHtml}
        <div class="guild-info">
          <div class="guild-name">${guild.name}</div>
          <div style="display:flex; align-items:center; gap:0.5rem; margin-top:0.35rem;">
            ${badgeHtml}
            <small class="text-muted">${metaHtml}</small>
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        if (guild.hasBot) {
          openServerDashboard(guild.id);
        } else {
          window.open(guild.inviteUrl, '_blank');
          showToast('Abriendo ventana de invitación para J.A.R.V.I.S Security...', 'info');
        }
      });

      container.appendChild(card);
    });
  } catch (err) {
    console.error('Error cargando servidores:', err);
    container.innerHTML = '<p class="text-muted">Error de conexión al cargar servidores.</p>';
  }
}

// ==========================================================================
// Dashboard del Servidor Específico
// ==========================================================================
async function openServerDashboard(guildId) {
  try {
    const res = await fetch(`/api/guilds/${guildId}/settings`);
    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'No se pudo acceder al servidor', 'error');
      return;
    }

    const data = await res.json();
    state.currentGuild = data.guild;
    state.isLockedDown = data.guild.isLockedDown;

    // Encabezado del Servidor
    document.getElementById('dash-server-name').textContent = data.guild.name;
    document.getElementById('dash-server-id').textContent = data.guild.id;
    document.getElementById('dash-member-count').textContent = `${data.guild.memberCount} Miembros`;

    const iconEl = document.getElementById('dash-server-icon');
    if (data.guild.icon) {
      iconEl.src = data.guild.icon;
      iconEl.style.display = 'block';
    } else {
      iconEl.style.display = 'none';
    }

    updateLockdownButton();

    // Llenar Selects de Canales y Roles
    populateSelects(data.channels, data.roles);

    // Cargar Valores del Formulario
    populateSettingsForm(data.settings);

    // Cargar Whitelist y Logs en paralelo
    loadWhitelist(guildId);
    loadSecurityLogs(guildId);

    switchView('view-dashboard');
  } catch (err) {
    console.error('Error al abrir dashboard del servidor:', err);
    showToast('Error cargando los datos del servidor.', 'error');
  }
}

function updateLockdownButton() {
  const btn = document.getElementById('btn-panic-lockdown');
  const text = document.getElementById('btn-lockdown-text');
  if (state.isLockedDown) {
    btn.className = 'btn btn-primary';
    text.textContent = 'DESACTIVAR LOCKDOWN';
  } else {
    btn.className = 'btn btn-danger';
    text.textContent = 'EMERGENCY LOCKDOWN';
  }
}

function populateSelects(channels, roles) {
  const alertSelect = document.getElementById('setting-alert-channel-id');
  alertSelect.innerHTML = '<option value="">-- Sin asignar --</option>';
  channels.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `#${c.name}`;
    alertSelect.appendChild(opt);
  });

  const qRoleSelect = document.getElementById('setting-quarantine-role-id');
  qRoleSelect.innerHTML = '<option value="">-- Sin asignar --</option>';
  roles.forEach((r) => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = `@${r.name}`;
    qRoleSelect.appendChild(opt);
  });
}

function populateSettingsForm(s) {
  document.getElementById('setting-antinuke-enabled').checked = s.antinuke_enabled === 1;
  document.getElementById('setting-antiraid-enabled').checked = s.antiraid_enabled === 1;
  document.getElementById('setting-antiscam-enabled').checked = s.antiscam_enabled === 1;

  document.getElementById('setting-default-penalty').value = s.default_penalty || 'QUARANTINE';
  document.getElementById('setting-channel-delete-limit').value = s.channel_delete_limit;
  document.getElementById('setting-channel-create-limit').value = s.channel_create_limit;
  document.getElementById('setting-role-delete-limit').value = s.role_delete_limit;
  document.getElementById('setting-role-create-limit').value = s.role_create_limit;
  document.getElementById('setting-ban-limit').value = s.ban_limit;
  document.getElementById('setting-kick-limit').value = s.kick_limit;
  document.getElementById('setting-webhook-limit').value = s.webhook_limit;
  document.getElementById('setting-limit-window-seconds').value = s.limit_window_seconds;

  document.getElementById('setting-anti-bot-enabled').checked = s.anti_bot_enabled === 1;
  document.getElementById('setting-auto-recovery-enabled').checked = s.auto_recovery_enabled === 1;

  document.getElementById('setting-join-burst-limit').value = s.join_burst_limit;
  document.getElementById('setting-join-burst-window-seconds').value = s.join_burst_window_seconds;
  document.getElementById('setting-min-account-age-days').value = s.min_account_age_days;

  document.getElementById('setting-anti-links-enabled').checked = s.anti_links_enabled === 1;
  document.getElementById('setting-anti-invites-enabled').checked = s.anti_invites_enabled === 1;
  document.getElementById('setting-anti-spam-enabled').checked = s.anti_spam_enabled === 1;
  document.getElementById('setting-anti-mass-mention-enabled').checked = s.anti_mass_mention_enabled === 1;
  document.getElementById('setting-max-mentions').value = s.max_mentions;

  if (s.alert_channel_id) document.getElementById('setting-alert-channel-id').value = s.alert_channel_id;
  if (s.quarantine_role_id) document.getElementById('setting-quarantine-role-id').value = s.quarantine_role_id;
}

// ==========================================================================
// Guardar Configuración
// ==========================================================================
async function saveSecuritySettings(e) {
  e.preventDefault();
  if (!state.currentGuild) return;

  const body = {
    antinuke_enabled: document.getElementById('setting-antinuke-enabled').checked ? 1 : 0,
    antiraid_enabled: document.getElementById('setting-antiraid-enabled').checked ? 1 : 0,
    antiscam_enabled: document.getElementById('setting-antiscam-enabled').checked ? 1 : 0,

    default_penalty: document.getElementById('setting-default-penalty').value,
    channel_delete_limit: parseInt(document.getElementById('setting-channel-delete-limit').value, 10),
    channel_create_limit: parseInt(document.getElementById('setting-channel-create-limit').value, 10),
    role_delete_limit: parseInt(document.getElementById('setting-role-delete-limit').value, 10),
    role_create_limit: parseInt(document.getElementById('setting-role-create-limit').value, 10),
    ban_limit: parseInt(document.getElementById('setting-ban-limit').value, 10),
    kick_limit: parseInt(document.getElementById('setting-kick-limit').value, 10),
    webhook_limit: parseInt(document.getElementById('setting-webhook-limit').value, 10),
    limit_window_seconds: parseInt(document.getElementById('setting-limit-window-seconds').value, 10),

    anti_bot_enabled: document.getElementById('setting-anti-bot-enabled').checked ? 1 : 0,
    auto_recovery_enabled: document.getElementById('setting-auto-recovery-enabled').checked ? 1 : 0,

    join_burst_limit: parseInt(document.getElementById('setting-join-burst-limit').value, 10),
    join_burst_window_seconds: parseInt(document.getElementById('setting-join-burst-window-seconds').value, 10),
    min_account_age_days: parseInt(document.getElementById('setting-min-account-age-days').value, 10),

    anti_links_enabled: document.getElementById('setting-anti-links-enabled').checked ? 1 : 0,
    anti_invites_enabled: document.getElementById('setting-anti-invites-enabled').checked ? 1 : 0,
    anti_spam_enabled: document.getElementById('setting-anti-spam-enabled').checked ? 1 : 0,
    anti_mass_mention_enabled: document.getElementById('setting-anti-mass-mention-enabled').checked ? 1 : 0,
    max_mentions: parseInt(document.getElementById('setting-max-mentions').value, 10),

    alert_channel_id: document.getElementById('setting-alert-channel-id').value || null,
    quarantine_role_id: document.getElementById('setting-quarantine-role-id').value || null,
  };

  try {
    const res = await fetch(`/api/guilds/${state.currentGuild.id}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (data.success) {
      showToast('¡Configuración de seguridad guardada y sincronizada!', 'success');
    } else {
      showToast(data.error || 'Error al guardar los cambios', 'error');
    }
  } catch (err) {
    showToast('Error de red al guardar la configuración', 'error');
  }
}

// ==========================================================================
// Whitelist
// ==========================================================================
async function loadWhitelist(guildId) {
  const tbody = document.getElementById('whitelist-table-body');
  try {
    const res = await fetch(`/api/guilds/${guildId}/whitelist`);
    const data = await res.json();

    if (!data.success || !data.whitelist) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Error al cargar whitelist.</td></tr>';
      return;
    }

    if (data.whitelist.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay usuarios en la lista blanca (El dueño del servidor es inmune automáticamente).</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    data.whitelist.forEach((w) => {
      const tr = document.createElement('tr');
      const dateStr = new Date(w.added_at).toLocaleString();
      tr.innerHTML = `
        <td><code>${w.user_id}</code></td>
        <td><span class="badge badge-success">${w.type}</span></td>
        <td><code>${w.added_by}</code></td>
        <td>${dateStr}</td>
        <td>
          <button class="btn btn-icon text-danger" title="Revocar Inmunidad" onclick="removeWhitelistMember('${w.user_id}')">
            🗑️
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Error de red.</td></tr>';
  }
}

window.removeWhitelistMember = async function (userId) {
  if (!state.currentGuild) return;
  if (!confirm(`¿Deseas revocar la inmunidad del usuario ${userId}?`)) return;

  try {
    const res = await fetch(`/api/guilds/${state.currentGuild.id}/whitelist/${userId}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (data.success) {
      showToast('Usuario removido de la whitelist', 'success');
      loadWhitelist(state.currentGuild.id);
    } else {
      showToast(data.error || 'No se pudo eliminar el usuario', 'error');
    }
  } catch (err) {
    showToast('Error de red al remover usuario', 'error');
  }
};

async function handleAddWhitelist(e) {
  e.preventDefault();
  if (!state.currentGuild) return;

  const userId = document.getElementById('whitelist-user-id').value.trim();
  const type = document.getElementById('whitelist-type').value;

  try {
    const res = await fetch(`/api/guilds/${state.currentGuild.id}/whitelist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, type }),
    });

    const data = await res.json();
    if (data.success) {
      showToast('Usuario añadido con éxito a la whitelist', 'success');
      document.getElementById('modal-whitelist').classList.add('hidden');
      document.getElementById('form-add-whitelist').reset();
      loadWhitelist(state.currentGuild.id);
    } else {
      showToast(data.error || 'Error al añadir usuario', 'error');
    }
  } catch (err) {
    showToast('Error de red', 'error');
  }
}

// ==========================================================================
// Radar de Logs de Seguridad
// ==========================================================================
async function loadSecurityLogs(guildId) {
  const tbody = document.getElementById('logs-table-body');
  try {
    const res = await fetch(`/api/guilds/${guildId}/logs?limit=30`);
    const data = await res.json();

    if (!data.success || !data.logs) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No se pudieron cargar los registros.</td></tr>';
      return;
    }

    if (data.logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No hay incidentes registrados en este servidor. ¡Todo en orden! 🟢</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    data.logs.forEach((log) => {
      const tr = document.createElement('tr');
      const timeStr = new Date(log.timestamp).toLocaleTimeString();
      tr.innerHTML = `
        <td><small class="text-muted">${timeStr}</small></td>
        <td><strong>${log.module}</strong></td>
        <td><code>${log.action}</code></td>
        <td><code>${log.user_id}</code></td>
        <td><span class="badge badge-warning">${log.penalty_applied}</span></td>
        <td><small>${log.details}</small></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Error de red.</td></tr>';
  }
}

// ==========================================================================
// Pánico / Lockdown
// ==========================================================================
async function handleLockdownToggle() {
  if (!state.currentGuild) return;

  const enable = !state.isLockedDown;
  const actionText = enable ? 'ACTIVAR MODO LOCKDOWN' : 'DESACTIVAR LOCKDOWN';
  if (!confirm(`¿Estás seguro de que deseas ${actionText} en todos los canales?`)) return;

  try {
    const res = await fetch(`/api/guilds/${state.currentGuild.id}/lockdown`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enable, reason: 'Activado desde el Dashboard Web' }),
    });

    const data = await res.json();
    if (data.success) {
      state.isLockedDown = data.isLockedDown;
      updateLockdownButton();
      showToast(
        enable 
          ? `¡Lockdown ACTIVADO! ${data.affectedChannels} canales asegurados.` 
          : `Lockdown DESACTIVADO. ${data.affectedChannels} canales normalizados.`,
        enable ? 'error' : 'success'
      );
    } else {
      showToast(data.error || 'Error al ejecutar lockdown', 'error');
    }
  } catch (err) {
    showToast('Error de red al ejecutar lockdown', 'error');
  }
}

// ==========================================================================
// Event Listeners Generales
// ==========================================================================
function setupEventListeners() {
  // Login Buttons
  const loginAction = () => { window.location.href = '/api/auth/login'; };
  document.getElementById('btn-login-nav')?.addEventListener('click', loginAction);
  document.getElementById('btn-landing-login')?.addEventListener('click', loginAction);

  // Dev Login
  document.getElementById('btn-dev-login')?.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/auth/dev-login', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('Sesión de operador iniciada en modo local', 'success');
        await checkAuth();
      }
    } catch (err) {
      showToast('No se pudo iniciar el modo dev', 'error');
    }
  });

  // Logout
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    showToast('Sesión cerrada correctamente', 'info');
    await checkAuth();
  });

  // Logo vuelve a la vista de servidores o landing
  document.getElementById('brand-home')?.addEventListener('click', () => {
    if (state.user) switchView('view-guilds');
    else switchView('view-landing');
  });

  // Volver a servidores desde dashboard
  document.getElementById('btn-back-to-guilds')?.addEventListener('click', () => {
    switchView('view-guilds');
  });

  // Refrescar servidores
  document.getElementById('btn-refresh-guilds')?.addEventListener('click', loadGuilds);

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // Guardar configuración
  document.getElementById('form-security-settings')?.addEventListener('submit', saveSecuritySettings);

  // Lockdown
  document.getElementById('btn-panic-lockdown')?.addEventListener('click', handleLockdownToggle);

  // Modal Whitelist
  document.getElementById('btn-open-whitelist-modal')?.addEventListener('click', () => {
    document.getElementById('modal-whitelist').classList.remove('hidden');
  });

  document.getElementById('btn-close-modal')?.addEventListener('click', () => {
    document.getElementById('modal-whitelist').classList.add('hidden');
  });

  document.getElementById('btn-cancel-modal')?.addEventListener('click', () => {
    document.getElementById('modal-whitelist').classList.add('hidden');
  });

  document.getElementById('form-add-whitelist')?.addEventListener('submit', handleAddWhitelist);

  // Refrescar logs
  document.getElementById('btn-refresh-logs')?.addEventListener('click', () => {
    if (state.currentGuild) loadSecurityLogs(state.currentGuild.id);
  });
}

// Iniciar al cargar el DOM
document.addEventListener('DOMContentLoaded', initApp);
