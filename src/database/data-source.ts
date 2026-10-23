import 'reflect-metadata';

import { DataSource } from 'typeorm';
import { PatientEntity } from '../entities/patient.entity';
import { CreatePatientsTable1792785600000 } from './migrations/create-patients-table';

import { MigrateUserRoles1792670400000 } from './migrations/migrate-user-roles';
import { env } from '../config/env';
import { User } from '../entities/user.entity';
import { CreateUsersTable1726000000000 } from './migrations/create-users-table';

export const appDataSource = new DataSource({
  type: 'postgres',
  host: env.database.host,
  port: env.database.port,
  username: env.database.user,
  password: env.database.password,
  ssl: env.database.ssl,
  connectTimeoutMS: 10000,
  database: env.database.name,
  synchronize: false,
  logging: false,
  entities: [User, PatientEntity],
  migrations: [
    CreateUsersTable1726000000000,
    MigrateUserRoles1792670400000,
    CreatePatientsTable1792785600000,
  ],
});
