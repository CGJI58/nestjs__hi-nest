import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private configService: ConfigService) {}

  getCodeRequestURL() {
    const clientId = this.configService.get<string>('DEPLOY_CLIENT_ID');
    const codeRequestURL = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=read:user user:email`;

    return { codeRequestURL };
  }
}
