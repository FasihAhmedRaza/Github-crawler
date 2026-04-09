export interface Repository {
    id: string; // GraphQL node ID
    name: string;
    owner: string;
    stars: number;
    updatedAt: Date;
}
