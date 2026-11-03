window.addEventListener('unhandledrejection', (event) => {
            console.error('Uncaught Async Error:', event.reason);
        });

        const state = {
            listings: [],
            workers: [],
            orders: []
        };

        let onConfirmDelete = null;
        let pendingWorker = null;

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
                coupons: 'Coupons & Discounts',
                workers: 'Manage Workers',
                orders: 'Orders & Fulfillment',
                sales: 'Sales & Analytics'
            };
            document.getElementById('page-heading').textContent = titles[tab] || 'Storefront Panel';

            if (tab === 'coupons') {
                loadCoupons();
            }
        }

        async function init() {
            const { client } = await import('./js/supaBase.js');

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

                if (userErr || !user || user.role !== 'storefront_owner') {
                    await client.auth.signOut();
                    window.location.replace('./');
                    return;
                }

                if (!user.storefront) {
                    showToast('Your account is not linked to any storefront. Please contact the administrator.', 'error');
                    await client.auth.signOut();
                    window.location.replace('./');
                    return;
                }

                currentManager = user;
                branchStorefront = user.storefront;

                document.getElementById('user-display').textContent = session.user.email;
                document.getElementById('storefront-pill').innerHTML = `
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> 
                    ${branchStorefront}
                `;
                document.getElementById('modal-storefront-display').value = branchStorefront;
                document.getElementById('worker-storefront-display').value = branchStorefront;
                const sfDisplay = document.getElementById('coupon-storefront-display');
                if (sfDisplay) sfDisplay.value = branchStorefront;
                const sfNameEl = document.getElementById('coupon-storefront-name');
                if (sfNameEl) sfNameEl.textContent = branchStorefront;

                await loadAll();
            } catch (err) {
                window.location.replace('./');
            }
        }

        async function loadAll() {
            const { client } = await import('./js/supaBase.js');
            if (!branchStorefront) return;

            const [listRes, workRes, ordRes] = await Promise.all([
                client.from('listings').select('*').eq('storefront', branchStorefront).order('created_at', { ascending: false }),
                client.from('users').select('*').eq('role', 'worker').eq('storefront', branchStorefront).order('created_at', { ascending: false }),
                client.from('orders').select('*').eq('storefront', branchStorefront).order('created_at', { ascending: false })
            ]);

            state.listings = listRes.data || [];
            state.workers = workRes.data || [];
            state.orders = ordRes.data || [];

            renderListings();
            renderWorkers();
            renderOrders();
            renderSales();

            try {
                const { data: cData } = await client.from('coupons').select('id').eq('storefront', branchStorefront);
                const cBadge = document.getElementById('badge-coupons');
                if (cBadge) cBadge.textContent = cData ? cData.length : 0;
            } catch (cErr) {
                // Table might not exist yet
            }
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
                    <td class="py-3 px-4 font-medium text-slate-900 dark:text-white">${sanitizeHtml(branchStorefront)}</td>
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
                            <button onclick="editListing('${sanitizeHtml(item.id)}')" class="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition">Edit</button>
                            <button onclick="removeListing('${sanitizeHtml(item.id)}')" class="text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 transition">Delete</button>
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
                const { client } = await import('./js/supaBase.js');
                const { error } = await client.from('listings').delete().eq('id', id).eq('storefront', branchStorefront);
                if (error) throw error;
                state.listings = state.listings.filter(x => x.id !== id);
                renderListings();
            });
        }

        document.getElementById('listing-form').addEventListener('submit', async (e) => {
            const { client } = await import('./js/supaBase.js');
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
                storefront: branchStorefront,
                image_url: document.getElementById('modal-image').value.trim() || null
            };

            try {
                const query = id 
                    ? client.from('listings').update(payload).eq('id', id).eq('storefront', branchStorefront) 
                    : client.from('listings').insert([payload]);
                const { error } = await query;
                if (error) throw error;

                hideModal('listing-modal');
                document.getElementById('listing-form').reset();
                document.getElementById('modal-item-id').value = '';
                
                const { data: refreshed } = await client.from('listings').select('*').eq('storefront', branchStorefront).order('created_at', { ascending: false });
                state.listings = refreshed || [];
                renderListings();
            } catch (e) {
                err.textContent = e.code === '23505' ? 'That SKU already exists in the system.' : e.message;
                err.classList.remove('hidden');
            } finally {
                btn.disabled = false;
            }
        });

        /* --- WORKERS --- */

        function renderWorkers() {
            const search = document.getElementById('worker-search-input').value.toLowerCase().trim();
            const tbody = document.getElementById('workers-tbody');
            document.getElementById('badge-workers').textContent = state.workers.length;

            let htmlStr = '';
            
            state.workers.forEach(w => {
                const name = (w.name || '').toLowerCase();
                const email = (w.email || '').toLowerCase();
                
                if (name.includes(search) || email.includes(search)) {
                    htmlStr += `
                        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td class="py-3 px-4">
                                <div class="font-medium text-slate-900 dark:text-white">${sanitizeHtml(w.name || 'Unnamed Worker')}</div>
                                <div class="text-xs font-mono text-slate-500 dark:text-slate-400">${sanitizeHtml(w.email)}</div>
                            </td>
                            <td class="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">${sanitizeHtml(w.storefront)}</td>
                            <td class="py-3 px-4">
                                <span class="px-2 py-0.5 ${w.status === 'Active' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'} text-xs font-medium rounded-md">${sanitizeHtml(w.status)}</span>
                            </td>
                            <td class="py-3 px-4 text-right space-x-2">
                                <button onclick="removeWorker('${sanitizeHtml(w.id)}')" class="text-xs font-medium text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 transition">Revoke Access</button>
                            </td>
                        </tr>
                    `;
                }
            });

            tbody.innerHTML = htmlStr || '<tr><td colspan="4" class="p-6 text-center text-slate-500 dark:text-slate-400">No workers found for this storefront.</td></tr>';
        }

        function removeWorker(id) {
            askDelete('Revoke Access', `Remove this worker's access from ${branchStorefront}?`, async () => {
                const { client } = await import('./js/supaBase.js');
                const { error } = await client.from('users').delete().eq('id', id).eq('storefront', branchStorefront);
                if (error) throw error;
                state.workers = state.workers.filter(x => x.id !== id);
                renderWorkers();
            });
        }

        document.getElementById('worker-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('worker-email').value.trim();
            pendingWorker = {
                payload: {
                    name: document.getElementById('worker-name').value.trim(),
                    email,
                    storefront: branchStorefront,
                    status: document.getElementById('worker-status').value,
                    role: 'worker'
                }
            };
            hideModal('worker-modal');
            document.getElementById('target-email-display').textContent = email;
            document.getElementById('confirm-email-input').value = '';
            showModal('confirm-email-modal');
        });

        document.getElementById('confirm-email-form').addEventListener('submit', async (e) => {
            const { client } = await import('./js/supaBase.js');
            e.preventDefault();
            if (!pendingWorker) return;
            const input = document.getElementById('confirm-email-input').value.trim();
            
            if (input.toLowerCase() !== pendingWorker.payload.email.toLowerCase()) {
                console.error('Email verification did not match.');
                return;
            }

            try {
                const { data: user } = await client.from('users').select('id, name').eq('email', pendingWorker.payload.email).maybeSingle();
                if (user) {
                    await client.from('users').update({
                        name: pendingWorker.payload.name || user.name,
                        storefront: pendingWorker.payload.storefront,
                        status: pendingWorker.payload.status,
                        role: 'worker'
                    }).eq('id', user.id);
                } else {
                    console.error('No account found for', pendingWorker.payload.email);
                }

                hideModal('confirm-email-modal');
                pendingWorker = null;
                const { data: refreshed } = await client.from('users').select('*').eq('role', 'worker').eq('storefront', branchStorefront).order('created_at', { ascending: false });
                state.workers = refreshed || [];
                renderWorkers();
            } catch (ex) {
                console.error("Worker save error:", ex);
            }
        });

        /* --- ORDERS --- */

        function renderOrders() {
            const search = document.getElementById('orders-search-input').value.toLowerCase().trim();
            const status = document.getElementById('orders-filter-status').value;
            const tbody = document.getElementById('global-orders-tbody');

            const rows = state.orders.filter(o => {
                const orderNum = (o.order_number || '').toLowerCase();
                const itemsStr = (o.items || '').toLowerCase();
                const matchSearch = orderNum.includes(search) || itemsStr.includes(search);
                const currentStatus = o.status === 'Ready for Driver' ? 'Shipped' : (o.status || 'Processing');
                const matchStatus = !status || o.status === status || currentStatus === status;
                return matchSearch && matchStatus;
            });

            document.getElementById('stat-ord-total').textContent = state.orders.length;
            document.getElementById('stat-ord-processing').textContent = state.orders.filter(o => o.status === 'Processing').length;
            document.getElementById('stat-ord-ready').textContent = state.orders.filter(o => ['Ready for Driver', 'Shipped', 'Out for Delivery', 'Delivered'].includes(o.status)).length;
            document.getElementById('badge-orders').textContent = state.orders.length;
            
            tbody.innerHTML = '';

            if (!rows.length) {
                tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-slate-500 dark:text-slate-400">No orders found for this storefront.</td></tr>';
                return;
            }

            rows.forEach(o => {
                const tr = document.createElement('tr');
                tr.className = 'border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors';
                
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
            const { client } = await import('./js/supaBase.js');
            const order = state.orders.find(o => o.id === orderId);
            if (!order) return;

            const dbStatus = newStatus === 'Shipped' ? 'Ready for Driver' : newStatus;

            try {
                const { error } = await client
                    .from('orders')
                    .update({ status: dbStatus })
                    .eq('id', orderId);

                if (error) {
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
            document.getElementById('receipt-branch-name').textContent = order.storefront || branchStorefront;

            const d = order.created_at ? new Date(order.created_at) : new Date();
            const formattedDate = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
            const formattedTime = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
            document.getElementById('receipt-date-time').textContent = `${formattedDate} at ${formattedTime}`;

            const badge = document.getElementById('receipt-status-badge');
            if (badge) {
                const displayStatus = order.status === 'Ready for Driver' ? 'Shipped' : (order.status || 'Processing');
                badge.textContent = displayStatus;
                badge.className = 'inline-block mt-0.5 px-2.5 py-0.5 text-xs font-semibold rounded-md border ' + 
                    (order.status === 'Shipped' || order.status === 'Ready for Driver' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' :
                     order.status === 'Out for Delivery' ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800' :
                     order.status === 'Delivered' ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800' :
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
                        <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
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
            ['worker-search-input', 'input', renderWorkers],
            ['orders-search-input', 'input', renderOrders],
            ['orders-filter-status', 'change', renderOrders]
        ];

        filterBindings.forEach(([id, event, handler]) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener(event, handler);
        });

        document.getElementById('logout-btn').addEventListener('click', async () => {
            const { client } = await import('./js/supaBase.js');
            await client.auth.signOut();
            window.location.replace('./');
        });

        // ==========================================
        // COUPONS MANAGEMENT
        // ==========================================

        function getCouponFormData() {
            const code = document.getElementById('coupon-code').value.trim().toUpperCase();
            const discountType = document.getElementById('coupon-type').value;
            const discountValue = Number(document.getElementById('coupon-value').value);

            if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
                throw new Error('Enter a valid coupon code (3-32 characters).');
            }

            if (!branchStorefront) {
                throw new Error('No storefront linked to your account.');
            }

            if (!Number.isFinite(discountValue) || discountValue <= 0 || (discountType === 'percent' && discountValue > 100)) {
                throw new Error('Enter a valid discount amount.');
            }

            return {
                code,
                storefront: branchStorefront,
                discount_type: discountType,
                discount_value: discountValue,
                is_active: true
            };
        }

        async function loadCoupons() {
            const list = document.getElementById('coupons-list');
            if (!list) return;

            list.innerHTML = '<p class="text-xs text-slate-500 dark:text-slate-400">Loading coupons...</p>';

            try {
                const { client } = await import('./js/supaBase.js');
                const { data, error } = await client
                    .from('coupons')
                    .select('*')
                    .eq('storefront', branchStorefront)
                    .order('created_at', { ascending: false });

                if (error) {
                    if (error.code === 'PGRST205' || (error.message && error.message.includes('public.coupons'))) {
                        list.innerHTML = `<div class="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-700 dark:text-amber-400">
                            <strong>Notice:</strong> The <code>coupons</code> database table has not been initialized yet in the Supabase schema. Please create the table in Supabase SQL Editor.
                        </div>`;
                    } else {
                        list.innerHTML = `<p class="text-xs text-rose-600 dark:text-rose-400">Error loading coupons: ${sanitizeHtml(error.message)}</p>`;
                    }
                    return;
                }

                const badge = document.getElementById('badge-coupons');
                if (badge) {
                    badge.textContent = data ? data.length : 0;
                }

                if (!data || data.length === 0) {
                    list.innerHTML = '<p class="text-xs text-slate-500 dark:text-slate-400">No coupons found for this storefront.</p>';
                    return;
                }

                list.innerHTML = data.map(coupon => {
                    const discount = coupon.discount_type === 'percent'
                        ? `${Number(coupon.discount_value)}%`
                        : `${Number(coupon.discount_value).toFixed(2)}`;

                    return `
                        <div class="border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between gap-4 transition-colors">
                            <div>
                                <div class="font-bold text-slate-900 dark:text-white text-sm font-mono tracking-tight">
                                    ${sanitizeHtml(coupon.code)}
                                </div>
                                <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    ${sanitizeHtml(coupon.storefront)} &bull; ${discount} off
                                </div>
                            </div>

                            <div class="flex items-center gap-3">
                                <button
                                    type="button"
                                    onclick="toggleCouponStatus('${sanitizeHtml(coupon.id)}', ${coupon.is_active})"
                                    class="text-xs font-semibold ${
                                        coupon.is_active
                                            ? 'text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300'
                                            : 'text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300'
                                    } transition">
                                    ${coupon.is_active ? 'Disable' : 'Enable'}
                                </button>

                                <button
                                    type="button"
                                    onclick="deleteCoupon('${sanitizeHtml(coupon.id)}')"
                                    class="text-xs font-semibold text-rose-600 hover:text-rose-500 dark:text-rose-400 dark:hover:text-rose-300 transition">
                                    Delete
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            } catch (err) {
                list.innerHTML = `<p class="text-xs text-rose-600 dark:text-rose-400">Error loading coupons: ${sanitizeHtml(err.message)}</p>`;
            }
        }
        window.loadCoupons = loadCoupons;

        function deleteCoupon(id) {
            askDelete(
                'Delete Coupon',
                'Delete this coupon? It cannot be undone.',
                async () => {
                    const { client } = await import('./js/supaBase.js');
                    const { error } = await client
                        .from('coupons')
                        .delete()
                        .eq('id', id)
                        .eq('storefront', branchStorefront);

                    if (error) {
                        showToast('Failed to delete coupon: ' + error.message, 'error');
                        throw error;
                    }

                    showToast('Coupon deleted successfully.');
                    await loadCoupons();
                }
            );
        }
        window.deleteCoupon = deleteCoupon;

        async function toggleCouponStatus(id, isActive) {
            try {
                const { client } = await import('./js/supaBase.js');
                const { error } = await client
                    .from('coupons')
                    .update({ is_active: !isActive })
                    .eq('id', id)
                    .eq('storefront', branchStorefront);

                if (error) throw error;

                showToast(`Coupon ${!isActive ? 'enabled' : 'disabled'}.`);
                await loadCoupons();
            } catch (err) {
                showToast('Failed to update coupon: ' + err.message, 'error');
            }
        }
        window.toggleCouponStatus = toggleCouponStatus;

        document.getElementById('coupon-form')
            ?.addEventListener('submit', async (event) => {
                event.preventDefault();

                const form = event.currentTarget;
                const message = document.getElementById('coupon-message');
                const button = form.querySelector('button[type="submit"]');

                if (message) {
                    message.textContent = '';
                }

                try {
                    const coupon = getCouponFormData();

                    button.disabled = true;
                    button.textContent = 'Creating...';

                    const { client } = await import('./js/supaBase.js');
                    const { error } = await client
                        .from('coupons')
                        .insert(coupon);

                    if (error) throw error;

                    showToast(`Coupon ${coupon.code} created successfully!`);
                    if (message) {
                        message.textContent = `Coupon ${coupon.code} created successfully!`;
                        message.className = 'text-xs font-semibold mt-4 text-emerald-600 dark:text-emerald-400';
                    }

                    form.reset();
                    const sfDisplay = document.getElementById('coupon-storefront-display');
                    if (sfDisplay) sfDisplay.value = branchStorefront;
                    await loadCoupons();

                } catch (error) {
                    const errMsg = error.code === '23505'
                        ? 'This coupon code already exists for this storefront.'
                        : (error.code === 'PGRST205' ? 'The coupons database table has not been initialized yet in Supabase.' : error.message);

                    showToast(errMsg, 'error');
                    if (message) {
                        message.textContent = errMsg;
                        message.className = 'text-xs font-semibold mt-4 text-rose-600 dark:text-rose-400';
                    }

                } finally {
                    button.disabled = false;
                    button.textContent = 'Create Coupon';
                }
            });

        init();
