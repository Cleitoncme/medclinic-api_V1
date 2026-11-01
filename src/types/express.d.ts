import type { AuthTokenPayload } from '../dtos/auth.dto';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload;
    }
  }
}

export {};
