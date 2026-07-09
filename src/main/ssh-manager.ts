import { Client, ClientChannel } from 'ssh2';
import { EventEmitter } from 'events';
import { readFileSync } from 'fs';
import { convertPPKtoOpenSSH } from './ppk-converter';

export interface SSHConnection {
  id?: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  password?: string;
  privateKeyPath?: string;
  passphrase?: string;
}

interface SSHSession {
  client: Client;
  stream: ClientChannel | null;
}

export class SSHManager extends EventEmitter {
  private sessions: Map<string, SSHSession> = new Map();

  async connect(connection: SSHConnection): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = new Client();
      const sessionId = generateId();

      const config: any = {
        host: connection.host,
        port: connection.port || 22,
        username: connection.username || 'root',
        keepaliveInterval: 10000,
        keepaliveCountMax: 3,
        readyTimeout: 30000,
        tryKeyboard: true,
        algorithms: {
          serverHostKey: ['ssh-rsa', 'ssh-ed25519', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521', 'rsa-sha2-256', 'rsa-sha2-512'],
          publicKey: ['ssh-rsa', 'ssh-ed25519', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521', 'rsa-sha2-256', 'rsa-sha2-512'],
        },
      };

      // Set up authentication
      const hasPassword = connection.password && connection.password.trim().length > 0;
      const hasKey = connection.privateKeyPath && connection.privateKeyPath.trim().length > 0;

      if (hasKey) {
        try {
          const keyPath = connection.privateKeyPath!;
          if (keyPath.toLowerCase().endsWith('.ppk')) {
            config.privateKey = convertPPKtoOpenSSH(keyPath);
          } else {
            config.privateKey = readFileSync(keyPath, 'utf8');
          }
          if (connection.passphrase) {
            config.passphrase = connection.passphrase;
          }
        } catch (err: any) {
          reject(new Error(`Cannot read private key: ${err.message}`));
          return;
        }
      }

      if (hasPassword) {
        config.password = connection.password;
      }

      // keyboard-interactive: when server asks for password interactively
      // Forward the prompt to the terminal via event
      client.on('keyboard-interactive', (_name: string, _instructions: string, _lang: string, prompts: any[], finish: (responses: string[]) => void) => {
        // Emit event so renderer can show the prompt in terminal
        this.emit('keyboard-interactive', sessionId, prompts, finish);
      });

      client.on('ready', () => {
        client.shell({ term: 'xterm-256color' }, (err, stream) => {
          if (err) {
            reject(err);
            return;
          }

          this.sessions.set(sessionId, { client, stream });

          stream.on('data', (data: Buffer) => {
            this.emit('data', sessionId, data.toString('utf-8'));
          });

          stream.on('close', () => {
            this.emit('close', sessionId);
            this.sessions.delete(sessionId);
          });

          stream.stderr.on('data', (data: Buffer) => {
            this.emit('data', sessionId, data.toString('utf-8'));
          });

          resolve(sessionId);
        });
      });

      client.on('error', (err) => {
        this.emit('error', sessionId, err.message);
        this.sessions.delete(sessionId);
        reject(err);
      });

      client.on('close', () => {
        this.emit('close', sessionId);
        this.sessions.delete(sessionId);
      });

      client.connect(config);
    });
  }

  write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (session?.stream) {
      session.stream.write(data);
    }
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (session?.stream) {
      session.stream.setWindow(rows, cols, 0, 0);
    }
  }

  disconnect(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.stream?.close();
      session.client.end();
      this.sessions.delete(sessionId);
    }
  }

  disconnectAll(): void {
    for (const [sessionId] of this.sessions) {
      this.disconnect(sessionId);
    }
  }

  getClient(sessionId: string): Client {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    return session.client;
  }
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}
