import { ChangeEvent, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MetricCard } from "../components/MetricCard";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";
import { demoAdminOrders, demoFulfillments, demoPaymentReview, demoPriceBoard, demoStore } from "../data/demo";
import { api } from "../lib/api";
import { formatCurrency, formatDate, formatItemName, formatItemNote, formatSourceModeLabel, formatStatusLabel } from "../lib/format";
import {
  AdminOrdersResponse,
  FulfillmentQueueItem,
  PaymentReviewItem,
  PriceBoardResponse,
  StoreInfo
} from "../types";

type NoticeTemplate = "compact" | "detailed" | "reservation";

const priceItemStatuses = [
  { value: "available", label: "판매중" },
  { value: "reserved_only", label: "예약문의" },
  { value: "sold_out", label: "품절" }
];

// ✅ 개선: 확인 모달 컴포넌트
interface ConfirmDialogProps {
  title: string;
  body: string | React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

function ConfirmDialog({ title, body, confirmLabel, onConfirm, onCancel, loading }: ConfirmDialogProps) {
  return (
    <div className="confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="confirm-panel">
        <h2 className="confirm-panel-title" id="confirm-title">{title}</h2>
        <p className="confirm-panel-body">{body}</p>
        <div className="confirm-actions">
          <button type="button" className="secondary-button compact-button" onClick={onCancel} disabled={loading}>
            취소
          </button>
          <button type="button" className="primary-button compact-button" onClick={onConfirm} disabled={loading}>
            {loading ? "처리 중..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const [isLoadingPreviousBoard, setIsLoadingPreviousBoard] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // ✅ 버그 수정: refreshKey로 수동 새로고침 트리거
  const [refreshKey, setRefreshKey] = useState(0);
  // ✅ 개선: 오늘 시세 반영 전 확인 다이얼로그
  const [showApplyConfirm, setShowApplyConfirm] = useState(false);
  const loadRef = useRef<((silent?: boolean) => Promise<void>) | null>(null);

  // ✅ 버그 수정: load 함수를 useCallback으로 분리하여 직접 호출 가능하게 함
  const loadData = useCallback(
    async (silent = false) => {
      if (!silent) setIsRefreshing(true);
      try {
        const [nextOrders, nextReviews, nextFulfillments, nextStore, nextBoard] = await Promise.all([
          api.getAdminOrders(deferredSearch.trim() || undefined),
          api.getPaymentReviewQueue(),
          api.getFulfillments(),
          api.getStore(),
          api.getPriceBoard()
        ]);

        setOrdersResponse(nextOrders);
        setReviewQueue(nextReviews.review_queue);
        setFulfillments(nextFulfillments.fulfillments);
        setStore(nextStore);
        setBoard(nextBoard);
        setMode("live");
        setLastRefreshed(new Date());
      } catch {
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

        setOrdersResponse({ ...demoAdminOrders, orders: filteredOrders });
        setReviewQueue(demoPaymentReview);
        setFulfillments(demoFulfillments);
        setStore(demoStore);
        setBoard(demoPriceBoard);
        setMode("demo");
        setLastRefreshed(new Date());
      } finally {
        setIsRefreshing(false);
      }
    },
    [deferredSearch]
  );

  // loadRef에 최신 loadData 저장 (interval 등에서 stale closure 방지)
  loadRef.current = loadData;

  useEffect(() => {
    let cancelled = false;

    async function load(silent = false) {
      if (cancelled) return;
      await loadData(silent);
    }

    void load();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadRef.current?.(true);
    }, 60000);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") void loadRef.current?.(true);
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferredSearch, refreshKey]);

  // ✅ 개선: 복사 메시지 4초 후 자동 소멸
  useEffect(() => {
    if (!copyMessage) return;
    const timer = setTimeout(() => setCopyMessage(""), 4000);
    return () => clearTimeout(timer);
  }, [copyMessage]);

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
  const matchAndReservationOrders = useMemo(
    () =>
      ordersResponse.orders
        .filter((order) => order.match_status === "matching_waiting" || order.is_reservation)
        .slice(0, 6),
    [ordersResponse.orders]
  );
  const workQueueCount = waitingPaymentCount + prepCount + reviewQueue.length + fulfillments.length;

  function scrollToAdminSection(sectionId: string) {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  // ✅ 버그 수정: refreshKey 증가로 useEffect를 실제로 재실행
  function handleManualRefresh() {
    setRefreshKey((prev) => prev + 1);
  }

  async function handleCopyNotice() {
    try {
      await navigator.clipboard.writeText(noticeText);
      setCopyMessage("카톡 공지 문구를 복사했습니다. 바로 붙여넣어 사용할 수 있습니다.");
    } catch {
      setCopyMessage("자동 복사가 되지 않았습니다. 미리보기 문구를 직접 선택해 복사해 주세요.");
    }
  }

  async function handleCopyOrderGuide(orderNo: string, customerName: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage(`${orderNo} ${customerName} 고객 안내 문구를 복사했습니다.`);
    } catch {
      setCopyMessage("자동 복사가 되지 않았습니다. 화면의 안내 문구를 직접 복사해 주세요.");
    }
  }

  function handleParsePriceText() {
    const parsed = parsePriceBoardNotice(pricePaste, getKoreaTodayDate());

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
        ? `${parsed.items.length}개 품목을 추출했습니다. 빠진 품목은 아래 미리보기에서 확인해 주세요.`
        : "가격이 들어간 품목을 찾지 못했습니다. 카톡 공지 전체를 다시 붙여넣어 주세요."
    );
  }

  function handlePreviewItemChange(
    itemIndex: number,
    field: keyof PriceBoardResponse["items"][number],
    value: string | boolean
  ) {
    setParsedPreview((current) => {
      const base = current ?? {
        ...board,
        items: [...board.items]
      };
      const nextItems = [...base.items];
      const nextItem = { ...nextItems[itemIndex] };

      if (field === "reservable_flag" && typeof value === "boolean") {
        nextItem.reservable_flag = value;
      } else if (typeof value === "string") {
        if (field === "sale_status") {
          nextItem.sale_status = value;
        } else if (field === "item_name") {
          nextItem.item_name = formatItemName(value);
        } else if (field === "origin_label") {
          nextItem.origin_label = value || null;
        } else if (field === "size_band") {
          nextItem.size_band = value || null;
        } else if (field === "unit_price") {
          nextItem.unit_price = value || null;
        } else if (field === "note") {
          nextItem.note = formatItemNote(value) || null;
        } else if (field === "reservation_cutoff_note") {
          nextItem.reservation_cutoff_note = value || null;
        }
      }

      nextItems[itemIndex] = nextItem;
      return {
        ...base,
        items: nextItems
      };
    });
  }

  function handleRemovePreviewItem(itemIndex: number) {
    setParsedPreview((current) => {
      const base = current ?? {
        ...board,
        items: [...board.items]
      };

      return {
        ...base,
        items: base.items.filter((_, index) => index !== itemIndex)
      };
    });
  }

  async function handleLoadPreviousBoard() {
    const todayDate = getKoreaTodayDate();
    const previousDate = toDateOffset(todayDate, -1);
    setIsLoadingPreviousBoard(true);
    setParseMessage("");

    try {
      const previous = await api.getAdminPriceBoard(previousDate);
      if (!previous.items.length) {
        setParseMessage("어제 시세가 아직 등록되지 않았습니다. 카톡 시세표 붙여넣기로 시작해 주세요.");
        return;
      }

      const previousBoard: PriceBoardResponse = {
        ...board,
        board_date: todayDate,
        items: previous.items
      };

      setParsedPreview(previousBoard);
      setBoard(previousBoard);
      setParseMessage("어제 시세를 불러왔습니다. 변경된 품목만 수정한 뒤 오늘 시세로 반영하면 됩니다.");
    } catch {
      setParseMessage("어제 시세를 불러오지 못했습니다. 카톡 시세표 붙여넣기 방식으로 진행해 주세요.");
    } finally {
      setIsLoadingPreviousBoard(false);
    }
  }

  // ✅ 개선: 확인 버튼 클릭 시 모달 표시
  function handleRequestApply() {
    const source = parsedPreview ?? (pricePaste.trim() ? parsePriceBoardNotice(pricePaste, getKoreaTodayDate()) : null);
    if (!source || !source.items.length) {
      setParseMessage("먼저 카톡 시세표를 붙여넣고 자동 추출을 눌러 주세요.");
      return;
    }
    setShowApplyConfirm(true);
  }

  async function handleApplyParsedBoard() {
    const source =
      parsedPreview ??
      (pricePaste.trim()
        ? parsePriceBoardNotice(pricePaste, getKoreaTodayDate())
        : {
            ...board,
            board_date: getKoreaTodayDate()
          });

    if (!source.items.length) {
      setParseMessage("먼저 카톡 시세표를 붙여넣고 자동 추출을 눌러 주세요.");
      return;
    }

    setIsSavingBoard(true);
    setShowApplyConfirm(false);
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
          normalizeBoardItemKey(formatItemName(item.item_name), item.origin_label, item.size_band),
          item
        ])
      );
      const parsedKeys = new Set<string>();

      for (const [index, item] of source.items.entries()) {
        const itemKey = normalizeBoardItemKey(formatItemName(item.item_name), item.origin_label, item.size_band);
        parsedKeys.add(itemKey);
        const unitPriceNumber = item.unit_price ? Number(item.unit_price) : null;
        const payload = {
          item_name: formatItemName(item.item_name),
          origin_label: item.origin_label,
          size_band: item.size_band,
          unit_price: Number.isFinite(unitPriceNumber) ? unitPriceNumber : null,
          unit_label: item.unit_label ?? "kg",
          sale_status: item.sale_status,
          reservable_flag: item.reservable_flag,
          reservation_cutoff_note: item.reservation_cutoff_note ?? null,
          note: formatItemNote(item.note) || null,
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
        const itemKey = normalizeBoardItemKey(formatItemName(item.item_name), item.origin_label, item.size_band);
        if (!parsedKeys.has(itemKey) && item.id) {
          const itemNote = formatItemNote(item.note);
          await api.patchAdminPriceBoardItem(item.id, {
            sale_status: "sold_out",
            note: itemNote ? `${itemNote} / 이번 붙여넣기 기준 제외` : "이번 붙여넣기 기준 제외"
          });
        }
      }

      await api.publishAdminPriceBoard(batchId);
      setBoard(source);
      setParsedPreview(source);
      setParseMessage("오늘 시세로 반영했습니다. 관리자와 고객 화면에 같은 내용이 보이도록 게시가 완료되었습니다.");
      setMode("live");
    } catch {
      setParseMessage("자동 반영 중 문제가 발생했습니다. 자동 추출 결과를 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setIsSavingBoard(false);
    }
  }

  return (
    <div className="page-content">
      {/* ✅ 개선: 오늘 시세 반영 확인 다이얼로그 */}
      {showApplyConfirm ? (
        <ConfirmDialog
          title="오늘 시세로 반영할까요?"
          body={
            <>
              <strong>{(parsedPreview ?? board).items.length}개 품목</strong>이 고객 화면에 즉시 반영됩니다.
              기존 시세와 다른 품목은 자동으로 업데이트되고, 이번에 없는 품목은 품절로 처리됩니다.
              반영 후에는 되돌리기 어려우니 미리보기를 한 번 더 확인해 주세요.
            </>
          }
          confirmLabel="지금 반영하기"
          onConfirm={() => { void handleApplyParsedBoard(); }}
          onCancel={() => setShowApplyConfirm(false)}
          loading={isSavingBoard}
        />
      ) : null}

      <section className="page-hero compact">
        <div>
          <p className="eyebrow-text">관리자 대시보드</p>
          <h1 className="page-title">오늘 운영은 여기서 끝내세요</h1>
          <p className="page-description">
            시세표 등록, 주문 확인, 입금/출고 처리, 카톡 공지를 매일 같은 순서로 처리할 수 있게 정리했습니다.
          </p>
        </div>
        <div className="hero-pills">
          <span className={`mode-badge ${mode}`}>{formatSourceModeLabel(mode)}</span>
          <div className="search-bar-wrap">
            <input
              className="search-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="주문번호, 이름, 품목 검색"
              aria-label="주문 검색"
            />
            {search ? (
              <button type="button" className="search-clear-button" onClick={() => setSearch("")} aria-label="검색어 지우기">×</button>
            ) : null}
          </div>
          {/* ✅ 버그 수정: 실제로 새로고침 트리거 */}
          <button
            type="button"
            className={`secondary-button compact-button${isRefreshing ? " loading" : ""}`}
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            aria-label="데이터 새로고침"
          >
            {isRefreshing ? "갱신 중..." : "↻ 새로고침"}
          </button>
          {lastRefreshed ? (
            <span className="refresh-hint" aria-live="polite">
              {lastRefreshed.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 갱신
            </span>
          ) : null}
        </div>
      </section>

      <section className="admin-command-center">
        <button type="button" className="admin-command-card primary" onClick={() => scrollToAdminSection("admin-price-input")}>
          <span>1</span>
          <strong>오늘 시세 올리기</strong>
          <p>카톡 시세표를 붙여넣고 자동 추출합니다.</p>
        </button>
        <button type="button" className="admin-command-card" onClick={() => scrollToAdminSection("admin-match-queue")}>
          <span>2</span>
          <strong>반마리/예약 큐</strong>
          <p>{matchAndReservationOrders.length}건 가능 여부 확인</p>
        </button>
        <button type="button" className="admin-command-card" onClick={() => scrollToAdminSection("admin-order-queue")}>
          <span>3</span>
          <strong>입금·출고 처리</strong>
          <p>총 {workQueueCount}건 처리 흐름 확인</p>
        </button>
        <button type="button" className="admin-command-card" onClick={() => scrollToAdminSection("admin-kakao-notice")}>
          <span>4</span>
          <strong>카톡 공지 복사</strong>
          <p>시세 반영 후 공지 문구를 바로 복사합니다.</p>
        </button>
      </section>

      <section className="metric-grid">
        <MetricCard label="오늘 접수" value={`${ordersResponse.orders.length}건`} hint="검색 결과 기준" />
        <MetricCard label="입금 대기" value={`${waitingPaymentCount}건`} hint="먼저 안내 필요" tone="amber" />
        <MetricCard label="준비 시작" value={`${prepCount}건`} hint="손질 순서 확인" tone="green" />
        <MetricCard label="예약/반마리" value={`${reservationCount}건`} hint="확보·매칭 확인" tone="red" />
      </section>

      <SectionCard
        id="admin-price-input"
        className="admin-primary-section"
        title="오늘 시세 빠른 입력"
        subtitle="카톡 공지 전체를 그대로 붙여넣고 자동 추출만 누르세요. 틀린 품목만 아래에서 고치면 됩니다."
      >
        <div className="kakao-generator-card">
          {/* ✅ 개선: 붙여넣기 형식 힌트 */}
          <div className="paste-guide-chips">
            <span className="paste-guide-chip">국내산 / 일본산 / 중국산 / 노르웨이</span>
            <span className="paste-guide-chip">품목명 + 가격 포함 라인 자동 인식</span>
            <span className="paste-guide-chip">품절 · 예약 판매 상태 자동 분류</span>
          </div>
          <textarea
            className="kakao-notice-preview tall"
            value={pricePaste}
            onChange={(event) => setPricePaste(event.target.value)}
            placeholder="카톡에 올린 오늘 시세표를 그대로 붙여넣어 주세요."
            aria-label="카톡 시세 붙여넣기"
          />
          <div className="summary-bar wrap">
            <div>
              <strong>가장 편한 입력 방식</strong>
              <span>사장님이 원래 쓰던 카톡 시세표 형식을 그대로 붙여넣으면 됩니다.</span>
            </div>
            <div className="button-row">
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={handleLoadPreviousBoard}
                disabled={isLoadingPreviousBoard}
              >
                {isLoadingPreviousBoard ? "불러오는 중..." : "어제 시세 불러오기"}
              </button>
              <button type="button" className="secondary-button compact-button" onClick={handleParsePriceText}>
                자동 추출
              </button>
              {/* ✅ 개선: 반영 전 확인 모달 */}
              <button
                type="button"
                className="primary-button compact-button"
                onClick={handleRequestApply}
                disabled={isSavingBoard}
              >
                {isSavingBoard ? "반영 중..." : "오늘 시세로 반영"}
              </button>
            </div>
          </div>
          <div className="notice-panel customer-sync-notice">
            <strong>고객 화면 반영 방식</strong>
            <p>
              오늘 시세로 반영하면 고객 홈과 주문 화면의 어종 선택 목록에 바로 적용됩니다. 고객 화면은 열려 있어도
              최대 60초 안에 새 시세를 다시 불러옵니다.
            </p>
          </div>
          {parseMessage ? <p className="helper-text" aria-live="polite">{parseMessage}</p> : null}
        </div>
        <div className="import-preview-grid">
          {(parsedPreview?.items ?? board.items).map((item, index) => (
            <article key={`${item.item_name}-${item.size_band ?? "na"}-${index}`} className="import-preview-item editable">
              <div className="summary-bar">
                <strong>품목 {index + 1}</strong>
                <button
                  type="button"
                  className="text-link danger"
                  onClick={() => handleRemovePreviewItem(index)}
                  aria-label={`${formatItemName(item.item_name)} 삭제`}
                >
                  삭제
                </button>
              </div>
              <label className="field-block compact">
                <span>품목명</span>
                <input
                  value={formatItemName(item.item_name)}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    handlePreviewItemChange(index, "item_name", event.target.value)
                  }
                />
              </label>
              <div className="inline-fields">
                <label className="field-block compact">
                  <span>원산지</span>
                  <input
                    value={item.origin_label ?? ""}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      handlePreviewItemChange(index, "origin_label", event.target.value)
                    }
                  />
                </label>
                <label className="field-block compact">
                  <span>중량대</span>
                  <input
                    value={item.size_band ?? ""}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      handlePreviewItemChange(index, "size_band", event.target.value)
                    }
                  />
                </label>
              </div>
              <div className="inline-fields">
                <label className="field-block compact">
                  <span>kg당 가격</span>
                  <input
                    inputMode="numeric"
                    value={item.unit_price ?? ""}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      handlePreviewItemChange(index, "unit_price", event.target.value.replace(/[^\d]/g, ""))
                    }
                  />
                </label>
                <label className="field-block compact">
                  <span>상태</span>
                  <select
                    value={item.sale_status}
                    onChange={(event) => handlePreviewItemChange(index, "sale_status", event.target.value)}
                  >
                    <option value="available">판매중</option>
                    <option value="reserved_only">예약문의</option>
                    <option value="sold_out">품절</option>
                  </select>
                </label>
              </div>
              {/* ✅ 개선: 상태 버튼 – 시각적으로 현재 상태 강조 */}
              <div className="status-button-row">
                {priceItemStatuses.map((status) => (
                  <button
                    key={status.value}
                    type="button"
                    className={`status-mini-button${item.sale_status === status.value ? " active" : ""}`}
                    onClick={() => handlePreviewItemChange(index, "sale_status", status.value)}
                  >
                    {status.label}
                  </button>
                ))}
              </div>
              <label className="field-block compact">
                <span>메모</span>
                <input
                    value={formatItemNote(item.note)}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    handlePreviewItemChange(index, "note", event.target.value)
                  }
                />
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={item.reservable_flag}
                  onChange={(event) =>
                    handlePreviewItemChange(index, "reservable_flag", event.target.checked)
                  }
                />
                <span>예약/전날 문의 품목</span>
              </label>
              <small>
                {item.unit_price
                  ? `${formatCurrency(item.unit_price)}${item.unit_label === "kg" ? "/kg" : ""}`
                  : "가격 확인 필요"}
              </small>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        id="admin-kakao-notice"
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
            <span>핵심 시세와 주문 링크만 빠르게 올릴 때 사용합니다.</span>
          </button>
          <button
            type="button"
            className={`choice-card${noticeTemplate === "detailed" ? " active" : ""}`}
            onClick={() => setNoticeTemplate("detailed")}
          >
            <strong>상세 공지</strong>
            <span>수령 방식과 주문 규칙까지 함께 안내할 때 사용합니다.</span>
          </button>
          <button
            type="button"
            className={`choice-card${noticeTemplate === "reservation" ? " active" : ""}`}
            onClick={() => setNoticeTemplate("reservation")}
          >
            <strong>예약 강조 공지</strong>
            <span>예약 품목과 마감 시간을 강조할 때 사용합니다.</span>
          </button>
        </div>
        <div className="kakao-generator-card">
          <div className="summary-bar">
            <div>
              <strong>{formatDate(board.board_date)} 공지 미리보기</strong>
              <span>현재 시세표 기준으로 자동 생성된 카톡용 문구입니다.</span>
            </div>
            <button type="button" className="primary-button compact-button" onClick={handleCopyNotice}>
              문구 복사하기
            </button>
          </div>
          <textarea className="kakao-notice-preview" value={noticeText} readOnly aria-label="카톡 공지 미리보기" />
          {copyMessage ? <p className="helper-text" aria-live="polite">{copyMessage}</p> : null}
        </div>
      </SectionCard>

      <SectionCard
        id="admin-match-queue"
        title="반마리/예약 확인 큐"
        subtitle="반마리 매칭, 예약 품목 확보처럼 고객 이탈이 빨리 생기는 주문만 따로 모았습니다."
      >
        <div className="support-grid compact-grid">
          {matchAndReservationOrders.length ? (
            matchAndReservationOrders.map((order) => (
              <div key={order.id} className="support-card match-queue-card">
                <div className="summary-bar">
                  <strong>{order.order_no}</strong>
                  <StatusBadge value={order.match_status} />
                </div>
                <p>
                  {order.customer_name} · {order.item_summary ?? "품목 확인 필요"}
                </p>
                <div className="match-queue-tags">
                  {order.is_reservation ? <span>예약</span> : null}
                  {order.match_status === "matching_waiting" ? <span>반마리</span> : null}
                  <span>{formatStatusLabel(order.fulfillment_type)}</span>
                </div>
                <Link className="primary-button compact-button" to={`/admin/orders/${order.id}`}>
                  가능 여부 처리
                </Link>
              </div>
            ))
          ) : (
            <div className="empty-order-card">현재 확인 대기 중인 반마리/예약 주문이 없습니다.</div>
          )}
        </div>
      </SectionCard>

      <SectionCard
        id="admin-priority-orders"
        title="지금 먼저 보면 좋은 주문"
        subtitle="입금, 손질, 반마리 매칭 상태를 기준으로 우선순위를 정리합니다."
      >
        <div className="support-grid">
          {urgentOrders.map((order) => {
            const quickGuide = buildOrderGuideMessage(order);

            return (
              <div key={order.id} className="support-card highlight">
                <div className="summary-bar">
                  <strong>{order.order_no}</strong>
                  {/* ✅ 개선: 우선순위 시각화 */}
                  <span className="priority-dot" aria-label="우선 처리 필요" />
                </div>
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
                <textarea className="kakao-notice-preview small" value={quickGuide} readOnly aria-label={`${order.order_no} 안내 문구`} />
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

      <div id="admin-order-queue" className="split-layout admin-layout">
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
                    <td>
                      <strong>{order.order_no}</strong>
                    </td>
                    <td>
                      <strong>{order.customer_name}</strong>
                      <p>
                        <a href={`tel:${order.customer_phone}`} className="phone-link">
                          {order.customer_phone}
                        </a>
                      </p>
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
              {reviewQueue.length ? (
                reviewQueue.map((item) => (
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
                ))
              ) : (
                <p className="helper-text">현재 검토 대기 중인 입금 건이 없습니다.</p>
              )}
            </div>
          </SectionCard>

          <SectionCard title="출고 대기" subtitle="방식별로 지금 인계가 필요한 주문">
            <div className="stack-list">
              {fulfillments.length ? (
                fulfillments.map((item) => (
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
                ))
              ) : (
                <p className="helper-text">현재 출고 대기 중인 주문이 없습니다.</p>
              )}
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
    const cleanedName = formatItemName(
      left
        .replace(/^[☆🐥🐧●♡@!~\s]+/u, "")
        .replace(/\s{2,}/g, " ")
        .trim()
    );

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
      note: formatItemNote(after.replace(/\(([^)]+)\)/, "").trim()) || null
    });
  }

  return {
    board_date: boardDate,
    items,
    order_guide: demoPriceBoard.order_guide
  };
}

function toDateOffset(dateText: string, offsetDays: number) {
  const [year, month, day] = dateText.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + offsetDays);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getKoreaTodayDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul"
  }).format(new Date());
}

function resolveUrgentReason(order: AdminOrdersResponse["orders"][number]) {
  if (order.payment_status === "unpaid") {
    return "최종 금액 안내 후 미입금 상태라 다음 단계가 멈춰 있습니다. 빠르게 확인 안내를 보내는 것이 좋습니다.";
  }

  if (order.match_status === "matching_waiting") {
    return "반마리 또는 예약 매칭 대기 상태라 확인이 늦어지면 이탈 가능성이 큽니다.";
  }

  if (order.order_status === "ready_for_prep") {
    return "입금 확인이 완료된 주문입니다. 손질 준비 순서를 바로 지정하는 것이 좋습니다.";
  }

  return "처리 흐름을 한 번 더 확인하면 안전한 주문입니다.";
}

function buildOrderGuideMessage(order: AdminOrdersResponse["orders"][number]) {
  if (order.payment_status === "unpaid") {
    return `[${order.order_no}] ${order.customer_name}님, 금액 안내가 완료되었습니다. 입금 확인 후 바로 준비를 시작합니다. 입금 후 이 메시지에 입금자명을 남겨주시면 더 빠르게 확인할 수 있습니다.`;
  }

  if (order.match_status === "matching_waiting") {
    return `[${order.order_no}] ${order.customer_name}님, 반마리/예약 매칭 여부를 확인 중입니다. 확인되는 대로 가능 여부와 금액을 먼저 안내합니다.`;
  }

  if (order.order_status === "ready_for_prep") {
    return `[${order.order_no}] ${order.customer_name}님, 입금 확인이 완료되어 손질 준비를 시작했습니다. 준비가 끝나면 수령 방식에 맞춰 다시 안내합니다.`;
  }

  return `[${order.order_no}] ${order.customer_name}님, 주문 상태를 확인 중입니다. 변동 사항이 있으면 바로 안내합니다.`;
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
      return `- ${formatItemName(item.item_name)}${size}${price}${reservation}`;
    });
  const soldOutItems = board.items
    .filter((item) => item.sale_status === "sold_out")
    .map((item) => formatItemName(item.item_name));
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
        return `- ${formatItemName(item.item_name)}${cutoff}`;
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
    "주문 전 참고해 주세요",
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
