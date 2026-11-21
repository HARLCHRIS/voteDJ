import type {
  AdminRole,
  AllowedScore,
  DeviceEventType,
  DeviceStatus,
  PerformanceStatus,
  RoundName,
  RoundStatus,
} from './database';

export type {
  AdminRole,
  AllowedScore,
  DeviceEventType,
  DeviceStatus,
  PerformanceStatus,
  RoundName,
  RoundStatus,
};

export const ALLOWED_SCORES: readonly AllowedScore[] = [2, 4, 6, 8, 10] as const;

export type UserRole = 'super_admin' | 'moderator' | 'voter' | 'visitor';

export type RequestStatus = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T> {
  status: RequestStatus;
  data: T | null;
  error: string | null;
}

export interface AuthSessionState {
  status: RequestStatus;
  userId: string | null;
  role: UserRole;
  isAuthenticated: boolean;
  displayName: string | null;
  error: string | null;
}

export interface PublicDjProfile {
  id: string;
  stageName: string;
  realName: string | null;
  bio: string | null;
  genre: string | null;
  photoUrl: string | null;
  mediaUrl: string | null;
  socialLinks: Record<string, string>;
}

export interface PublicRoundSummary {
  id: string;
  name: RoundName;
  orderNumber: 1 | 2;
  status: RoundStatus;
  minScoresRequired: number;
}

export interface PublicPerformanceItem {
  id: string;
  roundId: string;
  roundName: RoundName;
  performanceOrder: number;
  status: PerformanceStatus;
  openedAt: string | null;
  closedAt: string | null;
  isQualified: boolean;
  dj: PublicDjProfile;
}

export interface LiveStatusPayload {
  eventName: string;
  activeRound: PublicRoundSummary | null;
  openPerformance: PublicPerformanceItem | null;
  nextPerformancePhotoUrl?: string | null;
  lastClosedPerformance?: {
    id: string;
    stageName: string;
    roundName: RoundName;
    performanceOrder: number;
    photoUrl: string | null;
    closedAt: string | null;
  } | null;
  totalPerformancesInRound: number;
  closedCountInRound: number;
  updatedAt: string;
}

export interface VoterScoreReceipt {
  scoreId: string;
  performanceId: string;
  score: AllowedScore;
  updatedAt: string;
}

export interface DeviceBindingResult {
  bound: boolean;
  deviceId: string | null;
  voterId: string | null;
  conflictType: 'second_account' | 'other_device' | 'blocked' | null;
  message: string | null;
}

export interface AdminDjFormInput {
  stageName: string;
  roundId: string;
  realName?: string;
  bio?: string;
  genre?: string;
  photoUrl?: string;
  mediaUrl?: string;
}

export interface CsvDjRowError {
  rowNumber: number;
  rawName: string;
  rawRound: string;
  reason: string;
}

export interface CsvDjImportReport {
  totalRows: number;
  importedCount: number;
  errors: CsvDjRowError[];
}

export interface AdminPerformanceRankingRow {
  performanceId: string;
  roundId: string;
  roundName: RoundName;
  performanceOrder: number;
  status: PerformanceStatus;
  isQualified: boolean;
  djId: string;
  stageName: string;
  genre: string | null;
  photoUrl: string | null;
  scoresCount: number;
  scoresSum: number;
  publicAvg: number;
  publicRank: number | null;
  meetsMinThreshold: boolean;
  minScoresRequired: number;
}

export interface FraudAlertItem {
  id: string;
  type: 'burst_score' | 'multi_account_ip' | 'multi_account_fingerprint' | 'device_conflict';
  severity: 'medium' | 'high';
  title: string;
  description: string;
  performanceId: string | null;
  deviceId: string | null;
  voterId: string | null;
  createdAt: string;
}

export interface InAppBrowserDetection {
  isInApp: boolean;
  appName: 'WhatsApp' | 'Facebook' | 'Instagram' | 'TikTok' | 'Autre' | null;
}

export interface TurnstileRenderOptions {
  sitekey: string;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact' | 'flexible';
  appearance?: 'always' | 'execute' | 'interaction-only';
  callback?: (token: string) => void;
  'error-callback'?: (errorCode?: string) => void;
  'expired-callback'?: () => void;
}

export interface RoundScheduleInfo {
  dateLabel: string;
  shortDateLabel: string;
  venueLabel: string;
}

export interface TurnstileGlobalApi {
  render: (
    container: HTMLElement,
    options: TurnstileRenderOptions
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}

