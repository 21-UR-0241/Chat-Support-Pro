const { exec } = require('child_process');
const os = require('os');

function cleanupPort(port) {
  const platform = os.platform();
  
  console.log(`🧹 Cleaning up port ${port}...`);

  if (platform === 'win32') {
    // Windows
    exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
      if (stdout) {
        const lines = stdout.trim().split('\n');
        const pids = new Set();
        
        lines.forEach(line => {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0') {
            pids.add(pid);
          }
        });

        if (pids.size > 0) {
          console.log(`Found ${pids.size} process(es) using port ${port}`);
          pids.forEach(pid => {
            exec(`taskkill /PID ${pid} /F`, (killError) => {
              if (!killError) {
                console.log(`✅ Killed process ${pid}`);
              }
            });
          });
        }
      }
    });
  }
}

// Clean both ports
console.log('🧹 Cleaning up ports...\n');
cleanupPort(3000);
cleanupPort(3001);

// Wait and exit
setTimeout(() => {
  console.log('\n✅ Cleanup complete\n');
  process.exit(0);
}, 1500);