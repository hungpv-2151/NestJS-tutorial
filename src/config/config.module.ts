import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { validateEnvironment } from './environment.validation.js';

@Global()
@Module({
  imports: [NestConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment })],
  exports: [NestConfigModule],
})
export class ConfigModule {}
