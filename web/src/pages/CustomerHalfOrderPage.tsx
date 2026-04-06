import { Link, useNavigate } from "react-router-dom";
import { SectionCard } from "../components/SectionCard";
import { demoHalfOrderDemands, demoPriceBoard } from "../data/demo";
import { formatCurrency } from "../lib/format";

export function CustomerHalfOrderPage() {
  const navigate = useNavigate();

  function moveToHalfOrder(itemName?: string) {
    const params = new URLSearchParams();
    params.set("half", "1");
    params.set("flow", itemName?.includes("예약") || itemName?.includes("연어") ? "reservation" : "same_day");
    if (itemName) {
      params.set("item", itemName);
    }

    navigate(`/customer/order?${params.toString()}`);
  }

  return (
    <div className="page-content narrow-content">
      <section className="page-hero compact">
        <div>
          <p className="eyebrow-text">반마리 주문</p>
          <h1 className="page-title">한 마리 부담되면 반마리끼리 같이 주문하세요</h1>
          <p className="page-description">
            지금 반마리 원하는 분이 있는 품목을 보고 바로 신청할 수 있어요. 매칭되면 최종 금액을 안내해드려요.
          </p>
        </div>
      </section>

      <SectionCard
        title="지금 반마리 요청 현황"
        subtitle="신청이 모이면 같은 품목끼리 먼저 연결해드려요."
      >
        <div className="half-demand-grid">
          {demoHalfOrderDemands.map((demand) => (
            <article key={demand.id} className="half-demand-card">
              <div className="half-demand-head">
                <div>
                  <strong>{demand.item_name}</strong>
                  <p>
                    {demand.origin_label ?? "원산지 확인"} · {demand.size_band ?? "크기 확인"}
                  </p>
                </div>
                <span className="mini-pill">{demand.urgency_label}</span>
              </div>
              <div className="half-demand-meta">
                <span>{demand.unit_price ? `${formatCurrency(demand.unit_price)}/kg` : "가격 확인 후 안내"}</span>
                <span>{demand.fulfillment_hint}</span>
                <span>대기 {demand.waiting_count}팀</span>
              </div>
              {demand.note ? <p className="half-demand-note">{demand.note}</p> : null}
              <button
                type="button"
                className="primary-button full-width"
                onClick={() => moveToHalfOrder(demand.item_name)}
              >
                이 품목 반마리 신청
              </button>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="이렇게 진행돼요" subtitle="반마리 주문은 일반 주문보다 한 단계만 더 확인해드려요.">
        <div className="half-flow-grid">
          <article className="support-card">
            <strong>1. 품목 신청</strong>
            <p>원하는 품목과 받는 방법을 먼저 남겨주세요.</p>
          </article>
          <article className="support-card">
            <strong>2. 매칭 확인</strong>
            <p>같이 주문할 분이 맞춰지면 크기와 가능 여부를 확인해드려요.</p>
          </article>
          <article className="support-card">
            <strong>3. 금액 안내</strong>
            <p>실제 사이즈 기준으로 최종 금액을 다시 안내해드려요.</p>
          </article>
          <article className="support-card">
            <strong>4. 입금 후 진행</strong>
            <p>입금 확인 후 손질과 포장을 시작해드려요.</p>
          </article>
        </div>
      </SectionCard>

      <SectionCard title="바로 신청할까요?" subtitle="원하는 품목이 아직 없으면 일반 주문에서 반마리 요청으로 바로 남기실 수 있어요.">
        <div className="button-row">
          <button type="button" className="primary-button" onClick={() => moveToHalfOrder()}>
            반마리 주문서 작성
          </button>
          <Link to="/" className="secondary-button">
            오늘 시세 다시 보기
          </Link>
        </div>
        <p className="field-hint">
          오늘 시세 품목 기준으로 신청하실 수 있고, 없는 품목은 예약 반마리 요청으로 남기시면 확인 후 안내드려요.
        </p>
      </SectionCard>
    </div>
  );
}
