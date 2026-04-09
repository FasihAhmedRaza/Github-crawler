import { GitHubGraphQLAdapter } from './adapters/GitHubGraphQLAdapter';
import { PostgresRepositoryAdapter } from './adapters/PostgresRepositoryAdapter';
import { LocalFileRepositoryAdapter } from './adapters/LocalFileRepositoryAdapter';
import { CrawlRepositoriesUseCase } from './usecases/CrawlRepositoriesUseCase';
import { IRepositoryStorage } from './domain/IRepositoryStorage';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
    const token = process.env.GITHUB_TOKEN;
    const dbUrl = process.env.DATABASE_URL;

    if (!token) {
        console.error('Missing GITHUB_TOKEN environment variable');
        process.exit(1);
    }

    let storage: IRepositoryStorage;

    if (dbUrl) {
        console.log('Using real Postgres storage...');
        storage = new PostgresRepositoryAdapter(dbUrl);
    } else {
        console.warn('⚠️ No DATABASE_URL found. Running in LOCAL FILE mode (Zero-Setup).');
        storage = new LocalFileRepositoryAdapter();
    }

    const githubClient = new GitHubGraphQLAdapter(token);
    const useCase = new CrawlRepositoriesUseCase(githubClient, storage);

    // If a target count is passed as argument, use it; otherwise default to 100,000
    const targetArg = process.argv[2] ? parseInt(process.argv[2], 10) : 100000;
    
    await useCase.execute(targetArg);
}

main().catch(err => {
    console.error('Fatal error', err);
    process.exit(1);
});
