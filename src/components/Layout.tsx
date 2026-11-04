import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useApp } from '../store/AppStore';
import { formatDate } from '../lib/utils';
import { cn } from '../lib/utils';
import {
  CalendarIcon,
  CheckCircleIcon,
  ClipboardIcon,
  DownloadIcon,
  SettingsIcon,
  TrophyIcon,
} from './icons';

const NAV_ITEMS = [
  { to: '/thiet-lap', label: 'Thiết lập', icon: SettingsIcon },
  { to: '/su-kien', label: 'Sự kiện', icon: CalendarIcon },
  { to: '/cham-diem', label: 'Chấm điểm', icon: ClipboardIcon },
  { to: '/xep-hang', label: 'Xếp hạng', icon: TrophyIcon },
  { to: '/xuat', label: 'Xuất', icon: DownloadIcon },
];

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return null;
}

export function Layout() {
  const { state, savedAt, saveError } = useApp();

  return (
    <div className="min-h-screen bg-canvas">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-brand-700 focus:px-4 focus:py-3 focus:text-white"
      >
        Bỏ qua điều hướng
      </a>
      <ScrollToTop />
      <header className="app-header no-print sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-[68px] items-center justify-between gap-4">
            <Link to="/su-kien" className="group flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-indigo-800 text-white shadow-sm">
                <TrophyIcon size={24} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-base font-extrabold leading-tight text-ink">
                  WDSF Scoring
                </span>
                <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Chấm điểm khiêu vũ thể thao
                </span>
              </span>
            </Link>

            <div className="hidden items-center gap-3 text-right md:flex">
              <div className="max-w-[360px] truncate text-xs text-slate-500">
                <div className="font-semibold text-slate-700">{state.settings.competitionName}</div>
                <div>
                  {state.settings.eventDate ? formatDate(state.settings.eventDate) : 'Chưa đặt ngày'}
                  {state.settings.venue ? ` · ${state.settings.venue}` : ''}
                </div>
              </div>
              <span className="badge-gray" title="Dữ liệu chỉ lưu trong trình duyệt">
                Offline
              </span>
              {saveError ? (
                <span className="badge-red" title={saveError}>
                  Lỗi lưu
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                  <CheckCircleIcon size={16} />
                  {savedAt ? 'Đã lưu' : 'Đang lưu…'}
                </span>
              )}
            </div>
          </div>

          <nav className="nav-scroll -mb-px flex gap-1 overflow-x-auto pb-1" aria-label="Điều hướng chính">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => cn('nav-tab', isActive && 'nav-tab-active')}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </header>

      <main id="main-content" className="app-main">
        <Outlet />
      </main>

      <footer className="app-footer no-print border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>
            Hệ thống chấm điểm giải khiêu vũ thể thao · Skating System WDSF · Dữ liệu lưu trên
            trình duyệt
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            Hoạt động không cần internet
          </span>
        </div>
      </footer>
    </div>
  );
}
