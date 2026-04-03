import { env } from "../../config/env";
import { Queryable } from "../../lib/db";
import { createStore, findFirstStore, StoreRecord } from "./stores.repository";

export async function getDefaultStore(executor?: Queryable): Promise<StoreRecord> {
  const existing = await findFirstStore(executor);
  if (existing) {
    return existing;
  }

  return createStore(
    {
      name: env.storeName,
      phonePrimary: env.storePrimaryPhone,
      phoneSecondary: env.storeSecondaryPhone,
      addressLine1: env.storeAddressLine1,
      addressLine2: env.storeAddressLine2,
      bankName: env.storeBankName,
      bankAccount: env.storeBankAccount,
      bankHolder: env.storeBankHolder,
      businessHoursNote: env.storeBusinessHoursNote
    },
    executor
  );
}
