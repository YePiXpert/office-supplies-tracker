import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { Public } from '../common/public.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { clientIp } from '../common/request.util';
import { changePasswordSchema, loginSchema, setupSchema } from '@procure-lite/shared';
import { z } from 'zod';

@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly session: SessionService,
  ) {}

  @Get('status')
  status() {
    return this.auth.status();
  }

  @Post('setup')
  setup(
    @Body(new ZodValidationPipe(setupSchema)) body: { password: string },
    @Req() req: FastifyRequest,
  ) {
    return this.auth.setup(body.password, clientIp(req));
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: { password: string },
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    await this.auth.login(body.password, clientIp(req));
    this.session.issue(res, req);
    return { ok: true };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: FastifyReply) {
    this.session.clear(res);
    return { ok: true };
  }

  @Post('recover')
  @HttpCode(200)
  recover(
    @Body(
      new ZodValidationPipe(
        z.object({ recoveryCode: z.string().min(1), newPassword: z.string().min(8).max(128) }),
      ),
    )
    body: { recoveryCode: string; newPassword: string },
    @Req() req: FastifyRequest,
  ) {
    return this.auth.recover(body.recoveryCode, body.newPassword, clientIp(req));
  }

  /** 以下需要登录（不加 @Public） */

  @Post('change-password')
  @HttpCode(200)
  changePassword(
    @Body(new ZodValidationPipe(changePasswordSchema))
    body: { currentPassword: string; newPassword: string },
    @Req() req: FastifyRequest,
  ) {
    return this.auth.changePassword(body.currentPassword, body.newPassword, clientIp(req));
  }

  @Post('recovery-code')
  @HttpCode(200)
  regenerateRecoveryCode(
    @Body(new ZodValidationPipe(loginSchema)) body: { password: string },
    @Req() req: FastifyRequest,
  ) {
    return this.auth.regenerateRecoveryCode(body.password, clientIp(req));
  }
}
