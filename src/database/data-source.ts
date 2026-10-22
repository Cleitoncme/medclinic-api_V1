import 'reflect-metadata';

import { DataSource } from 'typeorm';

import { env } from '../config/env';
import { User } from '../entities/user.entity';
import { CreateUsersTable1726000000000 } from './migrations/1726000000000-create-users-table';

export const appDataSource = new DataSource({
  type: 'postgres',
  host: env.database.host,
  port: env.database.port,
  username: env.database.user,
  password: env.database.password,
  database: env.database.name,
  synchronize: false,
  logging: false,
  entities: [User],
  migrations: [CreateUsersTable1726000000000],
});
