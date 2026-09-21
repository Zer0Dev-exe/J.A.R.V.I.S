# 🛡️ J.A.R.V.I.S Security • Bot de Seguridad de Alto Rendimiento para Discord

Bot de seguridad de última generación para Discord desarrollado con **TypeScript**, **Discord.js v14**, **pnpm** y motor embebido **Better-SQLite3** en modo WAL. Diseñado para ofrecer una protección proactiva, instantánea y robusta con latencias de respuesta en memoria de **< 1ms**.

---

## 🚀 Características Principales

### 1. 💣 Módulo Anti-Nuke (Control y Límite de Destrucción)
- **Límites de Canales**: Detección de borrado masivo o creación descontrolada de canales dentro de ventanas de tiempo configurables.
- **Auto-Restauración de Canales**: Si un canal es borrado en un ataque, el bot lo reconstruye de inmediato con sus categorías, temas y permisos originales.
- **Límites de Roles**: Bloqueo de borrado y creación masiva de roles.
- **Defensa contra Escalada de Privilegios**: Revierte automáticamente cualquier intento no autorizado de asignar permisos de `Administrador`, `Gestionar Servidor`, `Gestionar Canales`, etc.
- **Control de Miembros**: Detección y sanción inmediata ante baneos masivos (*mass-bans*) o expulsiones coordinadas (*mass-kicks*).
- **Anti-Bot No Autorizado**: Expulsa o banea de inmediato cualquier bot invitado sin aprobación previa en la Whitelist y sanciona al administrador que lo introdujo.
- **Control de Webhooks**: Detección y borrado de webhooks maliciosos o no autorizados.

### 2. 🚨 Módulo Anti-Raid (Control de Accesos y Ataques de Entrada Masiva)
- **Detección de Join-Burst**: Identifica entradas masivas simultáneas (ej. más de 5 usuarios en 5 segundos) y activa de forma automática el modo de contención (*Lockdown*), expulsando a los atacantes.
- **Filtro de Edad de Cuenta (Account Age)**: Aísla con rol de cuarentena o expulsa cuentas creadas hace menos de $X$ días.
- **Modo Lockdown de Emergencia**: Cierra la comunicación en todos los canales de texto impidiendo que los atacantes envíen mensajes.

### 3. 🎣 Módulo Anti-Scam & Phishing (Protección de Enlaces y Spam)
- **Detección Heurística y Typosquatting**: Utiliza distancia de Levenshtein y patrones regex avanzados para interceptar enlaces falsos de Nitro o Steam (ej. `discorcl-nitro.com`, `steamcommuniity.com`).
- **Bloqueo de Invitaciones no Autorizadas**: Filtra enlaces `discord.gg/` en canales protegidos.
- **Anti-Spam / Anti-Flood**: Limita el envío repetido y ultra rápido de mensajes en milisegundos.
- **Anti-Mass Mention**: Bloquea menciones a `@everyone`, `@here` o menciones masivas a múltiples miembros.

### 4. 👑 Sistema de Whitelist y Jerarquía de Seguridad
- **Dueño del Servidor & Dueño del Bot**: Inmunidad absoluta automática. Solo el dueño del servidor puede modificar la lista de confianza.
- **Inmunidades Específicas**: Posibilidad de otorgar inmunidad total (`FULL`) o granular por módulos (`CHANNELS`, `ROLES`, `MEMBERS`, `BOTS`, `WEBHOOKS`).
- **Sistema de Cuarentena**: Retira roles de moderación y aísla al usuario malicioso sin retrasos.

### 5. 🌐 Web Dashboard & REST API Centralizada
- **Panel Web Cyberpunk SPA**: Interfaz de control estético en tiempo real con diseño futurista (Dark Mode, acentos cyan neón `#00f0ff`, micro-animaciones).
- **Discord OAuth2**: Autenticación segura con filtrado de servidores administrables y detección de presencia del bot.
- **Modo Operador Directo (Dev)**: Acceso de simulación y desarrollo local sin necesidad inmediata de `CLIENT_SECRET`.
- **Control Total en Vivo**: Toggles interactivos para Anti-Nuke, Anti-Raid y Anti-Scam, ajuste de límites numéricos, gestión de Whitelist, visor de logs de seguridad y botón de pánico (*Emergency Lockdown*).
- **Telemetría en Vivo**: Monitorización de latencia WebSocket, memoria RAM, servidores protegidos y estado del motor en `http://localhost:3000`.

---

## 🛠️ Requisitos Previos

1. **Node.js** v18 o superior (recomendado v20+ o v24+).
2. **pnpm** instalado globalmente (`npm i -g pnpm` o `corepack enable`).
3. Una aplicación y bot creados en [Discord Developer Portal](https://discord.com/developers/applications).

> [!IMPORTANT]
> **Intents Privilegiados Obligatorios:**
> En el [Discord Developer Portal](https://discord.com/developers/applications) > tu bot > pestaña **Bot** > sección **Privileged Gateway Intents**, debes activar obligatoriamente:
> - ✅ **Server Members Intent** (para detectar entradas, expulsiones, roles y bots).
> - ✅ **Message Content Intent** (para inspeccionar y bloquear enlaces phishing, scam y spam).

---

## ⚙️ Instalación y Puesta en Marcha

1. **Clonar o entrar en el directorio del proyecto:**
   ```bash
   git clone https://github.com/Zer0Dev-exe/J.A.R.V.I.S.git
   cd J.A.R.V.I.S
   ```

2. **Instalar dependencias con pnpm:**
   ```bash
   pnpm install
   ```

3. **Configurar el archivo `.env`:**
   Copia el archivo `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```
   Rellena tus credenciales:
   ```env
   DISCORD_TOKEN=tu_token_aqui
   CLIENT_ID=tu_client_id_aqui
   CLIENT_SECRET=tu_client_secret_aqui
   DASHBOARD_PORT=3000
   DASHBOARD_URL=http://localhost:3000
   DATABASE_PATH=./data/jarvis_security.db
   ```

4. **Ejecutar el bot en modo desarrollo:**
   ```bash
   pnpm run dev
   ```

5. **Compilar y ejecutar en producción:**
   ```bash
   pnpm run build
   pnpm start
   ```

6. **Ejecutar tests de verificación:**
   ```bash
   pnpm test
   ```

---

## 📖 Guía de Comandos Slash

| Comando | Subcomando | Descripción |
|---|---|---|
| `/help` | - | Panel interactivo y estético con menú desplegable para navegar todos los módulos. |
| `/stats` | - | HUD holográfico cibernético con telemetría en tiempo real, latencia, CPU, RAM y escudos. |
| `/security` | `status` | Muestra el panel interactivo con el estado de todos los escudos. |
| `/security` | `setup` | Configura el canal de alertas y el rol de cuarentena. |
| `/security` | `logs` | Consulta los últimos incidentes de seguridad registrados. |
| `/antinuke` | `toggle` | Activa o desactiva la protección contra nukes. |
| `/antinuke` | `limits` | Ajusta límites de borrado/creación de canales, roles, bans, kicks y webhooks. |
| `/antinuke` | `penalty` | Cambia la sanción inmediata (`QUARANTINE`, `BAN`, `KICK`, `STRIP_ROLES`). |
| `/antiraid` | `toggle` | Activa o desactiva la protección anti-raid. |
| `/antiraid` | `config` | Calibra el join burst y la edad mínima exigida a las cuentas. |
| `/antiscam` | `toggle` | Activa o desactiva la protección anti-scam. |
| `/antiscam` | `rules` | Configura filtros de phishing, invitaciones, spam y menciones. |
| `/whitelist` | `add` | Añade un usuario de confianza con alcance total o por módulo. |
| `/whitelist` | `remove` | Revoca la inmunidad de un usuario en la whitelist. |
| `/whitelist` | `list` | Lista todos los usuarios autorizados en el servidor. |
| `/lockdown` | `enable` | Cierra todos los canales de texto de emergencia. |
| `/lockdown` | `disable` | Restaura la actividad normal en todos los canales. |
| `/backup` | `create` | Crea un snapshot completo de canales y permisos en SQLite. |
| `/backup` | `restore` | Reconstruye un canal eliminado a partir de su ID previo. |
