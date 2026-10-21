import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(configService: ConfigService) {
    const connectionString = configService.getOrThrow<string>('DATABASE_URL');

    const pool = new Pool({
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      idleTimeoutMillis: Number(process.env.DATABASE_POOL_IDLE_TIMEOUT ?? 5000),
      connectionTimeoutMillis: Number(
        process.env.DATABASE_POOL_CONNECTION_TIMEOUT ?? 5000,
      ),
    });

    pool.on('error', (err: Error) => {
      this.logger.error(`pg.Pool error: ${err.message}`, err.stack);
    });

    super({ adapter: new PrismaPg(pool) });
  }

  async onModuleInit(): Promise<void> {
    let retries = 5;
    while (retries > 0) {
      try {
        await this.$connect();
        return;
      } catch (err) {
        retries -= 1;
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Prisma $connect failed (${retries} retries left): ${message}`);
        if (retries === 0) {
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}