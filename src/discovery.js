const axios = require('axios');
require('dotenv').config();

const SERPER_API_KEY = process.env.SERPER_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

/**
 * Executes a user-provided search query via Serper.dev (Google Search).
 * @param {string} rawQuery - The exact query from the user (supports Google operators)
 * @returns {Promise<string[]>} List of result snippets
 */
async function searchGoogle(rawQuery) {
    if (!rawQuery || rawQuery.trim() === '') {
        throw new Error('Please provide a search query');
    }

    try {
        const response = await axios.post('https://google.serper.dev/search', {
            q: rawQuery,
            num: 20
        }, {
            headers: {
                'X-API-KEY': SERPER_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        const results = response.data;
        const snippets = [];

        if (results.organic) {
            results.organic.forEach(item => {
                snippets.push(`${item.title}: ${item.snippet} | URL: ${item.link}`);
            });
        }

        console.log(`Search returned ${snippets.length} results for query: "${rawQuery}"`);
        return snippets;
    } catch (error) {
        console.error('Serper Search Error:', error.response?.data || error.message);
        throw new Error('Search failed. Please check your SERPER_API_KEY.');
    }
}

/**
 * Uses Groq AI to extract contacts from search result snippets.
 * @param {string[]} snippets 
 * @returns {Promise<Object[]>}
 */
async function extractContactsWithGroq(snippets) {
    if (snippets.length === 0) return [];

    // Process in batches
    const batchSize = 15;
    const allContacts = [];

    for (let i = 0; i < snippets.length; i += batchSize) {
        const batch = snippets.slice(i, i + batchSize);

        const prompt = `
Extract business contact information from these Google search result snippets.

For each entry found, extract:
- "Name": Full name of person or organization/school name
- "Email": Email address (REQUIRED - skip if no email found)
- "Address": Physical address or location (if available)
- "Title": Job title or type of organization (e.g. "Secondary School", "CEO")

Output a JSON object with key "contacts" as an array.
Only return entries where an email address is clearly present.
Deduplicate by email.

Snippets:
${batch.join('\n---\n')}

JSON only:
        `.trim();

        try {
            const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' }
            }, {
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            const content = JSON.parse(response.data.choices[0].message.content);
            allContacts.push(...(content.contacts || []));
        } catch (error) {
            console.error('Groq AI batch error:', error.response?.data || error.message);
        }
    }

    // Deduplicate by email
    const emailsSeen = new Set();
    return allContacts.filter(c => {
        if (!c.Email || emailsSeen.has(c.Email.toLowerCase())) return false;
        emailsSeen.add(c.Email.toLowerCase());
        return true;
    });
}

module.exports = { searchGoogle, extractContactsWithGroq };
