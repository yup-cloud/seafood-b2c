import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";
import { demoHalfOrderDemands, demoPriceBoard, demoStore } from "../data/demo";
import { api, isNetworkError } from "../lib/api";
import { formatCurrency, formatDate, formatItemName, formatProcessingRuleSummary } from "../lib/format";
import { PriceBoardResponse, StoreInfo } from "../types";

function splitProcessingRule(rule: string) {
  const formatted = formatProcessingRuleSummary(rule);
  const [label, ...detailParts] = formatted.split(":");

  return {
    label: label.trim(),
    detail: detailParts.join(":").trim() || "주문 내용 확인 후 안내"
  };
}

function resolveBoardDateLabel(boardDate: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" });
  const today = formatter.format(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = formatter.format(yesterdayDate);

  if (boardDate === today) return "오늘";
  if (boardDate === yesterday) return "어제";
  return formatDate(boardDate);
}

export function HomePage() {
  const [store, setStore] = useState<StoreInfo>(demoStore);
  const [board, setBoard] = useState<PriceBoardResponse>(demoPriceBoard);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [refreshMessage, setRefreshMessage] = useState("");
  const cutoffWindows = board.order_guide.cutoff_windows ?? [
    { fulfillment_type: "pickup", label: "매장 픽업", cutoff_note: board.order_guide.pickup_note },
    { fulfillment_type: "quick", label: "퀵 수령", cutoff_note: board.order_guide.quick_note },
    { fulfillment_type: "parcel", label: "택배 수령", cutoff_note: board.order_guide.parcel_note }
  ];
  const boardDateLabel = resolveBoardDateLabel(board.board_date);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) {
        setRefreshing(true);
      }
      try {
        const [nextStore, nextBoard] = await Promise.all([api.getStore(), api.getPriceBoard()]);
        setStore(nextStore);
        setBoard(nextBoard);
        setRefreshMessage("");
        setLastUpdatedAt(new Date());
      } catch (error) {
        setStore(demoStore);
        setBoard(demoPriceBoard);
        setRefreshMessage(
          isNetworkError(error)
            ? "인터넷 연결이 불안정해 최근 예시 시세를 표시하고 있습니다."
            : "실시간 시세를 불러오지 못해 예시 시세를 표시하고 있습니다."
        );
        setLastUpdatedAt(new Date());
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    let cancelled = false;

    async function loadSafely(silent = false) {
      if (cancelled) return;
      await load(silent);
    }

    void loadSafely();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadSafely(true);
      }
    }, 60000);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void loadSafely(true);
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [load]);

  return (
    <div className="page-content">
      <section className="hero-card">
        <div className="hero-card-copy">
          <p className="eyebrow-text">오늘바다</p>
          <h1 className="hero-title">
            좋은 생선을 고르는 일,
            <br />
            주문까지 편안해야 하니까
          </h1>
          <p className="hero-description">
            당일 시세를 먼저 확인하고, 손질부터 픽업·퀵·택배까지 원하는 방식으로 주문할 수 있습니다.
          </p>
          <div className="inline-actions home-cta-row">
            <Link to="/customer/order" className="primary-button">
              오늘 시세 보고 주문
            </Link>
            <Link to="/customer/status" className="secondary-button">
              내 주문 확인
            </Link>
          </div>
        </div>
        <div className="hero-card-side">
          <div className="hero-store-card">
            <strong>{store.name}</strong>
            {store.address.line1 ? <p>{store.address.line1}</p> : null}
            {store.business_hours_note ? <p>{store.business_hours_note}</p> : null}
            <div className="hero-store-meta">
              {store.phones[0] ? (
                <a href={`tel:${store.phones[0]}`} className="phone-link">
                  {store.phones[0]}
                </a>
              ) : null}
              <span>픽업 · 퀵 · 택배 가능</span>
            </div>
          </div>
        </div>
      </section>

      <SectionCard
        title="오늘 주문 안내"
        subtitle={`${boardDateLabel} 기준 주문 가능한 품목과 수령 안내입니다.`}
      >
        <div className="cutoff-grid">
          {cutoffWindows.map((cutoff) => (
            <article key={cutoff.fulfillment_type} className="cutoff-card">
              <p className="cutoff-card-label">{cutoff.label}</p>
              <strong>{cutoff.cutoff_note}</strong>
            </article>
          ))}
        </div>
        <div className="trust-strip">
          <div>
            <strong>당일 주문</strong>
            <p>{board.order_guide.expected_price_note ?? "당일 시세, 손질비, 운임을 확인한 뒤 정확한 금액을 안내합니다."}</p>
          </div>
          <div>
            <strong>예약 주문</strong>
            <p>{board.order_guide.reservation_deposit_policy ?? "예약 주문은 확보 가능 여부를 먼저 확인한 뒤 진행합니다."}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="반마리 요청 현황"
        subtitle="한 마리가 부담스러운 품목은 현재 요청 흐름을 보고 바로 반마리로 문의할 수 있습니다."
        action={<Link to="/customer/order?half=1" className="text-link">반마리 주문하기</Link>}
      >
        <div className="half-demand-grid">
          {demoHalfOrderDemands.map((demand) => (
            <Link
              key={demand.id}
              className="half-demand-card clickable-card"
              to={`/customer/order?half=1&item=${encodeURIComponent(demand.item_name)}`}
            >
              <div className="half-demand-head">
                <div>
                  <strong>{formatItemName(demand.item_name)}</strong>
                  <p>
                    {demand.origin_label ?? "원산지 확인"} · {demand.size_band ?? "크기 확인"}
                  </p>
                </div>
                <StatusBadge value="half_request" />
              </div>
              <div className="half-demand-meta">
                <span>{demand.waiting_count}팀 문의 중</span>
                <span>{demand.fulfillment_hint}</span>
                <span>{demand.urgency_label}</span>
              </div>
              {demand.unit_price ? (
                <strong className="half-demand-price">
                  {formatCurrency(demand.unit_price)} / kg
                </strong>
              ) : null}
              {demand.note ? <p className="half-demand-note">{demand.note}</p> : null}
            </Link>
          ))}
        </div>
      </SectionCard>

      <div className="split-layout">
        <SectionCard
          title="오늘 준비 가능한 품목"
          subtitle="원하시는 생선과 시세를 먼저 보고, 바로 주문서에 담아 시작할 수 있습니다."
          action={
            <div className="button-row">
              <button
                type="button"
                className="secondary-button compact-button"
                onClick={() => void load()}
                disabled={refreshing}
              >
                {refreshing ? "확인 중..." : "지금 확인"}
              </button>
              <Link to="/customer/order" className="text-link">주문서 바로가기</Link>
            </div>
          }
        >
          <div className="stack-list">
            {lastUpdatedAt ? (
              <p className="field-hint">
                최근 확인 {lastUpdatedAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            ) : null}
            {refreshMessage ? <p className="helper-text">{refreshMessage}</p> : null}
            {initialLoading ? (
              <>
                <div className="skeleton" style={{ height: "68px", borderRadius: "20px" }} />
                <div className="skeleton" style={{ height: "68px", borderRadius: "20px" }} />
                <div className="skeleton" style={{ height: "68px", borderRadius: "20px" }} />
              </>
            ) : board.items.length ? (
              board.items.map((item) => (
                <div key={item.id ?? item.item_name} className="list-row">
                  <div>
                    <strong>{formatItemName(item.item_name)}</strong>
                    <p>
                      {item.origin_label ?? "원산지 미지정"} · {item.size_band ?? "규격 미지정"}
                    </p>
                    {item.reservable_flag && item.sale_status === "reserved_only" && item.reservation_cutoff_note ? (
                      <small className="reservation-hint">예약 안내: {item.reservation_cutoff_note}</small>
                    ) : null}
                  </div>
                  <div className="row-end">
                    <strong>
                      {formatCurrency(item.unit_price)}
                      {item.unit_label === "kg" ? " / kg" : ""}
                    </strong>
                    <StatusBadge value={item.sale_status} />
                    {item.sale_status !== "sold_out" ? (
                      <div className="list-row-action-stack">
                        <Link
                          className="secondary-button compact-button list-row-action"
                          to={`/customer/order?item=${encodeURIComponent(item.item_name)}`}
                        >
                          이 품목 주문
                        </Link>
                        <Link
                          className="text-link"
                          to={`/customer/order?item=${encodeURIComponent(item.item_name)}&half=1`}
                        >
                          반마리 문의
                        </Link>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-board-state">
                <p>오늘 시세를 준비 중입니다.</p>
                <p>잠시 후 다시 확인하거나, 예약 주문으로 원하는 품목을 먼저 남길 수 있습니다.</p>
                <Link to="/customer/order?flow=reservation" className="secondary-button compact-button">
                  예약 주문 남기기
                </Link>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="처음 주문할 때 확인할 내용"
          subtitle="실제 문의가 많은 내용을 중심으로 간단히 정리했습니다."
        >
          <div className="stack-list">
            <div className="list-row">
              <div>
                <strong>시세를 먼저 확인합니다</strong>
                <p>오늘 기준 단가를 확인한 뒤 주문할 수 있습니다. 손질비와 운임은 주문 내용에 맞춰 별도로 안내합니다.</p>
              </div>
            </div>
            <div className="list-row">
              <div>
                <strong>주문번호로 진행 상황을 확인합니다</strong>
                <p>금액 안내부터 손질 준비, 출고 완료까지 주문 후에도 직접 확인할 수 있습니다.</p>
              </div>
            </div>
            <div className="list-row">
              <div>
                <strong>픽업, 퀵, 택배 중 선택합니다</strong>
                <p>당일 섭취 여부와 이동 거리에 따라 적합한 수령 방식을 선택할 수 있습니다.</p>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* ✅ 개선: 손질비 안내 섹션 – 주문 전 비용 투명하게 공개 */}
      {board.order_guide.processing_rules_summary.length > 0 && (
        <SectionCard
          title="손질 비용 안내"
          subtitle="원물 가격 외에 추가되는 손질비 기준입니다. 주문 전 참고해 주세요."
        >
          <div className="processing-fee-grid">
            {board.order_guide.processing_rules_summary.map((rule) => {
              const formattedRule = splitProcessingRule(rule);

              return (
                <div key={rule} className="processing-fee-chip">
                  <strong>{formattedRule.label}</strong>
                  <span>{formattedRule.detail}</span>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      <SectionCard
        title="자주 묻는 질문"
        subtitle="처음 주문할 때 자주 확인하는 내용을 짧게 정리했습니다."
      >
        <div className="support-grid">
          <div className="support-card">
            <strong>어떤 손질을 골라야 할지 모르겠어요</strong>
            <p>처음 주문한다면 포 뜨기를 권장합니다. 이동이나 보관이 비교적 편합니다.</p>
          </div>
          <div className="support-card">
            <strong>주문하면 언제 연락이 오나요?</strong>
            <p>보통 주문서 확인 후 10~20분 안에 금액 또는 진행 가능 여부를 안내합니다.</p>
          </div>
          <div className="support-card">
            <strong>한 마리가 부담스러우면 어떻게 하나요?</strong>
            <p>반마리 주문으로 남기면 가능한 품목을 확인한 뒤 매칭 가능 여부를 안내합니다.</p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
