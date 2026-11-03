import { setupNav } from './shared-nav.js';
        setupNav('aboutus.html');

        const CONTRIBUTORS_ENDPOINT = './assets/data/contributors.json';
        const FETCH_TIMEOUT_MS = 8000;
        const SKELETON_COUNT = 6;
        const EMPTY_STAT = '\u2014';
        const AVATAR_HOST_PREFIX = 'https://avatars.githubusercontent.com/';
        const PROFILE_URL_PATTERN = /^https:\/\/github\.com\/[A-Za-z0-9._-]+$/;
        const REPO_URL_FALLBACK = 'https://github.com/Laura-pez/team-project';

        function makeElement(tagName, className, text)
        {
            const element = document.createElement(tagName);
            if (className) element.className = className;
            if (typeof text === 'string') element.textContent = text;
            return element;
        }

        // only load avatars from GitHub's own avatar host
        function isAllowedAvatarUrl(url)
        {
            return typeof url === 'string' && url.startsWith(AVATAR_HOST_PREFIX);
        }

        // only link out to GitHub profile URLs over HTTPS
        function isAllowedProfileUrl(url)
        {
            return typeof url === 'string' && PROFILE_URL_PATTERN.test(url);
        }

        function initialsFor(name)
        {
            const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
            if (parts.length === 0) return '?';
            if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }

        function isRenderableContributor(entry)
        {
            if (!entry || typeof entry !== 'object') return false;
            const hasLogin = typeof entry.login === 'string' && entry.login.trim().length > 0;
            const hasDisplayName = typeof entry.displayName === 'string' && entry.displayName.trim().length > 0;
            return hasLogin || hasDisplayName;
        }

        function normalizeSnapshot(payload)
        {
            if (!payload || typeof payload !== 'object' || !Array.isArray(payload.contributors))
            {
                throw new Error('The snapshot does not match the expected format.');
            }

            const list = payload.contributors
                .filter(isRenderableContributor)
                .map((entry) =>
                {
                    const login = typeof entry.login === 'string' && entry.login.trim() ? entry.login.trim() : null;
                    const displayName = typeof entry.displayName === 'string' && entry.displayName.trim()
                        ? entry.displayName.trim()
                        : (login || 'Team member');
                    const role = typeof entry.role === 'string' && entry.role.trim() ? entry.role.trim() : null;

                    return {
                        login,
                        displayName,
                        avatarUrl: isAllowedAvatarUrl(entry.avatar_url) ? entry.avatar_url : null,
                        profileUrl: isAllowedProfileUrl(entry.html_url) ? entry.html_url : null,
                        role,
                        key: login || displayName,
                    };
                });

            return {
                list,
                profiles: (payload.profiles && typeof payload.profiles === 'object') ? payload.profiles : {},
                generatedAt: typeof payload.generatedAt === 'string' ? payload.generatedAt : null,
                commitsThisMonth: (payload.commitsThisMonth === null || payload.commitsThisMonth === undefined)
                    ? null
                    : (Number.isFinite(Number(payload.commitsThisMonth)) ? Math.max(0, Math.round(Number(payload.commitsThisMonth))) : null),
                repoUrl: isAllowedProfileUrl(payload.repoUrl) ? payload.repoUrl : REPO_URL_FALLBACK,
            };
        }

        function buildCard(entry, profiles)
        {
            const override = (entry.key && profiles[entry.key] && typeof profiles[entry.key] === 'object')
                ? profiles[entry.key]
                : null;

            const displayName = (override && typeof override.displayName === 'string' && override.displayName.trim())
                ? override.displayName.trim()
                : entry.displayName;

            const loginText = entry.login ? '@' + entry.login : '';

            const roleText = (override && typeof override.role === 'string' && override.role.trim())
                ? override.role.trim()
                : (entry.role || '');

            const card = makeElement('article', 'p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-xl hover:border-slate-300 dark:hover:border-slate-700 flex flex-col items-center text-center');

            const avatarWrapper = makeElement('div', 'relative w-20 h-20');
            avatarWrapper.appendChild(makeElement('div', 'absolute inset-0 rounded-full flex items-center justify-center text-xl font-bold bg-slate-100 dark:bg-slate-800 text-amber-600 dark:text-amber-400 ring-4 ring-amber-50 dark:ring-amber-950/40', initialsFor(displayName)));

            if (entry.avatarUrl)
            {
                const avatar = makeElement('img', 'absolute inset-0 w-20 h-20 rounded-full object-cover ring-4 ring-slate-200 dark:ring-slate-700');
                avatar.src = entry.avatarUrl;
                avatar.alt = displayName ? displayName + ' avatar' : 'Contributor avatar';
                avatar.loading = 'lazy';
                avatar.decoding = 'async';
                avatar.addEventListener('error', () => avatar.classList.add('hidden'));
                avatarWrapper.appendChild(avatar);
            }

            card.appendChild(avatarWrapper);
            card.appendChild(makeElement('h3', 'mt-5 type-title font-bold text-slate-900 dark:text-white', displayName));

            if (loginText)
            {
                card.appendChild(makeElement('p', 'mt-1 text-xs font-medium text-slate-500 dark:text-slate-400', loginText));
            }

            if (roleText)
            {
                card.appendChild(makeElement('p', 'mt-1 text-xs text-slate-500 dark:text-slate-400', roleText));
            }

            if (entry.profileUrl)
            {
                const profileLink = makeElement('a', 'mt-auto pt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:opacity-80 transition-opacity rounded-sm', 'View profile');
                profileLink.href = entry.profileUrl;
                profileLink.target = '_blank';
                profileLink.rel = 'noopener noreferrer';
                card.appendChild(profileLink);
            }
            else
            {
                card.appendChild(makeElement('span', 'mt-auto pt-6 text-xs font-medium text-slate-500 dark:text-slate-400', 'Private repo member'));
            }

            return card;
        }

        function renderCards(grid, list, profiles)
        {
            const fragment = document.createDocumentFragment();
            list.forEach((entry) => fragment.appendChild(buildCard(entry, profiles)));
            grid.replaceChildren(fragment);
        }

        function renderSkeletons(grid)
        {
            const skeletonCard = `
                <div class="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col items-center animate-pulse" aria-hidden="true">
                    <div class="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-800"></div>
                    <div class="mt-5 h-4 w-32 rounded-full bg-slate-200 dark:bg-slate-800"></div>
                    <div class="mt-2.5 h-3 w-20 rounded-full bg-slate-100 dark:bg-slate-800/70"></div>
                </div>
            `;
            grid.innerHTML = skeletonCard.repeat(SKELETON_COUNT);
        }

        function renderEmptyState(grid)
        {
            const panel = makeElement('div', 'sm:col-span-2 lg:col-span-3 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 p-10 text-center');
            panel.appendChild(makeElement('p', 'text-sm font-semibold text-slate-700 dark:text-slate-200', 'No contributors recorded yet'));
            panel.appendChild(makeElement('p', 'mt-1 text-xs text-slate-500 dark:text-slate-400', 'Add entries to contributors.json, then reload this page.'));
            grid.replaceChildren(panel);
        }

        function setStats(contributorCount, commitsThisMonth)
        {
            const contributorsEl = document.getElementById('stat-contributors');
            const monthEl = document.getElementById('stat-month-commits');

            if (contributorsEl) contributorsEl.textContent = Number.isFinite(contributorCount) ? contributorCount.toLocaleString() : EMPTY_STAT;
            if (monthEl) monthEl.textContent = Number.isFinite(commitsThisMonth) ? commitsThisMonth.toLocaleString() : EMPTY_STAT;
        }

        function hideStatus()
        {
            const banner = document.getElementById('status-banner');
            if (!banner) return;
            banner.classList.add('hidden');
            banner.replaceChildren();
        }

        function showStatus(kind, message)
        {
            const banner = document.getElementById('status-banner');
            if (!banner) return;

            const isError = kind === 'error';
            const containerTone = isError
                ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200'
                : 'border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200';
            const badgeTone = isError ? 'bg-rose-600 text-white' : 'bg-amber-500 text-slate-950 font-bold';
            const buttonTone = isError
                ? 'border-rose-300 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/40'
                : 'border-amber-300 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-950 dark:text-amber-200';

            banner.className = 'mb-10 rounded-2xl border p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between ' + containerTone;

            const messageRow = makeElement('div', 'flex items-start gap-3');
            messageRow.appendChild(makeElement('span', 'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ' + badgeTone, '!'));
            messageRow.appendChild(makeElement('p', 'text-sm leading-relaxed', message));

            const actionRow = makeElement('div', 'flex items-center gap-3 shrink-0');
            const retryButton = makeElement('button', 'px-4 py-2 text-sm font-semibold rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 ' + buttonTone, 'Try again');
            retryButton.id = 'retry-btn';
            retryButton.type = 'button';

            const repoLink = makeElement('a', 'text-sm font-semibold underline underline-offset-4 hover:opacity-80 transition-opacity', 'View on GitHub');
            repoLink.href = REPO_URL_FALLBACK;
            repoLink.target = '_blank';
            repoLink.rel = 'noopener noreferrer';

            actionRow.append(retryButton, repoLink);
            banner.replaceChildren(messageRow, actionRow);
        }

        async function loadContributors(options)
        {
            const force = Boolean(options && options.force);
            const grid = document.getElementById('contributors-grid');
            if (!grid) return;

            hideStatus();
            grid.setAttribute('aria-busy', 'true');
            renderSkeletons(grid);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

            try
            {
                const response = await fetch(CONTRIBUTORS_ENDPOINT, {
                    cache: force ? 'reload' : 'no-cache',
                    headers: { Accept: 'application/json' },
                    signal: controller.signal,
                });

                if (!response.ok)
                {
                    throw new Error('The browser received HTTP ' + response.status + ' for the snapshot file.');
                }

                let payload;
                try
                {
                    payload = await response.json();
                }
                catch (parseError)
                {
                    throw new Error('The snapshot file could not be parsed as JSON.');
                }

                const snapshot = normalizeSnapshot(payload);
                setStats(snapshot.list.length, snapshot.commitsThisMonth);

                if (snapshot.list.length === 0)
                {
                    renderEmptyState(grid);
                    showStatus('info', 'The snapshot loaded successfully, but it does not list any contributors yet.');
                    return;
                }

                renderCards(grid, snapshot.list, snapshot.profiles);
                console.info('Rendered ' + snapshot.list.length + ' contributor(s) from the snapshot dated ' + (snapshot.generatedAt || 'unknown') + '.');
            }
            catch (error)
            {
                const timedOut = error && error.name === 'AbortError';
                console.error('Contributor snapshot failed:', error);

                grid.replaceChildren();
                setStats(null, null);

                if (timedOut)
                {
                    showStatus('error', 'Loading the contributor snapshot took too long to respond.');
                }
                else
                {
                    showStatus('error', 'Could not load the contributor snapshot. ' + (error && error.message ? error.message : ''));
                }
            }
            finally
            {
                clearTimeout(timeoutId);
                grid.setAttribute('aria-busy', 'false');
            }
        }

        document.addEventListener('click', async (event) =>
        {
            const retryButton = event.target.closest('#retry-btn');
            if (retryButton)
            {
                retryButton.disabled = true;
                await loadContributors({ force: true });
                return;
            }

            const logout = event.target.closest('[data-logout]');
            if (!logout)
            {
                return;
            }

            try
            {
                logout.disabled = true;
                const { client } = await import('./js/supaBase.js');
                localStorage.removeItem('scamazon_user_role');
                await client.auth.signOut();
                window.location.reload();
            }
            catch (err)
            {
                console.error('Logout failed:', err);
                logout.disabled = false;
            }
        });

        (function boot()
        {
            const grid = document.getElementById('contributors-grid');

            if (window.location.protocol === 'file:')
            {
                if (grid)
                {
                    grid.replaceChildren();
                    grid.setAttribute('aria-busy', 'false');
                }
                setStats(null, null);
                console.warn('aboutus.html was opened over file://, so the contributor snapshot cannot be fetched.');
            }
            else
            {
                loadContributors();
            }

            
        })();
