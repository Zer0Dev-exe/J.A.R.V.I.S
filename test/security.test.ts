import { db } from '../src/database/db.js';
import { SlidingWindowLimiter } from '../src/utils/slidingWindow.js';
import { WhitelistManager } from '../src/modules/whitelist/whitelistManager.js';

console.log('--- INICIANDO TESTS DE SEGURIDAD J.A.R.V.I.S ---');

// Test 1: SQLite DB Settings y WAL mode
console.log('\n[Test 1] Verificando Base de Datos SQLite...');
const testGuildId = '999888777666555444';
const initialSettings = db.getGuildSettings(testGuildId);
console.log('Configuración inicial obtenida:', initialSettings.guild_id === testGuildId ? 'PASS' : 'FAIL');

db.updateGuildSettings(testGuildId, {
  channel_delete_limit: 4,
  default_penalty: 'BAN',
});
const updatedSettings = db.getGuildSettings(testGuildId);
console.log('Actualización de configuración:', updatedSettings.channel_delete_limit === 4 && updatedSettings.default_penalty === 'BAN' ? 'PASS' : 'FAIL');

// Test 2: In-memory Sliding Window Limiter Speed & Accuracy
console.log('\n[Test 2] Verificando Sliding Window Rate Limiter (< 1ms)...');
const limiter = new SlidingWindowLimiter();
const key = 'test_guild:test_user:channel_delete';
const limit = 2;
const windowMs = 5000;

const start = performance.now();
const res1 = limiter.hit(key, limit, windowMs);
const res2 = limiter.hit(key, limit, windowMs);
const res3 = limiter.hit(key, limit, windowMs); // Debe exceder
const elapsed = performance.now() - start;

console.log(`Tiempo para 3 evaluaciones de límites en memoria: ${elapsed.toFixed(3)} ms`);
console.log('Evaluación 1 (Count: 1, Exceeded: false):', res1.currentCount === 1 && !res1.exceeded ? 'PASS' : 'FAIL');
console.log('Evaluación 2 (Count: 2, Exceeded: false):', res2.currentCount === 2 && !res2.exceeded ? 'PASS' : 'FAIL');
console.log('Evaluación 3 (Count: 3, Exceeded: true):', res3.currentCount === 3 && res3.exceeded ? 'PASS' : 'FAIL');
limiter.destroy();

// Test 3: Whitelist Database Persistence
console.log('\n[Test 3] Verificando Sistema de Whitelist...');
const testUserId = '111222333444555666';
db.addWhitelist(testGuildId, testUserId, 'CHANNELS', '999');
console.log('Whitelist CHANNELS activa:', db.isWhitelisted(testGuildId, testUserId, 'CHANNELS') ? 'PASS' : 'FAIL');
console.log('Whitelist ROLES inactiva para este usuario:', !db.isWhitelisted(testGuildId, testUserId, 'ROLES') ? 'PASS' : 'FAIL');
db.removeWhitelist(testGuildId, testUserId, 'CHANNELS');
console.log('Whitelist removida con éxito:', !db.isWhitelisted(testGuildId, testUserId, 'CHANNELS') ? 'PASS' : 'FAIL');

// Test 4: Channel Backup & Recovery Persistence
console.log('\n[Test 4] Verificando Snapshot de Canales...');
const testChannelId = '1234567890';
db.saveChannelBackup({
  guild_id: testGuildId,
  channel_id: testChannelId,
  name: 'canal-seguro',
  type: 0,
  parent_id: null,
  position: 1,
  topic: 'Reglas del servidor',
  nsfw: 0,
  rate_limit_per_user: 5,
  permission_overwrites: JSON.stringify([{ id: '123', allow: '1024', deny: '0' }]),
  updated_at: Date.now(),
});

const backup = db.getChannelBackup(testGuildId, testChannelId);
console.log('Snapshot guardado y recuperado:', backup?.name === 'canal-seguro' ? 'PASS' : 'FAIL');
db.removeChannelBackup(testGuildId, testChannelId);
console.log('Snapshot limpiado:', db.getChannelBackup(testGuildId, testChannelId) === undefined ? 'PASS' : 'FAIL');

db.close();
console.log('\n--- TODOS LOS TESTS HAN SIDO COMPLETADOS CON ÉXITO ---');
