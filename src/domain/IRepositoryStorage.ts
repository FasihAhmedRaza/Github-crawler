import { Repository } from "./Repository";

export interface IRepositoryStorage {
    /**
     * Initializes the underlying storage schema.
     */
    init(): Promise<void>;

    /**
     * Performs an efficient bulk upsert of repositories.
     * @param repositories A batch of repositories to upsert
     */
    upsertBatch(repositories: Repository[]): Promise<void>;
    
    /**
     * Closes the connection to the storage.
     */
    close(): Promise<void>;
}
