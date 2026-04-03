import { PropsWithChildren, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import {
  ADMIN_QUERY_TOKEN_KEY,
  grantAdminAccess,
  hasAdminAccess
} from "../lib/admin-access";

export function AdminRoute({ children }: PropsWithChildren) {
  const location = useLocation();
  const [allowed, setAllowed] = useState(hasAdminAccess());

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tokenFromQuery = searchParams.get(ADMIN_QUERY_TOKEN_KEY);

    if (tokenFromQuery && grantAdminAccess(tokenFromQuery)) {
      setAllowed(true);
      return;
    }

    setAllowed(hasAdminAccess());
  }, [location.search]);

  if (!allowed) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
