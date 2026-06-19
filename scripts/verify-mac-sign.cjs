#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');
const config = require('../electron-builder.config.js');
const productName = config.productName;
const distDir = path.join(rootDir, config.directories?.output || 'dist');

function findApp() {
  if (!fs.existsSync(distDir)) return null;
  for (const entry of fs.readdirSync(distDir)) {
    if (!entry.startsWith('mac')) continue;
    const candidate = path.join(distDir, entry, `${productName}.app`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function findDmg() {
  if (!fs.existsSync(distDir)) return null;
  const dmg = fs
    .readdirSync(distDir)
    .find((file) => file.toLowerCase().endsWith('.dmg'));
  return dmg ? path.join(distDir, dmg) : null;
}

function runOrFail(command, args, target) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`\nVerification failed for: ${target}`);
    process.exit(result.status || 1);
  }
}

const appPath = findApp();
const dmgPath = findDmg();

if (!appPath) {
  console.error(`Missing app bundle under: ${distDir}`);
  process.exit(1);
}
if (!dmgPath) {
  console.error(`Missing dmg file under: ${distDir}`);
  process.exit(1);
}

console.log(`Verifying macOS signatures for "${productName}"`);
console.log(`  app: ${appPath}`);
console.log(`  dmg: ${dmgPath}`);

runOrFail('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath], appPath);
runOrFail('codesign', ['-dv', '--verbose=4', appPath], appPath);
runOrFail('codesign', ['--verify', '--deep', '--strict', '--verbose=2', dmgPath], dmgPath);
runOrFail('xcrun', ['stapler', 'validate', appPath], appPath);
runOrFail('xcrun', ['stapler', 'validate', dmgPath], dmgPath);
runOrFail('spctl', ['--assess', '--verbose=4', '--type', 'execute', appPath], appPath);
runOrFail(
  'spctl',
  ['--assess', '--verbose=4', '--type', 'open', '--context', 'context:primary-signature', dmgPath],
  dmgPath
);

console.log('\nAll signing and notarization checks passed.');
