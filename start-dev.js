const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');
const http = require('http');

const rootDir = __dirname;
const pgDataDir = path.join(rootDir, '.pgdata');

async function isPortOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function ensureDatabase() {
  console.log('[start-dev] Checking PostgreSQL status...');
  const portOpen = await isPortOpen(5432);
  
  if (!portOpen) {
    console.log('[start-dev] PostgreSQL is not running. Starting local PostgreSQL server...');
    
    // Clean stale lock files if present
    const lockFile = path.join(pgDataDir, '.s.PGSQL.5432.lock');
    const pidFile = path.join(pgDataDir, 'postmaster.pid');
    if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
    if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);

    const pgProcess = spawn('postgres', ['-D', pgDataDir], {
      cwd: rootDir,
      stdio: 'inherit',
      detached: false
    });

    pgProcess.on('error', (err) => {
      console.error('[start-dev] Failed to start PostgreSQL:', err.message);
    });

    // Wait for postgres to be ready
    let attempts = 0;
    while (attempts < 10) {
      await new Promise(r => setTimeout(r, 1000));
      if (await isPortOpen(5432)) {
        console.log('[start-dev] PostgreSQL is ready on port 5432!');
        break;
      }
      attempts++;
    }
  } else {
    console.log('[start-dev] PostgreSQL is already running on port 5432.');
  }

  // Ensure devbrain database and extensions are set up
  try {
    console.log('[start-dev] Verifying database schema with Prisma...');
    execSync('npx prisma db push', {
      cwd: path.join(rootDir, 'web'),
      stdio: 'inherit'
    });
  } catch (err) {
    console.error('[start-dev] Warning: Prisma db push failed or was skipped:', err.message);
  }
}

async function verifyBackendHealth() {
  console.log('[start-dev] Waiting for Next.js backend & database health verification on port 3005...');
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      const ok = await new Promise((resolve) => {
        const req = http.get('http://localhost:3005/api/health', (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            if (res.statusCode === 200) {
              console.log('\n[start-dev] ✅ Backend API & Database Health Check PASSED!');
              console.log('[start-dev] Health Check Response:', body);
              resolve(true);
            } else {
              resolve(false);
            }
          });
        });
        req.on('error', () => resolve(false));
        req.end();
      });
      if (ok) return true;
    } catch (_) {}
  }
  console.log('[start-dev] Backend initialization ongoing at http://localhost:3005');
}

async function main() {
  await ensureDatabase();

  console.log('\n[start-dev] Starting Web App (Next.js) on Port 3005 & Extension...\n');

  const children = [];

  // Start Next.js web app
  const webProc = spawn('npm', ['run', 'dev'], {
    cwd: path.join(rootDir, 'web'),
    stdio: 'inherit',
    shell: true
  });
  children.push(webProc);

  // Start extension dev server if extension directory exists
  if (fs.existsSync(path.join(rootDir, 'extension', 'package.json'))) {
    const extProc = spawn('npm', ['run', 'dev'], {
      cwd: path.join(rootDir, 'extension'),
      stdio: 'inherit',
      shell: true
    });
    children.push(extProc);
  }

  // Run backend health check verification
  verifyBackendHealth();

  const cleanup = () => {
    console.log('\n[start-dev] Shutting down child processes...');
    children.forEach(child => {
      if (child && !child.killed) {
        try { child.kill('SIGINT'); } catch (_) {}
      }
    });
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

main().catch((err) => {
  console.error('[start-dev] Fatal error:', err);
  process.exit(1);
});
