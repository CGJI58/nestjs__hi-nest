import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './schemas/user.schema';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { UserInfo } from './schemas/userinfo.schema';
import { defaultUserEntity, UserEntity } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  generateAccessTokenRequestURL(ghCode: string): string {
    const baseUrl = 'https://github.com/login/oauth/access_token';
    const [clientId, clientSecret] = [
      process.env.LOCALHOST_CLIENT_ID,
      process.env.LOCALHOST_CLIENT_SECRET,
    ];
    if (clientId && clientSecret) {
      const config = {
        client_id: clientId,
        client_secret: clientSecret,
        code: ghCode,
      };
      const params = new URLSearchParams(config).toString();

      return `${baseUrl}?${params}`;
    } else {
      throw new Error('Cannot get clientId or clientSecret.');
    }
  }

  async getAccessToken(url: string) {
    const accessTokenReqest = await (
      await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
      })
    ).json();
    const accessToken = accessTokenReqest['access_token'];
    if (typeof accessToken === 'string') {
      return accessToken;
    } else {
      throw new Error('Cannot get accessToken from github O Auth app.');
    }
  }

  generateHashCode(accessToken: string) {
    return crypto.createHash('sha256').update(accessToken).digest('hex');
  }

  async getUserInfo(accessToken: string): Promise<UserInfo> {
    try {
      const response = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `token ${accessToken}`,
        },
      });
      const userInfo: UserInfo = (await response.json())[0];
      return userInfo;
    } catch {
      throw new Error('Cannot get userinfo from github.');
    }
  }

  async loginByGhCode(ghCode: string) {
    const tokenRequestURL = this.generateAccessTokenRequestURL(ghCode);
    const accessToken = await this.getAccessToken(tokenRequestURL);
    const userInfo = await this.getUserInfo(accessToken);
    const hashCode = this.generateHashCode(accessToken);
    const user = await this.getUserByEmail(userInfo.email);

    if (user) {
      console.log('loginByGhCode: send updated user data to FE.');
      const updatedUser: User = { ...user, hashCode };
      return updatedUser;
    } else {
      console.log('loginByGhCode: send created user data to FE.');
      const newUser = {
        hashCode,
        userInfo,
        userRecord: defaultUserEntity.userRecord,
      };
      return newUser;
    }
  }

  async loginByHashCode(hash: string): Promise<UserEntity> {
    const user = await this.userModel.findOne({ hashCode: hash }).exec();
    if (user) {
      const { hashCode, userInfo, userRecord } = user;
      return {
        hashCode,
        userInfo,
        userRecord,
      };
    } else {
      console.log('no matched hashCode. return empty user.');
      return defaultUserEntity;
    }
  }

  async getUserByEmail(email: string): Promise<UserEntity | null> {
    const user = await this.userModel
      .findOne({ 'userInfo.email': email })
      .exec();
    if (user) {
      const { hashCode, userInfo, userRecord } = user;
      return {
        hashCode,
        userInfo,
        userRecord,
      };
    } else {
      console.log('getUserByEmail: Cannot find user in DB. OK to save user.');
      return user;
    }
  }

  async saveUser(user: User) {
    const checkUserDB = await this.getUserByEmail(user.userInfo.email);
    if (checkUserDB === null) {
      const newUserModel = new this.userModel(user);
      await newUserModel.save();
      console.log('save user');
    } else {
      throw new Error('User already exists in DB. (duplicated emails)');
    }
  }

  async deleteUser(email: string) {
    const result = await this.userModel
      .deleteOne({ 'userInfo.email': email })
      .exec();
    if (result.deletedCount === 1) {
      console.log('delete user successfully.');
    } else {
      console.log(`delete user failed. No matched user in DB. email: ${email}`);
    }
  }

  async updateUserDB(user: User) {
    await this.deleteUser(user.userInfo.email);
    await this.saveUser(user);
  }
}
