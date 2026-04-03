import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SectionCard } from "../components/SectionCard";
import { StatusBadge } from "../components/StatusBadge";
import { demoPriceBoard, demoStore } from "../data/demo";
import { api } from "../lib/api";
import { formatCurrency, formatDate } from "../lib/format";
import { PriceBoardResponse, StoreInfo } from "../types";

export function HomePage() {
  const [store, setStore] = useState<StoreInfo>(demoStore);
  const [board, setBoard] = useState<PriceBoardResponse>(demoPriceBoard);
  const cutoffWindows = board.order_guide.cutoff_windows ?? [
    { fulfillment_type: "pickup", label: "매장 픽업", cutoff_note: board.order_guide.pickup_note },
    { fulfillment_type: "quick", label: "퀵 수령", cutoff_note: board.order_guide.quick_note },
    { fulfillment_type: "parcel", label: "택배 수령", cutoff_note: board.order_guide.parcel_note }
  ];

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [nextStore, nextBoard] = await Promise.all([api.getStore(), api.getPriceBoard()]);

        if (cancelled) {
          return;
        }

        setStore(nextStore);
        setBoard(nextBoard);
      } catch {
        if (cancelled) {
          return;
        }
        setStore(demoStore);
        setBoard(demoPriceBoard);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page-content">
      <section className="hero-card">
        <div className="hero-card-copy">
          <p className="eyebrow-text">오늘바다</p>
          <h1 className="hero-title">좋은 생선을 고르는 일, 주문까지 편안해야 하니까</h1>
          <p className="hero-description">
            당일 시세는 먼저 투명하게 보여드리고, 손질과 픽업, 퀵, 택배까지 요청하신 방식에
            맞춰 정성껏 준비해드립니다.
          </p>
          <div className="inline-actions">
            <Link to="/customer/order" className="primary-button">
              오늘 시세 보고 주문하기
            </Link>
            <Link to="/customer/status" className="secondary-button">
              내 주문 진행 확인하기
            </Link>
          </div>
        </div>
        <div className="hero-card-side">
          <div className="hero-store-card">
            <strong>{store.name}</strong>
            <p>{store.address.line1}</p>
            <p>{store.business_hours_note}</p>
            <div className="hero-store-meta">
              <span>{store.phones[0]}</span>
              <span>픽업 · 퀵 · 택배 가능</span>
            </div>
          </div>
        </div>
      </section>

      <section className="consumer-info-grid">
        <article className="consumer-info-card">
          <p className="consumer-info-label">오늘 시세 기준</p>
          <strong className="consumer-info-title">{formatDate(board.board_date)}</strong>
          <p className="consumer-info-copy">매일 바뀌는 시세를 먼저 보여드리고, 확인 후 정확한 금액을 안내해드려요.</p>
        </article>
        <article className="consumer-info-card">
          <p className="consumer-info-label">받는 방법</p>
          <strong className="consumer-info-title">픽업 · 퀵 · 택배</strong>
          <p className="consumer-info-copy">원하시는 방식에 맞춰 가장 신선한 상태로 받으실 수 있게 준비해드려요.</p>
        </article>
        <article className="consumer-info-card">
          <p className="consumer-info-label">반마리 주문</p>
          <strong className="consumer-info-title">같이 맞춰드릴 수 있어요</strong>
          <p className="consumer-info-copy">한 마리가 부담스러우시면 반마리 함께 주문도 확인 후 도와드려요.</p>
        </article>
      </section>

      <SectionCard
        title="오늘 주문 마감과 결제 방식"
        subtitle="지금 바로 가능한 주문과 예약으로 진행되는 주문을 먼저 쉽게 구분해보세요."
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
            <p>{board.order_guide.expected_price_note ?? "당일 시세와 손질비, 운임비를 확인해 정확한 금액을 안내해드려요."}</p>
          </div>
          <div>
            <strong>예약 주문</strong>
            <p>{board.order_guide.reservation_deposit_policy ?? "예약 주문은 확보 가능 여부를 먼저 확인한 뒤 진행해드려요."}</p>
          </div>
        </div>
      </SectionCard>

      <div className="split-layout">
        <SectionCard
          title="오늘 준비 가능한 품목"
          subtitle="원하시는 생선과 시세를 먼저 보고 편하게 주문해보세요."
          action={<Link to="/customer/order" className="text-link">주문서 바로가기</Link>}
        >
          <div className="stack-list">
            {board.items.map((item) => (
              <div key={item.id ?? item.item_name} className="list-row">
                <div>
                  <strong>{item.item_name}</strong>
                  <p>
                    {item.origin_label ?? "원산지 미지정"} · {item.size_band ?? "규격 미지정"}
                  </p>
                </div>
                <div className="row-end">
                  <strong>{formatCurrency(item.unit_price)}</strong>
                  <StatusBadge value={item.sale_status} />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="주문 전 꼭 확인하면 좋은 안내"
          subtitle="고객 입장에서 실제로 가장 많이 궁금해하시는 부분만 골라 정리했어요."
        >
          <div className="stack-list">
            <div className="list-row">
              <div>
                <strong>시세부터 먼저 숨기지 않습니다</strong>
                <p>당일 기준 가격을 먼저 보여드리고, 손질비와 운임비는 확인 후 정확히 안내해드려요.</p>
              </div>
            </div>
            <div className="list-row">
              <div>
                <strong>주문 후 진행 상황을 바로 확인할 수 있어요</strong>
                <p>금액 안내, 입금 확인, 손질 준비, 출고 상태까지 주문 후 직접 확인하실 수 있어요.</p>
              </div>
            </div>
            <div className="list-row">
              <div>
                <strong>받는 방식도 원하는 대로 고르세요</strong>
                <p>매장 픽업, 퀵, 일반택배와 당일택배까지 상황에 맞춰 가장 편한 방식으로 준비해드려요.</p>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="주문은 이렇게 진행돼요"
        subtitle="복잡한 설명 없이, 고객 입장에서 꼭 필요한 흐름만 간단하게 보여드릴게요."
      >
        <div className="service-step-grid">
          <article className="service-step-card">
            <span className="service-step-no">1</span>
            <strong>원하시는 품목과 받는 방법을 남겨주세요</strong>
            <p>픽업, 퀵, 택배 중 편한 방법을 고르고 요청사항까지 함께 남기실 수 있어요.</p>
          </article>
          <article className="service-step-card">
            <span className="service-step-no">2</span>
            <strong>확인 후 정확한 금액을 안내해드려요</strong>
            <p>당일 시세와 손질, 운임 조건을 반영해 주문별 금액을 분명하게 말씀드려요.</p>
          </article>
          <article className="service-step-card">
            <span className="service-step-no">3</span>
            <strong>준비 상황과 전달 상태를 링크로 확인하세요</strong>
            <p>입금 확인부터 손질 준비, 출고 완료까지 주문 후에도 불안하지 않게 보여드려요.</p>
          </article>
        </div>
      </SectionCard>
    </div>
  );
}
