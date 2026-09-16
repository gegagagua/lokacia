import {
  Briefcase, Car, Coffee, Croissant, Dumbbell, Factory, Gem, GraduationCap, Pill, Scissors, ShoppingBag, Sparkles, Stethoscope, Store, Users, Warehouse, Wine,
  type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  coffee: Coffee,
  wine: Wine,
  croissant: Croissant,
  'shopping-bag': ShoppingBag,
  pill: Pill,
  scissors: Scissors,
  stethoscope: Stethoscope,
  briefcase: Briefcase,
  users: Users,
  warehouse: Warehouse,
  factory: Factory,
  gem: Gem,
  car: Car,
  dumbbell: Dumbbell,
  'graduation-cap': GraduationCap,
  sparkles: Sparkles,
};

/** Lucide icon for a business type's `icon` name (decorative). */
export function BusinessTypeIcon({ name, className = 'size-5' }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Store;
  return <Icon className={className} strokeWidth={1.5} aria-hidden />;
}
