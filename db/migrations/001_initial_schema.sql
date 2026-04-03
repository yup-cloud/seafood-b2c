create extension if not exists pgcrypto;

create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  name varchar(120) not null,
  business_name varchar(120),
  owner_name varchar(80),
  phone_primary varchar(30),
  phone_secondary varchar(30),
  address_line1 varchar(200),
  address_line2 varchar(200),
  bank_name varchar(80),
  bank_account varchar(80),
  bank_holder varchar(80),
  business_hours_note text,
  kakao_notice_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists store_contacts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  contact_type varchar(30) not null,
  contact_value varchar(255) not null,
  note varchar(255),
  is_active boolean not null default true
);

create table if not exists price_board_batches (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  board_date date not null,
  title varchar(150),
  status varchar(30) not null default 'draft',
  published_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, board_date)
);

create table if not exists price_board_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references price_board_batches(id) on delete cascade,
  item_name varchar(120) not null,
  origin_label varchar(120),
  size_band varchar(120),
  unit_price numeric(12,2),
  unit_label varchar(40) not null default 'kg',
  sale_status varchar(30) not null,
  reservable_flag boolean not null default false,
  reservation_cutoff_note varchar(255),
  note text,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create index if not exists idx_price_board_items_batch_status on price_board_items(batch_id, sale_status);
create index if not exists idx_price_board_items_batch_item on price_board_items(batch_id, item_name);

create table if not exists processing_rules (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  species_name varchar(120) not null,
  cut_type varchar(50) not null,
  fee_mode varchar(30) not null,
  fee_amount numeric(12,2),
  fulfillment_warning text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  order_no varchar(40) not null unique,
  public_token varchar(80) not null unique,
  order_status varchar(40) not null,
  pricing_status varchar(40) not null,
  payment_status varchar(40) not null,
  fulfillment_type varchar(40) not null,
  fulfillment_subtype varchar(40),
  fulfillment_status varchar(40) not null,
  purchase_unit varchar(30) not null,
  match_status varchar(40) not null,
  requested_date date,
  requested_time_slot varchar(60),
  requested_at_note varchar(120),
  is_reservation boolean not null default false,
  reservation_target_date date,
  item_hold_request_note text,
  customer_name varchar(80) not null,
  customer_phone varchar(30) not null,
  depositor_name varchar(80),
  receiver_name varchar(80),
  receiver_phone varchar(30),
  postal_code varchar(20),
  address_line1 varchar(200),
  address_line2 varchar(200),
  entrance_password varchar(50),
  customer_request text,
  internal_note text,
  source_channel varchar(40) not null default 'kakao_openchat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orders_status_date on orders(store_id, order_status, requested_date);
create index if not exists idx_orders_payment on orders(store_id, payment_status);
create index if not exists idx_orders_fulfillment on orders(store_id, fulfillment_status);
create index if not exists idx_orders_match on orders(store_id, match_status);
create index if not exists idx_orders_customer_phone on orders(customer_phone);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  item_name varchar(120) not null,
  origin_label varchar(120),
  size_band varchar(120),
  quantity numeric(12,3) not null,
  unit_label varchar(30) not null default 'kg',
  requested_cut_type varchar(50),
  packing_option varchar(80),
  unit_price numeric(12,2),
  estimated_total numeric(12,2),
  created_at timestamptz not null default now()
);

create table if not exists order_quotes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders(id) on delete cascade,
  item_subtotal numeric(12,2) not null,
  processing_fee_total numeric(12,2) not null default 0,
  delivery_fee_total numeric(12,2) not null default 0,
  discount_total numeric(12,2) not null default 0,
  final_amount numeric(12,2) not null,
  receipt_type_note varchar(120),
  payment_method_note varchar(120),
  quote_note text,
  quoted_by uuid,
  quoted_at timestamptz not null default now(),
  revised_count integer not null default 0
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders(id) on delete cascade,
  expected_amount numeric(12,2) not null,
  paid_amount numeric(12,2) not null default 0,
  payment_status varchar(40) not null,
  confirmed_by_mode varchar(20),
  confirmed_by_user_id uuid,
  confirmed_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id) on delete cascade,
  from_status varchar(40),
  to_status varchar(40) not null,
  reason varchar(120),
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists bank_transactions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  provider_name varchar(80),
  external_txn_id varchar(120),
  transaction_at timestamptz not null,
  depositor_name varchar(80),
  amount numeric(12,2) not null,
  currency varchar(10) not null default 'KRW',
  raw_payload jsonb,
  imported_at timestamptz not null default now()
);

create index if not exists idx_bank_transactions_store_time on bank_transactions(store_id, transaction_at desc);
create index if not exists idx_bank_transactions_amount_name on bank_transactions(store_id, amount, depositor_name);

create table if not exists payment_matches (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id) on delete cascade,
  bank_transaction_id uuid not null references bank_transactions(id) on delete cascade,
  match_status varchar(40) not null,
  match_score numeric(5,2),
  matched_by_mode varchar(20) not null,
  matched_by_user_id uuid,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists fulfillments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders(id) on delete cascade,
  fulfillment_type varchar(40) not null,
  fulfillment_subtype varchar(40),
  fulfillment_status varchar(40) not null,
  quick_request_time timestamptz,
  quick_dispatch_note text,
  parcel_tracking_no varchar(120),
  packing_note text,
  handed_off_at timestamptz,
  handed_off_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists match_groups (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  item_name varchar(120) not null,
  size_band varchar(120),
  target_date date,
  target_time_slot varchar(60),
  fulfillment_type varchar(40),
  match_status varchar(40) not null,
  matching_deadline_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists match_group_members (
  id uuid primary key default gen_random_uuid(),
  match_group_id uuid not null references match_groups(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  role varchar(20) not null,
  created_at timestamptz not null default now(),
  unique (match_group_id, order_id)
);

create table if not exists order_status_logs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  status_group varchar(30) not null,
  from_status varchar(40),
  to_status varchar(40) not null,
  reason varchar(255),
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  actor_user_id uuid,
  target_type varchar(40) not null,
  target_id uuid not null,
  action_type varchar(60) not null,
  payload jsonb,
  created_at timestamptz not null default now()
);
