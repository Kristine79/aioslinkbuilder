import type { Verification, VerificationDraft } from '@aios/domain';

export interface VerificationRepository {
  findById(id: string): Promise<Verification | null>;
  findByPlacementId(placementId: string): Promise<Verification[]>;
  create(draft: VerificationDraft): Promise<Verification>;
  save(verification: Verification): Promise<Verification>;
}
