import { Client } from 'pg';
import { IRepositoryStorage } from '../domain/IRepositoryStorage';
import { Repository } from '../domain/Repository';

export class PostgresRepositoryAdapter implements IRepositoryStorage {
    private client: Client;

    constructor(connectionString: string) {
        this.client = new Client({ connectionString });
    }

    async init(): Promise<void> {
        await this.client.connect();
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS github_repositories (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                owner TEXT NOT NULL,
                stars INTEGER NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `;
        await this.client.query(createTableQuery);
    }

    async upsertBatch(repositories: Repository[]): Promise<void> {
        if (repositories.length === 0) return;

        // Construct the bulk upsert query safely
        // To prevent SQL injection, we will use parametrized queries.
        // It looks like: INSERT INTO ... VALUES ($1, $2, $3, $4), ($5, $6, $7, $8) ...
        const values: any[] = [];
        const placeholders: string[] = [];

        repositories.forEach((repo, index) => {
            const offset = index * 4;
            placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
            values.push(repo.id, repo.name, repo.owner, repo.stars);
        });

        const query = `
            INSERT INTO github_repositories (id, name, owner, stars)
            VALUES ${placeholders.join(', ')}
            ON CONFLICT (id) DO UPDATE SET 
                stars = EXCLUDED.stars,
                updated_at = CURRENT_TIMESTAMP;
        `;

        await this.client.query(query, values);
    }

    async close(): Promise<void> {
        await this.client.end();
    }
}
