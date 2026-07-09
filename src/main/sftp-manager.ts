import { Client, SFTPWrapper } from 'ssh2';
import path from 'path';

export interface RemoteFile {
  name: string;
  type: 'file' | 'directory' | 'symlink';
  size: number;
  modifyTime: number;
  permissions: string;
  owner: number;
  group: number;
}

export class SFTPManager {
  private sftpSessions: Map<string, SFTPWrapper> = new Map();

  async connect(client: Client, sessionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      client.sftp((err, sftp) => {
        if (err) {
          reject(err);
          return;
        }
        this.sftpSessions.set(sessionId, sftp);
        resolve();
      });
    });
  }

  async list(sessionId: string, remotePath: string): Promise<RemoteFile[]> {
    const sftp = this.getSftp(sessionId);

    return new Promise((resolve, reject) => {
      sftp.readdir(remotePath, (err, list) => {
        if (err) {
          reject(err);
          return;
        }

        const files: RemoteFile[] = list.map((item) => ({
          name: item.filename,
          type: item.attrs.isDirectory()
            ? 'directory'
            : item.attrs.isSymbolicLink?.()
            ? 'symlink'
            : 'file',
          size: item.attrs.size,
          modifyTime: item.attrs.mtime,
          permissions: formatPermissions(item.attrs.mode),
          owner: item.attrs.uid,
          group: item.attrs.gid,
        }));

        files.sort((a, b) => {
          if (a.type === 'directory' && b.type !== 'directory') return -1;
          if (a.type !== 'directory' && b.type === 'directory') return 1;
          return a.name.localeCompare(b.name);
        });

        resolve(files);
      });
    });
  }

  async download(sessionId: string, remotePath: string, localPath: string): Promise<void> {
    const sftp = this.getSftp(sessionId);

    return new Promise((resolve, reject) => {
      sftp.fastGet(remotePath, localPath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async upload(sessionId: string, localPath: string, remotePath: string): Promise<void> {
    const sftp = this.getSftp(sessionId);

    return new Promise((resolve, reject) => {
      sftp.fastPut(localPath, remotePath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async mkdir(sessionId: string, remotePath: string): Promise<void> {
    const sftp = this.getSftp(sessionId);

    return new Promise((resolve, reject) => {
      sftp.mkdir(remotePath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async rename(sessionId: string, oldPath: string, newPath: string): Promise<void> {
    const sftp = this.getSftp(sessionId);

    return new Promise((resolve, reject) => {
      sftp.rename(oldPath, newPath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async delete(sessionId: string, remotePath: string): Promise<void> {
    const sftp = this.getSftp(sessionId);

    return new Promise((resolve, reject) => {
      sftp.unlink(remotePath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async rmdir(sessionId: string, remotePath: string): Promise<void> {
    const sftp = this.getSftp(sessionId);

    return new Promise((resolve, reject) => {
      sftp.rmdir(remotePath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async chmod(sessionId: string, remotePath: string, mode: number): Promise<void> {
    const sftp = this.getSftp(sessionId);

    return new Promise((resolve, reject) => {
      sftp.chmod(remotePath, mode, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async stat(sessionId: string, remotePath: string): Promise<RemoteFile> {
    const sftp = this.getSftp(sessionId);

    return new Promise((resolve, reject) => {
      sftp.stat(remotePath, (err, stats) => {
        if (err) {
          reject(err);
          return;
        }
        resolve({
          name: path.basename(remotePath),
          type: stats.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          modifyTime: stats.mtime,
          permissions: formatPermissions(stats.mode),
          owner: stats.uid,
          group: stats.gid,
        });
      });
    });
  }

  async readFile(sessionId: string, remotePath: string): Promise<string> {
    const sftp = this.getSftp(sessionId);

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const stream = sftp.createReadStream(remotePath);
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      stream.on('error', reject);
    });
  }

  async writeFile(sessionId: string, remotePath: string, content: string): Promise<void> {
    const sftp = this.getSftp(sessionId);

    return new Promise((resolve, reject) => {
      const stream = sftp.createWriteStream(remotePath);
      stream.on('finish', () => resolve());
      stream.on('error', reject);
      stream.end(content, 'utf-8');
    });
  }

  has(sessionId: string): boolean {
    return this.sftpSessions.has(sessionId);
  }

  disconnect(sessionId: string): void {
    const sftp = this.sftpSessions.get(sessionId);
    if (sftp) {
      sftp.end();
      this.sftpSessions.delete(sessionId);
    }
  }

  private getSftp(sessionId: string): SFTPWrapper {
    const sftp = this.sftpSessions.get(sessionId);
    if (!sftp) throw new Error('SFTP session not found');
    return sftp;
  }
}

function formatPermissions(mode: number): string {
  const perms = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'];
  const owner = perms[(mode >> 6) & 7];
  const group = perms[(mode >> 3) & 7];
  const others = perms[mode & 7];
  return `${owner}${group}${others}`;
}
