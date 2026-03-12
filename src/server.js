const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
require('dotenv').config();

const { validateEmail } = require('./validator');
const { searchGoogle, extractContactsWithGroq } = require('./discovery');
const { buildSenderProfile } = require('./sender');
const { generatePersonalizedEmails } = require('./emailGenerator');
const { extractPdfText, summarizePdfWithGroq, fileToBase64 } = require('./pdfExtractor');

// In-memory store for the uploaded PDF attachment
let attachedPdf = null; // { filePath, fileName, base64, summary }

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Multer for Excel uploads
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, 'uploads/'),
        filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
    }),
    fileFilter: (req, file, cb) => {
        const ok = /csv|xlsx|xls/.test(path.extname(file.originalname).toLowerCase());
        ok ? cb(null, true) : cb(new Error('Only Excel/CSV files allowed'));
    }
});

// Multer for PDF uploads
const uploadPdf = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, 'uploads/'),
        filename: (req, file, cb) => cb(null, 'attachment_' + Date.now() + '.pdf')
    }),
    fileFilter: (req, file, cb) => {
        const ok = /pdf/.test(path.extname(file.originalname).toLowerCase());
        ok ? cb(null, true) : cb(new Error('Only PDF files are allowed'));
    },
    limits: { fileSize: 200 * 1024 * 1024 } // 200 MB max
});

// ─────────────────────────────────────────────────────────────
// PDF Upload & Understanding
// ─────────────────────────────────────────────────────────────
app.post('/api/upload-pdf', uploadPdf.single('pdf'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Please upload a PDF file' });

    try {
        const filePath = req.file.path;
        const fileName = req.file.originalname;

        // Extract text from PDF
        const rawText = await extractPdfText(filePath);

        // Summarize with Groq
        const summary = await summarizePdfWithGroq(rawText, fileName);

        // Store globally for this session
        // Clean up previous attachment if any
        if (attachedPdf && fs.existsSync(attachedPdf.filePath)) {
            fs.unlinkSync(attachedPdf.filePath);
        }

        attachedPdf = {
            filePath,
            fileName,
            base64: fileToBase64(filePath),
            summary
        };

        console.log(`PDF attached: ${fileName} (${rawText.length} chars extracted)`);
        res.json({ fileName, summary });
    } catch (err) {
        console.error('PDF upload error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/upload-pdf', (req, res) => {
    if (attachedPdf && fs.existsSync(attachedPdf.filePath)) {
        fs.unlinkSync(attachedPdf.filePath);
    }
    attachedPdf = null;
    res.json({ message: 'Attachment removed' });
});

// ─────────────────────────────────────────────────────────────
// STEP 1: Build Sender Profile
// ─────────────────────────────────────────────────────────────
app.post('/api/sender-profile', async (req, res) => {
    const { companyName, website } = req.body;
    if (!companyName) return res.status(400).json({ error: 'Company name is required' });

    try {
        console.log(`Building sender profile for: ${companyName}`);
        const profile = await buildSenderProfile(companyName, website || '');
        res.json({ profile });
    } catch (err) {
        console.error('Sender profile error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// STEP 2: Discover Recipients via Search
// ─────────────────────────────────────────────────────────────
app.post('/api/discover', async (req, res) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Search query is required' });

    try {
        const snippets = await searchGoogle(query);
        const contacts = await extractContactsWithGroq(snippets);

        // Validate emails
        const validated = await Promise.all(contacts.map(async (c) => {
            const v = await validateEmail(c.Email);
            return { ...c, isValid: v.isValid, validationReason: v.reason };
        }));

        res.json({ contacts: validated, total: validated.length });
    } catch (err) {
        console.error('Discovery error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// STEP 3: Generate Personalized Emails
// ─────────────────────────────────────────────────────────────
app.post('/api/generate-emails', async (req, res) => {
    const { senderProfile, recipients, customInstructions } = req.body;

    if (!senderProfile) return res.status(400).json({ error: 'Sender profile is required' });
    if (!recipients || recipients.length === 0) return res.status(400).json({ error: 'Recipients list is empty' });

    try {
        // Include PDF summary in instructions if a PDF was uploaded
        let finalInstructions = customInstructions || '';
        if (attachedPdf) {
            finalInstructions += `\n\nThe sender is also attaching a document called "${attachedPdf.fileName}". Here is what the document contains:\n${attachedPdf.summary}\n\nMention this document naturally in the email and encourage the recipient to read it.`;
        }

        console.log(`Generating ${recipients.length} personalized emails${attachedPdf ? ' (with PDF context)' : ''}...`);
        const emailsWithContent = await generatePersonalizedEmails(senderProfile, recipients, finalInstructions);
        res.json({ recipients: emailsWithContent, pdfAttached: !!attachedPdf, pdfName: attachedPdf?.fileName });
    } catch (err) {
        console.error('Email generation error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────
// STEP 4: Send Emails via ZeptoMail
// ─────────────────────────────────────────────────────────────
app.post('/api/send-emails', async (req, res) => {
    const { recipients } = req.body;

    if (!recipients || recipients.length === 0) {
        return res.status(400).json({ error: 'Recipients list is empty' });
    }

    const API_KEY = process.env.ZEPTOMAIL_API_KEY;
    const SENDER_EMAIL = process.env.ZEPTOMAIL_SENDER_EMAIL;
    const SENDER_NAME = process.env.ZEPTOMAIL_SENDER_NAME;

    if (!API_KEY || API_KEY === 'your_zeptomail_api_key_here') {
        return res.status(401).json({ error: 'ZeptoMail API key not configured' });
    }

    const results = { success: 0, failed: 0, errors: [] };

    // Build attachment payload once if PDF exists
    const attachments = attachedPdf ? [{
        name: attachedPdf.fileName,
        content: attachedPdf.base64,
        mime_type: 'application/pdf'
    }] : [];

    for (const recipient of recipients) {
        const email = recipient.Email || recipient.email;
        const subject = recipient.generatedSubject || 'Hello from us';
        const body = recipient.generatedBody || '<p>Please see our introduction.</p>';

        if (!email) {
            results.failed++;
            results.errors.push(`No email for: ${recipient.Name}`);
            continue;
        }

        try {
            const payload = {
                from: { address: SENDER_EMAIL, name: SENDER_NAME },
                to: [{ email_address: { address: email } }],
                subject,
                htmlbody: body
            };
            if (attachments.length) payload.attachments = attachments;

            await axios.post('https://api.zeptomail.com/v1.1/email', payload, {
                headers: { 'Authorization': API_KEY, 'Content-Type': 'application/json' }
            });
            results.success++;
        } catch (err) {
            results.failed++;
            results.errors.push(`Failed to send to ${email}: ${err.message}`);
        }
    }

    res.json({ message: 'Campaign complete', results });
});

// ─────────────────────────────────────────────────────────────
// File Upload (Manual Import)
// ─────────────────────────────────────────────────────────────
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Please upload a file' });

    try {
        const wb = xlsx.readFile(req.file.path);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(ws);
        fs.unlinkSync(req.file.path);
        res.json({ count: data.length, allData: data });
    } catch (err) {
        res.status(500).json({ error: 'Failed to parse file' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
