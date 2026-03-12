# Bulk Mailer Pro | Smart Email Campaign Wizard

Bulk Mailer Pro is a sophisticated, AI-powered tool designed to streamline cold email outreach. It automates the entire process from company research and contact discovery to generating highly personalized, PDF-aware emails and sending them via ZeptoMail.

## ✨ Key Features

- **Step 1: AI-Powered Company Profiling** – Automatically researches your company online to build a compelling sender profile.
- **Step 2: Pro Contact Discovery** – Uses advanced Google search strategies to find relevant leads (LinkedIn, Yellow Pages, etc.) and extracts their contact details with AI.
- **Step 3: PDF-Aware Email Generation** – Upload a PDF (brochure, catalogue, or proposal). Our AI reads the document and uses its contents as the primary source for email personalization.
- **Step 4: Smart Personalization** – Generates captivating emails with pattern-interrupting hooks and specific call-to-actions tailored to each recipient.
- **Two-Column Professional UI** – A smooth, dark-mode dashboard with a persistent Activity Log for real-time progress monitoring.

## 🛠️ Tech Stack

- **Backend**: Node.js, Express
- **AI Intelligence**: [Groq AI](https://groq.com/) (Llama 3.3 70B)
- **PDF Processing**: `pdf-parse`
- **Email Delivery**: [ZeptoMail](https://www.zoho.com/zeptomail/)
- **Frontend**: Vanilla HTML5, CSS3, JavaScript (Inter font & FontAwesome)

## 🚀 Getting Started

### Prerequisites

- Node.js installed on your system.
- API keys for **Groq** and **ZeptoMail**.

### Installation

1. Clone or download the repository.
2. Install dependencies:
   ```bash
   npm install
   ```

### Configuration

Create a `.env` file in the root directory and add your credentials:

```env
# Groq AI
GROQ_API_KEY=your_groq_api_key_here

# ZeptoMail
ZEPTOMAIL_API_KEY=your_zeptomail_api_key_here
ZEPTOMAIL_SENDER_EMAIL=your_verified_sender_email@example.com
ZEPTOMAIL_SENDER_NAME="Your Company Name"
```

### Running the App

Start the server:
```bash
npm start
```
Open your browser and navigate to `http://localhost:3000`.

## 📜 Repository Structure

- `/public`: Frontend assets (UI, logic, and styles).
- `/src`: Backend logic, including AI prompt engineering and email handlers.
- `server.js`: Main Express server configuration.
- `.gitignore`: Standard exclusions for Node.js projects.

## 🔒 Security Note

This tool hides infrastructure details from the client-side for enhanced professionalism and security. Always ensure your `.env` file is excluded from version control (included in the default `.gitignore`).
