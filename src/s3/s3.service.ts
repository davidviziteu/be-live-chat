import { Injectable, Logger } from '@nestjs/common';
import {
  PutObjectCommand,
  S3Client,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
@Injectable()
export class S3Service {
  private log = new Logger(S3Service.name);
  client: S3Client;
  private bucket = '';
  private secretAccessKey = '';
  private accessKey = '';

  constructor() {
    this.client = new S3Client({
      credentials: {
        secretAccessKey: this.secretAccessKey,
        accessKeyId: this.accessKey,
      },
      region: 'eu-north-1',
    });
  }

  async uploadFile(to: string, name: string, content: any) {
    if (name.includes('/')) {
      this.log.warn('name cannot contain /: ' + name);
      return 'fail';
    }
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: to + '/' + name,
      Body: content,
    });

    try {
      return await this.client.send(command);
    } catch (err) {
      console.error(err);
      return 'fail';
    }
  }

  async getFile(to: string, name: string) {
    if (name.includes('/')) {
      this.log.warn('name cannot contain /: ' + name);
      return 'fail';
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: to + '/' + name,
    });

    try {
      return await this.client.send(command);
    } catch (err) {
      console.error(err);
      return 'fail';
    }
  }
}
