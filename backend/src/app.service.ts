import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  health(): { estado: string } {
    return { estado: 'ok' };
  }
}
