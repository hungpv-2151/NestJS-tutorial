import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Principal } from './auth.service.js';
export const CurrentPrincipal = createParamDecorator((_data: unknown, context: ExecutionContext): Principal => context.switchToHttp().getRequest<{ principal: Principal }>().principal);
