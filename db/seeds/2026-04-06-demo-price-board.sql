begin;

with target_store as (
  select id
  from stores
  order by created_at asc
  limit 1
)
update stores
set
  name = '데모수산',
  phone_primary = '010-0000-0000',
  phone_secondary = '010-1111-2222',
  address_line1 = '수산시장 데모동 00호',
  address_line2 = '방문 포장비 없음 · 필렛 진공포장 가능',
  bank_name = '데모은행',
  bank_account = '000-0000-0000',
  bank_holder = '데모수산',
  business_hours_note = '월~금 05:00~18:00 / 토 05:00~19:00 / 일 07:00~17:00',
  updated_at = now()
where id in (select id from target_store);

with target_store as (
  select id
  from stores
  order by created_at asc
  limit 1
),
upserted_batch as (
  insert into price_board_batches (
    store_id,
    board_date,
    title,
    status,
    published_at
  )
  select
    id,
    date '2026-04-06',
    '2026-04-06 데모수산 시세표',
    'published',
    now()
  from target_store
  on conflict (store_id, board_date)
  do update set
    title = excluded.title,
    status = 'published',
    published_at = now(),
    updated_at = now()
  returning id
)
delete from price_board_items
where batch_id in (select id from upserted_batch);

with batch as (
  select id
  from price_board_batches
  where board_date = date '2026-04-06'
  order by created_at desc
  limit 1
)
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
select
  batch.id,
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
from batch
cross join (
  values
    ('자연산 광어', '국산', '3~5kg', 22000, 'kg', 'available', true, '반반 주문 가능 / 상태 최상급', 'SSSS · 정품 최상급 낚시바리', 10),
    ('자연산 도다리', '국산', '1~1.5kg', 20000, 'kg', 'available', true, '전화·문자 문의 우선', 'S · 상태 좋음', 20),
    ('자연산 감성돔 (목포)', '국산', '1.3~1.5kg', 20000, 'kg', 'available', true, '전화·문자 문의 우선', 'SS · 상태 최강', 30),
    ('광어 (제주 · 2.8~3.2kg)', '국산', '2.8~3.2kg', 30000, 'kg', 'available', true, '당일 문의 가능', 'SS · 정품 상태 최강', 40),
    ('광어 (제주 · 2~2.5kg)', '국산', '2~2.5kg', 28000, 'kg', 'available', true, '당일 문의 가능', 'S · 정품 상태 최강', 50),
    ('완도전복', '국산', '10~11미', 24000, 'kg', 'available', true, '당일 문의 가능', 'SS · 정품 상태 최강', 60),
    ('돌돔 (일본산 · 2kg급)', '일본산', '2kg', 90000, 'kg', 'available', true, '고가 어종 / 예약 문의 권장', 'SSSSS · 기스 없는 최상급', 70),
    ('돌돔 (일본산 · 1.6~1.8kg)', '일본산', '1.6~1.8kg', 85000, 'kg', 'available', true, '고가 어종 / 예약 문의 권장', 'SSSS · 기스 없는 최상급', 80),
    ('능성어 (일본산)', '일본산', '3.5~4kg', 40000, 'kg', 'available', true, '당일 문의 가능', 'SS · 정품 상태 최강', 90),
    ('잿방어 (일본산)', '일본산', '4.5kg', 30000, 'kg', 'available', true, '당일 문의 가능', 'SS · 정품 상태 최강', 100),
    ('참돔 (일본산 · 2.5~3kg)', '일본산', '2.5~3kg', 25000, 'kg', 'available', true, '당일 문의 가능', 'SSS · 정품 상태 최강', 110),
    ('참돔 (일본산 · 2kg 이하)', '일본산', '2kg', 20000, 'kg', 'available', true, '당일 문의 가능', 'S · 정품 상태 최강', 120),
    ('감성돔 (중국산)', '중국산', '1kg', 23000, 'kg', 'available', true, '당일 문의 가능', 'SS · 정품 상태 최강', 130),
    ('농어 (중국산)', '중국산', '3~3.5kg', 23000, 'kg', 'available', true, '당일 문의 가능', 'S · 정품 상태 최강', 140),
    ('연어 (노르웨이 · 예약판매)', '노르웨이', '6~8kg', 23000, 'kg', 'reserved_only', true, '전날 주문 / 반마리는 전날 매칭 시 진행', '최상급 · 마리 단위 예약 판매', 150)
) as items(
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
);

with target_store as (
  select id
  from stores
  order by created_at asc
  limit 1
)
delete from processing_rules
where store_id in (select id from target_store);

with target_store as (
  select id
  from stores
  order by created_at asc
  limit 1
)
insert into processing_rules (
  store_id,
  species_name,
  cut_type,
  fee_mode,
  fee_amount,
  fulfillment_warning,
  is_active
)
select
  target_store.id,
  species_name,
  cut_type,
  fee_mode,
  fee_amount,
  fulfillment_warning,
  true
from target_store
cross join (
  values
    ('공통', 'fillet', 'kg당', 2000, '오로시(필렛) 작업비'),
    ('공통', 'sashimi', 'kg당', 4000, '회 작업은 픽업 또는 퀵 권장'),
    ('도미류', 'masukawa', 'kg당', 5000, '껍질 작업은 어종 상태에 따라 조정 가능'),
    ('공통', 'raw', '개별문의', null, '작은 생선은 마리당 작업비가 추가될 수 있음')
) as rules(
  species_name,
  cut_type,
  fee_mode,
  fee_amount,
  fulfillment_warning
);

commit;
