import type { Verification } from '@aios/domain';

export interface VerificationRepository {
  findById(id: string): Promise<Verification | null>;
  findByPlacementId(placementId: string): Promise<Verification[]>;
  save(verification: Verification): Promise<Verification>;
}