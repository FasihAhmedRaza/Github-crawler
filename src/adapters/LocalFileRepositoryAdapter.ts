import { IRepositoryStorage } from '../domain/IRepositoryStorage';
import { Repository } from '../domain/Repository';
import * as fs from 'fs/promises';
import * as path from 'path';

export class LocalFileRepositoryAdapter implements IRepositoryStorage {
    private filePath: string;
    private data: Record<string, Repository> = {};

    constructor() {
        this.filePath = path.join(process.cwd(), 'crawled_repositories.json');
    }

    async init(): Promise<void> {
        try {
            const content = await fs.readFile(this.filePath, 'utf-8');
            this.data = JSON.parse(content);
            console.log(`[LOCAL STORAGE] Initialized. Loaded ${Object.keys(this.data).length} existing repositories from crawled_repositories.json`);
        } catch (error) {
            console.log('[LOCAL STORAGE] Initialized. Starting with a fresh file.');
            this.data = {};
        }
    }

    async upsertBatch(repositories: Repository[]): Promise<void> {
        // Upsert logically into our local dictionary
        repositories.forEach(repo => {
            this.data[repo.id] = {
                ...repo,
                updatedAt: new Date()
            };
        });

        // Save to file
        await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2));
        console.log(`[LOCAL STORAGE] Successfully saved batch of ${repositories.length} repositories to crawled_repositories.json (Total: ${Object.keys(this.data).length})`);
    }

    async close(): Promise<void> {
        console.log('[LOCAL STORAGE] Session ended.');
    }
}
