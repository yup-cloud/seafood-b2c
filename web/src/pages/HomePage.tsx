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
          <h1 className="hero-title">
            좋은 생선을 고르는 일,
            <br />
            주문까지 편안해야 하니까
          </h1>
          <p className="hero-description">
            당일 시세는 먼저 투명하게 보여드리고, 손질과 픽업, 퀵, 택배까지 요청하신 방식에
            맞춰 정성껏 준비해드립니다.
          </p>
          <div className="inline-actions home-cta-row">
            <Link to="/customer/order" className="primary-button">
              오늘 시세보고 주문
            </Link>
            <Link to="/customer/status" className="secondary-button">
              내 주문 확인
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

      <SectionCard
        title="오늘 주문 안내"
        subtitle={`${formatDate(board.board_date)} 기준으로 바로 가능한 주문만 먼저 모아봤어요.`}
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
                  <strong>
                    {formatCurrency(item.unit_price)}
                    {item.unit_label === "kg" ? " / kg" : ""}
                  </strong>
                  <StatusBadge value={item.sale_status} />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="처음 주문이라면 이것만 보세요"
          subtitle="복잡한 설명은 줄이고, 실제로 많이 물어보시는 내용만 남겼어요."
        >
          <div className="stack-list">
            <div className="list-row">
              <div>
                <strong>시세를 먼저 보고 주문해요</strong>
                <p>오늘 기준 단가를 먼저 보고, 손질비와 운임은 주문 내용에 맞춰 따로 안내해드려요.</p>
              </div>
            </div>
            <div className="list-row">
              <div>
                <strong>주문번호로 진행 상황을 확인해요</strong>
                <p>금액 안내부터 손질 준비, 출고 완료까지 주문 후에도 직접 확인하실 수 있어요.</p>
              </div>
            </div>
            <div className="list-row">
              <div>
                <strong>픽업, 퀵, 택배 중에 고르세요</strong>
                <p>오늘 드실지, 이동이 있는지에 따라 가장 무난한 수령 방식을 추천해드려요.</p>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="처음 주문하시는 분이 가장 많이 물어보세요"
        subtitle="실제 문의가 많은 질문만 먼저 짧게 정리했어요."
      >
        <div className="support-grid">
          <div className="support-card">
            <strong>어떤 손질을 골라야 할지 모르겠어요</strong>
            <p>처음 주문이면 필렛부터 시작하시면 가장 부담이 적고, 이동이나 보관도 편한 편이에요.</p>
          </div>
          <div className="support-card">
            <strong>주문하면 언제 연락이 오나요?</strong>
            <p>보통 주문서 확인 후 10~20분 안에 금액이나 진행 가능 여부를 먼저 안내드려요.</p>
          </div>
          <div className="support-card">
            <strong>한 마리가 부담스러우면 어떻게 하나요?</strong>
            <p>반마리 함께 주문으로 먼저 남겨주시면 가능한 품목은 확인 후 함께 맞춰드릴 수 있어요.</p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
