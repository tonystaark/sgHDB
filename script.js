(function () {
    'use strict';

    let currentUser = null;
    let authMode = 'login'; // 'login' or 'register'

    // ===== UTILITY FUNCTIONS =====

    function setFeedback(message, isError = true) {
        const el = document.getElementById('feedback');
        if (!el) return;
        if (!message) {
            el.hidden = true;
            el.textContent = '';
        } else {
            el.hidden = false;
            el.textContent = message;
            el.style.color = isError ? 'var(--danger)' : 'var(--accent-2)';
        }
    }

    function showAuthError(message) {
        const el = document.getElementById('auth-error');
        if (!el) return;
        el.textContent = message;
        el.hidden = false;
    }

    function hideAuthError() {
        const el = document.getElementById('auth-error');
        if (el) el.hidden = true;
    }

    function showModal(modalId) {
        // Prevent showing auth modal if user is already logged in
        if (modalId === 'auth-modal' && currentUser) {
            return;
        }

        // Prevent showing pricing modal if user is already on Pro tier
        if (modalId === 'pricing-modal' && currentUser && currentUser.user && currentUser.user.subscription_tier === 'pro') {
            return;
        }

        const modal = document.getElementById(modalId);
        if (modal) {
            modal.hidden = false;
            modal.style.display = 'flex';
        }
    }

    function hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.hidden = true;
            modal.style.display = 'none';
        }
    }

    // ===== AUTH FUNCTIONS =====

    async function checkAuth() {
        try {
            const resp = await fetch('/api/auth/me');
            if (resp.ok) {
                currentUser = await resp.json();
                updateUI();
                return true;
            }
        } catch (e) {
            console.error('Auth check failed:', e);
        }
        currentUser = null;
        updateUI();

        // Show login modal if user is not logged in
        authMode = 'login';
        setupAuthModal();
        showModal('auth-modal');

        return false;
    }

    async function handleLogin(email, password) {
        try {
            const resp = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await resp.json();

            if (!resp.ok) {
                throw new Error(data.error || 'Login failed');
            }

            currentUser = { user: data.user };
            hideModal('auth-modal');
            await checkAuth();
            setFeedback('Login successful!', false);
            setTimeout(() => setFeedback(''), 2000);
        } catch (err) {
            showAuthError(err.message);
        }
    }

    async function handleRegister(email, password) {
        try {
            const resp = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await resp.json();

            if (!resp.ok) {
                throw new Error(data.error || 'Registration failed');
            }

            currentUser = { user: data.user };
            hideModal('auth-modal');
            await checkAuth();
            setFeedback('Registration successful!', false);
            setTimeout(() => setFeedback(''), 2000);
        } catch (err) {
            showAuthError(err.message);
        }
    }

    async function handleLogout() {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            currentUser = null;
            updateUI();
            setFeedback('Logged out successfully', false);
            setTimeout(() => setFeedback(''), 2000);
        } catch (err) {
            console.error('Logout error:', err);
        }
    }

    // ===== PAYMENT FUNCTIONS =====

    async function handleUpgrade() {
        try {
            const resp = await fetch('/api/payment/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await resp.json();

            if (!resp.ok) {
                throw new Error(data.error || 'Failed to create checkout session');
            }

            // Redirect to Stripe checkout
            window.location.href = data.url;
        } catch (err) {
            alert('Failed to start checkout: ' + err.message);
        }
    }

    async function handleCancelSubscription() {
        if (!confirm('Are you sure you want to cancel your Pro subscription? You will lose unlimited searches.')) {
            return;
        }

        try {
            const resp = await fetch('/api/payment/cancel-subscription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await resp.json();

            if (!resp.ok) {
                throw new Error(data.error || 'Failed to cancel subscription');
            }

            setFeedback('Subscription cancelled successfully. You are now on the free tier.', false);
            setTimeout(() => {
                checkAuth();
                setFeedback('');
            }, 2000);
        } catch (err) {
            alert('Failed to cancel subscription: ' + err.message);
        }
    }

    // ===== UI FUNCTIONS =====

    function updateUI() {
        const headerActions = document.getElementById('header-actions');
        const usageStatus = document.getElementById('usage-status');

        if (!headerActions) return;

        if (currentUser && currentUser.user) {
            const user = currentUser.user;
            const tierClass = user.subscription_tier === 'pro' ? 'pro' : 'free';
            const tierText = user.subscription_tier === 'pro' ? 'PRO' : 'FREE';

            headerActions.innerHTML = `
                <div class="user-info">
                    <span>${user.email}</span>
                    <span class="user-tier ${tierClass}">${tierText}</span>
                </div>
                ${user.subscription_tier === 'free' ? '<button class="btn btn-primary btn-small" id="upgrade-header-btn">Upgrade</button>' : '<button class="btn btn-secondary btn-small" id="cancel-subscription-btn">Cancel Subscription</button>'}
                <button class="btn btn-secondary btn-small" id="logout-btn">Logout</button>
            `;

            // Attach event listeners
            const logoutBtn = document.getElementById('logout-btn');
            if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

            const upgradeHeaderBtn = document.getElementById('upgrade-header-btn');
            if (upgradeHeaderBtn) {
                upgradeHeaderBtn.addEventListener('click', () => showModal('pricing-modal'));
            }

            const cancelSubscriptionBtn = document.getElementById('cancel-subscription-btn');
            if (cancelSubscriptionBtn) {
                cancelSubscriptionBtn.addEventListener('click', handleCancelSubscription);
            }

            hideModal('auth-modal');
            console.log('user', user);
            // Hide pricing modal if user is on Pro tier
            if (user.subscription_tier === 'pro') {
                hideModal('pricing-modal');
            }

            // Show usage status for free tier
            if (usageStatus && user.subscription_tier === 'free') {
                const remaining = user.usage_limit - user.usage_count;
                const statusClass = remaining === 0 ? 'danger' : (remaining === 1 ? '' : '');

                usageStatus.className = `usage-status ${statusClass}`;
                usageStatus.innerHTML = `
                    <span>Free Tier: ${user.usage_count}/${user.usage_limit} searches used</span>
                    ${remaining === 0 ? '<strong>Upgrade to continue searching</strong>' : ''}
                `;
                usageStatus.hidden = false;
            } else if (usageStatus) {
                usageStatus.hidden = true;
            }
        } else {
            headerActions.innerHTML = `
                <button class="btn btn-secondary btn-small" id="login-btn">Login</button>
                <button class="btn btn-primary btn-small" id="register-btn">Sign Up</button>
            `;

            const loginBtn = document.getElementById('login-btn');
            if (loginBtn) {
                loginBtn.addEventListener('click', () => {
                    authMode = 'login';
                    setupAuthModal();
                    showModal('auth-modal');
                });
            }

            const registerBtn = document.getElementById('register-btn');
            if (registerBtn) {
                registerBtn.addEventListener('click', () => {
                    authMode = 'register';
                    setupAuthModal();
                    showModal('auth-modal');
                });
            }

            if (usageStatus) usageStatus.hidden = true;
        }
    }

    function setupAuthModal() {
        const title = document.getElementById('auth-modal-title');
        const submitBtn = document.getElementById('auth-submit');
        const toggleText = document.getElementById('auth-toggle-text');
        const toggleLink = document.getElementById('auth-toggle-link');
        const forgotPasswordMessage = document.getElementById('forgot-password-message');

        if (authMode === 'login') {
            title.textContent = 'Login';
            submitBtn.textContent = 'Login';
            toggleText.textContent = "Don't have an account?";
            toggleLink.textContent = 'Sign up';
            if (forgotPasswordMessage) forgotPasswordMessage.hidden = false;
        } else {
            title.textContent = 'Sign Up';
            submitBtn.textContent = 'Sign Up';
            toggleText.textContent = 'Already have an account?';
            toggleLink.textContent = 'Login';
            if (forgotPasswordMessage) forgotPasswordMessage.hidden = true;
        }

        hideAuthError();
    }

    // ===== SEARCH FUNCTIONS =====

    function renderResults(container, data) {
        if (!container) return;
        container.innerHTML = '';

        if (!data || !data.results || data.results.length === 0) {
            var empty = document.createElement('div');
            empty.className = 'record-card';
            empty.innerHTML = '<p class="record-desc">No incident records found for the entered postal code.</p>';
            container.appendChild(empty);
            return;
        }

        // Show summary header
        var summary = document.createElement('div');
        summary.className = 'summary-header';
        summary.innerHTML = `<h3>Found ${data.count} incident(s) for postal code ${data.postal_code}</h3>`;
        container.appendChild(summary);

        // Render each incident
        data.results.forEach(function (record, index) {
            renderSingleResult(container, record, index + 1, data.count);
        });
    }

    function renderSingleResult(container, record, index, total) {
        var card = document.createElement('article');
        card.className = 'record-card';

        var header = document.createElement('div');
        header.className = 'record-header';

        var title = document.createElement('h4');
        title.className = 'record-title';
        title.textContent = record.location;

        var badge = document.createElement('span');
        badge.className = 'badge minor';
        badge.textContent = 'Incident #' + index;

        header.appendChild(title);
        header.appendChild(badge);

        var grid = document.createElement('div');
        grid.className = 'record-grid';

        var meta = document.createElement('div');
        meta.className = 'record-meta';
        meta.innerHTML = '<strong>Postal Code:</strong> ' + record.postal_code + '<br>' +
            '<strong>Block:</strong> ' + record.block + '<br>' +
            '<strong>Date Reported:</strong> ' + record.date_reported + '<br>' +
            '<strong>Source:</strong> <a href="' + record.source_url + '" target="_blank" rel="noopener">' + record.source_url + '</a>';

        var desc = document.createElement('p');
        desc.className = 'record-desc';
        desc.textContent = record.incident_summary;

        grid.appendChild(meta);
        grid.appendChild(desc);

        card.appendChild(header);
        card.appendChild(grid);

        container.appendChild(card);
    }

    async function handleSearch(postalCode) {
        const resultContainer = document.getElementById('result-container');

        if (!currentUser) {
            setFeedback('Please login to search incidents');
            showModal('auth-modal');
            return;
        }

        try {
            const resp = await fetch('/api/incidents?postal_code=' + encodeURIComponent(postalCode));

            if (resp.status === 429) {
                const data = await resp.json();
                setFeedback(data.message);
                showModal('pricing-modal');
                return;
            }

            if (!resp.ok) {
                throw new Error('Network error');
            }

            const data = await resp.json();
            renderResults(resultContainer, data);

            // Update usage display
            if (data.usage && currentUser) {
                currentUser.user.usage_count = data.usage.count;
                updateUI();
            }
        } catch (e) {
            setFeedback('Failed to fetch data. Please try again.');
        }
    }

    // ===== INITIALIZATION =====

    function onReady() {
        const form = document.getElementById('search-form');
        const input = document.getElementById('address-input');
        const authForm = document.getElementById('auth-form');
        const authToggleLink = document.getElementById('auth-toggle-link');
        const closeModal = document.getElementById('close-modal');
        const closePricingModal = document.getElementById('close-pricing-modal');
        const upgradeButton = document.getElementById('upgrade-button');

        // Check authentication status
        checkAuth();

        // Check for payment success/cancel
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('payment') === 'success') {
            const sessionId = urlParams.get('session_id');
            hideModal('pricing-modal');

            if (sessionId) {
                // Verify payment and update subscription
                setFeedback('Verifying payment...', false);

                fetch('/api/payment/verify-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ session_id: sessionId })
                })
                .then(resp => resp.json())
                .then(data => {
                    if (data.success) {
                        setFeedback('Payment successful! Your account has been upgraded to Pro.', false);
                        setTimeout(() => {
                            checkAuth();
                            window.history.replaceState({}, document.title, '/');
                        }, 2000);
                    } else {
                        setFeedback('Payment verification failed. Please contact support.', true);
                    }
                })
                .catch(err => {
                    console.error('Verification error:', err);
                    setFeedback('Payment verification failed. Please refresh the page.', true);
                });
            } else {
                setFeedback('Payment successful! Your account has been upgraded.', false);
                setTimeout(() => {
                    checkAuth();
                    window.history.replaceState({}, document.title, '/');
                }, 2000);
            }
        } else if (urlParams.get('payment') === 'cancelled') {
            setFeedback('Payment cancelled', true);
            setTimeout(() => {
                window.history.replaceState({}, document.title, '/');
            }, 2000);
        }

        // Search form
        if (form && input) {
            form.addEventListener('submit', function (ev) {
                ev.preventDefault();
                var value = input.value.trim();

                if (!value) {
                    setFeedback('Please enter a postal code to search.');
                    return;
                }

                setFeedback('');
                handleSearch(value);
            });
        }

        // Auth form
        if (authForm) {
            authForm.addEventListener('submit', async function (ev) {
                ev.preventDefault();
                const email = document.getElementById('auth-email').value;
                const password = document.getElementById('auth-password').value;

                if (authMode === 'login') {
                    await handleLogin(email, password);
                } else {
                    await handleRegister(email, password);
                }
            });
        }

        // Auth toggle
        if (authToggleLink) {
            authToggleLink.addEventListener('click', function (ev) {
                ev.preventDefault();
                authMode = authMode === 'login' ? 'register' : 'login';
                setupAuthModal();
            });
        }

        // Close modals
        if (closeModal) {
            closeModal.addEventListener('click', () => hideModal('auth-modal'));
        }

        if (closePricingModal) {
            closePricingModal.addEventListener('click', () => hideModal('pricing-modal'));
        }

        // Close modal on outside click
        window.addEventListener('click', function (ev) {
            if (ev.target.classList.contains('modal')) {
                ev.target.hidden = true;
                ev.target.style.display = 'none';
            }
        });

        // Upgrade button
        if (upgradeButton) {
            upgradeButton.addEventListener('click', handleUpgrade);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onReady);
    } else {
        onReady();
    }
})();
