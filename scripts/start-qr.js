/* eslint-disable no-console */

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const readline = require('readline');

const projectRoot = path.resolve(__dirname, '..');
const serverRoot = path.join(projectRoot, 'server');
const expoCli = require.resolve('expo/bin/cli');
const expoArgs = process.argv.slice(2);

const readServerPort = () => {
  const envPath = path.join(serverRoot, '.env');
  if (!fs.existsSync(envPath)) return 4242;
  const match = fs
    .readFileSync(envPath, 'utf8')
    .match(/^\s*PORT\s*=\s*["']?(\d+)["']?\s*$/m);
  return match ? Number(match[1]) : 4242;
};

const port = readServerPort();
const healthPath = '/api/health';
let backend;
let expo;
let stopping = false;

const isPortOpen = (candidate = port) =>
  new Promise(resolve => {
    const socket = net.createConnection({
      host: '127.0.0.1',
      port: candidate,
    });
    const finish = open => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(500);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });

const findExpoPort = async (candidate = 8081) => {
  if (candidate > 8100) {
    throw new Error(
      'No se encontró un puerto libre para Metro entre 8081 y 8100.',
    );
  }
  if (!(await isPortOpen(candidate))) return candidate;
  return findExpoPort(candidate + 1);
};

const checkHealth = () =>
  new Promise(resolve => {
    const request = http.get(
      { hostname: '127.0.0.1', port, path: healthPath, timeout: 500 },
      response => {
        response.resume();
        resolve(response.statusCode === 200);
      },
    );
    request.once('timeout', () => {
      request.destroy();
      resolve(false);
    });
    request.once('error', () => resolve(false));
  });

const delay = milliseconds =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

const waitForBackend = async (deadline = Date.now() + 12000) => {
  if (await checkHealth()) return undefined;
  if (backend.exitCode !== null) {
    throw new Error('El servidor Stripe terminó antes de estar disponible.');
  }
  if (Date.now() >= deadline) {
    throw new Error(`El servidor Stripe no respondió en el puerto ${port}.`);
  }
  await delay(250);
  return waitForBackend(deadline);
};

const pipeWithPrefix = (stream, prefix, destination) => {
  const lines = readline.createInterface({ input: stream });
  lines.on('line', line => destination.write(`${prefix} ${line}\n`));
};

const terminateTree = child => {
  if (!child || child.exitCode !== null || !child.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
  } else {
    child.kill('SIGTERM');
  }
};

const shutdown = exitCode => {
  if (stopping) return;
  stopping = true;
  process.stdout.write('\nDeteniendo Expo y Stripe…\n');
  terminateTree(expo);
  terminateTree(backend);
  process.exitCode = exitCode;
};

const showLanAddresses = () => {
  const addresses = Object.values(os.networkInterfaces())
    .flat()
    .filter(
      address =>
        address &&
        address.family === 'IPv4' &&
        !address.internal &&
        !address.address.startsWith('169.254.'),
    )
    .map(address => address.address);
  const unique = [...new Set(addresses)];
  if (unique.length === 0) {
    console.log('[stripe] No se detectó una dirección LAN. Revisa tu Wi-Fi.');
    return;
  }
  unique.forEach(address => {
    console.log(`[stripe] Teléfono: http://${address}:${port}${healthPath}`);
  });
};

const main = async () => {
  if (await isPortOpen()) {
    throw new Error(
      `El puerto ${port} ya está ocupado. Cierra el proceso que lo utiliza y vuelve a ejecutar yarn qr --clear.`,
    );
  }

  console.log('[stripe] Iniciando backend de Stripe Test Mode…');
  backend = spawn(process.execPath, ['server.js'], {
    cwd: serverRoot,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  pipeWithPrefix(backend.stdout, '[stripe]', process.stdout);
  pipeWithPrefix(backend.stderr, '[stripe:error]', process.stderr);

  await waitForBackend();
  console.log(`[stripe] API lista en http://127.0.0.1:${port}${healthPath}`);
  showLanAddresses();
  console.log('[expo] Iniciando Expo Go…');

  const expoEnvironment = { ...process.env };
  delete expoEnvironment.STRIPE_SECRET_KEY;
  const hasExplicitPort = expoArgs.some(
    (argument, index) =>
      argument === '--port' ||
      argument.startsWith('--port=') ||
      expoArgs[index - 1] === '--port',
  );
  const metroPort = hasExplicitPort ? null : await findExpoPort();
  if (metroPort && metroPort !== 8081) {
    console.log(`[expo] El puerto 8081 está ocupado; se usará ${metroPort}.`);
  }
  const metroArgs = metroPort
    ? [expoCli, 'start', '--go', '--port', String(metroPort), ...expoArgs]
    : [expoCli, 'start', '--go', ...expoArgs];
  expo = spawn(process.execPath, metroArgs, {
    cwd: projectRoot,
    env: expoEnvironment,
    stdio: 'inherit',
  });

  expo.once('exit', code => shutdown(code || 0));
  backend.once('exit', code => {
    if (!stopping) {
      process.stderr.write(
        `[stripe:error] El backend se detuvo inesperadamente (código ${code}).\n`,
      );
      shutdown(code || 1);
    }
  });
};

process.once('SIGINT', () => shutdown(0));
process.once('SIGTERM', () => shutdown(0));
process.once('exit', () => {
  terminateTree(expo);
  terminateTree(backend);
});

main().catch(error => {
  process.stderr.write(`[inicio:error] ${error.message}\n`);
  shutdown(1);
});
