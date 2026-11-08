import {
  ArrowLeftRight,
  Boxes,
  Building2,
  FileBarChart,
  LayoutDashboard,
  Package,
  Settings,
  Tags,
  Users,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import type { ModuleCode } from '@stockpro/shared';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  module?: ModuleCode;
  description?: string;
}

export const MAIN_NAV: NavItem[] = [
  { label: 'Home', to: '/', icon: LayoutDashboard },
  { label: 'Kardex', to: '/kardex', icon: ArrowLeftRight, module: 'kardex' },
  { label: 'Reportes', to: '/reports', icon: FileBarChart, module: 'reports' },
];

export const SECONDARY_NAV: NavItem[] = [
  { label: 'Configuración', to: '/settings', icon: Settings },
];

export const SETTINGS_NAV: NavItem[] = [
  {
    label: 'Productos',
    to: '/settings/products',
    icon: Package,
    module: 'products',
    description: 'Registra tus productos',
  },
  {
    label: 'Categorías',
    to: '/settings/categories',
    icon: Tags,
    module: 'categories',
    description: 'Asigna categorías a tus productos',
  },
  {
    label: 'Marcas',
    to: '/settings/brands',
    icon: Boxes,
    module: 'brands',
    description: 'Gestiona tus marcas',
  },
  {
    label: 'Almacenes',
    to: '/settings/warehouses',
    icon: Warehouse,
    module: 'warehouses',
    description: 'Gestiona dónde guardas tu stock',
  },
  {
    label: 'Personal',
    to: '/settings/users',
    icon: Users,
    module: 'users',
    description: 'Ten el control de tu personal',
  },
  {
    label: 'Tu empresa',
    to: '/settings/company',
    icon: Building2,
    module: 'company',
    description: 'Configura tus opciones básicas',
  },
];
