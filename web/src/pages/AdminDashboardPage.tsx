import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MetricCard } from "../components/MetricCard";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";
import { demoAdminOrders, demoFulfillments, demoPaymentReview, demoPriceBoard, demoStore } from "../data/demo";
import { api } from "../lib/api";
import { formatCurrency, formatDate, formatSourceModeLabel, formatStatusLabel } from "../lib/format";
import {
  AdminOrdersResponse,
  FulfillmentQueueItem,
  PaymentReviewItem,
  PriceBoardResponse,
  StoreInfo
} from "../types";

type NoticeTemplate = "compact" | "detailed" | "reservation";

export function AdminDashboardPage() {
  const [ordersResponse, setOrdersResponse] = useState<AdminOrdersResponse>(demoAdminOrders);
  const [reviewQueue, setReviewQueue] = useState<PaymentReviewItem[]>(demoPaymentReview);
  const [fulfillments, setFulfillments] = useState<FulfillmentQueueItem[]>(demoFulfillments);
  const [store, setStore] = useState<StoreInfo>(demoStore);
  const [board, setBoard] = useState<PriceBoardResponse>(demoPriceBoard);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [mode, setMode] = useState<"live" | "demo">("demo");
  const [noticeTemplate, setNoticeTemplate] = useState<NoticeTemplate>("compact");
  const [copyMessage, setCopyMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [nextOrders, nextReviews, nextFulfillments, nextStore, nextBoard] = await Promise.all([
          api.getAdminOrders(deferredSearch.trim() || undefined),
          api.getPaymentReviewQueue(),
          api.getFulfillments(),
          api.getStore(),
          api.getPriceBoard()
        ]);

        if (cancelled) {
          return;
        }

        setOrdersResponse(nextOrders);
        setReviewQueue(nextReviews.review_queue);
        setFulfillments(nextFulfillments.fulfillments);
        setStore(nextStore);
        setBoard(nextBoard);
        setMode("live");
      } catch {
        if (cancelled) {
          return;
        }

        const lowered = deferredSearch.trim().toLowerCase();
        const filteredOrders = !lowered
          ? demoAdminOrders.orders
          : demoAdminOrders.orders.filter((order) => {
              return (
                order.order_no.toLowerCase().includes(lowered) ||
                order.customer_name.toLowerCase().includes(lowered) ||
                (order.item_summary ?? "").toLowerCase().includes(lowered)
              );
            });

        setOrdersResponse({
          ...demoAdminOrders,
          orders: filteredOrders
        });
        setReviewQueue(demoPaymentReview);
        setFulfillments(demoFulfillments);
        setStore(demoStore);
        setBoard(demoPriceBoard);
        setMode("demo");
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [deferredSearch]);

  const waitingPaymentCount = ordersResponse.orders.filter((order) => order.payment_status === "unpaid").length;
  const prepCount = ordersResponse.orders.filter((order) => order.order_status === "ready_for_prep").length;
  const reservationCount = ordersResponse.orders.filter((order) => order.is_reservation).length;
  const noticeText = useMemo(
    () => buildKakaoNotice({
      template: noticeTemplate,
      board,
      store,
      orderUrl:
        typeof window === "undefined"
          ? "https://oneulbada.example/customer/order"
          : `${window.location.origin}/customer/order`
    }),
    [board, noticeTemplate, store]
  );

  async function handleCopyNotice() {
    try {
      await navigator.clipboard.writeText(noticeText);
      setCopyMessage("카톡 공지 문구를 복사했어요. 바로 붙여넣어 올리시면 됩니다.");
    } catch {
      setCopyMessage("자동 복사가 어려워 미리보기 문구를 직접 선택해 복사해주세요.");
    }
  }

  return (
    <div className="page-content">
      <section className="page-hero compact">
        <div>
          <p className="eyebrow-text">관리자 대시보드</p>
          <h1 className="page-title">당일 주문 운영 현황</h1>
          <p className="page-description">
            금액 안내, 입금 확인, 손질 준비, 출고 상태까지 한 화면에서 빠르게 이어서 처리합니다.
          </p>
        </div>
        <div className="hero-pills">
          <span className={`mode-badge ${mode}`}>{formatSourceModeLabel(mode)}</span>
          <input
            className="search-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="주문번호, 이름, 품목 검색"
          />
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard label="오늘 주문" value={`${ordersResponse.orders.length}건`} hint="검색 결과 기준" />
        <MetricCard label="미입금" value={`${waitingPaymentCount}건`} hint="출고 차단 대상" tone="amber" />
        <MetricCard label="손질 준비" value={`${prepCount}건`} hint="입금 확인 완료" tone="green" />
        <MetricCard label="예약 / 반절" value={`${reservationCount}건`} hint="예약 확보 및 매칭 확인" tone="red" />
      </section>

      <SectionCard
        title="카톡 공지 생성기"
        subtitle="오늘 시세와 주문 가이드를 카톡에 올리기 좋은 문장으로 바로 만들어드립니다."
      >
        <div className="choice-grid three">
          <button
            type="button"
            className={`choice-card${noticeTemplate === "compact" ? " active" : ""}`}
            onClick={() => setNoticeTemplate("compact")}
          >
            <strong>짧은 공지</strong>
            <span>핵심 시세와 주문 링크만 빠르게 올릴 때 좋아요.</span>
          </button>
          <button
            type="button"
            className={`choice-card${noticeTemplate === "detailed" ? " active" : ""}`}
            onClick={() => setNoticeTemplate("detailed")}
          >
            <strong>상세 공지</strong>
            <span>수령 방식과 주문 규칙까지 같이 안내할 때 좋아요.</span>
          </button>
          <button
            type="button"
            className={`choice-card${noticeTemplate === "reservation" ? " active" : ""}`}
            onClick={() => setNoticeTemplate("reservation")}
          >
            <strong>예약 강조 공지</strong>
            <span>예약 품목과 마감 시간을 강조하고 싶을 때 좋아요.</span>
          </button>
        </div>
        <div className="kakao-generator-card">
          <div className="summary-bar">
            <div>
              <strong>{formatDate(board.board_date)} 공지 미리보기</strong>
              <span>현재 시세판 기준으로 자동 생성된 카톡용 문구예요.</span>
            </div>
            <button type="button" className="primary-button compact-button" onClick={handleCopyNotice}>
              문구 복사하기
            </button>
          </div>
          <textarea className="kakao-notice-preview" value={noticeText} readOnly />
          {copyMessage ? <p className="helper-text">{copyMessage}</p> : null}
        </div>
      </SectionCard>

      <div className="split-layout admin-layout">
        <SectionCard title="주문 목록" subtitle="지금 가장 먼저 처리해야 할 주문">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>주문번호</th>
                  <th>주문자</th>
                  <th>품목</th>
                  <th>입금</th>
                  <th>출고</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {ordersResponse.orders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.order_no}</td>
                    <td>
                      <strong>{order.customer_name}</strong>
                      <p>{order.customer_phone}</p>
                    </td>
                    <td>
                      <strong>{order.item_summary ?? "-"}</strong>
                      <p>
                        {formatDate(order.requested_date)} · {order.requested_time_slot ?? "시간 미정"}
                      </p>
                    </td>
                    <td><StatusBadge value={order.payment_status} /></td>
                    <td><StatusBadge value={order.fulfillment_status} /></td>
                    <td>
                      <Link className="text-link" to={`/admin/orders/${order.id}`}>
                        상세 보기
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <div className="stacked-cards">
          <SectionCard title="입금 검토 큐" subtitle="자동 확정이 애매한 주문만 분리">
            <div className="stack-list">
              {reviewQueue.map((item) => (
                <div key={item.order_id} className="review-queue-card">
                  <div className="review-queue-head">
                    <div>
                      <strong>{item.order_no}</strong>
                      <p>{item.customer_name}</p>
                    </div>
                    <span className="mini-pill">{formatCurrency(item.expected_amount)}</span>
                  </div>
                  <p className="helper-text">{item.review_reason}</p>
                  {item.transaction_candidates.map((candidate) => (
                    <div key={candidate.id} className="candidate-chip">
                      <span>{candidate.depositor_name ?? "입금자 미상"}</span>
                      <strong>{formatCurrency(candidate.amount)}</strong>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="출고 대기" subtitle="방식별로 지금 인계가 필요한 주문">
            <div className="stack-list">
              {fulfillments.map((item) => (
                <div key={item.id} className="list-row">
                  <div>
                    <strong>{item.order_no}</strong>
                    <p>
                      {item.customer_name} · {formatStatusLabel(item.fulfillment_type)}
                    </p>
                  </div>
                  <div className="row-end">
                    <StatusBadge value={item.fulfillment_status} />
                    <small>{formatDate(item.requested_date)}</small>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function buildKakaoNotice(params: {
  template: NoticeTemplate;
  board: PriceBoardResponse;
  store: StoreInfo;
  orderUrl: string;
}) {
  const { template, board, store, orderUrl } = params;
  const availableItems = board.items
    .filter((item) => item.sale_status !== "sold_out")
    .map((item) => {
      const size = item.size_band ? ` ${item.size_band}` : "";
      const price = item.unit_price ? ` ${formatCurrency(item.unit_price)}` : " 가격 문의";
      const reservation = item.reservable_flag && item.sale_status === "reserved_only" ? " (예약 문의)" : "";
      return `- ${item.item_name}${size}${price}${reservation}`;
    });
  const soldOutItems = board.items
    .filter((item) => item.sale_status === "sold_out")
    .map((item) => item.item_name);
  const cutoffLines = (board.order_guide.cutoff_windows ?? []).map(
    (cutoff) => `- ${cutoff.label}: ${cutoff.cutoff_note}`
  );
  const linkLine = `주문 링크\n${orderUrl}`;
  const commonHeader = `[오늘바다 ${formatDate(board.board_date)} 시세 안내]`;

  if (template === "compact") {
    return [
      commonHeader,
      "",
      "오늘 준비 가능한 품목",
      ...availableItems,
      soldOutItems.length ? "" : null,
      soldOutItems.length ? `품절: ${soldOutItems.join(", ")}` : null,
      "",
      "주문 가능 방식",
      "- 매장 픽업",
      "- 퀵",
      "- 택배",
      "",
      linkLine
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (template === "reservation") {
    const reservableItems = board.items
      .filter((item) => item.reservable_flag)
      .map((item) => {
        const cutoff = item.reservation_cutoff_note ? ` / ${item.reservation_cutoff_note}` : "";
        return `- ${item.item_name}${cutoff}`;
      });

    return [
      commonHeader,
      "",
      "오늘 시세 / 예약 가능 품목",
      ...availableItems,
      "",
      "예약으로도 많이 문의주시는 품목",
      ...(reservableItems.length ? reservableItems : ["- 예약 가능 품목은 개별 확인 후 안내드립니다."]),
      "",
      "주문 마감 안내",
      ...(cutoffLines.length ? cutoffLines : ["- 마감 시간은 수령 방식에 따라 달라집니다."]),
      "",
      board.order_guide.reservation_deposit_policy ?? "예약 주문은 물건 확보를 위해 예약금 안내 후 진행됩니다.",
      "",
      `문의 및 픽업 위치\n${store.name} / ${store.address.line1 ?? "-"}`,
      "",
      linkLine
    ].join("\n");
  }

  return [
    commonHeader,
    "",
    "오늘 준비 가능한 품목",
    ...availableItems,
    soldOutItems.length ? "" : null,
    soldOutItems.length ? `오늘 품절: ${soldOutItems.join(", ")}` : null,
    "",
    "주문 전 참고해주세요",
    `- 픽업: ${board.order_guide.pickup_note}`,
    `- 퀵: ${board.order_guide.quick_note}`,
    `- 택배: ${board.order_guide.parcel_note}`,
    "",
    "손질 / 포장 안내",
    ...board.order_guide.processing_rules_summary.map((rule) => `- ${rule}`),
    "",
    board.order_guide.expected_price_note ?? "당일 시세와 손질비, 운임비를 반영해 최종 금액을 다시 안내드립니다.",
    "",
    `문의\n${store.phones[0] ?? "-"}`,
    "",
    linkLine
  ]
    .filter(Boolean)
    .join("\n");
}
