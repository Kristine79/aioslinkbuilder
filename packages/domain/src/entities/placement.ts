import type { PlacementStatus } from '../enums/placement-status.js';

export interface Placement {
  id: string;
  opportunityId: string;
  providerId: string | null;
  status: PlacementStatus;
  externalId: string | null;
  submittedAt: Date | null;
  publishedAt: Date | null;
  liveUrl: string | null;
  metadata: Readonly<Record<string, unknown>> | null;
  createdAt: Date;
  updatedAt: Date;
}
