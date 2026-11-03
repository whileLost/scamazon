window.addEventListener('unhandledrejection', (event) => {
            console.error('Uncaught Async Error:', event.reason);
        });

        const state = {
            listings: [],
            orders: []
        };

        let onConfirmDelete = null;

        function sanitizeHtml(str) {
            if (!str && str !== 0) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function showModal(id) {
            const el = document.getElementById(id);
            if (!el) return;
            const err = el.querySelector('.bg-red-50'); 
            if (err) err.classList.add('hidden');
            el.classList.remove('hidden');
        }

        function hideModal(id) {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        }

        function askDelete(title, msg, fn) {
            document.getElementById('delete-modal-title').textContent = title;
            document.getElementById('delete-modal-message').textContent = msg;
            onConfirmDelete = fn;
            showModal('delete-modal');
        }

        document.getElementById('delete-modal-confirm-btn').addEventListener('click', async () => {
            if (!onConfirmDelete) return;
            const btn = document.getElementById('delete-modal-confirm-btn');
            btn.disabled = true;
            btn.textContent = '...';
            try {
                await onConfirmDelete();
                hideModal('delete-modal');
                onConfirmDelete = null;
            } catch (e) {
                const err = document.getElementById('delete-modal-error');
                err.textContent = e.message || 'Action failed.';
                err.classList.remove('hidden');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Delete';
            }
        });

        function switchTab(tab) {
            toggleMobileSidebar(false);
            // Stop the camera if the worker leaves the scanner tab
            if (tab !== 'scanner') {
                stopBarcodeScanner();
            }
            
            document.querySelectorAll('.tab-pane').forEach(el => {
                el.classList.add('hidden');
                el.setAttribute('hidden', '');
            });
            const targetPane = document.getElementById(`pane-${tab}`);
            if (targetPane) {
                targetPane.classList.remove('hidden');
                targetPane.removeAttribute('hidden');
            }

            document.querySelectorAll('#sidebar-nav .nav-item').forEach(btn => {
                const badge = btn.querySelector('span');
                const isSelected = btn.dataset.tab === tab;
                btn.className = `nav-item w-full text-left px-3.5 py-2.5 rounded-xl flex items-center justify-between text-sm transition-all ${
                    isSelected 
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' 
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80 font-semibold'
                }`;
                if (badge) {
                    badge.className = `text-xs px-2 py-0.5 rounded-md ${
                        isSelected 
                            ? 'bg-slate-950/20 text-slate-950 font-bold' 
                            : 'bg-slate-800 text-slate-400'
                    }`;
                }
            });

            const titles = {
                listings: 'Manage Listings',
                scanner: 'Barcode Scanner',
                orders: 'Orders & Fulfillment',
                sales: 'Sales & Analytics'
            };
            document.getElementById('page-heading').textContent = titles[tab] || 'Worker Panel';
        }

        async function init() {
            const { client } = await import('./supaBase.js');

            try {
                const { data: { session }, error: sessionErr } = await client.auth.getSession();
                if (sessionErr || !session) {
                    window.location.replace('./');
                    return;
                }

                const { data: user, error: userErr } = await client
                    .from('users')
                    .select('*')
                    .eq('email', session.user.email)
                    .maybeSingle();

                if (userErr || !user || user.role !== 'worker') {
                    await client.auth.signOut();
                    window.location.replace('./');
                    return;
                }

                currentWorker = user;
                document.getElementById('user-display').textContent = session.user.email;
                document.getElementById('worker-pill').innerHTML = `
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> 
                    ${currentWorker.name || currentWorker.email} &bull; ${currentWorker.storefront || 'Unassigned Branch'}
                `;
                document.getElementById('modal-storefront-display').value = currentWorker.storefront || '';

                await loadAll();
            } catch (err) {
                window.location.replace('./');
            }
        }

        async function loadAll() {
            const { client } = await import('./supaBase.js');
            if (!currentWorker.storefront) return;

            const [listRes, ordRes] = await Promise.all([
                client.from('listings').select('*').eq('storefront', currentWorker.storefront).order('created_at', { ascending: false }),
                client.from('orders').select('*').eq('storefront', currentWorker.storefront).order('created_at', { ascending: false })
            ]);

            state.listings = listRes.data || [];
            state.orders = ordRes.data || [];

            renderListings();
            renderOrders();
            renderSales();
        }

        // ==========================================
        // SALES & ANALYTICS
        // ==========================================

        function renderSales() {
            const tbody = document.getElementById('sales-storefronts-tbody');
            let branchRev = 0;
            let branchUnits = 0;

            state.orders.forEach(o => {
                if (typeof o.items === 'string') {
                    const countMatch = o.items.match(/(\d+)\s*x/i);
                    const count = countMatch ? parseInt(countMatch[1], 10) : 1;
                    branchUnits += count;

                    const matchedItem = state.listings.find(l => 
                        (l.sku && o.items.includes(l.sku)) || 
                        (l.title && o.items.toLowerCase().includes(l.title.toLowerCase()))
                    );
                    
                    if (matchedItem) {
                        branchRev += (parseFloat(matchedItem.price) || 0) * count;
                    }
                    const cMatch = o.items.match(/\[Coupon:\s*([^\]]+?)\s*\(-?\$?([\d\.]+)\)\]/i);
                    if (cMatch) {
                        branchRev = Math.max(0, branchRev - (parseFloat(cMatch[2]) || 0));
                    }
                }
            });

            document.getElementById('stat-sales-rev').textContent = `$${branchRev.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            document.getElementById('stat-sales-orders').textContent = state.orders.length;
            const statUnits = document.getElementById('stat-sales-units');
            if (statUnits) statUnits.textContent = branchUnits;

            if (!state.orders.length) {
                tbody.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-slate-500 dark:text-slate-400">No sales records available for this storefront.</td></tr>';
                return;
            }

            tbody.innerHTML = `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td class="py-3 px-4 font-medium text-slate-900 dark:text-white">${sanitizeHtml(currentWorker.storefront)}</td>
                    <td class="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">${state.orders.length}</td>
                    <td class="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">${branchUnits}</td>
                    <td class="py-3 px-4 text-right font-semibold text-slate-900 dark:text-white">$${branchRev.toFixed(2)}</td>
                </tr>
            `;
        }

        /* --- LISTINGS --- */

        function renderListings() {
            const search = document.getElementById('search-input').value.toLowerCase().trim();
            const tbody = document.getElementById('listings-tbody');

            const itemsList = state.listings.filter(i => {
                const title = (i.title || '').toLowerCase();
                const sku = (i.sku || '').toLowerCase();
                return title.includes(search) || sku.includes(search);
            });

            document.getElementById('stat-total').textContent = state.listings.length;
            document.getElementById('stat-low').textContent = state.listings.filter(i => i.stock > 0 && i.stock < 10).length;
            document.getElementById('stat-units').textContent = state.listings.reduce((acc, curr) => acc + (parseInt(curr.stock, 10) || 0), 0);
            document.getElementById('badge-listings').textContent = state.listings.length;

            if (!itemsList.length) {
                tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-500 dark:text-slate-400">No listings found for this storefront.</td></tr>';
                return;
            }

            tbody.innerHTML = itemsList.map(item => {
                let badge = `<span class="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-xs font-medium rounded-md">${item.stock}</span>`;
                if (item.stock === 0) badge = '<span class="px-2 py-0.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-xs font-medium rounded-md">Out of Stock</span>';
                else if (item.stock < 10) badge = `<span class="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-xs font-medium rounded-md">Low (${item.stock})</span>`;

                const img = item.image_url 
                    ? `<img src="${sanitizeHtml(item.image_url)}" alt="${sanitizeHtml(item.title)}" loading="lazy" referrerpolicy="no-referrer" class="w-8 h-8 object-cover rounded-md border border-slate-200 dark:border-slate-700">`
                    : '<div class="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500 text-xs font-mono">-</div>';

                return `
                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td class="py-3 px-4 flex items-center gap-3">
                            ${img}
                            <div>
                                <div class="font-medium text-slate-900 dark:text-white">${sanitizeHtml(item.title)}</div>
                                <div class="text-xs text-slate-500 dark:text-slate-400">${sanitizeHtml(item.storefront)}</div>
                            </div>
                        </td>
                        <td class="py-3 px-4 text-xs font-mono text-slate-600 dark:text-slate-400">${sanitizeHtml(item.sku)}</td>
                        <td class="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">${sanitizeHtml(item.storefront)}</td>
                        <td class="py-3 px-4 text-sm font-semibold text-slate-900 dark:text-white">$${(parseFloat(item.price) || 0).toFixed(2)}</td>
                        <td class="py-3 px-4">${badge}</td>
                        <td class="py-3 px-4 text-right space-x-2">
                            <button onclick="editListing('${sanitizeHtml(item.id)}')" class="text-xs font-semibold text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 transition">Edit</button>
                            <button onclick="removeListing('${sanitizeHtml(item.id)}')" class="text-xs font-medium text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300 transition">Delete</button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        function editListing(id) {
            const item = state.listings.find(x => x.id === id);
            if (!item) return;
            document.getElementById('modal-title').textContent = 'Edit Listing';
            document.getElementById('modal-item-id').value = item.id;
            document.getElementById('modal-title-input').value = item.title || '';
            document.getElementById('modal-sku').value = item.sku || '';
            document.getElementById('modal-price').value = item.price || '';
            document.getElementById('modal-stock').value = item.stock || 0;
            document.getElementById('modal-image').value = item.image_url || '';
            showModal('listing-modal');
        }

        function removeListing(id) {
            askDelete('Delete Listing', `Delete this listing? It won't come back.`, async () => {
                const { client } = await import('./supaBase.js');
                const { error } = await client.from('listings').delete().eq('id', id).eq('storefront', currentWorker.storefront);
                if (error) throw error;
                state.listings = state.listings.filter(x => x.id !== id);
                renderListings();
            });
        }

        document.getElementById('listing-form').addEventListener('submit', async (e) => {
            const { client } = await import('./supaBase.js');
            e.preventDefault();
            const btn = document.getElementById('modal-submit-btn');
            const err = document.getElementById('listingError');
            btn.disabled = true;

            const id = document.getElementById('modal-item-id').value;
            const payload = {
                title: document.getElementById('modal-title-input').value.trim(),
                sku: document.getElementById('modal-sku').value.trim(),
                price: parseFloat(document.getElementById('modal-price').value),
                stock: parseInt(document.getElementById('modal-stock').value, 10),
                storefront: currentWorker.storefront,
                image_url: document.getElementById('modal-image').value.trim() || null
            };

            try {
                const query = id 
                    ? client.from('listings').update(payload).eq('id', id).eq('storefront', currentWorker.storefront) 
                    : client.from('listings').insert([payload]);
                const { error } = await query;
                if (error) throw error;

                hideModal('listing-modal');
                document.getElementById('listing-form').reset();
                document.getElementById('modal-item-id').value = '';
                
                const { data: refreshed } = await client.from('listings').select('*').eq('storefront', currentWorker.storefront).order('created_at', { ascending: false });
                state.listings = refreshed || [];
                renderListings();
            } catch (e) {
                err.textContent = e.code === '23505' ? 'That SKU already exists in the system.' : e.message;
                err.classList.remove('hidden');
            } finally {
                btn.disabled = false;
            }
        });

        /* --- BARCODE SCANNER --- */

        let scannerActiveInstance = null;
        let scannerRunning = false;
        let barcodeHandlingScan = false;
        let scannerSessionId = 0;
        let scannerTransitionPromise = null;

        function resetScannerUI() {
            const reader = document.getElementById('scanner-reader');
            const startButton = document.getElementById('scanner-start-btn');
            const stopButton = document.getElementById('scanner-stop-btn');

            if (reader) reader.classList.add('hidden');
            if (stopButton) {
                stopButton.classList.add('hidden');
                stopButton.disabled = false;
                stopButton.classList.remove('opacity-50', 'cursor-not-allowed');
            }
            if (startButton) {
                startButton.classList.remove('hidden');
                startButton.disabled = false;
                startButton.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        }

        async function cleanupScannerHardware() {
            if (scannerActiveInstance) {
                const inst = scannerActiveInstance;
                scannerActiveInstance = null;
                try {
                    const state = typeof inst.getState === 'function' ? inst.getState() : null;
                    if (state === 2 || state === 3 || inst.isScanning) {
                        await inst.stop();
                    }
                } catch (err) {
                    console.warn('Gracefully handled scanner stop error:', err);
                }
                try {
                    await inst.clear();
                } catch (_) {}
            }

            // Stop all hardware media stream tracks explicitly on all video elements inside #scanner-reader
            const reader = document.getElementById('scanner-reader');
            if (reader) {
                const videos = reader.querySelectorAll('video');
                videos.forEach(video => {
                    if (video.srcObject && typeof video.srcObject.getTracks === 'function') {
                        video.srcObject.getTracks().forEach(track => {
                            try {
                                track.stop();
                            } catch (_) {}
                        });
                    }
                    video.srcObject = null;
                });
                reader.innerHTML = '';
            }
        }

        // Looks for the scanned SKU inside the listings
        // already loaded for the logged-in worker's storefront.
        function findScannedProduct() {
            const barcode = document
                .getElementById('scanner-barcode-input')
                .value
                .trim();

            const message = document.getElementById('scanner-message');
            const result = document.getElementById('scanner-result');

            result.classList.add('hidden');
            message.textContent = '';

            if (!barcode) {
                message.textContent = 'Enter or scan a barcode first.';
                message.className = 'text-sm mt-4 text-amber-600';
                return;
            }

            const item = state.listings.find(listing =>
                String(listing.sku || '').trim() === barcode
            );

            if (!item) {
                message.textContent = `No product with barcode ${barcode} was found in ${currentWorker.storefront}.`;
                message.className = 'text-sm mt-4 text-rose-600';
                return;
            }

            // Populate Product Image
            const imgEl = document.getElementById('scanner-product-img');
            const fallbackEl = document.getElementById('scanner-product-img-fallback');

            if (item.image_url) {
                imgEl.src = item.image_url;
                imgEl.alt = item.title || 'Product Image';
                imgEl.classList.remove('hidden');
                if (fallbackEl) fallbackEl.classList.add('hidden');
            } else {
                imgEl.src = '';
                imgEl.classList.add('hidden');
                if (fallbackEl) fallbackEl.classList.remove('hidden');
            }

            document.getElementById('scanner-product-title').textContent = item.title || 'Unnamed Product';
            document.getElementById('scanner-product-sku').textContent = item.sku || '-';
            document.getElementById('scanner-product-price').textContent = (parseFloat(item.price) || 0).toFixed(2);
            document.getElementById('scanner-product-stock').textContent = item.stock ?? 0;
            document.getElementById('scanner-product-storefront').textContent = item.storefront || '-';

            result.classList.remove('hidden');
            message.textContent = 'Product found.';
            message.className = 'text-sm mt-4 text-emerald-600';
        }

        async function startBarcodeScanner() {
            if (scannerRunning) return;

            const startBtn = document.getElementById('scanner-start-btn');
            const stopBtn = document.getElementById('scanner-stop-btn');
            const reader = document.getElementById('scanner-reader');
            const message = document.getElementById('scanner-message');

            // Disable start button immediately and switch button visibility
            startBtn.disabled = true;
            startBtn.classList.add('hidden');
            stopBtn.classList.remove('hidden');
            stopBtn.disabled = false;
            reader.classList.remove('hidden');

            message.textContent = 'Starting camera...';
            message.className = 'text-sm mt-4 text-slate-500';

            const currentSession = ++scannerSessionId;

            // Wait if a previous transition (e.g. stop) is still completing
            if (scannerTransitionPromise) {
                try {
                    await scannerTransitionPromise;
                } catch (_) {}
            }

            // If the user cancelled or switched tabs while waiting, abort
            if (currentSession !== scannerSessionId) {
                return;
            }

            let startPromiseResolve;
            scannerTransitionPromise = new Promise(resolve => { startPromiseResolve = resolve; });

            try {
                await cleanupScannerHardware();

                if (currentSession !== scannerSessionId) {
                    return;
                }

                const scanner = new Html5Qrcode('scanner-reader');
                scannerActiveInstance = scanner;

                await scanner.start(
                    { facingMode: 'environment' },
                    {
                        fps: 10,
                        qrbox: { width: 300, height: 150 }
                    },
                    async (decodedText) => {
                        if (barcodeHandlingScan) return;
                        barcodeHandlingScan = true;
                        try {
                            document.getElementById('scanner-barcode-input').value = decodedText;
                            await stopBarcodeScanner();
                            findScannedProduct();
                        } finally {
                            barcodeHandlingScan = false;
                        }
                    },
                    () => {}
                );

                // Check if user clicked stop or switched tabs while start() was running
                if (currentSession !== scannerSessionId) {
                    await cleanupScannerHardware();
                    return;
                }

                scannerRunning = true;
                message.textContent = 'Camera active — hold a barcode in front of the camera.';
                message.className = 'text-sm mt-4 text-amber-600 dark:text-amber-400 font-medium';

            } catch (error) {
                if (currentSession === scannerSessionId) {
                    console.error('Scanner error:', error);
                    await cleanupScannerHardware();
                    scannerRunning = false;
                    resetScannerUI();

                    message.textContent = 'Could not start camera: ' + (error.message || error);
                    message.className = 'text-sm mt-4 text-rose-600';
                }
            } finally {
                startPromiseResolve();
                scannerTransitionPromise = null;
                if (currentSession !== scannerSessionId) {
                    resetScannerUI();
                }
            }
        }

        async function stopBarcodeScanner() {
            const currentSession = ++scannerSessionId;

            const startBtn = document.getElementById('scanner-start-btn');
            const stopBtn = document.getElementById('scanner-stop-btn');
            const message = document.getElementById('scanner-message');

            resetScannerUI();

            // Disable buttons during hardware teardown to prevent spam clicks
            if (startBtn) {
                startBtn.disabled = true;
                startBtn.classList.add('opacity-50', 'cursor-not-allowed');
            }
            if (stopBtn) {
                stopBtn.disabled = true;
                stopBtn.classList.add('opacity-50', 'cursor-not-allowed');
            }

            if (message && (
                message.textContent.includes('Camera active') ||
                message.textContent.includes('Starting camera')
            )) {
                message.textContent = '';
                message.className = 'text-sm mt-4';
            }

            let stopPromiseResolve;
            const prevTransition = scannerTransitionPromise;
            scannerTransitionPromise = new Promise(resolve => { stopPromiseResolve = resolve; });

            try {
                if (prevTransition) {
                    try {
                        await prevTransition;
                    } catch (_) {}
                }

                await cleanupScannerHardware();
            } finally {
                scannerRunning = false;
                stopPromiseResolve();
                scannerTransitionPromise = null;

                if (startBtn) {
                    startBtn.disabled = false;
                    startBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                }
                if (stopBtn) {
                    stopBtn.disabled = false;
                    stopBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                }

                if (message && (
                    message.textContent.includes('Camera active') ||
                    message.textContent.includes('Starting camera')
                )) {
                    message.textContent = '';
                    message.className = 'text-sm mt-4';
                }
            }
        }

        // Manual barcode lookup button.
        document
            .getElementById('scanner-lookup-btn')
            .addEventListener(
                'click',
                findScannedProduct
            );

        // Enter key also performs lookup.
        document
            .getElementById('scanner-barcode-input')
            .addEventListener(
                'keydown',
                (event) => {

                    if (event.key === 'Enter') {
                        findScannedProduct();
                    }

                }
            );

        // Camera controls.
        document
            .getElementById('scanner-start-btn')
            .addEventListener(
                'click',
                startBarcodeScanner
            );

        document
            .getElementById('scanner-stop-btn')
            .addEventListener(
                'click',
                stopBarcodeScanner
            );

        /* --- ORDERS --- */

        function renderOrders() {
            const search = document.getElementById('orders-search-input').value.toLowerCase().trim();
            const status = document.getElementById('orders-filter-status').value;
            const tbody = document.getElementById('global-orders-tbody');

            const rows = state.orders.filter(o => {
                const orderNum = (o.order_number || '').toLowerCase();
                const itemsStr = (o.items || '').toLowerCase();
                const matchSearch = orderNum.includes(search) || itemsStr.includes(search);
                const matchStatus = !status || o.status === status;
                return matchSearch && matchStatus;
            });

            document.getElementById('stat-ord-total').textContent = state.orders.length;
            document.getElementById('stat-ord-processing').textContent = state.orders.filter(o => o.status === 'Processing').length;
            document.getElementById('stat-ord-ready').textContent = state.orders.filter(o => ['Ready for Driver', 'Out for Delivery'].includes(o.status)).length;
            document.getElementById('badge-orders').textContent = state.orders.length;
            
            tbody.innerHTML = '';

            if (!rows.length) {
                tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-slate-500 dark:text-slate-400">No orders found for this storefront.</td></tr>';
                return;
            }

            rows.forEach(o => {
                const tr = document.createElement('tr');
                tr.className = 'border-b border-slate-100 dark:border-slate-800/80 last:border-0 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors';
                
                const formattedDate = o.created_at ? new Date(o.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '-';
                
                const currentStatus = o.status === 'Ready for Driver' ? 'Shipped' : (o.status || 'Processing');

                tr.innerHTML = `
                    <td class="py-3 px-4">
                        <button onclick="viewOrderReceipt('${sanitizeHtml(o.id)}')" class="font-mono font-semibold text-sm text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:underline transition-colors focus:outline-none">
                            ${sanitizeHtml(o.order_number)}
                        </button>
                    </td>
                    <td class="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">${sanitizeHtml(o.storefront)}</td>
                    <td class="py-3 px-4 text-sm text-slate-700 dark:text-slate-300">${sanitizeHtml((o.items || '').replace(/\s*\[Coupon:[^\]]+\]/gi, '').trim())}</td>
                    <td class="py-3 px-4">
                        <select onchange="updateOrderStatus('${sanitizeHtml(o.id)}', this.value)" class="text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all cursor-pointer">
                            <option value="Processing" ${currentStatus === 'Processing' ? 'selected' : ''}>Processing</option>
                            <option value="Shipped" ${currentStatus === 'Shipped' ? 'selected' : ''}>Shipped</option>
                            <option value="Out for Delivery" ${currentStatus === 'Out for Delivery' ? 'selected' : ''}>Out for Delivery</option>
                            <option value="Delivered" ${currentStatus === 'Delivered' ? 'selected' : ''}>Delivered</option>
                        </select>
                    </td>
                    <td class="py-3 px-4 text-right text-sm text-slate-400 dark:text-slate-500">${formattedDate}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        async function updateOrderStatus(orderId, newStatus) {
            const { client } = await import('./supaBase.js');
            const order = state.orders.find(o => o.id === orderId);
            if (!order) return;

            // Map UI status to database schema value if needed
            const dbStatus = newStatus === 'Shipped' ? 'Ready for Driver' : newStatus;

            try {
                const { error } = await client
                    .from('orders')
                    .update({ status: dbStatus })
                    .eq('id', orderId);

                if (error) {
                    // If check constraint rejects a status like 'Delivered', fallback to 'Out for Delivery' or inform user
                    if (error.code === '23514' && newStatus === 'Delivered') {
                        const { error: fallbackErr } = await client
                            .from('orders')
                            .update({ status: 'Out for Delivery' })
                            .eq('id', orderId);
                        if (fallbackErr) throw fallbackErr;
                    } else {
                        throw error;
                    }
                }

                order.status = (newStatus === 'Shipped') ? 'Ready for Driver' : newStatus;
                renderOrders();
                renderSales();
            } catch (err) {
                console.error('Failed to update order status:', err);
                showToast('Could not update order status: ' + (err.message || 'Unknown error'), 'error');
                renderOrders();
            }
        }
        window.updateOrderStatus = updateOrderStatus;

        function viewOrderReceipt(orderId) {
            const order = state.orders.find(o => o.id === orderId);
            if (!order) return;

            document.getElementById('receipt-order-id').textContent = order.order_number || ('Order #' + order.id.slice(0, 6));
            document.getElementById('receipt-branch-name').textContent = order.storefront || currentWorker.storefront;

            const d = order.created_at ? new Date(order.created_at) : new Date();
            const formattedDate = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
            const formattedTime = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
            document.getElementById('receipt-date-time').textContent = `${formattedDate} at ${formattedTime}`;

            const badge = document.getElementById('receipt-status-badge');
            if (badge) {
                const displayStatus = order.status === 'Ready for Driver' ? 'Shipped' : (order.status || 'Processing');
                badge.textContent = displayStatus;
                badge.className = 'inline-block mt-0.5 px-2.5 py-0.5 text-xs font-semibold rounded-md border ' + 
                    (order.status === 'Shipped' || order.status === 'Ready for Driver' ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' :
                     order.status === 'Out for Delivery' ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800' :
                     order.status === 'Delivered' ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800' :
                     'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800');
            }

            const tbody = document.getElementById('receipt-items-tbody');
            let subtotal = 0;
            let itemRows = '';
            let discount = 0;
            let couponCode = '';

            const rawItemsStr = (order.items && typeof order.items === 'string') ? order.items : '';
            const couponMatch = rawItemsStr.match(/\[Coupon:\s*([^\]]+?)\s*\(-?\$?([\d\.]+)\)\]/i);
            if (couponMatch) {
                couponCode = couponMatch[1].trim();
                discount = parseFloat(couponMatch[2]) || 0;
            }

            const cleanItemsStr = rawItemsStr.replace(/\s*\[Coupon:[^\]]+\]/gi, '').trim();

            if (cleanItemsStr) {
                const itemsArr = cleanItemsStr.split(/,\s*(?=\d+\s*x)/i);
                
                itemsArr.forEach(rawItem => {
                    const countMatch = rawItem.match(/^(\d+)\s*x\s*(.*)$/i);
                    const qty = countMatch ? parseInt(countMatch[1], 10) : 1;
                    const rawTitle = countMatch ? countMatch[2].trim() : rawItem.trim();
                    const titleStr = rawTitle.replace(/\s*\[Coupon:[^\]]+\]/gi, '').trim();

                    const matchedListing = state.listings.find(l => 
                        (l.sku && titleStr.toLowerCase().includes(l.sku.toLowerCase())) || 
                        (l.title && titleStr.toLowerCase().includes(l.title.toLowerCase()))
                    );

                    const unitPrice = matchedListing ? parseFloat(matchedListing.price) : 24.99;
                    const lineTotal = unitPrice * qty;
                    subtotal += lineTotal;

                    itemRows += `
                        <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                            <td class="py-2.5 px-3 text-slate-800 dark:text-slate-200 font-sans font-medium">${sanitizeHtml(titleStr)}</td>
                            <td class="py-2.5 px-3 text-center text-slate-600 dark:text-slate-400">${qty}</td>
                            <td class="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">${unitPrice.toFixed(2)}</td>
                            <td class="py-2.5 px-3 text-right font-semibold text-slate-900 dark:text-white">${lineTotal.toFixed(2)}</td>
                        </tr>
                    `;
                });
            }

            if (!itemRows) {
                itemRows = `<tr><td colspan="4" class="p-3 text-center text-slate-400 dark:text-slate-500">No item details recorded.</td></tr>`;
            }
            tbody.innerHTML = itemRows;

            const netSubtotal = Math.max(0, subtotal - discount);
            const tax = netSubtotal * 0.0825;
            const total = netSubtotal + tax;

            const discountRow = document.getElementById('receipt-discount-row');
            const discountLabel = document.getElementById('receipt-discount-label');
            const discountEl = document.getElementById('receipt-discount');

            if (discountRow) {
                if (discount > 0) {
                    discountRow.classList.remove('hidden');
                    if (discountLabel) discountLabel.textContent = `Discount (${sanitizeHtml(couponCode)})`;
                    if (discountEl) discountEl.textContent = `-${discount.toFixed(2)}`;
                } else {
                    discountRow.classList.add('hidden');
                }
            }

            document.getElementById('receipt-subtotal').textContent = `${subtotal.toFixed(2)}`;
            document.getElementById('receipt-tax').textContent = `${tax.toFixed(2)}`;
            document.getElementById('receipt-total').textContent = `${total.toFixed(2)}`;

            showModal('receipt-modal');
        }

        const filterBindings = [
            ['search-input', 'input', renderListings],
            ['orders-search-input', 'input', renderOrders],
            ['orders-filter-status', 'change', renderOrders]
        ];

        filterBindings.forEach(([id, event, handler]) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener(event, handler);
        });

        document.getElementById('logout-btn').addEventListener('click', async () => {
            const { client } = await import('./supaBase.js');
            await client.auth.signOut();
            window.location.replace('./');
        });

        init();
