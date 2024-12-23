import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './schemas/user.schema';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { defaultUserEntity, UserEntity } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  generateAccessTokenRequestURL(ghCode: string) {
    const baseUrl = 'https://github.com/login/oauth/access_token';
    const config = {
      client_id: process.env.DEPLOY_CLIENT_ID,
      client_secret: process.env.DEPLOY_CLIENT_SECRET,
      code: ghCode,
    };
    const params = new URLSearchParams(config).toString();

    return `${baseUrl}?${params}`;
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
    return accessTokenReqest['access_token'];
  }

  generateHashCode(accessToken: string) {
    return crypto.createHash('sha256').update(accessToken).digest('hex');
  }

  async getUserInfo(accessToken: string) {
    const response = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `token ${accessToken}`,
      },
    });
    const userInfo = (await response.json())[0];
    return userInfo;
  }

  async loginByGhCode(ghCode: string) {
    const tokenRequestURL = this.generateAccessTokenRequestURL(ghCode);
    const accessToken = await this.getAccessToken(tokenRequestURL);
    const userInfo = await this.getUserInfo(accessToken);
    const hashCode = this.generateHashCode(accessToken);
    const user = await this.getUserByEmail(userInfo.email);

    if (user.userInfo.email !== '') {
      await this.deleteUser(user.userInfo.email);
      const newUser = await this.createUser(user);
      return newUser;
    } else {
      const newUser = await this.createUser({
        hashCode,
        userInfo,
        userRecord: { nickname: '', diaries: [] },
      });
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
    } else return defaultUserEntity;
  }

  /**
   *
   * @param email
   * @returns UserEntity
   * @description return defaultUserEntity (empty user object) if user not found.
   */
  async getUserByEmail(email: string): Promise<UserEntity> {
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
    } else return defaultUserEntity;
  }

  async createUser(user: User): Promise<UserEntity> {
    const newUser = new this.userModel(user);
    await newUser.save();
    console.log('create user');
    const { hashCode, userInfo, userRecord } = newUser;
    return { hashCode, userInfo, userRecord };
  }

  async deleteUser(email: string) {
    const result = await this.userModel
      .deleteOne({ 'userInfo.email': email })
      .exec();
    if (result.deletedCount === 1) {
      console.log('delete user successfully.');
    } else {
      console.log(`delete user failed. No matched user. email: ${email}`);
    }
  }

  async updateUser(user: User) {
    await this.deleteUser(user.userInfo.email);
    const newUser = await this.createUser(user);
    return newUser;
  }
}
