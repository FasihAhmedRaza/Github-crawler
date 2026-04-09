import { Repository } from "./Repository";

export interface IGitHubClient {
    /**
     * Crawl repositories iteratively starting from a target date range.
     * Yields batches of repositories back to the caller.
     * @param targetCount Total repositories to fetch
     */
    crawlRepositories(targetCount: number): AsyncGenerator<Repository[], void, unknown>;
}
