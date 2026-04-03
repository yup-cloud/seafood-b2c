import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";
import { demoOrderStatus, demoStore } from "../data/demo";
import { api } from "../lib/api";
import { formatCurrency, formatDateTime, formatStatusLabel } from "../lib/format";
import { PublicOrderStatus } from "../types";

const statusFlow = ["pricing_pending", "waiting_payment", "ready_for_prep", "completed"];

export function CustomerStatusPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tokenInput, setTokenInput] = useState(searchParams.get("token") ?? "");
  const [order, setOrder] = useState<PublicOrderStatus | null>(null);
  const [message, setMessage] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const hasDirectLinkToken = Boolean(searchParams.get("token"));

  useEffect(() => {
    setTokenInput(searchParams.get("token") ?? "");
  }, [searchParams]);

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      return;
    }

    const requestedToken = token;

    let cancelled = false;

    async function load(silent = false) {
      if (!silent) {
        setRefreshing(true);
      }

      try {
        const nextOrder = await api.getPublicOrder(requestedToken);
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
    if (!tokenInput.trim()) {
      setMessage("주문 접수 후 보내드린 조회 토큰을 입력해주세요.");
      return;
    }

    setSearchParams({ token: tokenInput.trim() });
  }

  async function handleRefresh() {
    const token = searchParams.get("token");
    if (!token) {
      setMessage("조회 토큰을 먼저 입력해주세요.");
      return;
    }

    setRefreshing(true);
    try {
      const nextOrder = await api.getPublicOrder(token);
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
    <div className="page-content narrow-content">
      <section className="page-hero compact">
        <div>
          <p className="eyebrow-text">주문 상태 조회</p>
          <h1 className="page-title">주문 후 진행 상황을 한눈에 확인하세요</h1>
          <p className="page-description">
            금액 안내부터 입금 확인, 손질 준비, 출고 완료까지 링크 하나로 편하게 확인하실 수
            있어요.
          </p>
        </div>
      </section>

      <SectionCard title="조회 토큰 입력" subtitle="주문 접수 후 보내드린 조회 링크의 토큰 값을 입력해주세요.">
        {hasDirectLinkToken ? (
          <div className="notice-panel">
            <p>보내드린 링크로 바로 들어오셔서 주문 상태를 자동으로 불러오고 있어요.</p>
            <p>다른 주문을 조회하실 때만 아래 토큰 입력창을 이용하시면 됩니다.</p>
          </div>
        ) : null}
        <form className="inline-form" onSubmit={handleSubmit}>
          <input value={tokenInput} onChange={(event) => setTokenInput(event.target.value)} placeholder="받으신 조회 토큰을 입력해주세요" />
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
      </SectionCard>

      {order ? (
        <>
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
        </>
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
