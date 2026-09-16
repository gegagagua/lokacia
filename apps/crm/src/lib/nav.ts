import {
  Building2, Camera, ChartLine, CalendarDays, Database, FileChartColumn, FileSignature, Handshake, LayoutDashboard, MessagesSquare, Presentation, Radar, Repeat,
  ScrollText, Settings, ShieldCheck, SquareCheckBig, SquareKanban, Target, Users, UsersRound, type LucideIcon,
} from 'lucide-react';
import type { CrmPermission } from '@lokacia/contracts';

export type NavItem = { key: string; href: string; icon: LucideIcon; perm?: CrmPermission; mobile?: boolean; shortcut?: string };
export type NavGroup = { key: 'work' | 'marketing' | 'team'; items: NavItem[] };

/** Single source for sidebar, mobile tab bar and command palette. Labels: messages/ka/shell.json → nav.<key>. */
export const NAV: NavGroup[] = [
  {
    key: 'work',
    items: [
      { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard, mobile: true, shortcut: 'g d' },
      { key: 'contacts', href: '/contacts', icon: Users, mobile: true, shortcut: 'g c' },
      { key: 'deals', href: '/deals', icon: SquareKanban, mobile: true, shortcut: 'g p' },
      { key: 'calendar', href: '/calendar', icon: CalendarDays, mobile: true, shortcut: 'g v' },
      { key: 'tasks', href: '/tasks', icon: SquareCheckBig, shortcut: 'g t' },
      { key: 'inbox', href: '/inbox', icon: MessagesSquare, shortcut: 'g i' },
    ],
  },
  {
    key: 'marketing',
    items: [
      { key: 'listings', href: '/listings', icon: Building2, shortcut: 'g l' },
      { key: 'addOnSite', href: '/listings/new', icon: Camera, mobile: true, perm: 'listings.publish' },
      { key: 'presentations', href: '/presentations', icon: Presentation },
      { key: 'sequences', href: '/sequences', icon: Repeat },
      { key: 'liveness', href: '/liveness', icon: ShieldCheck },
      { key: 'competitors', href: '/competitors', icon: Radar },
      { key: 'ownerReports', href: '/owner-reports', icon: FileChartColumn },
      { key: 'cobroker', href: '/cobroker', icon: Handshake },
    ],
  },
  {
    key: 'team',
    items: [
      { key: 'analytics', href: '/analytics', icon: ChartLine, perm: 'analytics.view' },
      { key: 'sources', href: '/sources', icon: Target, perm: 'finance.view' },
      { key: 'documents', href: '/documents', icon: FileSignature },
      { key: 'team', href: '/team', icon: UsersRound },
      { key: 'data', href: '/data', icon: Database, perm: 'data.import' },
      { key: 'audit', href: '/audit', icon: ScrollText, perm: 'audit.view' },
      { key: 'settings', href: '/settings', icon: Settings },
    ],
  },
];

export const NAV_ITEMS = NAV.flatMap((g) => g.items);
