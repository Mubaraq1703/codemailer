const fs = require('fs');
const path = require('path');
const axios = require('axios');
const pdfParse = require('pdf-parse');

const GROQ_API_KEY = process.env.GROQ_API_KEY;

/**
 * Extracts raw text from a PDF file using pdf-parse.
 * Falls back gracefully if extraction fails.
 * @param {string} filePath - Absolute path to the PDF
 * @returns {Promise<string>} Extracted text
 */
async function extractPdfText(filePath) {
    try {
        const buffer = fs.readFileSync(filePath);
        const data = await pdfParse(buffer);
        const text = data.text.trim();
        if (!text) throw new Error('PDF appears to be image-based (no selectable text found).');
        console.log(`PDF extracted: ${text.length} characters from ${path.basename(filePath)}`);
        return text;
    } catch (err) {
        console.error('PDF extraction error:', err.message);
        throw new Error(`Could not read PDF: ${err.message}`);
    }
}

/**
 * Uses Groq AI to summarize and understand the PDF content.
 * @param {string} rawText - Extracted PDF text
 * @param {string} fileName - Original file name for context
 * @returns {Promise<string>} AI summary of the PDF
 */
async function summarizePdfWithGroq(rawText, fileName) {
    // Trim to avoid token overflows — keep first 6000 chars
    const trimmed = rawText.substring(0, 6000);

    const prompt = `
You are an assistant helping to understand the content of an uploaded document.

Document name: "${fileName}"

Document content (may be truncated):
${trimmed}

Please provide:
1. A 2-3 sentence summary of what this document is about
2. The key points or offerings described
3. Any specific details useful for crafting a personalized marketing/introduction email (e.g. services, prices, achievements)

Be concise and factual. Output plain text.
    `.trim();

    try {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }]
        }, {
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data.choices[0].message.content.trim();
    } catch (err) {
        console.error('Groq PDF summarization error:', err.response?.data || err.message);
        return `Document attached: ${fileName}`;
    }
}

/**
 * Converts a file to a base64 string for email attachments.
 * @param {string} filePath
 * @returns {string} Base64 encoded content
 */
function fileToBase64(filePath) {
    return fs.readFileSync(filePath).toString('base64');
}

module.exports = { extractPdfText, summarizePdfWithGroq, fileToBase64 };
