const axios = require('axios');
require('dotenv').config();

const GROQ_API_KEY = process.env.GROQ_API_KEY;

/**
 * Generates personalized email content for each recipient using Groq AI.
 * @param {Object} senderProfile - The sender's company profile
 * @param {Object[]} recipients - Array of {Name, Email, Address, ...}
 * @param {string} customInstructions - Optional extra instructions from user
 * @returns {Promise<Object[]>} Recipients with generated subject + body
 */
async function generatePersonalizedEmails(senderProfile, recipients, customInstructions = '') {
    const results = [];

    // Process in batches to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);

        const batchPromises = batch.map(async (recipient) => {
            const recipientName = recipient.Name || recipient.Organization || 'there';
            const recipientAddress = recipient.Address || recipient.Location || '';

            const prompt = `
You are a world-class email copywriter — known for writing cold outreach emails that get replies.

Write a personalized cold outreach email on behalf of "${senderProfile.name}" to "${recipientName}".

━━━ SENDER INFO ━━━
- Company: ${senderProfile.name}
- Website: ${senderProfile.website || 'N/A'}
- What they do: ${senderProfile.description}
- Key services/products: ${(senderProfile.services || []).join(', ')}
- Communication tone: ${senderProfile.tone || 'professional'}

━━━ RECIPIENT ━━━
- Organization: ${recipientName}
${recipientAddress ? `- Location: ${recipientAddress}` : ''}

${customInstructions ? `━━━ DOCUMENT / EXTRA CONTEXT ━━━\n${customInstructions}\n` : ''}

━━━ WRITING RULES (follow strictly) ━━━
1. HOOK: Open with a captivating, pattern-interrupting first sentence that immediately grabs attention. Do NOT start with "I", "We", or the company name. Use a thought-provoking question, bold statement, or surprising fact relevant to the recipient's world.
2. RELEVANCE: Briefly connect what the sender does to a real pain point or goal the recipient likely has.
3. VALUE: Use any document content provided above as the MAIN source for what to offer — pull specific details, services, products, or achievements from it to make the email concrete and credible.
4. PERSONALIZATION: Mention the recipient organization by name at least once naturally.
5. CTA: End with ONE clear, low-friction call to action (e.g. "Would you be open to a quick 10-minute call this week?").
6. LENGTH: 150–220 words. No fluff. Every sentence must earn its place.
7. FORMAT: Use <p> tags for paragraphs. No headings. No bullet points in the body.

Return ONLY a valid JSON object with:
- "subject": A short, curiosity-driven subject line (max 8 words, no generic phrases like "Introduction" or "Partnership")
- "body": The full email body in HTML using <p> tags only
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

                const generated = JSON.parse(response.data.choices[0].message.content);
                return {
                    ...recipient,
                    generatedSubject: generated.subject || `Introducing ${senderProfile.name}`,
                    generatedBody: generated.body || '<p>Please see our attached introduction.</p>'
                };
            } catch (err) {
                console.error(`Failed to generate email for ${recipientName}:`, err.message);
                return {
                    ...recipient,
                    generatedSubject: `Introduction from ${senderProfile.name}`,
                    generatedBody: `<p>Dear ${recipientName},</p><p>We are ${senderProfile.name}. ${senderProfile.description}</p><p>We would love to connect with you.</p><p>Best regards,<br>${senderProfile.name}</p>`
                };
            }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
    }

    return results;
}

module.exports = { generatePersonalizedEmails };
