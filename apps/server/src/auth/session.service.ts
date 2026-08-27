import { Injectable } from '@nestjs/common';
import crypto from 'node:crypto';
import fs from 'node:fs';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config';

interface SessionPayload {
  exp: number; // 过期时间戳（秒）——滑动窗口
  iat: number; // 签发时间（秒）——绝对生命周期上限
  epoch: number; // 密码纪元：改密/恢复后旧会话全部失效
}

/** 会话绝对上限：即使持续活跃，12 小时后也必须重新登录 */
const ABSOLUTE_TTL_SECONDS = 12 * 3600;

/** HMAC 签名 Cookie 会话：密钥落盘一次性生成 */
@Injectable()
export class SessionService {
  private readonly secret: Buffer;

  constructor() {
    this.secret = this.loadOrCreateSecret();
  }

  private loadOrCreateSecret(): Buffer {
    let raw: string;
    try {
      raw = fs.readFileSync(config.secretPath, 'utf8').trim();
    } catch (e) {
      // 只有文件不存在才生成新密钥；权限/IO 问题应当抛出，避免静默重置所有会话
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      const secret = crypto.randomBytes(32);
      fs.writeFileSync(config.secretPath, secret.toString('hex'), { flag: 'wx' });
      return secret;
    }
    const secret = Buffer.from(raw, 'hex');
    if (secret.length !== 32) {
      throw new Error(`会话密钥文件损坏（${config.secretPath}），请删除后重启以重新生成`);
    }
    return secret;
  }

  private sign(body: string): string {
    return crypto.createHmac('sha256', this.secret).update(body).digest('base64url');
  }

  issue(res: FastifyReply, req: FastifyRequest, epoch = 0): void {
    const now = Math.floor(Date.now() / 1000);
    const payload: SessionPayload = {
      iat: now,
      exp: now + config.session.ttlSeconds,
      epoch,
    };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const token = `${body}.${this.sign(body)}`;
    res.setCookie(config.session.cookieName, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: this.isSecure(req),
      path: '/',
      maxAge: config.session.ttlSeconds,
    });
  }

  verify(token: string | undefined): SessionPayload | null {
    if (!token) return null;
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    const expected = this.sign(body);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
      const now = Math.floor(Date.now() / 1000);
      if (
        typeof payload.exp !== 'number' ||
        payload.exp < now ||
        typeof payload.iat !== 'number' ||
        now - payload.iat > ABSOLUTE_TTL_SECONDS
      ) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  clear(res: FastifyReply): void {
    res.clearCookie(config.session.cookieName, { path: '/' });
  }

  private isSecure(req: FastifyRequest): boolean {
    // trustProxy 配置下 fastify 已按可信跳数解析 protocol
    return req.protocol === 'https';
  }
}
