import 'dotenv/config';

interface EnvironmentConfig {
  port: number;
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
}

function getRequiredEnvironmentVariable(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Environment variable ${name} is required.`);
  }

  return value;
}

function getPort(value: string | undefined, fallback: number): number {
  if (!value) return fallback;

  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('PORT must be a positive integer.');
  }

  return port;
}

export const env: EnvironmentConfig = {
  port: getPort(process.env.PORT, 3000),
  database: {
    host: getRequiredEnvironmentVariable('DATABASE_HOST'),
    port: getPort(process.env.DATABASE_PORT, 5432),
    name: getRequiredEnvironmentVariable('DATABASE_NAME'),
    user: getRequiredEnvironmentVariable('DATABASE_USER'),
    password: getRequiredEnvironmentVariable('DATABASE_PASSWORD'),
  },
  jwt: {
    secret: getRequiredEnvironmentVariable('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  },
};
