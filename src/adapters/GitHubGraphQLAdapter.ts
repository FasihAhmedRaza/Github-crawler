import { IGitHubClient } from '../domain/IGitHubClient';
import { Repository } from '../domain/Repository';
import https from 'https';

export class GitHubGraphQLAdapter implements IGitHubClient {
    private token: string;
    private maxRetries = 3;

    constructor(token: string) {
        this.token = token;
    }

    async *crawlRepositories(targetCount: number): AsyncGenerator<Repository[], void, unknown> {
        let fetchedTotal = 0;
        let currentDate = new Date('2010-01-01T00:00:00Z'); // Start from a date where there's plenty of repos

        while (fetchedTotal < targetCount) {
            const dateString = currentDate.toISOString().split('T')[0];
            const queryString = `is:public created:${dateString}`;
            
            let cursor: string | null = null;
            let hasNextPage = true;

            while (hasNextPage && fetchedTotal < targetCount) {
                const query = `
                    query ($queryString: String!, $cursor: String) {
                        search(query: $queryString, type: REPOSITORY, first: 100, after: $cursor) {
                            pageInfo {
                                endCursor
                                hasNextPage
                            }
                            nodes {
                                ... on Repository {
                                    id
                                    name
                                    owner {
                                        login
                                    }
                                    stargazerCount
                                }
                            }
                        }
                        rateLimit {
                            cost
                            remaining
                            resetAt
                        }
                    }
                `;

                const variables = { queryString, cursor };
                
                try {
                    const response = await this.executeGraphql(query, variables);
                    
                    if (response.errors) {
                        console.error('GraphQL Errors:', response.errors);
                        throw new Error('GraphQL returned errors');
                    }

                    const nodes = response.data.search.nodes || [];
                    const rateLimit = response.data.rateLimit;
                    
                    if (nodes.length > 0) {
                        const parsedBatch = nodes.map((node: any) => ({
                            id: node.id,
                            name: node.name,
                            owner: node.owner.login,
                            stars: node.stargazerCount,
                            updatedAt: new Date()
                        }));

                        // Yield only the exact amount remaining if we are overshooting
                        const needed = targetCount - fetchedTotal;
                        const toYield = parsedBatch.slice(0, needed);
                        
                        yield toYield;
                        fetchedTotal += toYield.length;
                    }

                    console.log(`Fetched ${fetchedTotal}/${targetCount} repos. Date: ${dateString}, RateLimit Remaining: ${rateLimit.remaining}`);

                    if (rateLimit.remaining < 2) {
                        const resetTime = new Date(rateLimit.resetAt).getTime();
                        const now = Date.now();
                        const waitTime = Math.max(0, resetTime - now) + 5000; // Add 5 sec buffer
                        console.log(`Rate limit exhausted. Sleeping for ${waitTime / 1000} seconds until ${rateLimit.resetAt}...`);
                        await this.sleep(waitTime);
                    }

                    // Proceed to next page or next date
                    hasNextPage = response.data.search.pageInfo.hasNextPage;
                    cursor = response.data.search.pageInfo.endCursor;

                } catch (error) {
                    console.error('Error fetching from GitHub API, retrying in 10s...', error);
                    await this.sleep(10000);
                }
            }

            // Move to the next day
            currentDate.setDate(currentDate.getDate() + 1);
        }
    }

    private executeGraphql(query: string, variables: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const data = JSON.stringify({ query, variables });
            const options = {
                hostname: 'api.github.com',
                port: 443,
                path: '/graphql',
                method: 'POST',
                headers: {
                    'Authorization': `bearer ${this.token}`,
                    'Content-Type': 'application/json',
                    'Content-Length': data.length,
                    'User-Agent': 'CrawlerAssignment/1.0'
                }
            };

            const req = https.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => body += chunk);
                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 400) {
                        // Some robust error handling
                        if (res.statusCode === 403 && res.headers['x-ratelimit-reset']) {
                            const resetTime = parseInt(res.headers['x-ratelimit-reset'] as string, 10) * 1000;
                            console.log(`HTTP 403 Rate limited. Pausing until limit resets.`);
                        }
                        reject(new Error(`HTTP ${res.statusCode}: ${body}`));
                    } else {
                        try {
                            const parsed = JSON.parse(body);
                            resolve(parsed);
                        } catch (e) {
                            reject(e);
                        }
                    }
                });
            });

            req.on('error', (e) => reject(e));
            req.write(data);
            req.end();
        });
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
