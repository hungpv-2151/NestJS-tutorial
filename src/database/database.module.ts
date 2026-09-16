import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getDatabaseConfig } from '../config/database-config.js';

@Module({})
export class DatabaseModule {
  static register(): DynamicModule {
    return TypeOrmModule.forRoot({
      type: 'postgres',
      url: getDatabaseConfig().url,
      autoLoadEntities: true,
      synchronize: false,
      migrationsRun: false,
    });
  }
}
