import { FormEvent, PropsWithChildren, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { grantAdminAccess } from "../lib/admin-access";

const navigationItems = [
  { to: "/", label: "홈" },
  { to: "/customer/order", label: "주문하기" },
  { to: "/customer/status", label: "주문 확인" }
];

export function AppShell({ children }: PropsWithChildren) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAccessOpen, setIsAccessOpen] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [accessError, setAccessError] = useState("");
  const isAdminPath = location.pathname.startsWith("/admin");

  function closeAccessModal() {
    setIsAccessOpen(false);
    setAccessToken("");
    setAccessError("");
  }

  function openAccessModal() {
    setIsAccessOpen(true);
    setAccessError("");
  }

  function handleAccessSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!grantAdminAccess(accessToken)) {
      setAccessError("운영 PIN이 맞지 않습니다. 다시 확인해 주세요.");
      return;
    }

    closeAccessModal();
    navigate("/admin/dashboard");
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">오</div>
          <div className="brand-copy">
            <p className="brand-title">오늘바다</p>
            <p className="brand-subtitle">당일 시세를 확인하고 주문하는 수산 주문 서비스</p>
          </div>
        </div>
        <nav className="topnav">
          {navigationItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `topnav-link${isActive ? " active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="page-frame">{children}</main>
      {!isAdminPath ? (
        <nav className="mobile-tabbar" aria-label="모바일 주요 메뉴">
          {navigationItems.map((item) => (
            <NavLink
              key={`mobile-${item.to}`}
              to={item.to}
              className={({ isActive }) => `mobile-tabbar-link${isActive ? " active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      ) : null}
      {!isAdminPath ? (
        <button type="button" className="floating-admin-button" onClick={openAccessModal}>
          운영자
        </button>
      ) : null}
      <footer className="app-footer">
        <div className="app-footer-inner">
          <p className="footer-copy">오늘 시세 확인부터 주문, 진행 조회까지 한 번에 이용할 수 있습니다.</p>
        </div>
      </footer>
      {isAccessOpen ? (
        <div className="access-overlay" onClick={closeAccessModal} role="presentation">
          <section
            className="access-panel"
            onClick={(event) => event.stopPropagation()}
            aria-modal="true"
            role="dialog"
          >
            <p className="eyebrow-text">운영자 전용</p>
            <h2 className="access-title">운영 화면 입장</h2>
            <p className="access-body">운영 PIN 6자리를 입력하면 바로 관리자 화면으로 이동합니다.</p>
            <form className="stack-form" onSubmit={handleAccessSubmit}>
              <label className="field-block">
                <span>운영 PIN</span>
                <input
                  autoFocus
                  type="password"
                  inputMode="numeric"
                  value={accessToken}
                  onChange={(event) => setAccessToken(event.target.value)}
                  placeholder="000000"
                />
              </label>
              {accessError ? <p className="helper-text access-error">{accessError}</p> : null}
              <div className="access-actions">
                <button type="button" className="secondary-button" onClick={closeAccessModal}>
                  닫기
                </button>
                <button type="submit" className="primary-button">
                  운영 화면 열기
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
