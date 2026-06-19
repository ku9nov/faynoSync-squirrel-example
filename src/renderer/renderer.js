const { ipcRenderer } = require('electron');

// Update title
document.getElementById('title').textContent = document.title;

// Handle check updates button
document.getElementById('checkUpdateBtn').addEventListener('click', () => {
  ipcRenderer.send('check-updates');
});

// Handle update now button
document.getElementById('updateNowBtn').addEventListener('click', () => {
  ipcRenderer.send('update-now');
});

// Handle settings button
document.getElementById('settingsBtn').addEventListener('click', () => {
  ipcRenderer.send('open-settings');
});

// Listen for update available event
ipcRenderer.on('update-available', () => {
  document.getElementById('updateBanner').classList.remove('hidden');
});

// Listen for update not available event
ipcRenderer.on('update-not-available', () => {
  const statusCard = document.querySelector('.status-card');
  statusCard.innerHTML = `
    <div class="status-icon">
      <img src="../assets/check-circle.png" alt="Status" class="status-img">
    </div>
    <div class="status-content">
      <h2>You're up to date!</h2>
      <p class="status-description">Your application is running the latest version</p>
    </div>
  `;
});

// --- In-app update modal ---
const { marked } = require('marked');

const $ = (id) => document.getElementById(id);
const show = (id) => $(id).classList.remove('hidden');
const hide = (id) => $(id).classList.add('hidden');

function formatBytes(n) {
  if (!n) return '0 MB';
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function applyCritical(critical) {
  $('updateModal').classList.toggle('critical', !!critical);
  if (critical) show('updateCriticalWarning');
  else hide('updateCriticalWarning');
}

ipcRenderer.on('update:meta', (_e, meta) => {
  show('updateOverlay');
  $('updateModalTitle').textContent = 'Downloading update…';
  applyCritical(meta.critical);

  if (meta.source) {
    $('updateSource').textContent = `source: ${meta.source}`;
    show('updateSource');
  }
  if (meta.version) {
    $('updateVersionLine').textContent = `${meta.fromVersion} → ${meta.version}`;
    show('updateVersionLine');
  }
  if (meta.changelog) {
    $('updateChangelogContent').innerHTML = marked.parse(meta.changelog);
    show('updateChangelog');
  }
  show('updateProgress');
  show('updateLaterBtn');
});

ipcRenderer.on('update:progress', (_e, p) => {
  const percent = Math.round(p.percent || 0);
  $('updateProgressBar').style.width = `${percent}%`;
  $('updateProgressText').textContent =
    `${percent}% — ${formatBytes(p.transferred)} / ${formatBytes(p.total)} (${formatBytes(p.bytesPerSecond)}/s)`;
});

ipcRenderer.on('update:ready', () => {
  $('updateModalTitle').textContent = 'Update ready to install';
  $('updateProgressBar').style.width = '100%';
  $('updateProgressText').textContent = 'Download complete.';
  show('updateRestartBtn');
});

ipcRenderer.on('update:error', (_e, err) => {
  $('updateModalTitle').textContent = 'Update failed';
  hide('updateProgress');
  $('updateError').textContent = err && err.message ? err.message : 'Unknown error';
  show('updateError');
  show('updateManualBtn');
});

$('updateRestartBtn').addEventListener('click', () => {
  ipcRenderer.send('update:restart');
});
$('updateManualBtn').addEventListener('click', () => {
  ipcRenderer.send('update:manual');
  hide('updateOverlay');
});
$('updateLaterBtn').addEventListener('click', () => {
  hide('updateOverlay');
});