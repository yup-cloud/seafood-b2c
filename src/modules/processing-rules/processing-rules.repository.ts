import { Queryable, db } from "../../lib/db";

export interface ProcessingRuleRecord {
  id: string;
  store_id: string;
  species_name: string;
  cut_type: string;
  fee_mode: string;
  fee_amount: string | null;
  fulfillment_warning: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function listProcessingRules(storeId: string, executor: Queryable = db): Promise<ProcessingRuleRecord[]> {
  const result = await executor.query<ProcessingRuleRecord>(
    `
      select
        id,
        store_id,
        species_name,
        cut_type,
        fee_mode,
        fee_amount::text,
        fulfillment_warning,
        is_active,
        created_at::text,
        updated_at::text
      from processing_rules
      where store_id = $1
      order by is_active desc, species_name asc, cut_type asc
    `,
    [storeId]
  );

  return result.rows;
}

export interface CreateProcessingRuleInput {
  storeId: string;
  speciesName: string;
  cutType: string;
  feeMode: string;
  feeAmount?: number | null;
  fulfillmentWarning?: string | null;
  isActive?: boolean;
}

export async function createProcessingRule(
  input: CreateProcessingRuleInput,
  executor: Queryable = db
): Promise<ProcessingRuleRecord> {
  const result = await executor.query<ProcessingRuleRecord>(
    `
      insert into processing_rules (
        store_id,
        species_name,
        cut_type,
        fee_mode,
        fee_amount,
        fulfillment_warning,
        is_active
      )
      values ($1, $2, $3, $4, $5, $6, $7)
      returning
        id,
        store_id,
        species_name,
        cut_type,
        fee_mode,
        fee_amount::text,
        fulfillment_warning,
        is_active,
        created_at::text,
        updated_at::text
    `,
    [
      input.storeId,
      input.speciesName,
      input.cutType,
      input.feeMode,
      input.feeAmount ?? null,
      input.fulfillmentWarning ?? null,
      input.isActive ?? true
    ]
  );

  return result.rows[0];
}

export interface UpdateProcessingRuleInput {
  speciesName?: string;
  cutType?: string;
  feeMode?: string;
  feeAmount?: number | null;
  fulfillmentWarning?: string | null;
  isActive?: boolean;
}

export async function updateProcessingRule(
  ruleId: string,
  input: UpdateProcessingRuleInput,
  executor: Queryable = db
): Promise<ProcessingRuleRecord | null> {
  const fields: string[] = [];
  const values: Array<string | number | boolean | null> = [];

  if (input.speciesName !== undefined) {
    fields.push(`species_name = $${fields.length + 1}`);
    values.push(input.speciesName);
  }
  if (input.cutType !== undefined) {
    fields.push(`cut_type = $${fields.length + 1}`);
    values.push(input.cutType);
  }
  if (input.feeMode !== undefined) {
    fields.push(`fee_mode = $${fields.length + 1}`);
    values.push(input.feeMode);
  }
  if (input.feeAmount !== undefined) {
    fields.push(`fee_amount = $${fields.length + 1}`);
    values.push(input.feeAmount);
  }
  if (input.fulfillmentWarning !== undefined) {
    fields.push(`fulfillment_warning = $${fields.length + 1}`);
    values.push(input.fulfillmentWarning);
  }
  if (input.isActive !== undefined) {
    fields.push(`is_active = $${fields.length + 1}`);
    values.push(input.isActive);
  }

  if (fields.length === 0) {
    const current = await executor.query<ProcessingRuleRecord>(
      `
        select
          id,
          store_id,
          species_name,
          cut_type,
          fee_mode,
          fee_amount::text,
          fulfillment_warning,
          is_active,
          created_at::text,
          updated_at::text
        from processing_rules
        where id = $1
      `,
      [ruleId]
    );
    return current.rows[0] ?? null;
  }

  values.push(ruleId);

  const result = await executor.query<ProcessingRuleRecord>(
    `
      update processing_rules
      set
        ${fields.join(", ")},
        updated_at = now()
      where id = $${values.length}
      returning
        id,
        store_id,
        species_name,
        cut_type,
        fee_mode,
        fee_amount::text,
        fulfillment_warning,
        is_active,
        created_at::text,
        updated_at::text
    `,
    values
  );

  return result.rows[0] ?? null;
}
