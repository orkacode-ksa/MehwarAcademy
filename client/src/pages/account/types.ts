export interface Entitlements {
  planCode: string;
  planName: string;
  status: "TRIAL" | "ACTIVE" | "FREE";
  periodEnd: string | null;
  maxCourses: number | null;
  storageMb: number;
  generationsPerMonth: number;
  bankCoursesPerYear: number;
  bankCoursesUsed: number;
}
export interface Usage {
  courses: number;
  storageBytes: number;
  generationsThisMonth: number;
}
export interface Order {
  id: string;
  number: string;
  kind: "PLAN" | "BANK_COURSE";
  titleAr: string;
  amount: number;
  status: "AWAITING_PAYMENT" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "CANCELED";
  rejectReason: string | null;
  createdAt: string;
  submittedAt: string | null;
  payerName: string | null;
}
export interface Plan {
  id: string;
  code: string;
  nameAr: string;
  priceMonthly: number;
  priceYearly: number;
  maxCourses: number | null;
  storageMb: number;
  generationsPerMonth: number;
  bankCoursesPerYear: number;
  features: string[];
  active: boolean;
  sortOrder: number;
  audience: string;
}
export interface BankAccount {
  id: string;
  bankName: string;
  accountName: string;
  iban: string;
  accountNumber: string | null;
  active: boolean;
}

export const ORDER_TONE = {
  AWAITING_PAYMENT: "amber",
  UNDER_REVIEW: "amber",
  APPROVED: "teal",
  REJECTED: "crimson",
  CANCELED: "neutral",
} as const;

export const mb = (bytes: number) => Math.round((bytes / (1024 * 1024)) * 10) / 10;
export const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("ar-SA-u-nu-latn-ca-gregory") : "—");
export const sar = (n: number) => `${new Intl.NumberFormat("ar-SA-u-nu-latn").format(n)} ر.س`;
