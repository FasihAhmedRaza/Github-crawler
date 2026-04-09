import { CrawlRepositoriesUseCase } from '../src/usecases/CrawlRepositoriesUseCase';
import { IGitHubClient } from '../src/domain/IGitHubClient';
import { IRepositoryStorage } from '../src/domain/IRepositoryStorage';
import { Repository } from '../src/domain/Repository';

describe('CrawlRepositoriesUseCase', () => {
    let mockGitHubClient: jest.Mocked<IGitHubClient>;
    let mockStorage: jest.Mocked<IRepositoryStorage>;
    let useCase: CrawlRepositoriesUseCase;

    beforeEach(() => {
        mockGitHubClient = {
            crawlRepositories: jest.fn()
        };
        mockStorage = {
            init: jest.fn().mockResolvedValue(undefined),
            upsertBatch: jest.fn().mockResolvedValue(undefined),
            close: jest.fn().mockResolvedValue(undefined)
        };
        useCase = new CrawlRepositoriesUseCase(mockGitHubClient, mockStorage);
    });

    it('should crawl and upsert repositories', async () => {
        const mockedRepos: Repository[] = [
            { id: '1', name: 'repo1', owner: 'user1', stars: 10, updatedAt: new Date() }
        ];

        // Ensure proper typing for AsyncGenerator
        async function* mockGenerator() {
            yield mockedRepos;
        }

        mockGitHubClient.crawlRepositories.mockReturnValue(mockGenerator());

        await useCase.execute(1);

        expect(mockStorage.init).toHaveBeenCalledTimes(1);
        expect(mockGitHubClient.crawlRepositories).toHaveBeenCalledWith(1);
        expect(mockStorage.upsertBatch).toHaveBeenCalledWith(mockedRepos);
        expect(mockStorage.close).toHaveBeenCalledTimes(1);
    });

    it('should close storage on error', async () => {
        const error = new Error('GitHub API Error');
        
        async function* mockGenerator() {
            throw error;
        }

        mockGitHubClient.crawlRepositories.mockReturnValue(mockGenerator());

        await expect(useCase.execute(1)).rejects.toThrow('GitHub API Error');
        expect(mockStorage.init).toHaveBeenCalledTimes(1);
        expect(mockStorage.close).toHaveBeenCalledTimes(1);
    });
});
