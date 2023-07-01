import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { Gateway } from './app.gateway';
import { S3Service } from './s3/s3.service';
import { S3Module } from './s3/s3.module';

@Module({
  imports: [S3Module],
  controllers: [AppController],
  providers: [Gateway, S3Service],
})
export class AppModule {}
