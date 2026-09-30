import { Navigate, useLocation } from 'react-router';

/** /wheel and /bottle now live at /spin?mode=..., keeping any shared-wheel #hash intact. */
export function LegacyRedirect({ mode }: { mode: 'wheel' | 'bottle' }) {
  const location = useLocation();
  return <Navigate to={`/spin?mode=${mode}${location.hash}`} replace />;
}
