import { IGitHubClient } from '../domain/IGitHubClient';
import { IRepositoryStorage } from '../domain/IRepositoryStorage';

export class CrawlRepositoriesUseCase {
    constructor(
        private githubClient: IGitHubClient,
        private storage: IRepositoryStorage
    ) {}

    async execute(targetCount: number = 100000): Promise<void> {
        console.log(`Starting crawl process for ${targetCount} repositories...`);
        
        await this.storage.init();

        try {
            const batchGenerator = this.githubClient.crawlRepositories(targetCount);
            
            for await (const batch of batchGenerator) {
                if (batch.length > 0) {
                    await this.storage.upsertBatch(batch);
                }
            }
            console.log('Crawl completed successfully.');
        } catch (error) {
            console.error('Crawl failed with error:', error);
            throw error;
        } finally {
            await this.storage.close();
        }
    }
}
