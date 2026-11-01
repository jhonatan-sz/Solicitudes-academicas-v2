import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageProvider, StorageResult } from './storage.interface';
import { access, mkdir, unlink, writeFile } from 'fs/promises';
import { createReadStream } from 'fs';
import { join, resolve } from 'path';
import { Readable } from 'stream';

@Injectable()
export class LocalStorage implements StorageProvider {
  private uploadsDir: string;

  constructor(private configService: ConfigService) {
    this.uploadsDir = resolve(process.cwd(), 'uploads');
  }

  async upload(file: Buffer, fileName: string): Promise<StorageResult> {
    const safeName = this.sanitizeFileName(fileName);
    const fullPath = join(this.uploadsDir, safeName);

    if (!fullPath.startsWith(this.uploadsDir)) {
      throw new BadRequestException('Invalid file path');
    }

    await mkdir(this.uploadsDir, { recursive: true });
    await writeFile(fullPath, file);

    const url = `/api/documents/${safeName}/file`;
    return { url, fileName: safeName, fileSize: file.length };
  }

  async delete(fileName: string): Promise<void> {
    const fullPath = this.resolveSafePath(fileName);

    try {
      await unlink(fullPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      // El archivo ya no existía: el resultado esperado sigue siendo "no está".
    }
  }

  async getStream(fileName: string): Promise<Readable> {
    const fullPath = this.resolveSafePath(fileName);

    await this.assertExists(fullPath);

    return createReadStream(fullPath);
  }

  async fileExists(fileName: string): Promise<boolean> {
    const fullPath = this.resolveSafePath(fileName);

    try {
      await access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  private resolveSafePath(fileName: string): string {
    const safeName = this.sanitizeFileName(fileName);
    const fullPath = join(this.uploadsDir, safeName);

    if (!fullPath.startsWith(this.uploadsDir)) {
      throw new BadRequestException('Invalid file path');
    }

    return fullPath;
  }

  private async assertExists(fullPath: string): Promise<void> {
    try {
      await access(fullPath);
    } catch {
      throw new BadRequestException('File not found');
    }
  }

  private sanitizeFileName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '');
  }
}
