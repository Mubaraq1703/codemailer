const dns = require('dns').promises;

/**
 * Validates email syntax and checks for MX records.
 * @param {string} email 
 * @returns {Promise<{isValid: boolean, reason: string}>}
 */
async function validateEmail(email) {
    // 1. Syntax Check
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(email)) {
        return { isValid: false, reason: 'Invalid syntax' };
    }

    // 2. Domain MX Record Check
    const domain = email.split('@')[1];
    try {
        const mxRecords = await dns.resolveMx(domain);
        if (mxRecords && mxRecords.length > 0) {
            return { isValid: true, reason: 'Valid (MX found)' };
        } else {
            return { isValid: false, reason: 'No MX records found' };
        }
    } catch (error) {
        if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
            return { isValid: false, reason: 'Domain not found or has no mail server' };
        }
        return { isValid: false, reason: `DNS Error: ${error.code}` };
    }
}

module.exports = { validateEmail };
