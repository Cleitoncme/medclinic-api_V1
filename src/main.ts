import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  await app.listen(env.port, '0.0.0.0');
}

void bootstrap().catch((error: unknown) => {
  console.error('Unable to start MedClinic API.', error);
  process.exitCode = 1;
});
