/**
 * Type-only fallback for `tsc`. Metro picks `MapView.web.tsx` (web bundle) or
 * `MapView.native.tsx` (iOS / Android) via platform-suffix resolution, so this
 * module is never actually executed.
 */
export { default, type MapViewProps } from './MapView.web';
