import fs from 'fs';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';

const ROOT_DIR = process.cwd();
const SCHEMA_PATH = path.join(ROOT_DIR, 'prisma', 'schema.prisma');
const SCHEMA_BACKUP_PATH = path.join(ROOT_DIR, 'prisma', 'schema.prisma.bak');
const TEST_DB_PATH = path.join(ROOT_DIR, 'test.db');

function runCommand(command: string, args: string[], env: NodeJS.ProcessEnv = process.env): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const proc = spawn(isWindows ? `${command}.cmd` : command, args, {
      cwd: ROOT_DIR,
      env: { ...process.env, ...env },
      shell: isWindows,
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (d) => {
      stdout += d.toString();
      process.stdout.write(d);
    });

    proc.stderr?.on('data', (d) => {
      stderr += d.toString();
      process.stderr.write(d);
    });

    proc.on('close', (code) => {
      resolve({ code: code || 0, stdout, stderr });
    });
  });
}

async function main() {
  console.log('🚀 Setting up test environment for DineFlow...');

  const originalSchema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  let isSqliteTest = false;

  const currentDbUrl = process.env.DATABASE_URL || '';
  const isPostgresConfigured = currentDbUrl.startsWith('postgres://') || currentDbUrl.startsWith('postgresql://');

  if (!isPostgresConfigured) {
    console.log('ℹ️ No external PostgreSQL connection provided. Using local test SQLite engine for acceptance tests.');
    isSqliteTest = true;

    // Backup original schema
    fs.writeFileSync(SCHEMA_BACKUP_PATH, originalSchema, 'utf8');

    // Convert schema to SQLite for test execution
    const sqliteSchema = originalSchema
      .replace(/provider\s*=\s*"postgresql"/, 'provider = "sqlite"')
      .replace(/directUrl\s*=\s*env\("DIRECT_URL"\)\n?/, '');

    fs.writeFileSync(SCHEMA_PATH, sqliteSchema, 'utf8');

    // Run prisma db push to create test.db
    console.log('📦 Initializing test SQLite database...');
    const pushRes = await runCommand('npx', ['prisma', 'db', 'push', '--accept-data-loss'], {
      DATABASE_URL: 'file:./test.db',
    });

    if (pushRes.code !== 0) {
      console.error('❌ Failed to initialize test database:', pushRes.stderr);
      cleanup(originalSchema, isSqliteTest);
      process.exit(1);
    }
  } else {
    console.log('📦 Using configured PostgreSQL database...');
    await runCommand('npx', ['prisma', 'db', 'push', '--accept-data-loss']);
  }

  // Start API server
  console.log('🌐 Starting DineFlow API test server on port 5000...');
  const isWindows = process.platform === 'win32';
  const serverProcess: ChildProcess = spawn(
    isWindows ? 'npx.cmd' : 'npx',
    ['tsx', 'api/index.ts'],
    {
      cwd: ROOT_DIR,
      env: {
        ...process.env,
        PORT: '5000',
        DATABASE_URL: isSqliteTest ? 'file:./test.db' : currentDbUrl,
        JWT_SECRET: 'test-jwt-secret-key-1234567890',
        CRON_SECRET: 'test-cron-secret-key-1234567890',
        NODE_ENV: 'test',
      },
      shell: isWindows,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  serverProcess.stdout?.on('data', (d) => process.stdout.write(d));
  serverProcess.stderr?.on('data', (d) => process.stderr.write(d));

  // Wait for server to start
  console.log('⏳ Waiting for server to be ready on http://localhost:5000/api/health...');
  let serverReady = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://localhost:5000/api/health');
      if (res.ok) {
        serverReady = true;
        break;
      }
    } catch {
      // Retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  if (!serverReady) {
    console.error('❌ Server failed to start on port 5000 within 15 seconds.');
    serverProcess.kill();
    cleanup(originalSchema, isSqliteTest);
    process.exit(1);
  }

  console.log('✅ Server is ready! Starting test suites...\n');

  let e2eFailed = false;

  try {
    // Run Main E2E tests
    console.log('--- RUNNING SUITE 1: Main E2E Tests ---');
    const suite1 = await runCommand('npx', ['tsx', 'test/test-e2e.ts'], {
      TEST_BASE_URL: 'http://localhost:5000',
      CRON_SECRET: 'test-cron-secret-key-1234567890',
    });
    if (suite1.code !== 0) e2eFailed = true;

    console.log('\n--- RUNNING SUITE 2: Customer Display E2E Tests ---');
    const suite2 = await runCommand('npx', ['tsx', 'test/test-display-e2e.ts'], {
      TEST_BASE_URL: 'http://localhost:5000',
      CRON_SECRET: 'test-cron-secret-key-1234567890',
    });
    if (suite2.code !== 0) e2eFailed = true;
  } finally {
    console.log('\n🛑 Stopping test server...');
    serverProcess.kill('SIGINT');
    serverProcess.kill('SIGTERM');
    try {
      if (isWindows && serverProcess.pid) {
        spawn('taskkill', ['/pid', serverProcess.pid.toString(), '/f', '/t']);
      }
    } catch {
      // Ignore
    }

    await cleanup(originalSchema, isSqliteTest);
  }

  if (e2eFailed) {
    console.error('❌ One or more test suites failed.');
    process.exit(1);
  } else {
    console.log('🎉 ALL ACCEPTANCE TEST SUITES PASSED SUCCESSFULLY!');
  }
}

async function cleanup(originalSchema: string, isSqliteTest: boolean) {
  if (isSqliteTest) {
    console.log('🧹 Restoring PostgreSQL production schema and generating Prisma client...');
    // Give OS time to release file handles
    await new Promise((r) => setTimeout(r, 1000));

    fs.writeFileSync(SCHEMA_PATH, originalSchema, 'utf8');
    if (fs.existsSync(SCHEMA_BACKUP_PATH)) {
      try {
        fs.unlinkSync(SCHEMA_BACKUP_PATH);
      } catch {}
    }
    // Delete test.db
    if (fs.existsSync(TEST_DB_PATH)) {
      try {
        fs.unlinkSync(TEST_DB_PATH);
      } catch {
        // May be locked temporarily
      }
    }
    // Re-generate Prisma client for PostgreSQL (retry loop for Windows DLL unlock)
    for (let attempt = 1; attempt <= 5; attempt++) {
      await new Promise((r) => setTimeout(r, 1000));
      const res = await runCommand('npx', ['prisma', 'generate']);
      if (res.code === 0 && !res.stderr.includes('EPERM')) break;
    }
  }
}

main().catch((err) => {
  console.error('Unexpected error during test execution:', err);
  process.exit(1);
});
