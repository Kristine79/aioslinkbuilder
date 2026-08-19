import { DuckDuckGoSearchProvider } from '@aios/integrations';

async function main(): Promise<void> {
  const provider = new DuckDuckGoSearchProvider();
  try {
    const results = await provider.search('мебель на заказ Москва премиум', { maxResults: 6 });
    console.log('results:', results.length);
    for (const r of results.slice(0, 3)) console.log(`  ${r.url} | ${r.title}`);
  } catch (error) {
    console.log('search error:', error instanceof Error ? error.message : String(error));
  }
}

main().catch((error: unknown) => {
  console.error('FAILED:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
