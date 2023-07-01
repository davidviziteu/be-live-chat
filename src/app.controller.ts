import {
  Controller,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
  StreamableFile,
} from '@nestjs/common';
import { S3Service } from './s3/s3.service';

@Controller()
export class AppController {
  constructor(private readonly s3: S3Service) {}

  @Get('/:user/:file')
  async getHello(@Param('user') user, @Param('file') fileName) {
    const file = await this.s3.getFile(user, fileName);
    if (file == 'fail') throw new InternalServerErrorException();
    if (!file) throw new NotFoundException();

    const fileString = await file.Body.transformToString('UTF-8');
    const fileBuf = Buffer.from(fileString);
    return new StreamableFile(fileBuf);
  }
}
