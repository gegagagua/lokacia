export const DEAL_TYPES = ['rent', 'sale', 'transfer', 'short_term'] as const;
export type DealType = (typeof DEAL_TYPES)[number];

export const DEAL_TYPE_LABELS_KA: Record<DealType, string> = {
  rent: 'იჯარა',
  sale: 'იყიდება',
  transfer: 'ბიზნესის გადაცემა',
  short_term: 'ხანმოკლე იჯარა',
};

export const LISTING_STATUSES = [
  'draft',
  'pending_review',
  'active',
  'stale',
  'rented',
  'sold',
  'archived',
  'rejected',
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const LISTING_STATUS_LABELS_KA: Record<ListingStatus, string> = {
  draft: 'შავი ვერსია',
  pending_review: 'მოდერაციაში',
  active: 'აქტიური',
  stale: 'დაუდასტურებელი',
  rented: 'გაქირავებული',
  sold: 'გაყიდული',
  archived: 'არქივი',
  rejected: 'უარყოფილი',
};

/** Listing lifecycle (ARCHITECTURE.md): draft → pending_review → active ⇄ stale → rented|sold|archived; rejected from review. */
export const LISTING_TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  draft: ['pending_review', 'archived'],
  pending_review: ['active', 'rejected', 'draft'],
  active: ['stale', 'rented', 'sold', 'archived', 'pending_review'],
  stale: ['active', 'rented', 'sold', 'archived'],
  rented: ['pending_review', 'archived'],
  sold: ['archived'],
  archived: ['draft'],
  rejected: ['draft', 'pending_review'],
};

export function canTransition(from: ListingStatus, to: ListingStatus): boolean {
  return LISTING_TRANSITIONS[from].includes(to);
}

export type PassportFieldKind = 'boolean' | 'number' | 'integer';
export type PassportFieldMeta = { key: PassportKey; labelKa: string; kind: PassportFieldKind; unit?: string; icon: string };

export const PASSPORT_KEYS = [
  'powerKw',
  'threePhase',
  'ceilingM',
  'facadeM',
  'widthM',
  'depthM',
  'hasHood',
  'hasGas',
  'wetPoints',
  'gateWM',
  'truckAccess',
  'access247',
  'parking',
  'shopWindow',
  'separateEntrance',
  'ventilation',
] as const;
export type PassportKey = (typeof PASSPORT_KEYS)[number];

export const PASSPORT_FIELDS: PassportFieldMeta[] = [
  { key: 'powerKw', labelKa: 'სიმძლავრე', kind: 'number', unit: 'კვტ', icon: 'zap' },
  { key: 'threePhase', labelKa: 'სამფაზა კვება', kind: 'boolean', icon: 'plug-zap' },
  { key: 'ceilingM', labelKa: 'ჭერის სიმაღლე', kind: 'number', unit: 'მ', icon: 'move-vertical' },
  { key: 'facadeM', labelKa: 'ფასადის სიგანე', kind: 'number', unit: 'მ', icon: 'panel-top' },
  { key: 'widthM', labelKa: 'სიგანე', kind: 'number', unit: 'მ', icon: 'move-horizontal' },
  { key: 'depthM', labelKa: 'სიღრმე', kind: 'number', unit: 'მ', icon: 'move-diagonal' },
  { key: 'hasHood', labelKa: 'გამწოვი', kind: 'boolean', icon: 'wind' },
  { key: 'hasGas', labelKa: 'ბუნებრივი აირი', kind: 'boolean', icon: 'flame' },
  { key: 'wetPoints', labelKa: 'სველი წერტილები', kind: 'integer', icon: 'droplets' },
  { key: 'gateWM', labelKa: 'ჭიშკრის სიგანე', kind: 'number', unit: 'მ', icon: 'warehouse' },
  { key: 'truckAccess', labelKa: 'სატვირთოს შესასვლელი', kind: 'boolean', icon: 'truck' },
  { key: 'access247', labelKa: '24/7 დაშვება', kind: 'boolean', icon: 'clock' },
  { key: 'parking', labelKa: 'პარკინგის ადგილები', kind: 'integer', icon: 'square-parking' },
  { key: 'shopWindow', labelKa: 'ვიტრინა', kind: 'boolean', icon: 'app-window' },
  { key: 'separateEntrance', labelKa: 'ცალკე შესასვლელი', kind: 'boolean', icon: 'door-open' },
  { key: 'ventilation', labelKa: 'ვენტილაცია', kind: 'boolean', icon: 'fan' },
];

export const PASSPORT_FIELD_BY_KEY = Object.fromEntries(PASSPORT_FIELDS.map((f) => [f.key, f])) as Record<
  PassportKey,
  PassportFieldMeta
>;

export type FilterDef = {
  key: PassportKey;
  kind: 'boolean' | 'min';
  labelKa: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
};
export type FilterConfig = { filters: FilterDef[]; required: PassportKey[] };

const b = (key: PassportKey, labelKa?: string): FilterDef => ({
  key,
  kind: 'boolean',
  labelKa: labelKa ?? PASSPORT_FIELD_BY_KEY[key].labelKa,
});
const m = (key: PassportKey, min: number, max: number, step: number, labelKa?: string): FilterDef => ({
  key,
  kind: 'min',
  labelKa: labelKa ?? `${PASSPORT_FIELD_BY_KEY[key].labelKa} (მინ.)`,
  unit: PASSPORT_FIELD_BY_KEY[key].unit,
  min,
  max,
  step,
});

export type BusinessTypeSeed = {
  slug: string;
  nameKa: string;
  nameEn: string;
  nameRu: string;
  icon: string;
  utilityCoef: number; // GEL per m² per month
  fitoutPerM2: number; // GEL per m²
  filterConfig: FilterConfig;
};

/** Seed set from PRODUCT.md (extendable in admin). */
export const BUSINESS_TYPES: BusinessTypeSeed[] = [
  {
    slug: 'cafe',
    nameKa: 'კაფე / რესტორანი',
    nameEn: 'Cafe / restaurant',
    nameRu: 'Кафе / ресторан',
    icon: 'coffee',
    utilityCoef: 6,
    fitoutPerM2: 700,
    filterConfig: {
      filters: [b('hasHood'), b('hasGas'), m('ceilingM', 2.5, 6, 0.1), b('shopWindow'), m('powerKw', 5, 100, 5), m('wetPoints', 1, 6, 1)],
      required: ['powerKw', 'ceilingM', 'hasHood', 'hasGas', 'wetPoints'],
    },
  },
  {
    slug: 'bar',
    nameKa: 'ბარი',
    nameEn: 'Bar',
    nameRu: 'Бар',
    icon: 'wine',
    utilityCoef: 5,
    fitoutPerM2: 650,
    filterConfig: {
      filters: [b('hasHood'), b('access247'), m('ceilingM', 2.5, 6, 0.1), b('separateEntrance'), m('powerKw', 5, 80, 5)],
      required: ['powerKw', 'ceilingM', 'wetPoints'],
    },
  },
  {
    slug: 'bakery',
    nameKa: 'საცხობი',
    nameEn: 'Bakery',
    nameRu: 'Пекарня',
    icon: 'croissant',
    utilityCoef: 7,
    fitoutPerM2: 600,
    filterConfig: {
      filters: [b('hasGas'), b('threePhase'), b('hasHood'), m('powerKw', 10, 120, 5), b('shopWindow')],
      required: ['powerKw', 'threePhase', 'hasGas', 'wetPoints'],
    },
  },
  {
    slug: 'retail',
    nameKa: 'მაღაზია',
    nameEn: 'Retail',
    nameRu: 'Магазин',
    icon: 'shopping-bag',
    utilityCoef: 3,
    fitoutPerM2: 350,
    filterConfig: {
      filters: [b('shopWindow'), m('facadeM', 2, 30, 1), b('separateEntrance'), m('ceilingM', 2.5, 6, 0.1)],
      required: ['facadeM', 'ceilingM', 'shopWindow'],
    },
  },
  {
    slug: 'pharmacy',
    nameKa: 'აფთიაქი',
    nameEn: 'Pharmacy',
    nameRu: 'Аптека',
    icon: 'pill',
    utilityCoef: 3,
    fitoutPerM2: 450,
    filterConfig: {
      filters: [b('shopWindow'), b('separateEntrance'), m('facadeM', 2, 20, 1), b('access247')],
      required: ['facadeM', 'separateEntrance'],
    },
  },
  {
    slug: 'beauty-salon',
    nameKa: 'სილამაზის სალონი',
    nameEn: 'Beauty salon',
    nameRu: 'Салон красоты',
    icon: 'scissors',
    utilityCoef: 4,
    fitoutPerM2: 500,
    filterConfig: {
      filters: [m('wetPoints', 1, 10, 1), b('ventilation'), b('shopWindow'), m('powerKw', 5, 50, 5)],
      required: ['wetPoints', 'powerKw'],
    },
  },
  {
    slug: 'clinic',
    nameKa: 'კლინიკა',
    nameEn: 'Clinic',
    nameRu: 'Клиника',
    icon: 'stethoscope',
    utilityCoef: 4,
    fitoutPerM2: 900,
    filterConfig: {
      filters: [m('wetPoints', 1, 12, 1), b('separateEntrance'), m('parking', 1, 30, 1), m('powerKw', 10, 150, 5), b('threePhase')],
      required: ['wetPoints', 'powerKw', 'separateEntrance'],
    },
  },
  {
    slug: 'office',
    nameKa: 'ოფისი',
    nameEn: 'Office',
    nameRu: 'Офис',
    icon: 'briefcase',
    utilityCoef: 2.5,
    fitoutPerM2: 300,
    filterConfig: {
      filters: [m('parking', 1, 50, 1), b('access247'), m('ceilingM', 2.5, 5, 0.1), b('separateEntrance')],
      required: ['ceilingM'],
    },
  },
  {
    slug: 'coworking',
    nameKa: 'კოვორკინგი',
    nameEn: 'Coworking',
    nameRu: 'Коворкинг',
    icon: 'users',
    utilityCoef: 3,
    fitoutPerM2: 400,
    filterConfig: {
      filters: [b('access247'), m('parking', 1, 50, 1), m('wetPoints', 1, 8, 1), m('powerKw', 10, 100, 5)],
      required: ['ceilingM', 'wetPoints'],
    },
  },
  {
    slug: 'warehouse',
    nameKa: 'სასაწყობე',
    nameEn: 'Warehouse',
    nameRu: 'Склад',
    icon: 'warehouse',
    utilityCoef: 1,
    fitoutPerM2: 80,
    filterConfig: {
      filters: [b('truckAccess'), m('gateWM', 2, 8, 0.5), b('access247'), m('ceilingM', 3, 15, 0.5), b('threePhase')],
      required: ['gateWM', 'truckAccess', 'ceilingM'],
    },
  },
  {
    slug: 'production',
    nameKa: 'საწარმო',
    nameEn: 'Production',
    nameRu: 'Производство',
    icon: 'factory',
    utilityCoef: 2,
    fitoutPerM2: 200,
    filterConfig: {
      filters: [b('threePhase'), m('powerKw', 20, 500, 10), b('truckAccess'), m('gateWM', 2, 8, 0.5), m('ceilingM', 3, 15, 0.5)],
      required: ['powerKw', 'threePhase', 'truckAccess'],
    },
  },
  {
    slug: 'showroom',
    nameKa: 'შოურუმი',
    nameEn: 'Showroom',
    nameRu: 'Шоурум',
    icon: 'gem',
    utilityCoef: 3,
    fitoutPerM2: 400,
    filterConfig: {
      filters: [b('shopWindow'), m('facadeM', 4, 40, 1), m('ceilingM', 3, 8, 0.5), m('parking', 1, 30, 1)],
      required: ['facadeM', 'ceilingM', 'shopWindow'],
    },
  },
  {
    slug: 'car-service',
    nameKa: 'ავტოსერვისი',
    nameEn: 'Car service',
    nameRu: 'Автосервис',
    icon: 'car',
    utilityCoef: 2,
    fitoutPerM2: 150,
    filterConfig: {
      filters: [m('gateWM', 2.5, 8, 0.5), b('threePhase'), m('ceilingM', 3, 10, 0.5), m('parking', 1, 30, 1)],
      required: ['gateWM', 'ceilingM', 'threePhase'],
    },
  },
  {
    slug: 'fitness',
    nameKa: 'ფიტნესი',
    nameEn: 'Fitness',
    nameRu: 'Фитнес',
    icon: 'dumbbell',
    utilityCoef: 4,
    fitoutPerM2: 450,
    filterConfig: {
      filters: [m('ceilingM', 3, 8, 0.5), m('wetPoints', 2, 20, 1), b('ventilation'), m('parking', 1, 50, 1)],
      required: ['ceilingM', 'wetPoints', 'ventilation'],
    },
  },
  {
    slug: 'education',
    nameKa: 'სასწავლო ცენტრი',
    nameEn: 'Education',
    nameRu: 'Учебный центр',
    icon: 'graduation-cap',
    utilityCoef: 2.5,
    fitoutPerM2: 300,
    filterConfig: {
      filters: [b('separateEntrance'), m('wetPoints', 1, 10, 1), m('parking', 1, 30, 1), b('ventilation')],
      required: ['wetPoints', 'separateEntrance'],
    },
  },
  {
    slug: 'pop-up',
    nameKa: 'პოპ-აპი',
    nameEn: 'Pop-up',
    nameRu: 'Поп-ап',
    icon: 'sparkles',
    utilityCoef: 3,
    fitoutPerM2: 100,
    filterConfig: {
      filters: [b('shopWindow'), m('facadeM', 1, 20, 1), b('access247')],
      required: ['facadeM'],
    },
  },
];

export const BUSINESS_TYPE_SLUGS = BUSINESS_TYPES.map((t) => t.slug);
export const BUSINESS_TYPE_BY_SLUG = Object.fromEntries(BUSINESS_TYPES.map((t) => [t.slug, t])) as Record<
  string,
  BusinessTypeSeed
>;

export const SERVICE_CATEGORIES = [
  { slug: 'fitout', nameKa: 'რემონტი და მოწყობა' },
  { slug: 'design', nameKa: 'ინტერიერის დიზაინი' },
  { slug: 'signage', nameKa: 'აბრა და ბრენდინგი' },
  { slug: 'equipment', nameKa: 'აღჭურვილობა' },
  { slug: 'legal', nameKa: 'იურიდიული მომსახურება' },
  { slug: 'cleaning', nameKa: 'დასუფთავება' },
] as const;

export const POI_CATEGORIES = ['competitor', 'transport', 'school', 'business_center', 'parking', 'bank'] as const;
export type PoiCategory = (typeof POI_CATEGORIES)[number];
export const POI_LABELS_KA: Record<PoiCategory, string> = {
  competitor: 'კონკურენტები',
  transport: 'ტრანსპორტი',
  school: 'სკოლები',
  business_center: 'ბიზნეს-ცენტრები',
  parking: 'პარკინგი',
  bank: 'ბანკები',
};
