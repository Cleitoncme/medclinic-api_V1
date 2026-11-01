import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { appDataSource } from './data-source';

@Module({
  providers: [{ provide: DataSource, useFactory: () => appDataSource.initialize() }],
  exports: [DataSource],
})
export class DatabaseModule implements OnApplicationShutdown {
  public constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  public async onApplicationShutdown(): Promise<void> {
    if (this.dataSource.isInitialized) await this.dataSource.destroy();
  }
}
