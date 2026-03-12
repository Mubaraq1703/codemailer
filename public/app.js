document.addEventListener('DOMContentLoaded', () => {

    // ─── State ──────────────────────────────────────────────────
    let senderProfile = null;
    let discoveredContacts = [];
    let emailsWithContent = [];

    // ─── DOM References ──────────────────────────────────────────
    const $ = id => document.getElementById(id);

    // Step indicators
    const indicators = [1,2,3,4].map(i => $(`step-indicator-${i}`));
    const panels = [1,2,3,4].map(i => $(`step-${i}`));

    // ─── Helper: Navigate Steps ──────────────────────────────────
    function goToStep(n) {
        panels.forEach((p, i) => p.classList.toggle('active', i === n - 1));
        indicators.forEach((ind, i) => {
            ind.classList.remove('active', 'done');
            if (i < n - 1) ind.classList.add('done');
            if (i === n - 1) ind.classList.add('active');
        });
        // Update done circle icons
        indicators.forEach((ind, i) => {
            const circle = ind.querySelector('.step-circle');
            if (ind.classList.contains('done')) {
                circle.innerHTML = '<i class="fas fa-check"></i>';
            } else {
                circle.textContent = i + 1;
            }
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ─── Helper: Log ─────────────────────────────────────────────
    const logCard = $('logCard');
    const statusLog = $('statusLog');
    function log(msg, type = 'info') {
        const div = document.createElement('div');
        div.className = `log-item ${type === 'success' ? 'log-success' : type === 'error' ? 'log-error' : ''}`;
        div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        statusLog.prepend(div);
    }

    // ─── Helper: Custom Alert ─────────────────────────────────────
    function showAlert(message, title = 'Attention') {
        $('alertTitle').textContent = title;
        $('alertMessage').textContent = message;
        $('alertModal').style.display = 'flex';
    }

    $('closeAlertBtn').addEventListener('click', () => {
        $('alertModal').style.display = 'none';
    });

    $('alertModal').addEventListener('click', (e) => {
        if (e.target === $('alertModal')) $('alertModal').style.display = 'none';
    });

    // ─── Helper: Set button loading state ────────────────────────
    function setLoading(btn, loading, original) {
        if (loading) {
            btn.disabled = true;
            btn.dataset.original = btn.innerHTML;
            btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loading}`;
        } else {
            btn.disabled = false;
            btn.innerHTML = btn.dataset.original || original;
        }
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 1: Build Sender Profile
    // ─────────────────────────────────────────────────────────────
    $('buildProfileBtn').addEventListener('click', async () => {
        const name = $('companyName').value.trim();
        const website = $('companyWebsite').value.trim();

        if (!name) { showAlert('Please enter your company name'); return; }

        const btn = $('buildProfileBtn');
        setLoading(btn, 'Researching your company...');
        $('profileStatus').innerHTML = '<p class="text-muted" style="font-size:0.85rem">🔍 Searching the web for your company profile...</p>';
        log(`Researching company: ${name}...`);

        try {
            const res = await fetch('/api/sender-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyName: name, website })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error);

            senderProfile = data.profile;
            $('profileStatus').innerHTML = '';
            renderProfile(senderProfile);
            $('profileResult').style.display = 'block';
            log(`Profile built for: ${senderProfile.name}`, 'success');
        } catch (err) {
            $('profileStatus').innerHTML = `<p class="error-text">${err.message}</p>`;
            log(err.message, 'error');
        } finally {
            setLoading(btn, null);
        }
    });

    function renderProfile(p) {
        const hasWebsite = !!(p.website && p.website !== 'unknown');
        $('profileContent').innerHTML = `
            <div class="form-group" style="margin-bottom:1rem">
                <label style="display:flex; align-items:center; gap:0.4rem; margin-bottom:0.4rem">
                    <span>Company Description</span>
                    ${!hasWebsite ? '<span class="badge badge-primary" style="font-size:0.65rem">AI Generated — feel free to edit</span>' : ''}
                </label>
                <textarea id="profileDescTextarea" style="min-height:90px; font-size:0.88rem">${p.description}</textarea>
            </div>
            <div class="profile-grid">
                <div class="profile-item"><label>Company</label><p>${p.name}</p></div>
                <div class="profile-item"><label>Website</label><p>${p.website && p.website !== 'unknown' ? p.website : '—'}</p></div>
                <div class="profile-item"><label>Tone</label><p style="text-transform:capitalize">${p.tone || 'Professional'}</p></div>
            </div>
            <label style="margin-bottom:0.4rem; font-size:0.8rem; color:var(--text-muted); display:block">Services / Offerings</label>
            <div class="services-list">${(p.services || []).map(s => `<span class="service-tag">${s}</span>`).join('')}</div>
        `;

        // Live-sync textarea changes back to senderProfile
        document.getElementById('profileDescTextarea').addEventListener('input', (e) => {
            senderProfile.description = e.target.value;
        });
    }

    $('editProfileBtn').addEventListener('click', () => {
        $('profileResult').style.display = 'none';
    });

    $('proceedToStep2').addEventListener('click', () => goToStep(2));
    $('backToStep1').addEventListener('click', () => goToStep(1));

    // ─────────────────────────────────────────────────────────────
    // STEP 2: Discovery
    // ─────────────────────────────────────────────────────────────

    // ─── Query Builder: Auto-fill search bar ──────────────────────
    const qbSelects = ['qbTarget', 'qbCity', 'qbDomain', 'qbEmail'].map(id => $(id));

    function buildQuery() {
        const parts = qbSelects.map(s => s.value.trim()).filter(Boolean);
        if (parts.length > 0) {
            $('searchQuery').value = parts.join(' ');
        }
    }

    qbSelects.forEach(select => select.addEventListener('change', buildQuery));

    $('searchBtn').addEventListener('click', async () => {
        const query = $('searchQuery').value.trim();
        if (!query) { showAlert('Please enter a search query'); return; }

        const btn = $('searchBtn');
        setLoading(btn, 'Searching...');
        $('searchStatus').innerHTML = '<p class="text-muted" style="font-size:0.85rem">⚡ Executing Google search and extracting contacts with AI...</p>';
        $('searchResult').style.display = 'none';
        log(`Running search: "${query}"`);

        try {
            const res = await fetch('/api/discover', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error);

            discoveredContacts = data.contacts;
            $('searchStatus').innerHTML = `<p class="success-text">✅ Found ${data.total} contacts</p>`;
            $('contactCount').textContent = `${data.total} contacts`;
            renderContactsTable(discoveredContacts);
            $('searchResult').style.display = 'block';
            log(`Discovered ${data.total} contacts`, 'success');
        } catch (err) {
            $('searchStatus').innerHTML = `<p class="error-text">${err.message}</p>`;
            log(err.message, 'error');
        } finally {
            setLoading(btn, null);
        }
    });

    function renderContactsTable(contacts) {
        $('contactCount').textContent = `${contacts.length} contacts`;
        if (!contacts.length) {
            $('recipientsTable').innerHTML = '<p style="color:var(--text-muted); padding:1rem">No contacts yet. Use the search above or add manually below.</p>';
            return;
        }

        let html = `<table><thead><tr>
            <th>Name / Organization</th>
            <th>Email</th>
            <th>Title</th>
            <th>Status</th>
            <th></th>
        </tr></thead><tbody>`;

        contacts.forEach((c, i) => {
            const badge = c.isValid !== false
                ? `<span class="badge badge-success">Valid</span>`
                : `<span class="badge badge-error" title="${c.validationReason || ''}">Invalid</span>`;
            html += `<tr>
                <td>${c.Name || '—'}</td>
                <td>${c.Email}</td>
                <td>${c.Title || '—'}</td>
                <td>${badge}</td>
                <td><button onclick="removeContact(${i})" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:1rem" title="Remove"><i class="fas fa-times-circle"></i></button></td>
            </tr>`;
        });

        html += '</tbody></table>';
        $('recipientsTable').innerHTML = html;
    }

    // Remove a contact by index
    window.removeContact = (i) => {
        discoveredContacts.splice(i, 1);
        renderContactsTable(discoveredContacts);
        log(`Contact removed. ${discoveredContacts.length} remaining.`);
    };

    // Add contact manually
    $('addContactBtn').addEventListener('click', () => {
        const name = $('addName').value.trim();
        const email = $('addEmail').value.trim();
        const title = $('addTitle').value.trim();

        if (!email || !email.includes('@')) {
            $('addContactStatus').innerHTML = '<span class="error-text">Please enter a valid email address.</span>';
            return;
        }

        const exists = discoveredContacts.some(c => c.Email.toLowerCase() === email.toLowerCase());
        if (exists) {
            $('addContactStatus').innerHTML = '<span class="error-text">This email is already in the list.</span>';
            return;
        }

        discoveredContacts.push({ Name: name || 'Contact', Email: email, Title: title || '—', isValid: true });
        renderContactsTable(discoveredContacts);
        $('searchResult').style.display = 'block';
        $('addName').value = '';
        $('addEmail').value = '';
        $('addTitle').value = '';
        $('addContactStatus').innerHTML = '<span class="success-text">✅ Contact added!</span>';
        setTimeout(() => $('addContactStatus').innerHTML = '', 2000);
        log(`Manually added: ${email}`, 'success');
    });

    $('proceedToStep3').addEventListener('click', () => {
        if (discoveredContacts.length === 0) {
            showAlert('No contacts in the list. Please search or add manually.');
            return;
        }
        goToStep(3);
    });

    $('backToStep3').addEventListener('click', () => goToStep(3));

    // ─────────────────────────────────────────────────────────────
    // STEP 3: PDF Upload
    // ─────────────────────────────────────────────────────────────
    $('pdfFileInput').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const status = $('pdfStatus');
        const preview = $('pdfPreview');
        const dropbox = $('pdfDropbox');

        status.innerHTML = '<p class="text-muted" style="font-size:0.82rem">📤 Uploading and reading PDF...</p>';
        dropbox.style.display = 'none';
        log(`Uploading PDF: ${file.name}...`);

        const formData = new FormData();
        formData.append('pdf', file);

        try {
            const res = await fetch('/api/upload-pdf', { method: 'POST', body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            $('pdfFileName').textContent = data.fileName;
            $('pdfSummaryText').textContent = data.summary;
            preview.style.display = 'block';
            status.innerHTML = '<p class="success-text" style="font-size:0.82rem">✅ PDF read and understood by AI</p>';
            log(`PDF processed: ${data.fileName}`, 'success');
        } catch (err) {
            status.innerHTML = `<p class="error-text" style="font-size:0.82rem">${err.message}</p>`;
            dropbox.style.display = 'block';
            log(err.message, 'error');
        }

        // Reset file input so same file can be re-uploaded
        e.target.value = '';
    });

    $('removePdfBtn').addEventListener('click', async () => {
        await fetch('/api/upload-pdf', { method: 'DELETE' });
        $('pdfPreview').style.display = 'none';
        $('pdfDropbox').style.display = 'block';
        $('pdfStatus').innerHTML = '';
        log('PDF attachment removed.');
    });

    // ─────────────────────────────────────────────────────────────
    // STEP 3: Generate Emails
    // ─────────────────────────────────────────────────────────────
    $('generateBtn').addEventListener('click', async () => {
        if (!senderProfile) { showAlert('Sender profile not found. Please go back to Step 1.'); return; }

        const instructions = $('customInstructions').value.trim();
        const btn = $('generateBtn');
        setLoading(btn, `Generating ${discoveredContacts.length} emails...`);
        $('generateStatus').innerHTML = '<p class="text-muted" style="font-size:0.85rem">✍️ Groq AI is personalizing an email for every recipient...</p>';
        log(`Generating personalized emails for ${discoveredContacts.length} contacts...`);

        try {
            const res = await fetch('/api/generate-emails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    senderProfile,
                    recipients: discoveredContacts,
                    customInstructions: instructions
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            emailsWithContent = data.recipients;
            $('generateStatus').innerHTML = `<p class="success-text">✅ ${emailsWithContent.length} emails generated!</p>`;
            log(`${emailsWithContent.length} personalized emails generated`, 'success');

            // Auto-advance to step 4
            renderEmailsTable(emailsWithContent);
            $('generatedCount').textContent = `${emailsWithContent.length} emails`;
            goToStep(4);
        } catch (err) {
            $('generateStatus').innerHTML = `<p class="error-text">${err.message}</p>`;
            log(err.message, 'error');
        } finally {
            setLoading(btn, null);
        }
    });

    // ─────────────────────────────────────────────────────────────
    // STEP 4: Review & Send
    // ─────────────────────────────────────────────────────────────
    function renderEmailsTable(emails) {
        let html = `<table><thead><tr>
            <th>Organization</th>
            <th>Email</th>
            <th>Subject</th>
            <th>Preview</th>
        </tr></thead><tbody>`;

        emails.forEach((e, i) => {
            html += `<tr onclick="openPreview(${i})" style="cursor:pointer">
                <td>${e.Name || '—'}</td>
                <td>${e.Email}</td>
                <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${e.generatedSubject || '—'}</td>
                <td><span class="badge badge-primary">View</span></td>
            </tr>`;
        });
        html += '</tbody></table>';
        $('emailsTable').innerHTML = html;
    }

    // Global preview function
    window.openPreview = (i) => {
        const e = emailsWithContent[i];
        $('modalTitle').textContent = `Email to ${e.Name || e.Email}`;
        $('modalTo').textContent = e.Email;
        $('modalSubject').textContent = e.generatedSubject || '(No subject)';
        $('modalBody').innerHTML = e.generatedBody || '<p>(No content)</p>';
        $('emailModal').style.display = 'flex';
    };

    $('closeModal').addEventListener('click', () => {
        $('emailModal').style.display = 'none';
    });
    $('emailModal').addEventListener('click', (e) => {
        if (e.target === $('emailModal')) $('emailModal').style.display = 'none';
    });

    // Send Campaign
    $('sendCampaignBtn').addEventListener('click', async () => {
        if (emailsWithContent.length === 0) return;

        const confirmed = confirm(`Ready to send ${emailsWithContent.length} personalized emails?`);
        if (!confirmed) return;

        const btn = $('sendCampaignBtn');
        setLoading(btn, 'Sending campaign...');
        $('sendStatus').innerHTML = '<p class="text-muted" style="font-size:0.85rem">📤 Sending campaign emails...</p>';
        log(`Launching campaign to ${emailsWithContent.length} recipients...`);

        try {
            const res = await fetch('/api/send-emails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipients: emailsWithContent })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            const { success, failed } = data.results;
            $('sendStatus').innerHTML = `
                <p class="success-text">✅ Campaign complete! Sent: ${success}, Failed: ${failed}</p>
            `;
            log(`Campaign done. Success: ${success}, Failed: ${failed}`, success > 0 ? 'success' : 'error');
        } catch (err) {
            $('sendStatus').innerHTML = `<p class="error-text">${err.message}</p>`;
            log(err.message, 'error');
        } finally {
            setLoading(btn, null);
        }
    });
});
