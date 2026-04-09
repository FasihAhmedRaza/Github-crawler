import express from 'express';
import cors from 'cors';
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
// Serve the static frontend files
app.use(express.static(path.join(__dirname, '../../public')));

// API Endpoint to fetch paginated repositories
app.get('/api/repositories', async (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = (page - 1) * limit;

        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) {
            // Fallback for Local JSON Mode
            const fs = require('fs/promises');
            const data = await fs.readFile(path.join(process.cwd(), 'crawled_repositories.json'), 'utf-8');
            const parsed = JSON.parse(data);
            const array = Object.values(parsed);
            
            // @ts-ignore
            array.sort((a, b) => b.stars - a.stars);
            
            const total = array.length;
            const paginatedData = array.slice(offset, offset + limit);
            
            return res.json({
                data: paginatedData,
                pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
            });
        }

        // Database Mode
        const client = new Client({ connectionString: dbUrl });
        await client.connect();
        
        // Get total count
        const countResult = await client.query('SELECT COUNT(*) FROM github_repositories');
        const total = parseInt(countResult.rows[0].count);
        
        // Get paginated data
        const queryResult = await client.query(`
            SELECT * FROM github_repositories 
            ORDER BY stars DESC 
            LIMIT $1 OFFSET $2
        `, [limit, offset]);
        
        await client.end();
        
        res.json({
            data: queryResult.rows,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(port, () => {
    console.log(`\n🚀 UI Dashboard is running!`);
    console.log(`✨ Open http://localhost:${port} in your browser.\n`);
});
