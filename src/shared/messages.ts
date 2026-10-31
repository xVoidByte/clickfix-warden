import type { DisplayPart } from '../engine/types';
import type { FeedHit } from '../feed/types';

export type DetectionKind =
  | 'clipboard'
  | 'manual-copy'
  | 'paste'
  | 'protocol'
  | 'fullscreen'
  | 'page-instructions'
  | 'web3-loader'
  | 'reputation'
  | 'reputation-block';

export type DetectionAction = 'blocked' | 'warned' | 'copied-anyway' | 'continued' | 'trusted';

export interface Detection {
  id: string;
  time: string;
  kind: DetectionKind;
  action: DetectionAction;
  url: string;
  host: string;
  score?: number;
  reasons: string[];
  command?: string;
}

/** What an in-page dialog shows, built by the content script that caught the problem. */
export interface AlertData {
  kind: DetectionKind;
  host: string;
  score?: number;
  reasons: { id: string; text: string }[];
  display?: DisplayPart[];
  decoded?: string[];
  original?: string;
  detail?: string;
  hits?: FeedHit[];
}

export interface PageStatus {
  hits: FeedHit[];
  trusted: boolean;
}

export type Message =
  | { type: 'page-status'; url: string }
  | { type: 'lookup-targets'; urls: string[] }
  | { type: 'lookup-url'; url: string }
  | { type: 'log'; detection: Omit<Detection, 'id' | 'time'> }
  | { type: 'show-alert'; alert: AlertData }
  | { type: 'trust-site'; host: string }
  | { type: 'untrust-site'; host: string }
  | { type: 'leave-site' }
  | { type: 'bypass'; url: string }
  | { type: 'update-now' }
  | { type: 'clear-log' };

/** Messages the background sends into a tab. */
export type TabMessage = { type: 'reputation-update' } | { type: 'show-alert'; alert: AlertData };
