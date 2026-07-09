import { app } from 'electron';
import path from 'path';
import fs from 'fs';

export interface SavedConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  privateKeyPath?: string;
  group?: string;
  lastConnected?: string;
}

export class ConnectionStore {
  private filePath: string;
  private connections: SavedConnection[] = [];

  constructor() {
    const userDataPath = app.getPath('userData');
    this.filePath = path.join(userDataPath, 'connections.json');
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        this.connections = JSON.parse(data);
      }
    } catch {
      this.connections = [];
    }
  }

  private persist(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.connections, null, 2));
    } catch (error) {
      console.error('Failed to save connections:', error);
    }
  }

  getAll(): SavedConnection[] {
    return this.connections;
  }

  save(connection: SavedConnection): void {
    const index = this.connections.findIndex((c) => c.id === connection.id);
    if (index >= 0) {
      this.connections[index] = connection;
    } else {
      this.connections.push(connection);
    }
    this.persist();
  }

  delete(id: string): void {
    this.connections = this.connections.filter((c) => c.id !== id);
    this.persist();
  }
}
