import { Injectable } from '@nestjs/common';
import crypto from 'node:crypto';
import fs from 'node:fs';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config';

interface SessionPayload {
  exp: number; // 过期时间戳（秒）
}

/** HMAC 签名 Cookie 会话：无外部依赖，密钥落盘一次性生成 */
@Injectable()
export class SessionService {
  private readonly secret: Buffer;

  constructor() {
    this.secret = this.loadOrCreateSecret();
  }

  private loadOrCreateSecret(): Buffer {
    try {
      return Buffer.from(fs.readFileSync(config.secretPath, 'utf8').trim(), 'hex');
    } catch {
      const secret = crypto.randomBytes(32);
      // 'wx'：已存在则抛错，避免并发启动时覆盖
      fs.writeFileSync(config.secretPath, secret.toString('hex'), { flag: 'wx' });
      return secret;
    }
  }

  private sign(body: string): string {
    return crypto.createHmac('sha256', this.secret).update(body).digest('base64url');
  }

  issue(res: FastifyReply, req: FastifyRequest): void {
    const payload: SessionPayload = { exp: Math.floor(Date.now() / 1000) + config.session.ttlSeconds };
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
      if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
      return payload;
    } catch {
      return null;
    }
  }

  clear(res: FastifyReply): void {
    res.clearCookie(config.session.cookieName, { path: '/' });
  }

  private isSecure(req: FastifyRequest): boolean {
    const proto = req.headers['x-forwarded-proto'];
    if (typeof proto === 'string') return proto.split(',')[0].trim() === 'https';
    return req.protocol === 'https';
  }
}
