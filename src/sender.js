const axios = require('axios');
require('dotenv').config();

const SERPER_API_KEY = process.env.SERPER_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

/**
 * Researches the sender's company to build a profile.
 * @param {string} companyName
 * @param {string} website - optional
 * @returns {Promise<Object>} Sender profile
 */
async function buildSenderProfile(companyName, website) {
    let rawContent = '';

    // Strategy 1: Search the web for the company
    try {
        const searchQuery = website
            ? `"${companyName}" site:${website} OR "${companyName}" about services`
            : `"${companyName}" about services what they do`;

        const response = await axios.post('https://google.serper.dev/search', {
            q: searchQuery,
            num: 8
        }, {
            headers: { 'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json' }
        });

        const items = response.data.organic || [];
        rawContent = items.map(i => `${i.title}: ${i.snippet}`).join('\n---\n');
    } catch (err) {
        console.error('Serper search error for sender:', err.message);
    }

    // If no content from search, use the website/company name as context
    if (!rawContent) {
        rawContent = `Company: ${companyName}. Website: ${website || 'Not provided'}.`;
    }

    // Use Groq AI to summarize the sender profile
    const prompt = `
Based on the following web search results about "${companyName}", create a company profile.
Output a JSON object with keys:
- "name": The company's full name
- "website": The website URL (use "${website || 'unknown'}")
- "description": 2-3 sentences about what they do and the value they offer
- "services": An array of 3-5 key services or products they offer
- "tone": Suggested email tone (e.g. "professional", "friendly", "formal")

Search results:
${rawContent}

JSON only:
    `.trim();

    try {
        const aiResponse = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' }
        }, {
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const profile = JSON.parse(aiResponse.data.choices[0].message.content);
        profile.name = profile.name || companyName;
        return profile;
    } catch (err) {
        console.error('Groq profile error:', err.response?.data || err.message);
        return {
            name: companyName,
            website: website || '',
            description: `${companyName} is a company offering professional services.`,
            services: ['Professional services'],
            tone: 'professional'
        };
    }
}

module.exports = { buildSenderProfile };
