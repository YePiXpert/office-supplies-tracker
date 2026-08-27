import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { IS_PUBLIC_KEY } from '../common/public.decorator';
import { SessionService } from './session.service';
import { config } from '../config';

/** 全局守卫：校验签名 Cookie，并在每次请求通过后滑动续期 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly session: SessionService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const res = context.switchToHttp().getResponse<FastifyReply>();
    const token = (req.cookies as Record<string, string> | undefined)?.[config.session.cookieName];
    const payload = this.session.verify(token);
    if (!payload) throw new UnauthorizedException('未登录或会话已过期');
    this.session.issue(res, req);
    return true;
  }
}
