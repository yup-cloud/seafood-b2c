import { Queryable, db } from "../../lib/db";

export interface PriceBoardBatchRecord {
  id: string;
  store_id: string;
  board_date: string;
  title: string | null;
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PriceBoardItemRecord {
  id: string;
  batch_id: string;
  item_name: string;
  origin_label: string | null;
  size_band: string | null;
  unit_price: string | null;
  unit_label: string;
  sale_status: string;
  reservable_flag: boolean;
  reservation_cutoff_note: string | null;
  note: string | null;
  sort_order: number;
  created_at: string;
}

export async function listPriceBoardBatches(
  storeId: string,
  date?: string,
  executor: Queryable = db
): Promise<PriceBoardBatchRecord[]> {
  const values: string[] = [storeId];
  const where = ["store_id = $1"];

  if (date) {
    values.push(date);
    where.push(`board_date = $${values.length}`);
  }

  const result = await executor.query<PriceBoardBatchRecord>(
    `
      select
        id,
        store_id,
        board_date::text,
        title,
        status,
        published_at::text,
        created_at::text,
        updated_at::text
      from price_board_batches
      where ${where.join(" and ")}
      order by board_date desc
      limit 30
    `,
    values
  );

  return result.rows;
}

export async function getPriceBoardBatchById(
  batchId: string,
  executor: Queryable = db
): Promise<PriceBoardBatchRecord | null> {
  const result = await executor.query<PriceBoardBatchRecord>(
    `
      select
        id,
        store_id,
        board_date::text,
        title,
        status,
        published_at::text,
        created_at::text,
        updated_at::text
      from price_board_batches
      where id = $1
    `,
    [batchId]
  );

  return result.rows[0] ?? null;
}

export async function getPublishedPriceBoardByDate(
  storeId: string,
  date: string,
  executor: Queryable = db
): Promise<PriceBoardBatchRecord | null> {
  const result = await executor.query<PriceBoardBatchRecord>(
    `
      select
        id,
        store_id,
        board_date::text,
        title,
        status,
        published_at::text,
        created_at::text,
        updated_at::text
      from price_board_batches
      where store_id = $1
        and board_date = $2
        and status = 'published'
      limit 1
    `,
    [storeId, date]
  );

  return result.rows[0] ?? null;
}

export async function getLatestPublishedPriceBoard(
  storeId: string,
  executor: Queryable = db
): Promise<PriceBoardBatchRecord | null> {
  const result = await executor.query<PriceBoardBatchRecord>(
    `
      select
        id,
        store_id,
        board_date::text,
        title,
        status,
        published_at::text,
        created_at::text,
        updated_at::text
      from price_board_batches
      where store_id = $1
        and status = 'published'
      order by board_date desc, published_at desc nulls last, updated_at desc
      limit 1
    `,
    [storeId]
  );

  return result.rows[0] ?? null;
}

export async function getPriceBoardItems(batchId: string, executor: Queryable = db): Promise<PriceBoardItemRecord[]> {
  const result = await executor.query<PriceBoardItemRecord>(
    `
      select
        id,
        batch_id,
        item_name,
        origin_label,
        size_band,
        unit_price::text,
        unit_label,
        sale_status,
        reservable_flag,
        reservation_cutoff_note,
        note,
        sort_order,
        created_at::text
      from price_board_items
      where batch_id = $1
      order by sort_order asc, item_name asc
    `,
    [batchId]
  );

  return result.rows;
}

export async function upsertPriceBoardBatch(
  storeId: string,
  boardDate: string,
  title: string | null,
  executor: Queryable = db
): Promise<PriceBoardBatchRecord> {
  const existing = await executor.query<PriceBoardBatchRecord>(
    `
      select
        id,
        store_id,
        board_date::text,
        title,
        status,
        published_at::text,
        created_at::text,
        updated_at::text
      from price_board_batches
      where store_id = $1
        and board_date = $2
      limit 1
    `,
    [storeId, boardDate]
  );

  if (existing.rows[0]) {
    const updated = await executor.query<PriceBoardBatchRecord>(
      `
        update price_board_batches
        set
          title = $1,
          updated_at = now()
        where id = $2
        returning
          id,
          store_id,
          board_date::text,
          title,
          status,
          published_at::text,
          created_at::text,
          updated_at::text
      `,
      [title, existing.rows[0].id]
    );
    return updated.rows[0];
  }

  const inserted = await executor.query<PriceBoardBatchRecord>(
    `
      insert into price_board_batches (
        store_id,
        board_date,
        title,
        status
      )
      values ($1, $2, $3, 'draft')
      returning
        id,
        store_id,
        board_date::text,
        title,
        status,
        published_at::text,
        created_at::text,
        updated_at::text
    `,
    [storeId, boardDate, title]
  );

  return inserted.rows[0];
}

export interface CreatePriceBoardItemInput {
  batchId: string;
  itemName: string;
  originLabel?: string | null;
  sizeBand?: string | null;
  unitPrice?: number | null;
  unitLabel?: string;
  saleStatus: string;
  reservableFlag?: boolean;
  reservationCutoffNote?: string | null;
  note?: string | null;
  sortOrder?: number;
}

export async function createPriceBoardItem(
  input: CreatePriceBoardItemInput,
  executor: Queryable = db
): Promise<PriceBoardItemRecord> {
  const result = await executor.query<PriceBoardItemRecord>(
    `
      insert into price_board_items (
        batch_id,
        item_name,
        origin_label,
        size_band,
        unit_price,
        unit_label,
        sale_status,
        reservable_flag,
        reservation_cutoff_note,
        note,
        sort_order
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      returning
        id,
        batch_id,
        item_name,
        origin_label,
        size_band,
        unit_price::text,
        unit_label,
        sale_status,
        reservable_flag,
        reservation_cutoff_note,
        note,
        sort_order,
        created_at::text
    `,
    [
      input.batchId,
      input.itemName,
      input.originLabel ?? null,
      input.sizeBand ?? null,
      input.unitPrice ?? null,
      input.unitLabel ?? "kg",
      input.saleStatus,
      input.reservableFlag ?? false,
      input.reservationCutoffNote ?? null,
      input.note ?? null,
      input.sortOrder ?? 100
    ]
  );

  return result.rows[0];
}

export interface UpdatePriceBoardItemInput {
  itemName?: string;
  originLabel?: string | null;
  sizeBand?: string | null;
  unitPrice?: number | null;
  unitLabel?: string;
  saleStatus?: string;
  reservableFlag?: boolean;
  reservationCutoffNote?: string | null;
  note?: string | null;
  sortOrder?: number;
}

export async function updatePriceBoardItem(
  itemId: string,
  input: UpdatePriceBoardItemInput,
  executor: Queryable = db
): Promise<PriceBoardItemRecord | null> {
  const fields: string[] = [];
  const values: Array<string | number | boolean | null> = [];

  if (input.itemName !== undefined) {
    fields.push(`item_name = $${fields.length + 1}`);
    values.push(input.itemName);
  }
  if (input.originLabel !== undefined) {
    fields.push(`origin_label = $${fields.length + 1}`);
    values.push(input.originLabel);
  }
  if (input.sizeBand !== undefined) {
    fields.push(`size_band = $${fields.length + 1}`);
    values.push(input.sizeBand);
  }
  if (input.unitPrice !== undefined) {
    fields.push(`unit_price = $${fields.length + 1}`);
    values.push(input.unitPrice);
  }
  if (input.unitLabel !== undefined) {
    fields.push(`unit_label = $${fields.length + 1}`);
    values.push(input.unitLabel);
  }
  if (input.saleStatus !== undefined) {
    fields.push(`sale_status = $${fields.length + 1}`);
    values.push(input.saleStatus);
  }
  if (input.reservableFlag !== undefined) {
    fields.push(`reservable_flag = $${fields.length + 1}`);
    values.push(input.reservableFlag);
  }
  if (input.reservationCutoffNote !== undefined) {
    fields.push(`reservation_cutoff_note = $${fields.length + 1}`);
    values.push(input.reservationCutoffNote);
  }
  if (input.note !== undefined) {
    fields.push(`note = $${fields.length + 1}`);
    values.push(input.note);
  }
  if (input.sortOrder !== undefined) {
    fields.push(`sort_order = $${fields.length + 1}`);
    values.push(input.sortOrder);
  }

  if (fields.length === 0) {
    const current = await executor.query<PriceBoardItemRecord>(
      `
        select
          id,
          batch_id,
          item_name,
          origin_label,
          size_band,
          unit_price::text,
          unit_label,
          sale_status,
          reservable_flag,
          reservation_cutoff_note,
          note,
          sort_order,
          created_at::text
        from price_board_items
        where id = $1
      `,
      [itemId]
    );

    return current.rows[0] ?? null;
  }

  values.push(itemId);

  const result = await executor.query<PriceBoardItemRecord>(
    `
      update price_board_items
      set ${fields.join(", ")}
      where id = $${values.length}
      returning
        id,
        batch_id,
        item_name,
        origin_label,
        size_band,
        unit_price::text,
        unit_label,
        sale_status,
        reservable_flag,
        reservation_cutoff_note,
        note,
        sort_order,
        created_at::text
    `,
    values
  );

  return result.rows[0] ?? null;
}

export async function publishPriceBoardBatch(
  batchId: string,
  executor: Queryable = db
): Promise<PriceBoardBatchRecord | null> {
  const result = await executor.query<PriceBoardBatchRecord>(
    `
      update price_board_batches
      set
        status = 'published',
        published_at = now(),
        updated_at = now()
      where id = $1
      returning
        id,
        store_id,
        board_date::text,
        title,
        status,
        published_at::text,
        created_at::text,
        updated_at::text
    `,
    [batchId]
  );

  return result.rows[0] ?? null;
}
