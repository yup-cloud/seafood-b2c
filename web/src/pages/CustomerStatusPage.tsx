import { FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";
import { demoOrderStatus, demoStore } from "../data/demo";
import { api } from "../lib/api";
import { formatCurrency, formatDateTime, formatStatusLabel } from "../lib/format";
import { PublicOrderStatus } from "../types";

const statusFlow = ["pricing_pending", "waiting_payment", "ready_for_prep", "completed"];

export function CustomerStatusPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [orderNoInput, setOrderNoInput] = useState(searchParams.get("orderNo") ?? "");
  const [order, setOrder] = useState<PublicOrderStatus | null>(null);
  const [message, setMessage] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const hasDirectLinkToken = Boolean(searchParams.get("token"));

  useEffect(() => {
    setOrderNoInput(searchParams.get("orderNo") ?? "");
  }, [searchParams]);

  useEffect(() => {
    const token = searchParams.get("token");
    const orderNo = searchParams.get("orderNo");
    if (!token && !orderNo) {
      return;
    }

    const requestedToken = token;
    const requestedOrderNo = orderNo;

    let cancelled = false;

    async function load(silent = false) {
      if (!silent) {
        setRefreshing(true);
      }

      try {
        const nextOrder = requestedToken
          ? await api.getPublicOrder(requestedToken)
          : await api.getPublicOrderByOrderNo(requestedOrderNo ?? "");
        if (cancelled) {
          return;
        }
        setOrder(nextOrder);
        setMessage("");
        setLastUpdatedAt(new Date().toISOString());
      } catch {
        if (cancelled) {
          return;
        }
        setOrder(demoOrderStatus);
        setMessage("지금은 서비스 미리보기 화면으로 예시 주문 상태를 보여드리고 있어요.");
        setLastUpdatedAt(new Date().toISOString());
      } finally {
        if (!cancelled) {
          setRefreshing(false);
        }
      }
    }

    void load();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void load(true);
      }
    }, 30000);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void load(true);
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [searchParams]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orderNoInput.trim()) {
      setMessage("주문 후 안내받은 주문번호를 입력해주세요.");
      return;
    }

    setSearchParams({ orderNo: orderNoInput.trim().toUpperCase() });
  }

  async function handleRefresh() {
    const token = searchParams.get("token");
    const orderNo = searchParams.get("orderNo");
    if (!token && !orderNo) {
      setMessage("주문번호를 먼저 입력해주세요.");
      return;
    }

    setRefreshing(true);
    try {
      const nextOrder = token
        ? await api.getPublicOrder(token)
        : await api.getPublicOrderByOrderNo(orderNo ?? "");
      setOrder(nextOrder);
      setMessage("");
      setLastUpdatedAt(new Date().toISOString());
    } catch {
      setOrder(demoOrderStatus);
      setMessage("지금은 서비스 미리보기 화면으로 예시 주문 상태를 보여드리고 있어요.");
      setLastUpdatedAt(new Date().toISOString());
    } finally {
      setRefreshing(false);
    }
  }

  const currentStepIndex = order ? statusFlow.indexOf(order.order_status) : -1;

  return (
    <div className="page-content narrow-content status-page">
      <section className="page-hero compact">
        <div>
          <p className="eyebrow-text">주문 상태 조회</p>
          <h1 className="page-title">주문번호로 진행 상황을 바로 확인하세요</h1>
          <p className="page-description">금액 안내, 입금 확인, 준비 상태를 한 화면에서 확인하실 수 있어요.</p>
        </div>
      </section>

      <SectionCard title="주문번호 입력" subtitle="주문 후 안내받은 주문번호를 입력해주세요.">
        {hasDirectLinkToken ? (
          <div className="notice-panel">
            <p>보내드린 링크로 바로 들어오셔서 주문 상태를 자동으로 불러오고 있어요.</p>
            <p>다른 주문은 아래 주문번호로 다시 조회하실 수 있어요.</p>
          </div>
        ) : null}
        <form className="inline-form" onSubmit={handleSubmit}>
          <input
            value={orderNoInput}
            onChange={(event) => setOrderNoInput(event.target.value)}
            placeholder="예: OB-20260406-123456"
          />
          <button type="submit" className="primary-button">
            상태 확인하기
          </button>
        </form>
        {order ? (
          <div className="status-refresh-bar">
            <p>{lastUpdatedAt ? `최근 확인 ${formatDateTime(lastUpdatedAt)} · 30초마다 자동으로 새로고침돼요.` : "주문 상태를 불러오는 중이에요."}</p>
            <button type="button" className="secondary-button compact-button" onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? "새로 확인 중..." : "지금 다시 확인"}
            </button>
          </div>
        ) : null}
        {message ? <p className="helper-text">{message}</p> : null}
        <div className="inline-actions">
          <Link to="/customer/order?restoreRecent=1" className="secondary-button compact-button">
            같은 방식으로 다시 주문하기
          </Link>
        </div>
      </SectionCard>

      {order ? (
        <div className="status-section-stack">
          <SectionCard
            title={order.order_no}
            subtitle={order.next_step_message}
            action={<StatusBadge value={order.payment_status} />}
          >
            <div className="summary-grid">
              <div className="summary-tile">
                <span>현재 진행 단계</span>
                <strong>{formatStatusLabel(order.order_status)}</strong>
              </div>
              <div className="summary-tile">
                <span>안내드린 금액</span>
                <strong>{formatCurrency(order.quoted_amount)}</strong>
              </div>
              <div className="summary-tile">
                <span>전달 상태</span>
                <strong>{formatStatusLabel(order.fulfillment_status)}</strong>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="지금 어디까지 준비됐나요?" subtitle="주문이 어떤 단계에 있는지 차례대로 확인하실 수 있어요.">
            <ol className="timeline-list">
              {statusFlow.map((step, index) => {
                const stateClass =
                  index < currentStepIndex ? "done" : index === currentStepIndex ? "active" : "todo";
                return (
                  <li key={step} className={`timeline-step ${stateClass}`}>
                    <strong>{formatStatusLabel(step)}</strong>
                    <p>{resolveStepCopy(step)}</p>
                  </li>
                );
              })}
            </ol>
          </SectionCard>

          <SectionCard title="입금 안내" subtitle="최종 금액이 확정되면 아래 계좌로 입금해주시면 바로 확인해드려요.">
            <div className="bank-guide-card">
              <strong>{demoStore.name}</strong>
              <p>
                {order.bank_guide.bank_name} {order.bank_guide.bank_account}
              </p>
              <p>예금주 {order.bank_guide.bank_holder}</p>
            </div>
          </SectionCard>

          <SectionCard title="지금 내가 하면 되는 일" subtitle="주문 상태에 따라 가장 필요한 다음 행동만 간단하게 안내드릴게요.">
            <div className="support-grid">
              <div className="support-card">
                <strong>금액 안내 전 단계</strong>
                <p>품목 상태와 손질 조건을 확인 중이라면 조금만 기다려주세요. 보통 확인 후 순차적으로 안내드려요.</p>
              </div>
              <div className="support-card">
                <strong>입금 안내를 받으셨다면</strong>
                <p>입금 후 이 페이지를 새로 확인하시면 준비 상태가 업데이트돼요. 입금자명이 다르면 꼭 같이 알려주세요.</p>
              </div>
              <div className="support-card highlight">
                <strong>급하게 확인이 필요하신가요?</strong>
                <p>
                  진행이 오래 멈춘 것처럼 보이면 매장 연락처로 바로 확인하실 수 있어요.
                  {demoStore.phones[0] ? ` ${demoStore.phones[0]}` : ""}
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="자동 안내 예정 메시지" subtitle="실서비스에서는 아래 같은 안내가 순서대로 자동 발송되면 가장 체감이 커요.">
            <div className="support-grid">
              <div className="support-card">
                <strong>금액 안내 완료</strong>
                <p>
                  {order.order_no} 주문의 최종 금액이 확정되었어요. 확인 후 입금해주시면 바로 준비를 시작할게요.
                </p>
              </div>
              <div className="support-card">
                <strong>입금 확인 완료</strong>
                <p>
                  입금 확인이 끝나 손질과 포장을 시작했어요. 준비가 끝나면 수령 방식에 맞춰 다시 안내드릴게요.
                </p>
              </div>
              <div className="support-card highlight">
                <strong>출고 완료</strong>
                <p>
                  선택하신 방식으로 전달이 시작되었어요. 바로 드시는 회는 수령 후 2시간 내 섭취를 가장 권장드려요.
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="수령 후 보관 · 섭취 가이드" subtitle="받는 방식과 손질 상태에 따라 가장 무난한 보관 방법만 짧게 안내드릴게요.">
            <div className="support-grid">
              <div className="support-card">
                <strong>회 손질</strong>
                <p>가급적 수령 후 2시간 내 드시는 것을 권장드리고, 잠시 보관 시에는 냉장 보관해주세요.</p>
              </div>
              <div className="support-card">
                <strong>필렛 · 오로시</strong>
                <p>냉장 보관 후 당일 또는 다음날 빠르게 드시는 편이 가장 좋고, 진공포장은 이동과 보관이 조금 더 편해요.</p>
              </div>
              <div className="support-card">
                <strong>택배 수령</strong>
                <p>도착 즉시 냉장 상태를 먼저 확인하고, 장시간 상온 보관은 피하시는 게 좋아요.</p>
              </div>
            </div>
          </SectionCard>
        </div>
      ) : null}
    </div>
  );
}

function resolveStepCopy(step: string) {
  switch (step) {
    case "pricing_pending":
      return "품목 상태와 손질, 배송 조건을 확인한 뒤 정확한 금액을 안내드리고 있어요.";
    case "waiting_payment":
      return "최종 금액 안내가 완료되어 입금을 기다리고 있어요.";
    case "ready_for_prep":
      return "입금 확인이 끝나 정성껏 손질과 포장을 준비하고 있어요.";
    case "completed":
      return "선택하신 픽업, 퀵, 택배 방식으로 전달이 완료됐어요.";
    default:
      return "";
  }
}
