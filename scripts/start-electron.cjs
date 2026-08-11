const net = require('net');
const { spawn } = require('child_process');
const electron = require('electron');

process.env.NODE_ENV = 'development';

function waitForVite(attempts = 60) {
  const socket = net.createConnection({ host: '127.0.0.1', port: 5173 });
  socket.once('connect', () => {
    socket.destroy();
    const child = spawn(electron, ['dist/main/main.js'], {
      stdio: 'inherit',
      env: process.env,
    });
    child.once('exit', (code) => process.exit(code ?? 0));
  });
  socket.once('error', () => {
    socket.destroy();
    if (attempts <= 1) {
      console.error('Vite dev server did not start on port 5173.');
      process.exit(1);
    }
    setTimeout(() => waitForVite(attempts - 1), 250);
  });
}

waitForVite();
