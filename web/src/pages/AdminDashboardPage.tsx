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
  const [pricePaste, setPricePaste] = useState("");
  const [parseMessage, setParseMessage] = useState("");
  const [isSavingBoard, setIsSavingBoard] = useState(false);
  const [parsedPreview, setParsedPreview] = useState<PriceBoardResponse | null>(null);

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
  const urgentOrders = useMemo(
    () =>
      ordersResponse.orders
        .map((order) => ({
          ...order,
          priorityScore:
            (order.payment_status === "unpaid" ? 4 : 0) +
            (order.order_status === "ready_for_prep" ? 3 : 0) +
            (order.match_status === "matching_waiting" ? 2 : 0) +
            (order.is_reservation ? 1 : 0)
        }))
        .sort((left, right) => right.priorityScore - left.priorityScore)
        .slice(0, 3),
    [ordersResponse.orders]
  );

  async function handleCopyNotice() {
    try {
      await navigator.clipboard.writeText(noticeText);
      setCopyMessage("카톡 공지 문구를 복사했어요. 바로 붙여넣어 올리시면 됩니다.");
    } catch {
      setCopyMessage("자동 복사가 어려워 미리보기 문구를 직접 선택해 복사해주세요.");
    }
  }

  async function handleCopyOrderGuide(orderNo: string, customerName: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage(`${orderNo} ${customerName} 고객 안내 문구를 복사했어요.`);
    } catch {
      setCopyMessage("자동 복사가 어려워 화면의 안내 문구를 직접 복사해주세요.");
    }
  }

  function handleParsePriceText() {
    const parsed = parsePriceBoardNotice(pricePaste, board.board_date);

    setParsedPreview({
      ...board,
      board_date: parsed.board_date,
      items: parsed.items
    });
    setBoard((current) => ({
      ...current,
      board_date: parsed.board_date,
      items: parsed.items
    }));
    setParseMessage(
      parsed.items.length
        ? `${parsed.items.length}개 품목을 추출했어요. 빠진 품목은 아래 미리보기에서 바로 확인해주세요.`
        : "가격이 들어간 품목을 아직 찾지 못했어요. 카톡 공지 전체를 다시 붙여넣어 주세요."
    );
  }

  async function handleApplyParsedBoard() {
    const source = parsedPreview ?? parsePriceBoardNotice(pricePaste, board.board_date);

    if (!source.items.length) {
      setParseMessage("먼저 카톡 시세표를 붙여넣고 자동 추출을 눌러주세요.");
      return;
    }

    setIsSavingBoard(true);
    setParseMessage("");

    try {
      const boardResponse = await api.getAdminPriceBoard(source.board_date);
      const batchResult = await api.upsertAdminPriceBoard({
        board_date: source.board_date,
        title: `${source.board_date} 시세표`
      });
      const batchId = batchResult.batch.id;
      const existingItems = boardResponse.items ?? [];
      const existingItemMap = new Map(
        existingItems.map((item) => [
          normalizeBoardItemKey(item.item_name, item.origin_label, item.size_band),
          item
        ])
      );
      const parsedKeys = new Set<string>();

      for (const [index, item] of source.items.entries()) {
        const itemKey = normalizeBoardItemKey(item.item_name, item.origin_label, item.size_band);
        parsedKeys.add(itemKey);
        const unitPriceNumber = item.unit_price ? Number(item.unit_price) : null;
        const payload = {
          item_name: item.item_name,
          origin_label: item.origin_label,
          size_band: item.size_band,
          unit_price: Number.isFinite(unitPriceNumber) ? unitPriceNumber : null,
          unit_label: item.unit_label ?? "kg",
          sale_status: item.sale_status,
          reservable_flag: item.reservable_flag,
          reservation_cutoff_note: item.reservation_cutoff_note ?? null,
          note: item.note ?? null,
          sort_order: (index + 1) * 10
        };
        const existing = existingItemMap.get(itemKey);

        if (existing?.id) {
          await api.patchAdminPriceBoardItem(existing.id, payload);
        } else {
          await api.createAdminPriceBoardItem({
            batch_id: batchId,
            ...payload
          });
        }
      }

      for (const item of existingItems) {
        const itemKey = normalizeBoardItemKey(item.item_name, item.origin_label, item.size_band);
        if (!parsedKeys.has(itemKey) && item.id) {
          await api.patchAdminPriceBoardItem(item.id, {
            sale_status: "sold_out",
            note: item.note ? `${item.note} / 이번 붙여넣기 기준 제외` : "이번 붙여넣기 기준 제외"
          });
        }
      }

      await api.publishAdminPriceBoard(batchId);
      setBoard(source);
      setParsedPreview(source);
      setParseMessage("오늘 시세로 반영했어요. 관리자/고객 화면에 같은 내용이 보이도록 게시까지 완료했습니다.");
      setMode("live");
    } catch {
      setParseMessage("자동 반영 중 문제가 있어요. 먼저 자동 추출 결과를 확인하고 다시 시도해주세요.");
    } finally {
      setIsSavingBoard(false);
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
        title="오늘 시세 빠른 입력"
        subtitle="카톡 공지 전체를 붙여넣으면 품목, 원산지, 중량대, kg당 가격을 자동으로 읽어드립니다."
      >
        <div className="kakao-generator-card">
          <textarea
            className="kakao-notice-preview tall"
            value={pricePaste}
            onChange={(event) => setPricePaste(event.target.value)}
            placeholder="카톡에 올린 오늘 시세표를 그대로 붙여넣어 주세요."
          />
          <div className="summary-bar wrap">
            <div>
              <strong>가장 편한 입력 방식</strong>
              <span>사장님이 원래 쓰던 카톡 시세표 형식을 그대로 붙여넣으면 됩니다.</span>
            </div>
            <div className="button-row">
              <button type="button" className="secondary-button compact-button" onClick={handleParsePriceText}>
                자동 추출
              </button>
              <button
                type="button"
                className="primary-button compact-button"
                onClick={handleApplyParsedBoard}
                disabled={isSavingBoard}
              >
                {isSavingBoard ? "반영 중..." : "오늘 시세로 반영"}
              </button>
            </div>
          </div>
          {parseMessage ? <p className="helper-text">{parseMessage}</p> : null}
        </div>
        <div className="import-preview-grid">
          {(parsedPreview?.items ?? board.items).slice(0, 8).map((item) => (
            <article key={`${item.item_name}-${item.size_band ?? "na"}`} className="import-preview-item">
              <div className="summary-bar">
                <strong>{item.item_name}</strong>
                <StatusBadge value={item.sale_status} />
              </div>
              <p>
                {(item.origin_label ?? "원산지 확인") + (item.size_band ? ` · ${item.size_band}` : "")}
              </p>
              <p>{item.unit_price ? `${formatCurrency(item.unit_price)}${item.unit_label === "kg" ? "/kg" : ""}` : "가격 확인 필요"}</p>
              {item.note ? <small>{item.note}</small> : null}
            </article>
          ))}
        </div>
      </SectionCard>

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

      <SectionCard
        title="지금 먼저 보면 좋은 주문"
        subtitle="입금, 손질, 반마리 매칭 상태를 기준으로 우선 순위를 먼저 추천해드릴게요."
      >
        <div className="support-grid">
          {urgentOrders.map((order) => {
            const quickGuide = buildOrderGuideMessage(order);

            return (
              <div key={order.id} className="support-card highlight">
                <strong>{order.order_no}</strong>
                <p>
                  {order.customer_name} · {order.item_summary ?? "품목 확인 필요"}
                </p>
                <p>{resolveUrgentReason(order)}</p>
                <div className="summary-bar">
                  <StatusBadge value={order.payment_status} />
                  <Link className="text-link" to={`/admin/orders/${order.id}`}>
                    상세 보기
                  </Link>
                </div>
                <textarea className="kakao-notice-preview small" value={quickGuide} readOnly />
                <button
                  type="button"
                  className="secondary-button compact-button"
                  onClick={() => handleCopyOrderGuide(order.order_no, order.customer_name, quickGuide)}
                >
                  고객 안내 문구 복사
                </button>
              </div>
            );
          })}
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

function normalizeBoardItemKey(itemName: string, originLabel?: string | null, sizeBand?: string | null) {
  return [itemName.trim(), originLabel?.trim() ?? "", sizeBand?.trim() ?? ""].join("::");
}

function parsePriceBoardNotice(text: string, fallbackDate: string): PriceBoardResponse {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const dateMatch = text.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})/);
  const boardDate = dateMatch
    ? `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`
    : fallbackDate;
  const items: PriceBoardResponse["items"] = [];
  let currentOrigin: string | null = null;
  let stopParsing = false;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\*|#/g, "").trim();

    if (/당일택배|입금계좌|회손질비용/i.test(line)) {
      stopParsing = true;
    }

    if (stopParsing) {
      continue;
    }

    if (/국내산|국산/.test(line)) currentOrigin = "국산";
    else if (/일본산/.test(line)) currentOrigin = "일본산";
    else if (/중국산/.test(line)) currentOrigin = "중국산";
    else if (/노르웨이/.test(line)) currentOrigin = "노르웨이";

    const priceMatch = line.match(/(\d{1,3}(?:[.,]\d{3})+)\s*원/);
    if (!priceMatch || !currentOrigin) {
      continue;
    }

    const unitPrice = priceMatch[1].replace(/[.,]/g, "");
    const left = line.slice(0, priceMatch.index).trim();
    const after = line.slice((priceMatch.index ?? 0) + priceMatch[0].length).trim();
    const sizeMatch = after.match(/\(([^)]+)\)/);
    const saleStatus = /품절|🚫/.test(line) ? "sold_out" : /예약판매|전날주문|예약/.test(line) ? "reserved_only" : "available";
    const reservableFlag = /예약|전날/.test(line);
    const cleanedName = left
      .replace(/^[S☆🐥🐧●♡@!~\s]+/u, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    if (!cleanedName || /서비스요금|주문주셔야/.test(cleanedName)) {
      continue;
    }

    items.push({
      item_name: cleanedName,
      origin_label: currentOrigin,
      size_band: sizeMatch?.[1]?.trim() ?? null,
      unit_price: unitPrice,
      unit_label: "kg",
      sale_status: saleStatus,
      reservable_flag: reservableFlag,
      reservation_cutoff_note: reservableFlag ? "예약 또는 전날 문의 필요" : "당일 문의 가능",
      note: after.replace(/\(([^)]+)\)/, "").trim() || null
    });
  }

  return {
    board_date: boardDate,
    items,
    order_guide: demoPriceBoard.order_guide
  };
}

function resolveUrgentReason(order: AdminOrdersResponse["orders"][number]) {
  if (order.payment_status === "unpaid") {
    return "최종 금액 안내 후 미입금 상태라 다음 단계가 멈춰 있어요. 빠르게 확인 안내를 보내는 게 좋아요.";
  }

  if (order.match_status === "matching_waiting") {
    return "반마리 또는 예약 매칭 대기 상태라 확인이 늦어지면 이탈 가능성이 커요.";
  }

  if (order.order_status === "ready_for_prep") {
    return "입금 확인이 끝난 주문이라 손질 준비 순서를 바로 잡아주는 게 좋아요.";
  }

  return "지금 처리 흐름을 한 번 더 확인해두면 안전한 주문이에요.";
}

function buildOrderGuideMessage(order: AdminOrdersResponse["orders"][number]) {
  if (order.payment_status === "unpaid") {
    return `[${order.order_no}] ${order.customer_name}님, 금액 안내가 완료되어 입금 확인 후 바로 준비를 시작할 수 있어요. 입금 후 이 메시지에 입금자명만 남겨주시면 더 빠르게 확인해드릴게요.`;
  }

  if (order.match_status === "matching_waiting") {
    return `[${order.order_no}] ${order.customer_name}님, 반마리/예약 매칭 여부를 확인 중이에요. 확인되는 대로 가능 여부와 금액을 먼저 안내드릴게요.`;
  }

  if (order.order_status === "ready_for_prep") {
    return `[${order.order_no}] ${order.customer_name}님, 입금 확인이 완료되어 지금 손질 준비에 들어가고 있어요. 준비가 끝나면 수령 방식에 맞춰 다시 안내드릴게요.`;
  }

  return `[${order.order_no}] ${order.customer_name}님, 주문 상태를 확인 중이며 변동이 있으면 바로 안내드릴게요.`;
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
      const price = item.unit_price
        ? ` ${formatCurrency(item.unit_price)}${item.unit_label === "kg" ? "/kg" : ""}`
        : " 가격 문의";
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
