const { systemPlatform, systemArch } = require('@faynosync/sdk-js');
const { getClient } = require('./updater.js');
const { app_name, version, channel, reportKey, reportIntervalMs } = require('./config.js');

const EVENT_TYPES = [
  'crash',
  'startup_failure',
  'update_failure',
  'install_failure',
  'rollback_failure',
];

const REASONS = [
  'checksum_mismatch',
  'disk_full',
  'access_denied',
  'missing_dependency',
  'panic_nil_pointer',
  'signature_verification_failed',
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildDetails(type, reason) {
  if (Math.random() < 0.5) return undefined;
  return {
    message: `${reason} during ${type}`,
    timestamp: new Date().toISOString(),
    platform: systemPlatform(),
    arch: systemArch(),
  };
}

async function sendRandomReport(deviceId) {
  if (!reportKey) return;

  const type = pick(EVENT_TYPES);
  const reason = pick(REASONS);
  const details = buildDetails(type, reason);

  try {
    const resp = await getClient().reportEvent({
      reportKey,
      deviceId,
      appName: app_name,
      version,
      channel,
      platform: systemPlatform(),
      arch: systemArch(),
      event: { type, reason },
      ...(details ? { details } : {}),
    });
    console.log('Report sent:', { type, reason, withDetails: Boolean(details), ...resp });
  } catch (err) {
    console.error('Report failed:', err.message);
  }
}

let timer = null;

function startReporting(deviceId) {
  if (!reportKey) {
    console.log('REPORT_KEY not set, skipping demo reports');
    return;
  }
  if (timer) return;
  sendRandomReport(deviceId);
  timer = setInterval(() => sendRandomReport(deviceId), reportIntervalMs);
}

function stopReporting() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = { startReporting, stopReporting, sendRandomReport };
