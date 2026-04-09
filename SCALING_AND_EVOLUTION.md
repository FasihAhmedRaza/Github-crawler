# System Scaling and Evolution

## 1. Scaling to 500 Million Repositories

Scaling the crawler from 100,000 to 500 million repositories requires a significant shift from a single process to a highly distributed, horizontally scalable architecture, due to both API rate constraints and infrastructure limitations. 

Here is what I would do differently:

*   **Move away from sequential crawling in a single GitHub Action:**
    *   A single `GITHUB_TOKEN` is heavily rate-limited (1,000 requests/points per hour). Fetching 500 million repositories would take decades with a single token.
    *   Instead, adopt a distributed worker queue (e.g., Kafka, Amazon SQS, RabbitMQ).
    *   Create a pool of GitHub Personal Access Tokens (PATs) or a GitHub App mechanism to fan-out queries and respect rate limits across a massive array of workers.
*   **Decouple API Fetching from Database Writing:**
    *   The crawler workers should fetch data and push it into a message broker or a high-throughput stream (e.g., Kafka, Kinesis).
    *   A separate set of **consumer services** will batch these records to efficiently write to the database. This prevents database connection bottlenecks.
*   **Database Scaling:**
    *   A single Postgres instance may struggle with 500M highly volatile rows without sharding.
    *   Migrate to a horizontally partitioned PostgreSQL (e.g., Citus) or a distributed NoSQL/NewSQL database (e.g., Cassandra, CockroachDB, AWS DynamoDB) designed for write-heavy workloads.
    *   If using PostgreSQL, table partitioning (e.g., hash partitioning by `id` or range partitioning) is essential.
*   **Incremental Updates (Webhooks):**
    *   Instead of repeatedly polling and crawling 500 million repositories purely by querying changes via the API, rely on **GitHub Webhooks** (or GitHub Enterprise event streams if available) to actively push updates (like "star added") from GitHub's infrastructure direct to our ingestion endpoints. Continuous polling on 500M active repositories is wasteful.

---

## 2. Schema Evolution for High-Volatility Metadata

If we need to track rapidly changing metadata like issues, PRs, comments, and CI checks over time, adding all these fields to the `github_repositories` table is a bad practice. It leads to wide tables, massive I/O load, and too many row updates for a single entity. 

Instead, we must **normalize our schema and partition the data by domain model**. 

### A. Normalized Relational Schema

We should move from a single table to related entity tables. When a PR receives a new comment, we insert/update the comment, isolating the operation:

1.  **`github_repositories`**: Base entity (Id, Name, Stars, Owner). Updates here only happen when the repo properties change.
2.  **`pull_requests`**: (RepoID, PR_ID, Status, CreatedAt).
3.  **`pr_comments`**: (CommentID, PR_ID, Author, Content, CreatedAt, UpdatedAt).
4.  **`issues`**: (RepoID, IssueID, State).
5.  **`ci_checks`**: (CommitHash, Status, WorkflowRunID).

*Updating an issue with this model consists of upserting a single `issues` row, leaving the repository row entirely unaffected. This guarantees "minimal rows affected."*

### B. Efficient Write Strategies

*   **Append-Only or Log-Structured Models:** For events like "Comments" or "CI Checks" that grow endlessly, creating an append-only architecture (e.g., Event Sourcing or utilizing TimescaleDB) prevents the overhead of updating b-trees in traditional DBs.
*   **JSONB Data Columns:** For unstructured or highly varying data (e.g., CI check payloads), using a `JSONB` column structure in PostgreSQL allows us to dump variable metadata efficiently without executing frequent `ALTER TABLE` schema updates every time GitHub introduces a new feature.
*   **Change Data Capture (CDC):** As the dataset expands, relying on an analytical data warehouse (like Snowflake or BigQuery) allows us to replicate OLTP writes directly into OLAP engines. We can write updates swiftly into the RDS databases and let tools like Debezium fan out to analytical stores.
