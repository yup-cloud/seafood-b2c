import { Queryable, db } from "../../lib/db";
import { getDefaultStore } from "../stores/stores.service";

interface ReservationRecord {
  id: string;
  order_no: string;
  customer_name: string;
  customer_phone: string;
  reservation_target_date: string | null;
  requested_date: string | null;
  item_hold_request_note: string | null;
  order_status: string;
  payment_status: string;
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function listReservations(
  storeId: string,
  filters: Record<string, string>,
  executor: Queryable = db
): Promise<ReservationRecord[]> {
  const values: string[] = [storeId];
  const where = ["store_id = $1", "is_reservation = true"];

  if (filters.target_date) {
    values.push(filters.target_date);
    where.push(`reservation_target_date = $${values.length}`);
  }

  const result = await executor.query<ReservationRecord>(
    `
      select
        id,
        order_no,
        customer_name,
        customer_phone,
        reservation_target_date::text,
        requested_date::text,
        item_hold_request_note,
        order_status,
        payment_status
      from orders
      where ${where.join(" and ")}
      order by reservation_target_date asc nulls last, created_at desc
    `,
    values
  );

  return result.rows;
}

export async function getReservations(query: Record<string, unknown>) {
  const store = await getDefaultStore();
  const filters = {
    target_date: optionalString(query.target_date) ?? "",
    sale_status: optionalString(query.sale_status) ?? ""
  };

  return {
    filters: {
      target_date: filters.target_date || null,
      sale_status: filters.sale_status || null
    },
    reservations: await listReservations(store.id, filters)
  };
}
