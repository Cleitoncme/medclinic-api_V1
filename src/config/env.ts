import 'dotenv/config';

interface EnvironmentConfig {
  port: number;
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    ssl: false | { rejectUnauthorized: true; ca?: string };
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

const jwtExpiresIn = process.env.JWT_EXPIRES_IN ?? '1h';
if (!/^[1-9]\d*(s|m|h|d)$/.test(jwtExpiresIn)) {
  throw new Error('JWT_EXPIRES_IN deve ser uma duração positiva, por exemplo 1h.');
}
const databaseSsl = process.env.DATABASE_SSL ?? String(process.env.NODE_ENV === 'production');
if (databaseSsl !== 'true' && databaseSsl !== 'false') {
  throw new Error('DATABASE_SSL deve ser true ou false.');
}
const databaseCa = process.env.DATABASE_SSL_CA?.replace(/\\n/g, '\n');
export const env: EnvironmentConfig = {
  port: getPort(process.env.PORT, 3000),
  database: {
    host: getRequiredEnvironmentVariable('DATABASE_HOST'),
    port: getPort(process.env.DATABASE_PORT, 5432),
    name: getRequiredEnvironmentVariable('DATABASE_NAME'),
    user: getRequiredEnvironmentVariable('DATABASE_USER'),
    password: getRequiredEnvironmentVariable('DATABASE_PASSWORD'),
    ssl:
      databaseSsl === 'true'
        ? { rejectUnauthorized: true, ...(databaseCa ? { ca: databaseCa } : {}) }
        : false,
  },
  jwt: {
    secret: getRequiredEnvironmentVariable('JWT_SECRET'),
    expiresIn: jwtExpiresIn,
  },
};
