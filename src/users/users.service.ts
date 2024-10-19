import { Injectable, NotFoundException } from '@nestjs/common';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  private users: User[] = [];

  getAll(): User[] {
    return this.users;
  }

  async create(ghCode: string) {
    const baseUrl = 'https://github.com/login/oauth/access_token';
    const config = {
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      code: ghCode,
    };
    const params = new URLSearchParams(config).toString();
    const accessTokenReqestURL = `${baseUrl}?${params}`;
    const accessToken = await fetch(accessTokenReqestURL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
    });
    console.log(accessToken);

    this.users.push({
      ghCode,
    });
  }
}
