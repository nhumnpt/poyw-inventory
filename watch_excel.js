import chokidar from 'chokidar';
import { exec } from 'child_process';

const excelPath = 'C:\\poyw\\14255541 (1) (1).xlsm';

console.log(`👁️ Watching: ${excelPath}`);

// Debounce: wait for file to stop changing before extracting
let debounceTimer = null;
let isExtracting = false;

const watcher = chokidar.watch(excelPath, {
  persistent: true,
  usePolling: true,
  interval: 2000,       // Check every 2s instead of 1s
  awaitWriteFinish: {    // Wait for write to complete before firing
    stabilityThreshold: 1500,
    pollInterval: 500
  }
});

watcher.on('change', () => {
  // Clear previous timer (debounce)
  if (debounceTimer) clearTimeout(debounceTimer);

  // Wait 2 seconds after last change event before extracting
  debounceTimer = setTimeout(() => {
    if (isExtracting) {
      console.log('Already extracting, skipping...');
      return;
    }

    isExtracting = true;
    console.log(`\n📊 File changed — extracting data...`);

    exec('node extract_data.js', { cwd: 'C:\\poyw\\app product' }, (error, stdout, stderr) => {
      isExtracting = false;
      if (error) {
        console.error(`❌ Extract error: ${error.message}`);
        return;
      }
      console.log(stdout.trim() || '✅ Data extracted!');
    });
  }, 2000);
});

watcher.on('error', error => console.error(`Watcher error: ${error}`));
