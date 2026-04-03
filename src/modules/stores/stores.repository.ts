import { Queryable, db } from "../../lib/db";

export interface StoreRecord {
  id: string;
  name: string;
  business_name: string | null;
  owner_name: string | null;
  phone_primary: string | null;
  phone_secondary: string | null;
  address_line1: string | null;
  address_line2: string | null;
  bank_name: string | null;
  bank_account: string | null;
  bank_holder: string | null;
  business_hours_note: string | null;
}

export async function findFirstStore(executor: Queryable = db): Promise<StoreRecord | null> {
  const result = await executor.query<StoreRecord>(`
    select
      id,
      name,
      business_name,
      owner_name,
      phone_primary,
      phone_secondary,
      address_line1,
      address_line2,
      bank_name,
      bank_account,
      bank_holder,
      business_hours_note
    from stores
    order by created_at asc
    limit 1
  `);

  return result.rows[0] ?? null;
}

export interface CreateStoreInput {
  name: string;
  phonePrimary?: string;
  phoneSecondary?: string;
  addressLine1?: string;
  addressLine2?: string;
  bankName?: string;
  bankAccount?: string;
  bankHolder?: string;
  businessHoursNote?: string;
}

export async function createStore(input: CreateStoreInput, executor: Queryable = db): Promise<StoreRecord> {
  const result = await executor.query<StoreRecord>(
    `
      insert into stores (
        name,
        phone_primary,
        phone_secondary,
        address_line1,
        address_line2,
        bank_name,
        bank_account,
        bank_holder,
        business_hours_note
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      returning
        id,
        name,
        business_name,
        owner_name,
        phone_primary,
        phone_secondary,
        address_line1,
        address_line2,
        bank_name,
        bank_account,
        bank_holder,
        business_hours_note
    `,
    [
      input.name,
      input.phonePrimary ?? null,
      input.phoneSecondary ?? null,
      input.addressLine1 ?? null,
      input.addressLine2 ?? null,
      input.bankName ?? null,
      input.bankAccount ?? null,
      input.bankHolder ?? null,
      input.businessHoursNote ?? null
    ]
  );

  return result.rows[0];
}
