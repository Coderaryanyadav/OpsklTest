#!/usr/bin/env node
/**
 * Entrypoint for opskl-test-runner.
 *
 * Order: wait for health -> seed deterministic fixtures -> API/RLS workflow ->
 * real Chromium UI workflow. Exit code is nonzero if any stage fails.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const REPORT_DIR = process.env.REPORT_DIR || '/reports';
fs.mkdirSync(REPORT_DIR, { recursive: true });

const startedAt = new Date().toISOString();
const results = [];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(name, url, timeoutMs = 120000) {
  const start = Date.now();
  let last = '';
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: 'manual' });
      if (res.status >= 200 && res.status < 500) {
        console.log(`[ready] ${name}: HTTP ${res.status}`);
        return;
      }
      last = `HTTP ${res.status}`;
    } catch (err) {
      last = err.message;
    }
    await sleep(1000);
  }
  throw new Error(`${name} was not ready at ${url}: ${last}`);
}

function runScript(label, script) {
  const logPath = path.join(REPORT_DIR, `${label}.log`);
  const log = fs.createWriteStream(logPath);
  const started = Date.now();
  return new Promise((resolve) => {
    console.log(`\n[run] ${label}: node ${script}`);
    const child = spawn(process.execPath, [script], {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (data) => {
      process.stdout.write(data);
      log.write(data);
    });
    child.stderr.on('data', (data) => {
      process.stderr.write(data);
      log.write(data);
    });
    child.on('close', (code) => {
      log.end();
      const result = {
        label,
        script,
        exitCode: code,
        durationMs: Date.now() - started,
        log: logPath,
      };
      results.push(result);
      console.log(`[run] ${label}: exit ${code}`);
      resolve(code);
    });
  });
}

function writeSummary(extra = {}) {
  const failed = results.filter((r) => r.exitCode !== 0).length;
  const summary = {
    startedAt,
    finishedAt: new Date().toISOString(),
    node: process.version,
    platform: `${process.platform}/${process.arch}`,
    results,
    failed,
    ...extra,
  };
  fs.writeFileSync(path.join(REPORT_DIR, 'test-summary.json'), JSON.stringify(summary, null, 2));
  return summary;
}

async function main() {
  console.log(`[runner] OPSKL isolated test runner (${process.version}, ${process.platform}/${process.arch})`);
  await waitFor('admin', `${process.env.APP_ADMIN_URL}/api/health`);
  await waitFor('worker', `${process.env.APP_WORKER_URL}/healthz`);
  await waitFor('organizer', `${process.env.APP_ORGANIZER_URL}/healthz`);
  await waitFor('supabase auth', `${process.env.SUPABASE_URL}/auth/v1/health`);
  await waitFor('supabase rest', `${process.env.SUPABASE_URL}/rest/v1/`);

  const proxy = spawn(process.execPath, ['scripts/docker/browser_proxy.mjs'], {
    env: { ...process.env, BROWSER_PROXY_PORT: '54321' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  proxy.stdout.on('data', (data) => process.stdout.write(data));
  proxy.stderr.on('data', (data) => process.stderr.write(data));
  try {
    await waitFor('browser Supabase proxy', 'http://127.0.0.1:54321/auth/v1/health', 30000);

    const seedCode = await runScript('seed', 'scripts/docker/seed_test_data.mjs');
    if (seedCode !== 0) {
      writeSummary({ abortReason: 'seed failed' });
      process.exitCode = 1;
      return;
    }

    const apiCode = await runScript('api-rpc-rls', 'scripts/docker/test_api_workflow.mjs');
    if (apiCode !== 0) {
      writeSummary({ abortReason: 'API/RLS workflow failed' });
      process.exitCode = 1;
      return;
    }

    const uiCode = await runScript('browser-ui', 'scripts/docker/test_ui_workflow.mjs');
    const summary = writeSummary();
    process.exitCode = uiCode === 0 && summary.failed === 0 ? 0 : 1;
  } finally {
    proxy.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error('TEST RUNNER ERROR:', err?.stack || err?.message || err);
  writeSummary({ fatal: err?.message || String(err) });
  process.exit(1);
});
