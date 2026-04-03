import dotenv from "dotenv";

dotenv.config();

function requireString(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function requireNumber(name: string, fallback?: number): number {
  const raw = process.env[name] ?? (fallback !== undefined ? String(fallback) : undefined);
  if (!raw) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a number.`);
  }

  return parsed;
}

function optionalString(name: string, fallback?: string): string | undefined {
  return process.env[name] ?? fallback;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: requireNumber("PORT", 4000),
  databaseUrl: requireString("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/seafood_b2c"),
  storeName: requireString("STORE_NAME", "오늘바다 데모점"),
  storePrimaryPhone: requireString("STORE_PRIMARY_PHONE", "010-1234-5678"),
  storeSecondaryPhone: requireString("STORE_SECONDARY_PHONE", "010-2345-6789"),
  storeBankName: optionalString("STORE_BANK_NAME", "신한은행"),
  storeBankAccount: optionalString("STORE_BANK_ACCOUNT", "110-123-456789"),
  storeBankHolder: optionalString("STORE_BANK_HOLDER", "오늘바다"),
  storeAddressLine1: optionalString(
    "STORE_ADDRESS_LINE1",
    "서울시 동작구 예시로 123 수산타운 1층"
  ),
  storeAddressLine2: optionalString("STORE_ADDRESS_LINE2", "A동 12호"),
  storeBusinessHoursNote: optionalString("STORE_BUSINESS_HOURS_NOTE", "월~금 05:00~17:00 / 토 05:00~18:00 / 일 06:00~17:00")
};
