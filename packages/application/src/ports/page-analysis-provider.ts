import type { PageAnalysis } from '@aios/domain';

/**
 * Page analysis provider port.
 *
 * A real implementation crawls the target page and returns measured signals
 * (title, type, indexation, outbound links, …). The demo uses a mock that
 * returns SYNTHETIC data. The application layer merges provider output with
 * AI estimates and always keeps the provenance explicit.
 */
export interface PageAnalysisProvider {
  readonly name: string;
  analyzePage(input: { platformName: string; url: string | null }): Promise<PageAnalysis>;
}
