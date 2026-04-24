import { FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";
import { demoOrderStatus, demoStore } from "../data/demo";
import { api } from "../lib/api";
import { formatCurrency, formatDateTime, formatStatusLabel } from "../lib/format";
import { PublicOrderStatus } from "../types";

const statusFlow = ["pricing_pending", "waiting_payment", "ready_for_prep", "completed"];

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!copied) {
    throw new Error("copy_failed");
  }
}

async function shareOrderLink(shareUrl: string, orderNo: string) {
  if (navigator.share) {
    await navigator.share({
      title: `오늘바다 주문 ${orderNo}`,
      text: `주문번호 ${orderNo} 진행 상황 확인 링크입니다.`,
      url: shareUrl
    });
    return "shared";
  }

  await copyTextToClipboard(shareUrl);
  return "copied";
}

export function CustomerStatusPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [orderNoInput, setOrderNoInput] = useState(searchParams.get("orderNo") ?? "");
  const [activeOrderNo, setActiveOrderNo] = useState(searchParams.get("orderNo") ?? "");
  const [activeToken, setActiveToken] = useState(searchParams.get("token") ?? "");
  const [order, setOrder] = useState<PublicOrderStatus | null>(null);
  const [message, setMessage] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  // ✅ 개선: 데모 상태 여부를 별도로 추적
  const [isDemo, setIsDemo] = useState(false);
  const [isSubmittedView] = useState(searchParams.get("submitted") === "1");
  const hasDirectLinkToken = Boolean(activeToken);

  useEffect(() => {
    const token = searchParams.get("token");
    const orderNo = searchParams.get("orderNo");
    if (token) {
      setActiveToken(token);
    }
    if (orderNo) {
      setActiveOrderNo(orderNo);
      setOrderNoInput(orderNo);
      setSearchParams(token ? { token } : {}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!activeToken && !activeOrderNo) {
      return;
    }

    let cancelled = false;

    async function load(silent = false) {
      if (!silent) {
        setRefreshing(true);
      }

      try {
        const nextOrder = activeToken
          ? await api.getPublicOrder(activeToken)
          : await api.getPublicOrderByOrderNo(activeOrderNo);
        if (cancelled) return;
        setOrder(nextOrder);
        setIsDemo(false);
        setMessage("");
        setLastUpdatedAt(new Date().toISOString());
      } catch {
        if (cancelled) return;
        setOrder(demoOrderStatus);
        setIsDemo(true);
        setMessage("서비스 미리보기 화면입니다. 예시 주문 상태가 표시됩니다.");
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
  }, [activeOrderNo, activeToken]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orderNoInput.trim()) {
      setMessage("주문 후 안내받은 주문번호를 입력해 주세요.");
      return;
    }
    const normalizedOrderNo = orderNoInput.trim().toUpperCase();
    setActiveToken("");
    setActiveOrderNo(normalizedOrderNo);
    setOrderNoInput(normalizedOrderNo);
    setSearchParams({}, { replace: true });
    setMessage("");
  }

  async function handleRefresh() {
    if (!activeToken && !activeOrderNo) {
      setMessage("주문번호를 먼저 입력해 주세요.");
      return;
    }

    setRefreshing(true);
    try {
      const nextOrder = activeToken
        ? await api.getPublicOrder(activeToken)
        : await api.getPublicOrderByOrderNo(activeOrderNo);
      setOrder(nextOrder);
      setIsDemo(false);
      setMessage("");
      setLastUpdatedAt(new Date().toISOString());
    } catch {
      setOrder(demoOrderStatus);
      setIsDemo(true);
      setMessage("서비스 미리보기 화면입니다. 예시 주문 상태가 표시됩니다.");
      setLastUpdatedAt(new Date().toISOString());
    } finally {
      setRefreshing(false);
    }
  }

  async function handleCopyBankAccount() {
    if (!order) return;
    const bankGuide = order.bank_guide;
    const copyText = `${bankGuide.bank_name} ${bankGuide.bank_account} 예금주 ${bankGuide.bank_holder}`;
    try {
      await copyTextToClipboard(copyText);
      setCopyMessage("계좌번호를 복사했습니다.");
    } catch {
      setCopyMessage("자동 복사가 되지 않았습니다. 계좌번호를 직접 길게 눌러 복사해 주세요.");
    }
  }

  async function handleShareOrder() {
    const shareTarget = activeToken
      ? `${window.location.origin}/customer/status?token=${encodeURIComponent(activeToken)}`
      : activeOrderNo
        ? `${window.location.origin}/customer/status?orderNo=${encodeURIComponent(activeOrderNo)}`
        : "";

    if (!shareTarget) {
      setShareMessage("공유할 주문번호가 없습니다.");
      return;
    }

    try {
      const result = await shareOrderLink(shareTarget, activeOrderNo || order?.order_no || "주문");
      setShareMessage(
        result === "shared"
          ? "주문 조회 링크를 공유했습니다."
          : "주문 조회 링크를 복사했습니다."
      );
    } catch {
      setShareMessage("공유가 취소되었거나 자동 복사가 되지 않았습니다.");
    }
  }

  const currentStepIndex = order ? statusFlow.indexOf(order.order_status) : -1;

  return (
    <div className="page-content narrow-content status-page">
      <section className="page-hero compact">
        <div>
          <p className="eyebrow-text">주문 상태 조회</p>
          <h1 className="page-title">주문번호로 진행 상황을 바로 확인하세요</h1>
          <p className="page-description">금액 안내, 입금 확인, 준비 상태를 한 화면에서 확인할 수 있습니다.</p>
        </div>
      </section>

      {/* ✅ 개선: 주문 접수 완료 히어로 */}
      {isSubmittedView ? (
        <>
          <section className="order-success-hero">
            <div className="order-success-icon">✓</div>
            <p>주문서가 접수됐습니다</p>
            <strong>{activeOrderNo || order?.order_no || "주문번호 확인 중"}</strong>
            <span>이 번호로 금액 안내, 입금 확인, 준비 상태를 다시 조회할 수 있습니다.</span>
            <div className="button-row">
              <button type="button" className="secondary-button compact-button" onClick={() => void handleShareOrder()}>
                내 주문 공유하기
              </button>
            </div>
            {shareMessage ? <small className="copy-feedback" aria-live="polite">{shareMessage}</small> : null}
          </section>

          <SectionCard title="접수 후 이렇게 진행됩니다" subtitle="처음 주문하셨다면 아래 순서만 보면 됩니다.">
            <div className="support-grid">
              <div className="support-card">
                <strong>1. 먼저 금액 안내를 기다려 주세요</strong>
                <p>품목 상태와 실제 중량을 확인한 뒤 최종 금액을 안내합니다. 바로 입금하지 않아도 됩니다.</p>
              </div>
              <div className="support-card">
                <strong>2. 금액 안내를 받으면 입금해 주세요</strong>
                <p>입금 확인이 되면 손질과 준비가 시작됩니다. 입금자명이 다르면 함께 알려주시면 더 빠릅니다.</p>
              </div>
              <div className="support-card highlight">
                <strong>3. 다시 들어올 때는 주문번호만 확인하세요</strong>
                <p>아래 조회 화면에서 주문번호로 현재 진행 상태를 다시 확인할 수 있습니다.</p>
              </div>
            </div>
          </SectionCard>
        </>
      ) : null}

      <SectionCard title="주문번호 입력" subtitle="주문 후 안내받은 주문번호를 입력해 주세요.">
        {hasDirectLinkToken ? (
          <div className="notice-panel">
            <p>전달받은 링크로 접속해 주문 상태를 자동으로 불러오고 있습니다.</p>
            <p>다른 주문은 아래 주문번호로 다시 조회할 수 있습니다.</p>
          </div>
        ) : null}
        <form className="inline-form" onSubmit={handleSubmit} noValidate>
          <input
            value={orderNoInput}
            onChange={(event) => setOrderNoInput(event.target.value)}
            placeholder="예: OB-20260406-123456"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            aria-label="주문번호 입력"
          />
          <button type="submit" className="primary-button">
            확인하기
          </button>
        </form>
        {!order && !message ? (
          <p className="field-hint">주문 접수 후 문자 또는 카톡으로 안내된 번호를 입력해 주세요.</p>
        ) : null}
        {order ? (
          <div className="status-refresh-bar">
            <p aria-live="polite">
              {lastUpdatedAt ? `최근 확인 ${formatDateTime(lastUpdatedAt)} · 30초마다 자동 새로고침` : "주문 상태를 불러오는 중입니다."}
            </p>
            <div className="button-row">
              <button type="button" className="secondary-button compact-button" onClick={() => void handleShareOrder()}>
                공유
              </button>
              <button type="button" className="secondary-button compact-button" onClick={handleRefresh} disabled={refreshing}>
                {refreshing ? "확인 중..." : "지금 다시 확인"}
              </button>
            </div>
          </div>
        ) : null}
        {message ? <p className="helper-text" aria-live="polite">{message}</p> : null}
        {shareMessage && !isSubmittedView ? <p className="helper-text" aria-live="polite">{shareMessage}</p> : null}
        <div className="inline-actions">
          <Link to="/customer/order?restoreRecent=1" className="secondary-button compact-button">
            같은 방식으로 다시 주문하기
          </Link>
        </div>
      </SectionCard>

      {order ? (
        <div className="status-section-stack">
          {/* ✅ 개선: 데모 상태일 때 상단에 명확한 안내 배너 */}
          {isDemo ? (
            <div className="demo-notice-banner" role="status">
              현재 화면은 실제 주문이 아닌 <strong>예시 화면</strong>입니다. 실제 주문번호를 입력하면 진행 상태를 확인할 수 있습니다.
            </div>
          ) : null}

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

          <SectionCard title="현재 진행 단계" subtitle="주문이 어떤 단계에 있는지 순서대로 확인할 수 있습니다.">
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

          <SectionCard title="입금 안내" subtitle="최종 금액이 확정되면 아래 계좌로 입금해 주세요. 입금 후 순차적으로 확인합니다.">
            {order.payment_status === "paid" ? (
              <div className="notice-panel">
                <strong>✅ 입금 확인 완료</strong>
                <p>입금 확인이 완료되었습니다. 손질 준비가 진행됩니다.</p>
              </div>
            ) : (
              <>
                <div className="bank-guide-card">
                  <strong>{demoStore.name}</strong>
                  <p>
                    {order.bank_guide.bank_name} {order.bank_guide.bank_account}
                  </p>
                  <p>예금주 {order.bank_guide.bank_holder}</p>
                  <div className="bank-guide-actions">
                    <button type="button" className="secondary-button compact-button" onClick={handleCopyBankAccount}>
                      계좌번호 복사
                    </button>
                  </div>
                  {copyMessage ? <small className="copy-feedback" aria-live="polite">{copyMessage}</small> : null}
                  {/* ✅ 개선: 미확인/대기 상태에서만 금액 강조 표시 */}
                  {order.payment_status === "unpaid" && order.quoted_amount ? (
                    <>
                      <p>입금 금액</p>
                      <strong className="bank-guide-amount">{formatCurrency(order.quoted_amount)}</strong>
                    </>
                  ) : null}
                </div>
                {/* ✅ 개선: 입금 전 단계 (금액 미확정) 명확히 안내 */}
                {order.payment_status === "pending" || !order.quoted_amount ? (
                  <div className="notice-panel" style={{ marginTop: "12px" }}>
                    <p>금액이 아직 확정되지 않았습니다. 확정 후 다시 안내합니다. 입금은 금액 안내 이후 진행해 주세요.</p>
                  </div>
                ) : null}
              </>
            )}
          </SectionCard>

          <SectionCard title="다음 단계 안내" subtitle="주문 상태에 따라 필요한 행동만 간단히 안내합니다.">
            <div className="support-grid">
              <div className="support-card">
                <strong>금액 안내 전 단계</strong>
                <p>품목 상태와 손질 조건을 확인 중이라면 잠시 기다려 주세요. 확인 후 순차적으로 안내합니다.</p>
              </div>
              <div className="support-card">
                <strong>입금 안내를 받으셨다면</strong>
                <p>입금 후 이 페이지를 다시 확인하면 준비 상태가 업데이트됩니다. 입금자명이 다르면 함께 알려주세요.</p>
              </div>
              <div className="support-card highlight">
                <strong>급하게 확인이 필요하신가요?</strong>
                <p>
                  진행이 오래 멈춘 것처럼 보이면 매장 연락처로 바로 확인할 수 있습니다.
                  {demoStore.phones[0] ? (
                    <>
                      {" "}
                      <a href={`tel:${demoStore.phones[0]}`} className="phone-link">
                        {demoStore.phones[0]}
                      </a>
                    </>
                  ) : ""}
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="수령 후 보관 · 섭취 가이드" subtitle="수령 방식과 손질 상태에 맞춘 기본 보관 방법입니다.">
            <div className="support-grid">
              <div className="support-card">
                <strong>회 손질</strong>
                <p>가급적 수령 후 2시간 내 섭취를 권장합니다. 잠시 보관할 경우 냉장 보관해 주세요.</p>
              </div>
              <div className="support-card">
                <strong>포 뜨기 · 오로시</strong>
                <p>냉장 보관 후 당일 또는 다음날 빠르게 섭취하는 것이 좋습니다. 진공 포장은 이동과 보관에 도움이 됩니다.</p>
              </div>
              <div className="support-card">
                <strong>택배 수령</strong>
                <p>도착 즉시 냉장 상태를 확인하고, 장시간 상온 보관은 피하는 것이 좋습니다.</p>
              </div>
            </div>
          </SectionCard>

          {/* ✅ 개선: "자동 안내 예정 메시지" 섹션 – 데모에서만 표시하고 명확히 데모임을 표시 */}
          {isDemo ? (
            <SectionCard
              title="자동 안내 예정 메시지 예시"
              subtitle="실서비스에서는 이런 문자/카톡 안내가 자동으로 발송됩니다. 아래 내용은 예시입니다."
            >
              <div className="demo-notice-banner" style={{ marginBottom: "16px" }}>
                아래는 실제 발송 메시지가 아니라 <strong>예시 미리보기</strong>입니다.
              </div>
              <div className="support-grid">
                <div className="support-card">
                  <strong>금액 안내 완료</strong>
                  <p>
                    {order.order_no} 주문의 최종 금액이 확정되었습니다. 확인 후 입금하면 준비가 시작됩니다.
                  </p>
                </div>
                <div className="support-card">
                  <strong>입금 확인 완료</strong>
                  <p>
                    입금 확인이 완료되어 손질과 포장을 시작했습니다. 준비가 끝나면 수령 방식에 맞춰 다시 안내합니다.
                  </p>
                </div>
                <div className="support-card highlight">
                  <strong>출고 완료</strong>
                  <p>
                    선택한 방식으로 전달이 시작되었습니다. 바로 드시는 회는 수령 후 2시간 내 섭취를 권장합니다.
                  </p>
                </div>
              </div>
            </SectionCard>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function resolveStepCopy(step: string) {
  switch (step) {
    case "pricing_pending":
      return "품목 상태와 손질, 배송 조건을 확인한 뒤 정확한 금액을 안내합니다.";
    case "waiting_payment":
      return "최종 금액 안내가 완료되어 입금을 기다리고 있습니다.";
    case "ready_for_prep":
      return "입금 확인이 완료되어 손질과 포장을 준비하고 있습니다.";
    case "completed":
      return "선택하신 픽업, 퀵, 택배 방식으로 전달이 완료됐어요.";
    default:
      return "";
  }
}
