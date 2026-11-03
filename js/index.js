function toggleDarkMode() 
        {
            try 
            {
                const htmlElement = document.documentElement;
                if (htmlElement.classList.contains('dark')) 
                {
                    htmlElement.classList.remove('dark');
                    localStorage.setItem('scamazon_theme', 'light');
                } 
                else 
                {
                    htmlElement.classList.add('dark');
                    localStorage.setItem('scamazon_theme', 'dark');
                }
            } 
            catch (toggleErr) 
            {
                console.error('Dark mode toggle failed:', toggleErr);
            }
        }
        window.toggleDarkMode = toggleDarkMode;

        let activeStorefronts = [];
        let allListings = [];
        let cart = [];
        let appliedCoupon = null;
        let trackedOrderCache = null;
        let cartToastTimer = null;
        let sortMode = 'featured';
        let stockOnlyFilter = false;
        let currentUser = null; // null for guests, user object for authenticated

        function sanitizeHtml(str) {
            if (!str && str !== 0) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function focusStorefrontDropdown() {
            const el = document.getElementById('catalog-storefront');
            if (el) {
                el.focus();
            }
        }

        /* --- BUILT-IN AUTH MODAL & STATE HANDLERS --- */
        let currentAuthMode = 'signin'; // 'signin' or 'signup'
        let pendingPostAuthAction = null; // 'checkout' | 'tracking' | null

        function setAuthMode(mode) {
            currentAuthMode = mode;
            const errorBox = document.getElementById('auth-error-msg');
            const successBox = document.getElementById('auth-success-msg');
            if (errorBox) errorBox.classList.add('hidden');
            if (successBox) successBox.classList.add('hidden');
            applyAuthModeUI();
        }
        window.setAuthMode = setAuthMode;

        function toggleAuthMode() {
            setAuthMode(currentAuthMode === 'signin' ? 'signup' : 'signin');
        }
        window.toggleAuthMode = toggleAuthMode;

        function applyAuthModeUI() {
            const title = document.getElementById('auth-modal-title');
            const subtitle = document.getElementById('auth-modal-subtitle');
            const tabsContainer = document.getElementById('auth-tabs-container');
            const nameGroup = document.getElementById('auth-name-group');
            const nameInput = document.getElementById('auth-name-input');
            const emailGroup = document.getElementById('auth-email-group');
            const emailInput = document.getElementById('auth-email-input');
            const passwordGroup = document.getElementById('auth-password-group');
            const passwordLabel = document.getElementById('auth-password-label');
            const passwordInput = document.getElementById('auth-password-input');
            const forgotLink = document.getElementById('auth-forgot-link');
            const confirmGroup = document.getElementById('auth-confirm-group');
            const confirmInput = document.getElementById('auth-confirm-password-input');
            const submitText = document.getElementById('auth-submit-text');
            const altText = document.getElementById('auth-alt-text');
            const altBtn = document.getElementById('auth-alt-btn');
            const tabSignIn = document.getElementById('tab-btn-signin');
            const tabSignUp = document.getElementById('tab-btn-signup');
            const pwdHint = document.getElementById('auth-pwd-hint');

            if (currentAuthMode === 'forgot') {
                if (title) title.textContent = 'Reset Password';
                if (subtitle) subtitle.textContent = "Enter your email address to receive a password reset link";
                if (tabsContainer) tabsContainer.classList.add('hidden');
                if (nameGroup) nameGroup.classList.add('hidden');
                if (nameInput) { nameInput.required = false; nameInput.value = ''; }
                if (emailGroup) emailGroup.classList.remove('hidden');
                if (emailInput) { emailInput.required = true; }
                if (passwordGroup) passwordGroup.classList.add('hidden');
                if (passwordInput) { passwordInput.required = false; passwordInput.value = ''; }
                if (confirmGroup) confirmGroup.classList.add('hidden');
                if (confirmInput) { confirmInput.required = false; confirmInput.value = ''; }
                if (submitText) submitText.textContent = 'Send Reset Link';
                if (altText) altText.textContent = 'Remember your password?';
                if (altBtn) {
                    altBtn.textContent = 'Sign In';
                    altBtn.onclick = () => setAuthMode('signin');
                }
                if (pwdHint) pwdHint.textContent = '';
            } else if (currentAuthMode === 'recovery') {
                if (title) title.textContent = 'Set New Password';
                if (subtitle) subtitle.textContent = 'Enter your new password below (min 6 characters)';
                if (tabsContainer) tabsContainer.classList.add('hidden');
                if (nameGroup) nameGroup.classList.add('hidden');
                if (nameInput) { nameInput.required = false; nameInput.value = ''; }
                if (emailGroup) emailGroup.classList.add('hidden');
                if (emailInput) { emailInput.required = false; }
                if (passwordGroup) passwordGroup.classList.remove('hidden');
                if (passwordLabel) passwordLabel.textContent = 'New Password';
                if (passwordInput) { passwordInput.required = true; passwordInput.value = ''; }
                if (forgotLink) forgotLink.classList.add('hidden');
                if (confirmGroup) confirmGroup.classList.remove('hidden');
                if (confirmInput) { confirmInput.required = true; confirmInput.value = ''; }
                if (submitText) submitText.textContent = 'Update Password';
                if (altText) altText.textContent = 'Already updated?';
                if (altBtn) {
                    altBtn.textContent = 'Sign In';
                    altBtn.onclick = () => setAuthMode('signin');
                }
                if (pwdHint) pwdHint.textContent = 'Min 6 characters';
            } else if (currentAuthMode === 'signup') {
                if (title) title.textContent = 'Create Account';
                if (subtitle) subtitle.textContent = 'Register a new customer account to place orders';
                if (tabsContainer) tabsContainer.classList.remove('hidden');
                if (nameGroup) nameGroup.classList.remove('hidden');
                if (nameInput) nameInput.required = true;
                if (emailGroup) emailGroup.classList.remove('hidden');
                if (emailInput) emailInput.required = true;
                if (passwordGroup) passwordGroup.classList.remove('hidden');
                if (passwordLabel) passwordLabel.textContent = 'Password';
                if (passwordInput) passwordInput.required = true;
                if (forgotLink) forgotLink.classList.add('hidden');
                if (confirmGroup) confirmGroup.classList.add('hidden');
                if (confirmInput) { confirmInput.required = false; confirmInput.value = ''; }
                if (submitText) submitText.textContent = 'Create Account';
                if (altText) altText.textContent = 'Already have an account?';
                if (altBtn) {
                    altBtn.textContent = 'Sign In';
                    altBtn.onclick = () => setAuthMode('signin');
                }
                if (pwdHint) pwdHint.textContent = 'Min 6 characters';

                if (tabSignUp) {
                    tabSignUp.className = "py-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 bg-amber-500 text-slate-950 font-bold shadow-xs";
                    tabSignUp.setAttribute('aria-selected', 'true');
                }
                if (tabSignIn) {
                    tabSignIn.className = "py-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white";
                    tabSignIn.setAttribute('aria-selected', 'false');
                }
            } else {
                currentAuthMode = 'signin';
                if (title) title.textContent = 'Sign In';
                if (subtitle) subtitle.textContent = 'Access your customer orders and checkout';
                if (tabsContainer) tabsContainer.classList.remove('hidden');
                if (nameGroup) nameGroup.classList.add('hidden');
                if (nameInput) { nameInput.required = false; nameInput.value = ''; }
                if (emailGroup) emailGroup.classList.remove('hidden');
                if (emailInput) emailInput.required = true;
                if (passwordGroup) passwordGroup.classList.remove('hidden');
                if (passwordLabel) passwordLabel.textContent = 'Password';
                if (passwordInput) passwordInput.required = true;
                if (forgotLink) forgotLink.classList.remove('hidden');
                if (confirmGroup) confirmGroup.classList.add('hidden');
                if (confirmInput) { confirmInput.required = false; confirmInput.value = ''; }
                if (submitText) submitText.textContent = 'Sign In';
                if (altText) altText.textContent = "Don't have an account?";
                if (altBtn) {
                    altBtn.textContent = 'Create Account';
                    altBtn.onclick = () => setAuthMode('signup');
                }
                if (pwdHint) pwdHint.textContent = '';

                if (tabSignIn) {
                    tabSignIn.className = "py-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 bg-amber-500 text-slate-950 font-bold shadow-xs";
                    tabSignIn.setAttribute('aria-selected', 'true');
                }
                if (tabSignUp) {
                    tabSignUp.className = "py-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white";
                    tabSignUp.setAttribute('aria-selected', 'false');
                }
            }
        }

        function toggleAuthPasswordVisibility() {
            const pwdInput = document.getElementById('auth-password-input');
            const showIcon = document.getElementById('pwd-icon-show');
            const hideIcon = document.getElementById('pwd-icon-hide');
            if (!pwdInput) return;

            if (pwdInput.type === 'password') {
                pwdInput.type = 'text';
                if (showIcon) showIcon.classList.add('hidden');
                if (hideIcon) hideIcon.classList.remove('hidden');
            } else {
                pwdInput.type = 'password';
                if (showIcon) showIcon.classList.remove('hidden');
                if (hideIcon) hideIcon.classList.add('hidden');
            }
        }
        window.toggleAuthPasswordVisibility = toggleAuthPasswordVisibility;

        function openBuiltInAuth(mode = 'signin', contextMessage = null) {
            if (typeof toggleCartDrawer === 'function') {
                toggleCartDrawer(false);
            }
            currentAuthMode = mode;
            const modal = document.getElementById('auth-modal');
            const banner = document.getElementById('auth-context-banner');
            const bannerText = document.getElementById('auth-context-text');
            const errorBox = document.getElementById('auth-error-msg');
            const successBox = document.getElementById('auth-success-msg');

            if (errorBox) errorBox.classList.add('hidden');
            if (successBox) successBox.classList.add('hidden');

            if (contextMessage) {
                if (bannerText) bannerText.textContent = contextMessage;
                if (banner) banner.classList.remove('hidden');
            } else {
                if (banner) banner.classList.add('hidden');
            }

            applyAuthModeUI();

            if (modal) {
                modal.classList.remove('hidden');
                setTimeout(() => {
                    const targetInput = currentAuthMode === 'signup' 
                        ? document.getElementById('auth-name-input') 
                        : currentAuthMode === 'recovery'
                            ? document.getElementById('auth-password-input')
                            : document.getElementById('auth-email-input');
                    if (targetInput) targetInput.focus();
                }, 60);
            }
        }
        window.openBuiltInAuth = openBuiltInAuth;

        function openAuthModal(message) {
            openBuiltInAuth('signin', message);
        }
        window.openAuthModal = openAuthModal;

        function closeAuthModal() {
            const modal = document.getElementById('auth-modal');
            if (modal) modal.classList.add('hidden');
            pendingPostAuthAction = null;
        }
        window.closeAuthModal = closeAuthModal;

        function handleTrackingClick() {
            if (!currentUser) {
                pendingPostAuthAction = 'tracking';
                openBuiltInAuth('signin', 'Sign in to view real-time fulfillment status, order history, and printable receipts.');
                return;
            }
            switchTab('tracking');
        }

        function handleCheckoutClick() {
            if (!currentUser) {
                pendingPostAuthAction = 'checkout';
                if (typeof toggleCartDrawer === 'function') {
                    toggleCartDrawer(false);
                }
                openBuiltInAuth('signin', 'Sign in or create an account to complete your checkout.');
                return;
            }
            placeOrder();
        }

        async function handleBuiltInAuthSubmit(e) {
            e.preventDefault();
            const errorBox = document.getElementById('auth-error-msg');
            const errorText = document.getElementById('auth-error-text');
            const successBox = document.getElementById('auth-success-msg');
            const successText = document.getElementById('auth-success-text');
            const submitBtn = document.getElementById('auth-submit-btn');
            const submitText = document.getElementById('auth-submit-text');
            const emailInput = document.getElementById('auth-email-input');
            const pwdInput = document.getElementById('auth-password-input');
            const nameInput = document.getElementById('auth-name-input');

            if (errorBox) errorBox.classList.add('hidden');
            if (successBox) successBox.classList.add('hidden');

            const email = emailInput ? emailInput.value.trim() : '';
            const password = pwdInput ? pwdInput.value : '';

            if (currentAuthMode === 'forgot') {
                if (!email) {
                    if (errorText) errorText.textContent = 'Please enter your email address.';
                    if (errorBox) errorBox.classList.remove('hidden');
                    return;
                }

                if (submitBtn) submitBtn.disabled = true;
                if (submitText) submitText.textContent = 'Sending Link...';

                try {
                    const { client } = await import('./js/supaBase.js');
                    const redirectUrl = window.location.origin + window.location.pathname;
                    const { error } = await client.auth.resetPasswordForEmail(email, {
                        redirectTo: redirectUrl
                    });

                    if (error) throw error;

                    if (successText) successText.textContent = 'Password reset link sent! Check your email inbox to reset your password.';
                    if (successBox) successBox.classList.remove('hidden');
                    if (emailInput) emailInput.value = '';
                } catch (err) {
                    console.error('Password reset error:', err);
                    if (errorText) errorText.textContent = err.message || 'Failed to send reset link. Please verify email.';
                    if (errorBox) errorBox.classList.remove('hidden');
                } finally {
                    if (submitBtn) submitBtn.disabled = false;
                    applyAuthModeUI();
                }
                return;
            }

            if (currentAuthMode === 'recovery') {
                const confirmInput = document.getElementById('auth-confirm-password-input');
                const confirmPassword = confirmInput ? confirmInput.value : '';

                if (!password) {
                    if (errorText) errorText.textContent = 'Please enter your new password.';
                    if (errorBox) errorBox.classList.remove('hidden');
                    return;
                }

                if (password.length < 6) {
                    if (errorText) errorText.textContent = 'Password must be at least 6 characters.';
                    if (errorBox) errorBox.classList.remove('hidden');
                    return;
                }

                if (password !== confirmPassword) {
                    if (errorText) errorText.textContent = 'Passwords do not match.';
                    if (errorBox) errorBox.classList.remove('hidden');
                    return;
                }

                if (submitBtn) submitBtn.disabled = true;
                if (submitText) submitText.textContent = 'Updating Password...';

                try {
                    const { client } = await import('./js/supaBase.js');
                    const { error } = await client.auth.updateUser({
                        password: password
                    });

                    if (error) throw error;

                    if (successText) successText.textContent = 'Password successfully updated! You can now sign in.';
                    if (successBox) successBox.classList.remove('hidden');
                    if (pwdInput) pwdInput.value = '';
                    if (confirmInput) confirmInput.value = '';
                    setAuthMode('signin');
                } catch (err) {
                    console.error('Password recovery error:', err);
                    if (errorText) errorText.textContent = err.message || 'Failed to update password.';
                    if (errorBox) errorBox.classList.remove('hidden');
                } finally {
                    if (submitBtn) submitBtn.disabled = false;
                    applyAuthModeUI();
                }
                return;
            }

            if (!email || !password) {
                if (errorText) errorText.textContent = 'Please provide both email and password.';
                if (errorBox) errorBox.classList.remove('hidden');
                return;
            }

            if (currentAuthMode === 'signup' && password.length < 6) {
                if (errorText) errorText.textContent = 'Password must be at least 6 characters.';
                if (errorBox) errorBox.classList.remove('hidden');
                return;
            }

            if (submitBtn) submitBtn.disabled = true;
            if (submitText) submitText.textContent = currentAuthMode === 'signup' ? 'Creating Account...' : 'Signing In...';

            try {
                const { client } = await import('./js/supaBase.js');

                if (currentAuthMode === 'signup') {
                    const name = nameInput ? nameInput.value.trim() : '';
                    const { data, error } = await client.auth.signUp({
                        email,
                        password,
                        options: { data: { role: 'customer', name } }
                    });

                    if (error) throw error;

                    if (data && data.session) {
                        currentUser = {
                            email: data.session.user.email,
                            role: 'customer'
                        };
                        updateNavAuthUI();
                        closeAuthModal();
                        showToast('Welcome to Scamazon, ' + (name || email) + '!');

                        if (pendingPostAuthAction === 'checkout') {
                            pendingPostAuthAction = null;
                            placeOrder();
                        } else if (pendingPostAuthAction === 'tracking') {
                            pendingPostAuthAction = null;
                            switchTab('tracking');
                        }
                        return;
                    }

                    if (successText) successText.textContent = 'Account created successfully! You can now sign in.';
                    if (successBox) successBox.classList.remove('hidden');
                    setAuthMode('signin');
                    if (pwdInput) pwdInput.value = '';
                } else {
                    const { data: authData, error: authError } = await client.auth.signInWithPassword({
                        email,
                        password
                    });

                    if (authError) throw authError;

                    const { data: userRecord } = await client
                        .from('users')
                        .select('role')
                        .eq('email', email)
                        .maybeSingle();

                    const role = userRecord ? userRecord.role : 'customer';
                    currentUser = { email, role };

                    if (role === 'storefront_owner') {
                        window.location.href = 'storefront.html';
                        return;
                    } else if (role !== 'customer') {
                        window.location.href = `${role}.html`;
                        return;
                    }

                    updateNavAuthUI();
                    closeAuthModal();
                    showToast('Signed in as ' + email);

                    if (pendingPostAuthAction === 'checkout') {
                        pendingPostAuthAction = null;
                        placeOrder();
                    } else if (pendingPostAuthAction === 'tracking') {
                        pendingPostAuthAction = null;
                        switchTab('tracking');
                    }
                }
            } catch (err) {
                console.error('Built-in auth error:', err);
                if (errorText) errorText.textContent = err.message || 'Authentication failed. Please verify credentials.';
                if (errorBox) errorBox.classList.remove('hidden');
            } finally {
                if (submitBtn) submitBtn.disabled = false;
                applyAuthModeUI();
            }
        }

        /* --- TOAST NOTIFICATIONS & LOCAL CART --- */
        function loadCartFromStorage() {
            try {
                const saved = localStorage.getItem('scamazon_cart');
                if (saved) {
                    cart = JSON.parse(saved);
                }
            } catch (e) {
                console.error('Failed to load cart from storage:', e);
                cart = [];
            }
        }

        function saveCartToStorage() {
            try {
                localStorage.setItem('scamazon_cart', JSON.stringify(cart));
            } catch (e) {
                console.error('Failed to save cart to storage:', e);
            }
        }

        function showToast(title, type = 'success', subtitle = 'Added for delivery') {
            const toast = document.getElementById('cart-toast');
            const titleEl = document.getElementById('toast-title');
            const subEl = document.getElementById('toast-subtitle');
            const iconWrapper = document.getElementById('toast-icon-wrapper');
            const iconEl = document.getElementById('toast-icon');
            const actionBtn = document.getElementById('toast-action-btn');

            if (!toast) return;

            if (titleEl) {
                titleEl.textContent = title;
            }

            if (subEl) {
                subEl.textContent = subtitle;
            }

            if (type === 'error') {
                toast.className =
                    'fixed bottom-6 right-6 z-[70] transform translate-y-0 opacity-100 pointer-events-auto transition-all duration-300 ease-out flex items-center gap-3 bg-slate-900 text-white px-5 py-3.5 rounded-xl shadow-2xl border border-rose-500/80';

                if (iconWrapper) {
                    iconWrapper.className =
                        'w-6 h-6 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0';
                }

                if (iconEl) {
                    iconEl.innerHTML =
                        '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/>';
                }

                if (actionBtn) {
                    actionBtn.classList.add('hidden');
                }
            } else {
                toast.className =
                    'fixed bottom-6 right-6 z-[70] transform translate-y-0 opacity-100 pointer-events-auto transition-all duration-300 ease-out flex items-center gap-3 bg-slate-900 text-white px-5 py-3.5 rounded-xl shadow-2xl border border-slate-700/80';

                if (iconWrapper) {
                    iconWrapper.className =
                        'w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0';
                }

                if (iconEl) {
                    iconEl.innerHTML =
                        '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>';
                }

                if (actionBtn) {
                    actionBtn.classList.remove('hidden');
                }
            }

            clearTimeout(cartToastTimer);

            const counterEl = document.getElementById('cart-counter');

            if (counterEl && type === 'success') {
                counterEl.classList.add('scale-125');
                setTimeout(() => counterEl.classList.remove('scale-125'), 250);
            }

            cartToastTimer = setTimeout(() => {
                hideCartToast();
            }, 3200);
        }

        function showCartToast(title) {
            showToast(title ? `Added "${title}"` : 'Item added to cart', 'success', 'Added for delivery');
        }

        function hideCartToast() {
            const toast = document.getElementById('cart-toast');
            if (!toast) return;
            toast.classList.add('translate-y-12', 'opacity-0', 'pointer-events-none');
            toast.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
        }

        /* --- SMOOTH CART DRAWER TOGGLE --- */
        let drawerCloseTimeout = null;

        function toggleCartDrawer(forceState) {
            const drawer = document.getElementById('cart-drawer');
            const backdrop = document.getElementById('cart-backdrop');
            const panel = document.getElementById('cart-panel');
            if (!drawer || !backdrop || !panel) return;

            const isCurrentlyOpen = panel.classList.contains('translate-x-0');
            const shouldOpen = forceState !== undefined ? forceState : !isCurrentlyOpen;

            clearTimeout(drawerCloseTimeout);

            if (shouldOpen) {
                drawer.classList.remove('pointer-events-none');
                
                requestAnimationFrame(() => {
                    backdrop.classList.remove('opacity-0', 'pointer-events-none');
                    backdrop.classList.add('opacity-100', 'pointer-events-auto');

                    panel.classList.remove('translate-x-full');
                    panel.classList.add('translate-x-0');
                });
            } else {
                backdrop.classList.remove('opacity-100', 'pointer-events-auto');
                backdrop.classList.add('opacity-0', 'pointer-events-none');

                panel.classList.remove('translate-x-0');
                panel.classList.add('translate-x-full');

                drawerCloseTimeout = setTimeout(() => {
                    if (!panel.classList.contains('translate-x-0')) {
                        drawer.classList.add('pointer-events-none');
                    }
                }, 300);
            }
        }

        // Keyboard shortcuts
        window.addEventListener('keydown', (e) => {
            // Quick-focus search on '/'
            if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
                e.preventDefault();
                const searchInput = document.getElementById('catalog-search');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                }
            }

            // Close modals and drawer on Escape key
            if (e.key === 'Escape') {
                toggleCartDrawer(false);
                closeConfirmationModal();
                closeReceiptModal();
                closeAuthModal();
            }
        });

        /* --- SESSION & AUTH STATE --- */
        async function checkSession() {
            try {
                const { client } = await import('./js/supaBase.js');

                // Listen for Auth state changes including password recovery
                client.auth.onAuthStateChange(async (event, session) => {
                    if (event === 'PASSWORD_RECOVERY') {
                        openBuiltInAuth('recovery', 'Please enter your new password below.');
                    }
                });

                // Also check if arrived directly via recovery URL hash or parameter
                const urlHash = window.location.hash || '';
                const urlParams = new URLSearchParams(window.location.search);
                if (urlHash.includes('type=recovery') || urlParams.get('type') === 'recovery') {
                    openBuiltInAuth('recovery', 'Please enter your new password below.');
                }

                const { data: { session } } = await client.auth.getSession();
                
                if (session && session.user) {
                    const { data: userRecord } = await client
                        .from('users')
                        .select('role, email')
                        .eq('email', session.user.email)
                        .maybeSingle();

                    currentUser = {
                        email: session.user.email,
                        role: userRecord ? userRecord.role : 'customer'
                    };
                } else {
                    currentUser = null;
                }
            } catch (authErr) {
                console.error('Session check error:', authErr);
                currentUser = null;
            }

            updateNavAuthUI();
            await loadInitialData();
        }

        function updateNavAuthUI() {
            const guestBlock = document.getElementById('nav-guest-block');
            const userBlock = document.getElementById('nav-user-block');
            const userDisplay = document.getElementById('user-display');
            const logoutBtn = document.getElementById('logout-btn');
            const dashContainer = document.getElementById('dashboard-link-container');

            if (currentUser) {
                if (guestBlock) guestBlock.classList.add('hidden');
                if (userBlock) userBlock.classList.remove('hidden');
                if (logoutBtn) logoutBtn.classList.remove('hidden');
                if (userDisplay) userDisplay.textContent = currentUser.email;

                // If non-customer role, offer direct link to their portal
                if (dashContainer && currentUser.role && currentUser.role !== 'customer') {
                    dashContainer.classList.remove('hidden');
                    const targetPage = currentUser.role === 'storefront_owner' ? 'storefront.html' : `${currentUser.role}.html`;
                    dashContainer.innerHTML = `
                        <a href="${targetPage}" class="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-amber-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-amber-500/40 transition-colors">
                            Portal Dashboard &rarr;
                        </a>
                    `;
                }
            } else {
                if (guestBlock) guestBlock.classList.remove('hidden');
                if (userBlock) userBlock.classList.add('hidden');
                if (logoutBtn) logoutBtn.classList.add('hidden');
                if (dashContainer) dashContainer.classList.add('hidden');
            }
            if (typeof updateCartUI === 'function') {
                updateCartUI();
            }
        }

        async function loadInitialData() {
            loadCartFromStorage();
            updateCartUI();
            await Promise.all([fetchStorefronts(), fetchListings()]);
            populateStorefrontDropdown();
            renderCatalog();
        }

        function switchTab(tab) {
            const tabs = {
                catalog: document.getElementById('tab-catalog'),
                tracking: document.getElementById('tab-tracking')
            };

            const navs = {
                catalog: document.getElementById('nav-catalog'),
                tracking: document.getElementById('nav-tracking')
            };

            const headings = {
                catalog: 'Shop Quality Brands & Everyday Deals',
                tracking: 'Your Orders & Tracking'
            };

            Object.values(tabs).forEach(el => {
                if (el) {
                    el.classList.add('hidden');
                    el.setAttribute('hidden', '');
                }
            });

            Object.values(navs).forEach(el => {
                if (el) {
                    el.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-700/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500';
                }
            });

            if (tabs[tab]) {
                tabs[tab].classList.remove('hidden');
                tabs[tab].removeAttribute('hidden');
                if (tab === 'tracking') {
                    loadCustomerOrderHistory();
                }
            }

            if (navs[tab]) {
                navs[tab].className = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold text-white bg-slate-700/80 hover:bg-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500';
            }

            const pageHeading = document.getElementById('page-heading');
            if (pageHeading) pageHeading.textContent = headings[tab];

            // Scroll to top of main view smoothly
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function setSortMode(mode) {
            sortMode = mode;
            ['sort-featured', 'sort-price-low', 'sort-price-high'].forEach(id => {
                const btn = document.getElementById(id);
                if (btn) {
                    btn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors';
                }
            });

            const activeBtn = document.getElementById(`sort-${mode}`);
            if (activeBtn) {
                activeBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-slate-950 transition-colors';
            }

            renderCatalog();
        }

        // ================= LISTINGS =================
        async function fetchStorefronts() {
            const { client } = await import('./js/supaBase.js');
            const { data } = await client.from('storefronts').select('*').eq('status', 'Active');
            activeStorefronts = data || [];
        }

        async function fetchListings() {
            const { client } = await import('./js/supaBase.js');
            const { data } = await client.from('listings').select('*');
            allListings = data || [];
            const badge = document.getElementById('badge-listings');
            if (badge) badge.textContent = allListings.length;
        }

        function populateStorefrontDropdown() {
            const select = document.getElementById('catalog-storefront');
            if (!select) return;
            select.innerHTML = `<option value="">All Storefronts</option>` + 
                activeStorefronts.map(s => `<option value="${sanitizeHtml(s.name)}">${sanitizeHtml(s.name)}</option>`).join('');
            select.value = "";
        }

        function renderCatalog() {
            const container = document.getElementById('catalog-grid');
            const selectedBranch = document.getElementById('catalog-storefront').value;
            const searchTerm = (document.getElementById('catalog-search').value || '').toLowerCase().trim();

            const badge = document.getElementById('badge-listings');
            if (badge) badge.textContent = allListings.length;

            const navBranch = document.getElementById('nav-selected-branch');
            if (navBranch) navBranch.textContent = selectedBranch || 'All Storefronts';

            let branchItems = allListings.filter(l => {
                const matchesBranch = !selectedBranch || l.storefront === selectedBranch;
                const matchesSearch = (l.title || '').toLowerCase().includes(searchTerm) || (l.sku || '').toLowerCase().includes(searchTerm);
                const matchesStock = !stockOnlyFilter || (l.stock > 0);
                return matchesBranch && matchesSearch && matchesStock;
            });

            // Sorting
            if (sortMode === 'price-low') {
                branchItems.sort((a, b) => (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0));
            } else if (sortMode === 'price-high') {
                branchItems.sort((a, b) => (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0));
            }

            const resultsCountEl = document.getElementById('results-count');
            if (resultsCountEl) {
                resultsCountEl.textContent = `Showing ${branchItems.length} verified item${branchItems.length === 1 ? '' : 's'}${selectedBranch ? ` at ${selectedBranch}` : ''}`;
            }

            if (branchItems.length === 0) {
                container.innerHTML = `
                    <div class="col-span-full py-16 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-8 space-y-3">
                        <svg class="w-12 h-12 mx-auto text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                        </svg>
                        <p class="type-title font-bold text-slate-900 dark:text-white">No items found matching your filters</p>
                        <p class="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">Try clearing your search query or switching to "All Storefronts" to discover more products.</p>
                        <button onclick="document.getElementById('catalog-search').value=''; document.getElementById('catalog-storefront').value=''; renderCatalog();" class="mt-2 inline-flex items-center px-4 py-2 bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-bold text-xs rounded-xl hover:bg-slate-800 dark:hover:bg-amber-400 transition-colors">
                            Reset Search &amp; Filters
                        </button>
                    </div>
                `;
                return;
            }

            container.innerHTML = branchItems.map(item => {
                const stock = parseInt(item.stock, 10) || 0;
                const isOutOfStock = stock <= 0;
                const isLowStock = stock > 0 && stock <= 5;
                const priceNum = parseFloat(item.price) || 0;
                
                const img = item.image_url 
                    ? `<div class="w-full h-48 flex items-center justify-center p-3 mb-3 overflow-hidden">
                        <img src="${sanitizeHtml(item.image_url)}" alt="${sanitizeHtml(item.title)}" loading="lazy" referrerpolicy="no-referrer" class="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105">
                       </div>`
                    : `<div class="w-full h-48 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 font-mono text-xs mb-3">
                        <svg class="w-8 h-8 mb-1 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                        <span>No Image</span>
                       </div>`;

                let stockMarkup = `<span class="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-xs"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>In Stock (${stock} units)</span>`;
                if (isOutOfStock) {
                    stockMarkup = `<span class="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold text-xs"><span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>Currently Out of Stock</span>`;
                } else if (isLowStock) {
                    stockMarkup = `<span class="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold text-xs"><span class="w-2 h-2 rounded-full bg-amber-500"></span>Only ${stock} left - order soon</span>`;
                }

                return `
                    <article class="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:shadow-xl hover:border-amber-300 dark:hover:border-amber-700/60 transition-all duration-200 group">
                        <div>
                            ${img}
                            
                            <!-- Badges -->
                            <div class="flex items-center justify-between gap-2 mb-2">
                                <span class="text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 truncate max-w-[140px]">
                                    ${sanitizeHtml(item.storefront)}
                                </span>
                                <span class="text-xs font-mono text-slate-600 dark:text-slate-300 font-medium">${sanitizeHtml(item.sku)}</span>
                            </div>

                            <!-- Title -->
                            <h3 class="type-title font-bold text-slate-900 dark:text-white tracking-tight leading-snug line-clamp-2 min-h-[2.5rem]">
                                ${sanitizeHtml(item.title)}
                            </h3>

                            <!-- Price Display -->
                            <div class="flex items-baseline gap-1 mt-3">
                                <span class="text-xs text-slate-500 dark:text-slate-400 font-semibold">$</span>
                                <span class="text-2xl font-black text-slate-900 dark:text-white tabular-nums">${priceNum.toFixed(2)}</span>
                            </div>

                            <!-- Stock Status -->
                            <div class="mt-1">
                                ${stockMarkup}
                            </div>
                        </div>

                        <!-- Add to Cart Action -->
                        <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                            <button onclick="addToCart('${sanitizeHtml(item.id)}')" ${isOutOfStock ? 'disabled' : ''} 
                                class="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl shadow-sm hover:shadow transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-40 disabled:cursor-not-allowed">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                                </svg>
                                <span>${isOutOfStock ? 'Out of Stock' : 'Add to Cart'}</span>
                            </button>
                        </div>
                    </article>
                `;
            }).join('');
        }

        function addToCart(listingId) {
            const item = allListings.find(l => l.id === listingId);
            if (!item || item.stock <= 0) return;

            const existing = cart.find(c => c.id === listingId);
            if (existing) {
                if (existing.qty < item.stock) {
                    existing.qty += 1;
                    showToast(`Updated quantity for "${item.title}" (${existing.qty})`, 'success');
                } else {
                    showToast(`Cannot add more than ${item.stock} units currently in stock.`, 'error');
                    return;
                }
            } else {
                cart.push({ ...item, qty: 1 });
                showToast(`Added "${item.title}" to cart`, 'success');
            }

            saveCartToStorage();
            updateCartUI();
        }

        /* --- CART QUANTITY MODIFIERS --- */
        function changeCartQty(id, delta) {
            const cartItem = cart.find(c => c.id === id);
            if (!cartItem) return;

            const catalogItem = allListings.find(l => l.id === id) || cartItem;
            const maxStock = catalogItem.stock !== undefined ? catalogItem.stock : 999;
            const newQty = cartItem.qty + delta;

            if (newQty <= 0) {
                removeFromCart(id);
                return;
            }

            if (newQty > maxStock) {
                showToast(`Cannot add more than ${maxStock} units currently in stock.`, 'error');
                return;
            }

            cartItem.qty = newQty;
            saveCartToStorage();
            updateCartUI();
        }

        function setCartQtyManual(id, rawVal) {
            const cartItem = cart.find(c => c.id === id);
            if (!cartItem) return;

            const catalogItem = allListings.find(l => l.id === id) || cartItem;
            const maxStock = catalogItem.stock !== undefined ? catalogItem.stock : 999;
            let val = parseInt(rawVal, 10);

            if (isNaN(val) || val <= 0) {
                removeFromCart(id);
                return;
            }

            if (val > maxStock) {
                showToast(`Cannot add more than ${maxStock} units currently in stock.`, 'error');
                val = maxStock;
            }

            cartItem.qty = val;
            saveCartToStorage();
            updateCartUI();
        }

function updateCartUI() {
            const count = cart.reduce((sum, i) => sum + i.qty, 0);

            const badge = document.getElementById('cart-badge');
            if (badge) badge.textContent = count;
            const counter = document.getElementById('cart-counter');
            if (counter) counter.textContent = count;

            // Partition items by branch
            const branchMap = {};
            cart.forEach(item => {
                const b = item.storefront || 'Storefront';
                if (!branchMap[b]) branchMap[b] = [];
                branchMap[b].push(item);
            });
            const branchNames = Object.keys(branchMap);

            const branchEl = document.getElementById('cart-storefront-name');
            if (branchEl) {
                branchEl.textContent = branchNames.length === 1 
                    ? branchNames[0] 
                    : (branchNames.length > 1 ? `${branchNames.length} Storefronts` : 'All Storefronts');
            }

            // Guest notices
            const guestNotice = document.getElementById('cart-guest-notice');
            if (guestNotice) {
                if (!currentUser && cart.length > 0) {
                    guestNotice.classList.remove('hidden');
                } else {
                    guestNotice.classList.add('hidden');
                }
            }



            const container = document.getElementById('cart-items-container');
            const totalEl = document.getElementById('cart-total-price');
            const subtotalEl = document.getElementById('cart-subtotal-price');
            const taxEl = document.getElementById('cart-tax-price');
            const orderBtn = document.getElementById('order-btn');

            if (!container || !totalEl || !orderBtn) return;

            if (cart.length === 0) {
                appliedCoupon = null;
                const discountRow = document.getElementById('cart-discount-row');
                if (discountRow) discountRow.classList.add('hidden');
                syncCouponUI();
                const feedback = document.getElementById('coupon-feedback');
                if (feedback) { feedback.textContent = ''; feedback.classList.add('hidden'); }

                container.innerHTML = `
                    <div class="py-16 text-center space-y-2">
                        <svg class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
                        </svg>
                        <p class="text-sm font-bold text-slate-700 dark:text-slate-300">Your cart is empty</p>
                        <p class="text-xs text-slate-400 dark:text-slate-500">Add products from the catalog to prepare your delivery order.</p>
                    </div>
                `;
                if (subtotalEl) subtotalEl.textContent = '$0.00';
                if (taxEl) taxEl.textContent = '$0.00';
                totalEl.textContent = '$0.00';
                orderBtn.disabled = true;
                return;
            }

            let total = 0;
            container.innerHTML = branchNames.map(branch => {
                const items = branchMap[branch];
                const branchItemsHtml = items.map(item => {
                    const price = parseFloat(item.price) || 0;
                    const sub = item.qty * price;
                    total += sub;
                    const maxStock = item.stock !== undefined ? item.stock : 999;
                    const isMax = item.qty >= maxStock;

                    return `
                        <div class="flex flex-col gap-3 py-3.5 text-xs border-b border-slate-100 dark:border-slate-800 last:border-none">
                            <div class="flex justify-between items-start gap-2">
                                <div class="min-w-0 flex-1">
                                    <p class="font-bold text-slate-900 dark:text-white truncate text-sm leading-snug">${sanitizeHtml(item.title)}</p>
                                    <p class="text-slate-500 dark:text-slate-400 font-mono text-xs mt-0.5">${sanitizeHtml(item.sku)} &bull; $${price.toFixed(2)} each</p>
                                    <p class="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">${sanitizeHtml(item.storefront)} &bull; <span class="text-emerald-600 dark:text-emerald-400 font-semibold">${maxStock} in stock</span></p>
                                </div>
                                <button onclick="removeFromCart('${sanitizeHtml(item.id)}')" class="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors p-1.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700/60" title="Remove item from cart" aria-label="Remove item">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                </button>
                            </div>

                            <div class="flex items-center justify-between pt-1">
                                <!-- Stepper + Manual Entry Input -->
                                <div class="flex items-center gap-1 border border-slate-300 dark:border-slate-700 rounded-lg p-0.5">
                                    <button onclick="changeCartQty('${sanitizeHtml(item.id)}', -1)" class="w-7 h-7 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white rounded font-bold text-sm transition-colors" title="Decrease quantity" aria-label="Decrease quantity">
                                        &minus;
                                    </button>
                                    <input 
                                        type="number" 
                                        min="1" 
                                        max="${maxStock}" 
                                        value="${item.qty}" 
                                        onchange="setCartQtyManual('${sanitizeHtml(item.id)}', this.value)" 
                                        onkeydown="if(event.key==='Enter') this.blur();"
                                        class="w-10 text-center font-mono font-bold text-slate-900 dark:text-white text-xs bg-transparent focus:outline-none focus:ring-1 focus:ring-amber-500 rounded py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                                        title="Click to type custom quantity"
                                        aria-label="Item quantity"
                                    >
                                    <button onclick="changeCartQty('${sanitizeHtml(item.id)}', 1)" ${isMax ? 'disabled' : ''} class="w-7 h-7 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white rounded font-bold text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="${isMax ? 'Max stock reached' : 'Increase quantity'}" aria-label="Increase quantity">
                                        +
                                    </button>
                                </div>

                                <!-- Line Subtotal -->
                                <div class="text-right">
                                    <span class="text-slate-400 dark:text-slate-500 text-xs block font-medium">Subtotal</span>
                                    <span class="font-mono font-bold text-slate-900 dark:text-white text-sm">$${sub.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');

                if (branchNames.length > 1) {
                    return `
                        <div class="mb-4">
                            <div class="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-amber-600 dark:text-amber-400">
                                <span>${sanitizeHtml(branch)}</span>
                                <span class="font-mono font-normal text-slate-500 dark:text-slate-400">${items.length} item${items.length === 1 ? '' : 's'}</span>
                            </div>
                            <div class="pl-1">
                                ${branchItemsHtml}
                            </div>
                        </div>
                    `;
                }

                return branchItemsHtml;
            }).join('');

            const subtotal = total;
            let discountAmount = 0;

            const discountRow = document.getElementById('cart-discount-row');
            const discountPriceEl = document.getElementById('cart-discount-price');
            const discountLabelEl = document.getElementById('cart-discount-label');

            if (appliedCoupon && cart.length > 0) {
                const eligibleItems = cart.filter(i =>
                    !appliedCoupon.storefront ||
                    appliedCoupon.storefront === 'All' ||
                    appliedCoupon.storefront === 'All Storefronts' ||
                    i.storefront === appliedCoupon.storefront
                );
                const eligibleSubtotal = eligibleItems.reduce((sum, i) => sum + (i.qty * (parseFloat(i.price) || 0)), 0);

                if (eligibleItems.length > 0 && eligibleSubtotal > 0) {
                    if (appliedCoupon.discountType === 'percent') {
                        discountAmount = eligibleSubtotal * (appliedCoupon.discountValue / 100);
                    } else {
                        discountAmount = Math.min(eligibleSubtotal, appliedCoupon.discountValue);
                    }
                    if (discountRow) discountRow.classList.remove('hidden');
                    if (discountPriceEl) discountPriceEl.textContent = `-$${discountAmount.toFixed(2)}`;
                    if (discountLabelEl) {
                        const discountDesc = appliedCoupon.discountType === 'percent'
                            ? `${appliedCoupon.discountValue}%`
                            : `$${appliedCoupon.discountValue.toFixed(2)}`;
                        discountLabelEl.textContent = `Discount (${appliedCoupon.code} - ${discountDesc})`;
                    }
                } else {
                    appliedCoupon = null;
                    if (discountRow) discountRow.classList.add('hidden');
                    syncCouponUI();
                }
            } else {
                if (discountRow) discountRow.classList.add('hidden');
            }

            const netSubtotal = Math.max(0, subtotal - discountAmount);
            const tax = netSubtotal * 0.0825;
            const totalWithTax = netSubtotal + tax;

            if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
            if (taxEl) taxEl.textContent = `$${tax.toFixed(2)}`;
            totalEl.textContent = `$${totalWithTax.toFixed(2)}`;
            orderBtn.disabled = false;
        }

        function syncCouponUI() {
            const input = document.getElementById('cart-coupon-input');
            const applyBtn = document.getElementById('apply-coupon-btn');
            if (!input || !applyBtn) return;

            if (appliedCoupon) {
                input.value = appliedCoupon.code;
                input.disabled = true;
                applyBtn.textContent = 'Remove';
                applyBtn.onclick = removeCartCoupon;
                applyBtn.className = 'px-3.5 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl border border-rose-200 dark:border-rose-800 transition-all cursor-pointer';
            } else {
                input.disabled = false;
                applyBtn.textContent = 'Apply';
                applyBtn.onclick = applyCartCoupon;
                applyBtn.className = 'px-3.5 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700/60 transition-all cursor-pointer';
            }
        }
        window.syncCouponUI = syncCouponUI;

        async function applyCartCoupon() {
            const input = document.getElementById('cart-coupon-input');
            const feedback = document.getElementById('coupon-feedback');
            const applyBtn = document.getElementById('apply-coupon-btn');

            if (!input || !feedback) return;

            const code = input.value.trim().toUpperCase();

            feedback.classList.remove(
                'hidden',
                'text-rose-600',
                'text-emerald-600',
                'dark:text-rose-400',
                'dark:text-emerald-400'
            );

            if (!code) {
                removeCartCoupon();
                feedback.textContent = 'Please enter a coupon code.';
                feedback.classList.add('text-rose-600', 'dark:text-rose-400');
                feedback.classList.remove('hidden');
                return;
            }

            if (cart.length === 0) {
                feedback.textContent = 'Add items to your cart before applying a coupon.';
                feedback.classList.add('text-rose-600', 'dark:text-rose-400');
                feedback.classList.remove('hidden');
                return;
            }

            if (applyBtn) {
                applyBtn.disabled = true;
                applyBtn.textContent = '...';
            }

            try {
                const { client } = await import('./js/supaBase.js');

                // The redesigned cart may contain products from multiple storefronts.
                // Validate this code securely against each storefront represented
                // in the cart.
                const storefronts = [
                    ...new Set(
                        cart
                            .map(item => item.storefront)
                            .filter(Boolean)
                    )
                ];

                const validMatches = [];
                const invalidMessages = [];

                for (const storefront of storefronts) {
                    const storefrontSubtotal = cart
                        .filter(item => item.storefront === storefront)
                        .reduce(
                            (sum, item) =>
                                sum +
                                (
                                    (parseFloat(item.price) || 0) *
                                    (parseInt(item.qty, 10) || 0)
                                ),
                            0
                        );

                    const { data, error } = await client.rpc(
                        'validate_coupon',
                        {
                            p_code: code,
                            p_storefront: storefront,
                            p_subtotal: storefrontSubtotal
                        }
                    );

                    if (error) {
                        throw error;
                    }

                    const result = Array.isArray(data)
                        ? data[0]
                        : data;

                    if (result?.is_valid) {
                        validMatches.push({
                            storefront,
                            result
                        });
                    } else if (result?.message) {
                        invalidMessages.push(result.message);
                    }
                }

                // Same coupon code existing for multiple storefronts in the same
                // mixed cart would be ambiguous for the current UI.
                if (validMatches.length > 1) {
                    appliedCoupon = null;

                    feedback.textContent =
                        `Coupon "${code}" is valid for more than one storefront in your cart. ` +
                        'Please check out one storefront at a time when using this code.';

                    feedback.classList.add(
                        'text-rose-600',
                        'dark:text-rose-400'
                    );

                    syncCouponUI();
                    updateCartUI();
                    return;
                }

                if (validMatches.length === 0) {
                    appliedCoupon = null;

                    // Prefer a meaningful validation error such as expiration,
                    // minimum purchase, or usage limit over "Coupon not found."
                    const usefulMessage =
                        invalidMessages.find(
                            message => message !== 'Coupon not found.'
                        ) ||
                        invalidMessages[0] ||
                        'Coupon not found.';

                    feedback.textContent = usefulMessage;

                    feedback.classList.add(
                        'text-rose-600',
                        'dark:text-rose-400'
                    );

                    syncCouponUI();
                    updateCartUI();
                    return;
                }

                const match = validMatches[0];
                const result = match.result;

                appliedCoupon = {
                    code,
                    storefront: match.storefront,
                    discountType: result.discount_type,
                    discountValue: Number(result.discount_value)
                };

                const discountDesc =
                    result.discount_type === 'percent'
                        ? `${Number(result.discount_value)}%`
                        : `$${Number(result.discount_value).toFixed(2)}`;

                feedback.textContent =
                    `Coupon applied! ${discountDesc} off eligible items from ${match.storefront}.`;

                feedback.classList.add(
                    'text-emerald-600',
                    'dark:text-emerald-400'
                );

                feedback.classList.remove('hidden');

                syncCouponUI();
                updateCartUI();

            } catch (err) {
                appliedCoupon = null;

                feedback.textContent =
                    'Could not validate coupon: ' +
                    (err.message || 'Unknown error.');

                feedback.classList.add(
                    'text-rose-600',
                    'dark:text-rose-400'
                );

                feedback.classList.remove('hidden');

                syncCouponUI();
                updateCartUI();

            } finally {
                if (applyBtn) {
                    applyBtn.disabled = false;

                    if (!appliedCoupon) {
                        applyBtn.textContent = 'Apply';
                    }
                }
            }
        }
        window.applyCartCoupon = applyCartCoupon;

        function removeCartCoupon() {
            appliedCoupon = null;
            const input = document.getElementById('cart-coupon-input');
            const feedback = document.getElementById('coupon-feedback');

            if (input) {
                input.value = '';
            }
            if (feedback) {
                feedback.textContent = 'Coupon removed.';
                feedback.className = 'text-xs text-slate-500 dark:text-slate-400 mt-1 block';
            }
            syncCouponUI();
            updateCartUI();
        }
        window.removeCartCoupon = removeCartCoupon;

        function removeFromCart(id) {
            cart = cart.filter(c => c.id !== id);
            saveCartToStorage();
            updateCartUI();
        }

        async function placeOrder() {
            if (!currentUser) {
                if (typeof toggleCartDrawer === 'function') {
                    toggleCartDrawer(false);
                }

                openAuthModal('Sign in to your account to complete checkout.');
                return;
            }

            if (!cart.length) {
                showToast('Your cart is empty.', 'error');
                return;
            }

            const { client } = await import('./js/supaBase.js');

            const orderBtn = document.getElementById('order-btn');
            orderBtn.disabled = true;
            orderBtn.textContent = 'Processing Order...';

            // Keep the redesigned multi-storefront behavior.
            // Each storefront becomes its own secure order.
            const branchMap = {};

            cart.forEach(item => {
                const branch = item.storefront || 'Storefront';

                if (!branchMap[branch]) {
                    branchMap[branch] = [];
                }

                branchMap[branch].push(item);
            });

            const placedOrders = [];

            try {
                for (const [branch, items] of Object.entries(branchMap)) {

                    // Only send IDs + quantities.
                    // Price, stock, title, SKU, storefront and totals
                    // are loaded again by PostgreSQL.
                    const secureItems = items.map(item => ({
                        id: item.id,
                        qty: parseInt(item.qty, 10)
                    }));

                    // A coupon is sent only to the storefront
                    // for which it was securely validated.
                    const couponForBranch =
                        appliedCoupon &&
                        appliedCoupon.storefront === branch
                            ? appliedCoupon.code
                            : null;

                    const { data, error } = await client.rpc(
                        'place_order',
                        {
                            p_items: secureItems,
                            p_coupon_code: couponForBranch
                        }
                    );

                    if (error) {
                        throw error;
                    }

                    const result =
                        typeof data === 'string'
                            ? JSON.parse(data)
                            : data;

                    if (!result || !result.order_number) {
                        throw new Error(
                            'The server did not return a valid order confirmation.'
                        );
                    }

                    const subtotal =
                        Number(result.subtotal || 0).toFixed(2);

                    const discount =
                        Number(result.discount_amount || 0).toFixed(2);

                    const tax =
                        Number(result.tax_amount || 0).toFixed(2);

                    const total =
                        Number(result.total || 0).toFixed(2);

                    const orderNumber =
                        String(result.order_number);

                    const orderStorefront =
                        String(result.storefront || branch);

                    const orderItems =
                        String(result.items || '');

                    const couponCode =
                        result.coupon_code
                            ? String(result.coupon_code)
                            : '';

                    placedOrders.push({
                        orderNum: orderNumber,
                        branch: orderStorefront,
                        subtotal,
                        tax,
                        total,
                        count: items.length,
                        items: orderItems,
                        discount,
                        couponCode
                    });

                    storeCustomerOrderReference({
                        order_number: orderNumber,
                        storefront: orderStorefront,
                        items: orderItems,
                        subtotal,
                        tax,
                        total,
                        discount,
                        coupon_code: couponCode || null,
                        created_at: new Date().toISOString(),
                        status: 'Processing'
                    });

                    /*
                     * Remove this storefront from the local cart immediately
                     * after the database confirms it.
                     *
                     * This matters for a multi-storefront cart:
                     * if storefront #1 succeeds but storefront #2 fails,
                     * retrying checkout will not accidentally order
                     * storefront #1 twice.
                     */
                    cart = cart.filter(
                        cartItem => cartItem.storefront !== branch
                    );

                    saveCartToStorage();
                }

                // ==========================================
                // ORDER CONFIRMATION
                // ==========================================

                const msgEl =
                    document.getElementById('confirmation-message');

                const listEl =
                    document.getElementById('confirmation-orders-list');

                if (placedOrders.length === 1) {
                    const single = placedOrders[0];

                    msgEl.innerHTML =
                        `Your delivery order ` +
                        `<strong class="text-amber-500 font-mono">${sanitizeHtml(single.orderNum)}</strong> ` +
                        `from <strong class="text-slate-900 dark:text-white">${sanitizeHtml(single.branch)}</strong> ` +
                        `is confirmed and being prepared for delivery. ` +
                        `Total: <strong>$${single.total}</strong> ` +
                        `<span class="text-xs text-slate-500 dark:text-slate-400 font-normal">` +
                        `(incl. $${single.tax} tax)` +
                        `</span>.`;

                    if (listEl) {
                        listEl.innerHTML = `
                            <button
                                onclick="viewReceiptDirect(
                                    '${sanitizeHtml(single.orderNum)}',
                                    '${sanitizeHtml(single.branch)}',
                                    '${sanitizeHtml(single.items)}',
                                    '${single.total}',
                                    '${single.subtotal}',
                                    '${single.tax}',
                                    '${single.discount}',
                                    '${sanitizeHtml(single.couponCode || '')}'
                                )"
                                class="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-500/30 text-xs font-bold rounded-xl transition-colors"
                            >
                                <svg
                                    class="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                                    />
                                </svg>

                                <span>View Order Receipt</span>
                            </button>
                        `;
                    }

                } else {
                    msgEl.innerHTML =
                        `Successfully generated ` +
                        `<strong class="text-slate-900 dark:text-white">` +
                        `${placedOrders.length} separate delivery shipments` +
                        `</strong>:`;

                    if (listEl) {
                        listEl.innerHTML = placedOrders.map(order => `
                            <div
                                class="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-left flex justify-between items-center text-xs gap-3"
                            >
                                <div class="min-w-0 flex-1">

                                    <span class="font-mono font-bold text-amber-500 text-sm">
                                        ${sanitizeHtml(order.orderNum)}
                                    </span>

                                    <span class="block text-slate-700 dark:text-slate-300 font-semibold mt-0.5 truncate">
                                        ${sanitizeHtml(order.branch)}
                                        &bull;
                                        ${order.count}
                                        item${order.count === 1 ? '' : 's'}
                                    </span>

                                    <span class="font-mono font-bold text-slate-900 dark:text-white text-xs block mt-0.5">
                                        $${order.total}

                                        <span class="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                                            (incl. $${order.tax} tax)
                                        </span>
                                    </span>

                                </div>

                                <button
                                    onclick="viewReceiptDirect(
                                        '${sanitizeHtml(order.orderNum)}',
                                        '${sanitizeHtml(order.branch)}',
                                        '${sanitizeHtml(order.items)}',
                                        '${order.total}',
                                        '${order.subtotal}',
                                        '${order.tax}',
                                        '${order.discount}',
                                        '${sanitizeHtml(order.couponCode || '')}'
                                    )"
                                    class="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs shrink-0 transition-colors"
                                >
                                    View Receipt
                                </button>
                            </div>
                        `).join('');
                    }
                }

                document
                    .getElementById('confirmation-modal')
                    .classList.remove('hidden');

                appliedCoupon = null;

                saveCartToStorage();
                syncCouponUI();
                updateCartUI();

                toggleCartDrawer(false);

                // Reload trusted stock values from Supabase.
                await fetchListings();
                renderCatalog();

            } catch (err) {

                /*
                 * A storefront that already succeeded has already
                 * been removed from the cart.
                 *
                 * Therefore a retry will only retry the remaining
                 * storefronts instead of duplicating an order.
                 */
                saveCartToStorage();
                updateCartUI();

                await fetchListings();
                renderCatalog();

                const message =
                    err?.message ||
                    'Unknown checkout error.';

                if (placedOrders.length > 0) {
                    showToast(
                        `${placedOrders.length} shipment(s) were placed successfully, ` +
                        `but another shipment failed: ${message}. ` +
                        `The remaining items are still in your cart.`,
                        'error'
                    );

                } else {
                    showToast(
                        'Failed to place order: ' + message,
                        'error'
                    );
                }

            } finally {
                orderBtn.disabled = false;
                orderBtn.textContent =
                    'Proceed to Checkout • Place Delivery Order';
            }
        }

        function closeConfirmationModal() {
            document.getElementById('confirmation-modal').classList.add('hidden');
        }

        function viewReceiptDirect(orderNum, branchName, itemsString, total, subtotal, tax, discount, couponCode) {
            closeConfirmationModal();
            const branch = activeStorefronts.find(s => s.name === branchName);
            trackedOrderCache = {
                order_number: orderNum,
                storefront: branchName,
                items: itemsString,
                total: total,
                subtotal: subtotal,
                tax: tax,
                discount: discount || '0.00',
                coupon_code: couponCode || null,
                created_at: new Date().toISOString()
            };
            openReceiptModal();
        }
        window.viewReceiptDirect = viewReceiptDirect;

        /* --- REGISTERED CUSTOMER ORDER HISTORY --- */
        function getCustomerOrdersStorageKey() {
            if (!currentUser || !currentUser.email) return null;
            return `scamazon_customer_orders_${currentUser.email.toLowerCase()}`;
        }

        function storeCustomerOrderReference(orderObj) {
            const key = getCustomerOrdersStorageKey();
            if (!key) return;
            try {
                const existingJson = localStorage.getItem(key);
                let list = existingJson ? JSON.parse(existingJson) : [];
                // Prepend latest order, deduping by order_number
                list = list.filter(o => o.order_number !== orderObj.order_number);
                list.unshift(orderObj);
                localStorage.setItem(key, JSON.stringify(list));
            } catch (err) {
                console.error('Failed to save customer order reference:', err);
            }
        }

        async function loadCustomerOrderHistory() {
            const listContainer = document.getElementById('order-history-list');
            const countBadge = document.getElementById('history-count-badge');
            if (!listContainer) return;

            if (!currentUser) {
                listContainer.innerHTML = `
                    <div class="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3">
                        <div class="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center mx-auto">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                            </svg>
                        </div>
                        <p class="text-sm font-bold text-slate-900 dark:text-white">Sign In to View Your Order History</p>
                        <p class="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                            Connect your customer account to view past orders, delivery updates, and printable receipts.
                        </p>
                        <button onclick="openBuiltInAuth('signin')" class="mt-2 inline-flex items-center px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-colors">
                            Sign In / Create Account
                        </button>
                    </div>
                `;
                if (countBadge) countBadge.textContent = 'Sign In';
                return;
            }

            const key = getCustomerOrdersStorageKey();
            let storedOrders = [];
            try {
                const saved = localStorage.getItem(key);
                if (saved) storedOrders = JSON.parse(saved);
            } catch (e) {
                console.error('Failed to parse customer orders from storage:', e);
            }

            if (!storedOrders || storedOrders.length === 0) {
                listContainer.innerHTML = `
                    <div class="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3">
                        <div class="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center mx-auto">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                            </svg>
                        </div>
                        <p class="text-sm font-bold text-slate-900 dark:text-white">No Placed Orders Found Yet</p>
                        <p class="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                            You haven't placed any delivery orders under <span class="font-mono text-slate-700 dark:text-slate-300 font-semibold">${sanitizeHtml(currentUser.email)}</span>. Browse our catalog to get started!
                        </p>
                        <button onclick="switchTab('catalog')" class="mt-2 inline-flex items-center px-4 py-2 bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-bold text-xs rounded-xl hover:bg-slate-800 dark:hover:bg-amber-400 transition-colors">
                            Explore Catalog
                        </button>
                    </div>
                `;
                if (countBadge) countBadge.textContent = '0 Orders';
                return;
            }

            if (countBadge) countBadge.textContent = `${storedOrders.length} Order${storedOrders.length === 1 ? '' : 's'}`;

            listContainer.innerHTML = `
                <div class="p-4 text-center text-xs text-slate-500 dark:text-slate-400">
                    Syncing live delivery statuses...
                </div>
            `;


            // Query live database orders that this customer is still allowed to see.
            // Because Supabase RLS now restricts customers to their own orders,
            // any deleted or inaccessible local order references are removed.
            try {
                const { client } = await import('./js/supaBase.js');
                const orderNumbers = storedOrders.map(o => o.order_number);

                const { data: liveOrders, error } = await client
                    .from('orders')
                    .select('*')
                    .in('order_number', orderNumbers);

                if (error) {
                    throw error;
                }

                const liveMap = new Map(
                    (liveOrders || []).map(order => [
                        order.order_number,
                        order
                    ])
                );

                storedOrders = storedOrders
                    .filter(order => liveMap.has(order.order_number))
                    .map(order => {
                        const liveOrder = liveMap.get(order.order_number);

                        return {
                            ...order,
                            status: liveOrder.status || order.status,
                            storefront: liveOrder.storefront || order.storefront,
                            items: liveOrder.items || order.items,
                            created_at: liveOrder.created_at || order.created_at
                        };
                    });

                localStorage.setItem(
                    key,
                    JSON.stringify(storedOrders)
                );

                if (countBadge) {
                    countBadge.textContent =
                        `${storedOrders.length} Order${storedOrders.length === 1 ? '' : 's'}`;
                }

            } catch (syncErr) {
                console.warn(
                    'Live order status sync skipped:',
                    syncErr
                );
            }

            listContainer.innerHTML = storedOrders.map(order => {
                const displayStatus = order.status === 'Ready for Driver' ? 'Shipped' : (order.status || 'Processing');
                
                let statusBadge = `
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                        <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        Processing
                    </span>
                `;

                if (['Shipped', 'Ready for Driver'].includes(order.status)) {
                    statusBadge = `
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                            <span class="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                            Shipped
                        </span>
                    `;
                } else if (order.status === 'Out for Delivery') {
                    statusBadge = `
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                            <span class="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                            Out for Delivery
                        </span>
                    `;
                } else if (order.status === 'Delivered') {
                    statusBadge = `
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Delivered
                        </span>
                    `;
                }

                const placedDate = order.created_at 
                    ? new Date(order.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'Recent';

                return `
                    <article class="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:border-amber-400/60 dark:hover:border-amber-600/40 transition-all space-y-4">
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                            <div>
                                <div class="flex items-center gap-2">
                                    <span class="font-mono font-bold text-base text-slate-900 dark:text-white">${sanitizeHtml(order.order_number)}</span>
                                    ${statusBadge}
                                </div>
                                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Placed on ${placedDate} &bull; Storefront: <span class="font-medium text-slate-700 dark:text-slate-300">${sanitizeHtml(order.storefront)}</span>
                                </p>
                            </div>
                            <div class="flex items-center gap-2 self-start sm:self-auto">
                                <button type="button" onclick="selectHistoryOrder('${sanitizeHtml(order.order_number)}')" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                    </svg>
                                    <span>Track Live</span>
                                </button>
                                <button type="button" onclick="viewReceiptDirect('${sanitizeHtml(order.order_number)}', '${sanitizeHtml(order.storefront)}', '${sanitizeHtml(order.items)}', '${order.total || '0.00'}', '${order.subtotal || ''}', '${order.tax || ''}', '${order.discount || ''}', '${sanitizeHtml(order.coupon_code || '')}')" class="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 dark:border-slate-700 hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
                                    </svg>
                                    <span>Receipt</span>
                                </button>
                            </div>
                        </div>

                        <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs">
                            <div class="space-y-0.5">
                                <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Ordered Items</span>
                                <div class="space-y-1">
                                    <p class="font-mono text-xs text-slate-800 dark:text-slate-200 line-clamp-1">${sanitizeHtml((order.items || '').replace(/\s*\[Coupon:[^\]]+\]/gi, '').trim())}</p>
                                </div>
                            </div>
                            ${order.total ? `
                                <div class="text-left sm:text-right shrink-0">
                                    <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Order Total</span>
                                    <span class="font-mono font-bold text-sm text-slate-900 dark:text-white">$${order.total}</span>
                                    <span class="text-[10px] text-slate-500 dark:text-slate-400 block font-normal mt-0.5">incl. 8.25% state tax</span>
                                </div>
                            ` : ''}
                        </div>
                    </article>
                `;
            }).join('');
        }
        window.loadCustomerOrderHistory = loadCustomerOrderHistory;

        function selectHistoryOrder(orderNumber) {
            const input = document.getElementById('tracking-input');
            if (input) input.value = orderNumber;
            trackOrder();
            const card = document.getElementById('tracking-card');
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
        window.selectHistoryOrder = selectHistoryOrder;

        // ================= TRACKING & INVOICES =================
        async function trackOrder() {
            if (!currentUser) {
                openAuthModal('Sign in or register an account to track your orders and view delivery receipts.');
                return;
            }

            const { client } = await import('./js/supaBase.js');
            const rawQuery = (document.getElementById('tracking-input').value || '').trim();
            if (!rawQuery) return;

            // Extract numeric digits if present (e.g., 'Order #5041' -> '5041'), else clean special chars
           const cleanOrderId = rawQuery
                .replace(/^order\s*#?\s*/i, '')
                .replace(/[#%_]/g, '')
                .trim()
                .toUpperCase();

            const normalizedOrderNumber = `Order #${cleanOrderId}`;

            const { data, error } = await client
                .from('orders')
                .select('*')
                .eq('order_number', normalizedOrderNumber)
                .maybeSingle();

            const errorContainer = document.getElementById('tracking-error');
            const errorText = document.getElementById('tracking-error-text');

            if (error || !data) {
                if (errorContainer && errorText) {
                    errorText.textContent = `Order "${rawQuery}" was not found. Please verify your order number (e.g. Order #1042).`;
                    errorContainer.classList.remove('hidden');
                } else {
                    showToast(`Order "${rawQuery}" was not found.`, 'error');
                }
                return;
            }

            if (errorContainer) errorContainer.classList.add('hidden');

            trackedOrderCache = data;
            document.getElementById('tracking-card').classList.remove('hidden');
            document.getElementById('track-order-id').textContent = data.order_number;
            document.getElementById('track-storefront').textContent = data.storefront;
            const cleanTrackItems = (data.items || '').replace(/\s*\[Coupon:[^\]]+\]/gi, '').trim();
            const trackItemsEl = document.getElementById('track-items');
            if (trackItemsEl) {
                trackItemsEl.textContent = cleanTrackItems;
            }
            const displayStatus = data.status === 'Ready for Driver' ? 'Shipped' : data.status;
            document.getElementById('track-status-text').textContent = displayStatus;

            // Reset all 4 milestone dots
            const activeDotClass = 'w-10 h-10 rounded-full bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 flex items-center justify-center text-sm font-bold ring-4 ring-white dark:ring-slate-900 transition-all';
            const inactiveDotClass = 'w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center text-sm font-bold ring-4 ring-white dark:ring-slate-900 transition-all';

            ['step-processing-dot', 'step-shipped-dot', 'step-out-dot', 'step-delivered-dot'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.className = inactiveDotClass;
            });

            const status = data.status === 'Ready for Driver' ? 'Shipped' : (data.status || 'Processing');

            // Milestone 1: Processing (active for all placed orders)
            const dotProc = document.getElementById('step-processing-dot');
            const timeProc = document.getElementById('time-processing');
            if (dotProc) dotProc.className = activeDotClass;
            if (timeProc) timeProc.textContent = status === 'Processing' ? 'In Progress' : 'Completed';

            // Milestone 2: Shipped
            const dotShip = document.getElementById('step-shipped-dot');
            const timeShip = document.getElementById('time-shipped');
            if (['Shipped', 'Out for Delivery', 'Delivered'].includes(status)) {
                if (dotShip) dotShip.className = activeDotClass;
                if (timeShip) timeShip.textContent = status === 'Shipped' ? 'In Transit' : 'Completed';
            } else {
                if (timeShip) timeShip.textContent = 'Pending';
            }

            // Milestone 3: Out for Delivery
            const dotOut = document.getElementById('step-out-dot');
            const timeOut = document.getElementById('time-out');
            if (['Out for Delivery', 'Delivered'].includes(status)) {
                if (dotOut) dotOut.className = activeDotClass;
                if (timeOut) timeOut.textContent = status === 'Out for Delivery' ? 'En Route' : 'Completed';
            } else {
                if (timeOut) timeOut.textContent = 'Pending';
            }

            // Milestone 4: Delivered
            const dotDel = document.getElementById('step-delivered-dot');
            const timeDel = document.getElementById('time-delivered');
            if (status === 'Delivered') {
                if (dotDel) dotDel.className = activeDotClass;
                if (timeDel) timeDel.textContent = 'Completed';
            } else {
                if (timeDel) timeDel.textContent = 'Pending';
            }
        }

        function openReceiptModal() {
            if (!trackedOrderCache) return;
            const branch = activeStorefronts.find(s => s.name === trackedOrderCache.storefront);

            document.getElementById('receipt-order-id').textContent = trackedOrderCache.order_number;
            document.getElementById('receipt-branch-name').textContent = trackedOrderCache.storefront;
            document.getElementById('receipt-branch-address').textContent = branch ? branch.address : 'Storefront Location';
            document.getElementById('receipt-date').textContent = trackedOrderCache.created_at ? new Date(trackedOrderCache.created_at).toLocaleDateString() : 'Recent';

            const rawItemsStr = trackedOrderCache.items || '';
            let discountVal = 0;
            let couponCode = '';

            const couponMatch = rawItemsStr.match(/\[Coupon:\s*([^\]]+?)\s*\(-?\$?([\d\.]+)\)\]/i);
            if (couponMatch) {
                couponCode = couponMatch[1].trim();
                discountVal = parseFloat(couponMatch[2]) || 0;
            }

            if (trackedOrderCache.discount && parseFloat(trackedOrderCache.discount) > 0) {
                discountVal = parseFloat(trackedOrderCache.discount);
            }
            if (trackedOrderCache.coupon_code) {
                couponCode = trackedOrderCache.coupon_code;
            }

            const cleanItemsStr = rawItemsStr.replace(/\s*\[Coupon:[^\]]+\]/gi, '').trim();

            const itemsListEl = document.getElementById('receipt-items-list');
            if (itemsListEl) {
                itemsListEl.textContent = cleanItemsStr;
            }

            // Calculate Gross Subtotal
            let grossSubtotal = 0;
            if (cleanItemsStr) {
                const itemsArr = cleanItemsStr.split(/,\s*(?=\d+\s*x)/i);
                itemsArr.forEach(rawItem => {
                    const countMatch = rawItem.match(/^(\d+)\s*x\s*(.*)$/i);
                    const qty = countMatch ? parseInt(countMatch[1], 10) : 1;
                    const rawTitle = countMatch ? countMatch[2].trim() : rawItem.trim();
                    const titleStr = rawTitle.replace(/\s*\[Coupon:[^\]]+\]/gi, '').trim();
                    const matchedListing = allListings.find(l =>
                        (l.sku && titleStr.toLowerCase().includes(l.sku.toLowerCase())) ||
                        (l.title && titleStr.toLowerCase().includes(l.title.toLowerCase()))
                    );
                    const unitPrice = matchedListing ? parseFloat(matchedListing.price) : 24.99;
                    grossSubtotal += unitPrice * qty;
                });
            }

            if (grossSubtotal === 0 && trackedOrderCache.subtotal) {
                grossSubtotal = parseFloat(trackedOrderCache.subtotal) || 0;
            }

            const netSubtotal = Math.max(0, grossSubtotal - discountVal);
            const taxVal = netSubtotal * 0.0825;
            const totalVal = netSubtotal + taxVal;

            const receiptSubtotalEl = document.getElementById('receipt-subtotal');
            const receiptTaxEl = document.getElementById('receipt-tax');
            const receiptTotalEl = document.getElementById('receipt-total');
            const discountRow = document.getElementById('receipt-discount-row');
            const discountLabel = document.getElementById('receipt-discount-label');
            const discountEl = document.getElementById('receipt-discount');

            if (discountRow) {
                if (discountVal > 0) {
                    discountRow.classList.remove('hidden');
                    if (discountLabel) discountLabel.textContent = `Discount (${sanitizeHtml(couponCode)})`;
                    if (discountEl) discountEl.textContent = `-${discountVal.toFixed(2)}`;
                } else {
                    discountRow.classList.add('hidden');
                }
            }

            if (receiptSubtotalEl) receiptSubtotalEl.textContent = `${grossSubtotal.toFixed(2)}`;
            if (receiptTaxEl) receiptTaxEl.textContent = `${taxVal.toFixed(2)}`;
            if (receiptTotalEl) receiptTotalEl.textContent = `${totalVal.toFixed(2)}`;

            document.getElementById('receipt-modal').classList.remove('hidden');
        }

        function closeReceiptModal() {
            document.getElementById('receipt-modal').classList.add('hidden');
        }

        document.getElementById('catalog-storefront').addEventListener('change', renderCatalog);
        document.getElementById('catalog-search').addEventListener('input', renderCatalog);
        
        const authForm = document.getElementById('builtin-auth-form');
        if (authForm) {
            authForm.addEventListener('submit', handleBuiltInAuthSubmit);
        }

        document.getElementById('logout-btn').addEventListener('click', async () => {
            const { client } = await import('./js/supaBase.js');
            await client.auth.signOut();
            currentUser = null;
            updateNavAuthUI();
            cart = [];
            updateCartUI();
            switchTab('catalog');
        });

        checkSession();
