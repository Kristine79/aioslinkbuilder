export interface Company {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  geography: string[];
  locations: string[];
  products: string[];
  targetAudience: string[];
  website: string | null;
  metadata: Readonly<Record<string, unknown>> | null;
  createdAt: Date;
  updatedAt: Date;
}
