export interface Platform {
  id: string;
  name: string;
  url: string | null;
  country: string | null;
  categoryId: string | null;
  notes: string | null;
  metadata: Readonly<Record<string, unknown>> | null;
}
