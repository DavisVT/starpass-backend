import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Validates that all required environment variables are present and not empty.
 * If any required variables are missing, it throws a descriptive error listing them.
 */
export function validateConfig(): void {
  // Load local .env file if it exists and we are not running tests
  if (process.env.NODE_ENV !== 'test') {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
    }
  }

  const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'STELLAR_RPC_URL',
    'STELLAR_NETWORK',
    'STARPASS_CONTRACT_ID',
    'CONTENT_URL_SECRET',
  ];

  const missingEnvVars = requiredEnvVars.filter(
    (envVar) => !process.env[envVar] || process.env[envVar].trim() === '',
  );

  if (missingEnvVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingEnvVars.join(', ')}`,
    );
  }
}
