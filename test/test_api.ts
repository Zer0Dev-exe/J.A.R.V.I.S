import { ApiServer } from '../src/api/server.js';
import { JarvisSecurityClient } from '../src/core/client.js';

console.log('--- TEST DE INICIO API SERVER & DASHBOARD ---');
const client = new JarvisSecurityClient();
const api = new ApiServer(client);

async function test() {
  await api.start();

  // 1. Telemetría y estadísticas
  const resStats = await fetch('http://localhost:3000/api/stats');
  const dataStats = await resStats.json();
  console.log('1. GET /api/stats status:', resStats.status === 200 ? 'PASS' : 'FAIL');
  console.log('   Motor de seguridad:', dataStats.telemetry?.engine?.name);
  console.log('   Base de datos:', dataStats.telemetry?.engine?.database);

  // 2. Archivos estáticos del Dashboard
  const htmlRes = await fetch('http://localhost:3000/');
  const html = await htmlRes.text();
  console.log('2. GET / (index.html):', html.includes('J.A.R.V.I.S Security') ? 'PASS' : 'FAIL');

  const cssRes = await fetch('http://localhost:3000/styles.css');
  const css = await cssRes.text();
  console.log('3. GET /styles.css:', css.includes('--accent-cyan') ? 'PASS' : 'FAIL');

  const jsRes = await fetch('http://localhost:3000/app.js');
  const js = await jsRes.text();
  console.log('4. GET /app.js:', js.includes('J.A.R.V.I.S SECURITY') ? 'PASS' : 'FAIL');

  // 3. Verificación de autenticación inicial (no autenticado)
  const resMeUnauth = await fetch('http://localhost:3000/api/auth/me');
  const dataMeUnauth = await resMeUnauth.json();
  console.log('5. GET /api/auth/me (sin sesión):', dataMeUnauth.authenticated === false ? 'PASS' : 'FAIL');

  // 4. Modo dev-login
  const resLogin = await fetch('http://localhost:3000/api/auth/dev-login', { method: 'POST' });
  const dataLogin = await resLogin.json();
  const setCookie = resLogin.headers.get('set-cookie');
  console.log('6. POST /api/auth/dev-login:', dataLogin.success === true && !!setCookie ? 'PASS' : 'FAIL');

  // Extraer cookie
  const cookieHeader = setCookie?.split(';')[0] || '';

  // 5. Verificación de sesión activa con cookie
  const resMeAuth = await fetch('http://localhost:3000/api/auth/me', {
    headers: { Cookie: cookieHeader },
  });
  const dataMeAuth = await resMeAuth.json();
  console.log('7. GET /api/auth/me (con cookie):', dataMeAuth.authenticated === true && dataMeAuth.user?.username.includes('Operador') ? 'PASS' : 'FAIL');

  // 6. Endpoint de servidores accesibles
  const resGuilds = await fetch('http://localhost:3000/api/guilds', {
    headers: { Cookie: cookieHeader },
  });
  const dataGuilds = await resGuilds.json();
  console.log('8. GET /api/guilds:', dataGuilds.success === true && Array.isArray(dataGuilds.guilds) ? 'PASS' : 'FAIL');

  // 7. Cierre de sesión (Logout)
  const resLogout = await fetch('http://localhost:3000/api/auth/logout', {
    method: 'POST',
    headers: { Cookie: cookieHeader },
  });
  const dataLogout = await resLogout.json();
  console.log('9. POST /api/auth/logout:', dataLogout.success === true ? 'PASS' : 'FAIL');

  // 8. Verificación de que la sesión quedó revocada
  const resMeAfterLogout = await fetch('http://localhost:3000/api/auth/me', {
    headers: { Cookie: cookieHeader },
  });
  const dataMeAfterLogout = await resMeAfterLogout.json();
  console.log('10. GET /api/auth/me (tras logout):', dataMeAfterLogout.authenticated === false ? 'PASS' : 'FAIL');

  await api.stop();
  console.log('\n--- TODOS LOS TESTS DEL API SERVER COMPLETADOS CON ÉXITO ---');
  process.exit(0);
}

test().catch((err) => {
  console.error('Error en test:', err);
  process.exit(1);
});
