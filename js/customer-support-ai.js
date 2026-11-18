const SUPABASE_URL = 'https://wtcqblyyprofjocksdij.supabase.co';
const STORAGE_KEY = 'scamazon_support_chat';
const MAX_HISTORY = 10;
const MAX_INPUT = 500;

const STOP_WORDS = new Set([
    'the', 'and', 'you', 'have', 'got', 'any', 'does', 'do', 'is', 'are', 'there', 'for', 'with',
    'what', 'how', 'much', 'can', 'your', 'this', 'that', 'stock', 'price', 'cost', 'many',
    'sell', 'selling', 'carry', 'looking', 'want', 'need', 'buy', 'about', 'please', 'tell', 'show'
]);

function money(v) {
    const n = Number(v);
    return Number.isFinite(n) ? `$${n.toFixed(2)}` : String(v ?? '');
}

function describeListing(l) {
    const stock = Number(l.stock);
    const stockText = Number.isFinite(stock) ? (stock > 0 ? `${stock} in stock` : 'out of stock') : '';
    return `• **${l.title}** — ${money(l.price)}${stockText ? ` (${stockText})` : ''}`;
}

/** Canned replies for demo mode. Exported so it can be tested without a browser. */
export function mockReply(text, listings = []) {
    const q = String(text || '').toLowerCase();

    if (/^(hi|hello|hey|yo)\b/.test(q)) {
        return "Hi! I'm the Scamazon assistant. Ask me about products, stock, or your order.";
    }
    if (/refund|cancel|return/.test(q)) {
        return "Refunds and cancellations aren't available in this prototype yet. Please contact the storefront directly.";
    }
    if (/coupon|discount|promo|code/.test(q)) {
        return 'You can apply a coupon code from your cart before checking out.';
    }
    if (/order|track|package|deliver|shipping/.test(q)) {
        return "Demo mode can't look up real orders yet. Once the live connection is on, send me your order number and I'll check its status.";
    }

    const words = q.split(/\W+/).filter((w) => w.length > 2 && !STOP_WORDS.has(w));
    if (words.length && listings.length) {
        const hits = listings
            .filter((l) => words.some((w) => String(l.title || '').toLowerCase().includes(w)))
            .slice(0, 4);
        if (hits.length) {
            return `Here's what I found:\n${hits.map(describeListing).join('\n')}`;
        }
        return "I couldn't find a matching product. Try a different name, or use the search bar at the top.";
    }
    if (listings.length) {
        return `Here are a few things we carry:\n${listings.slice(0, 4).map(describeListing).join('\n')}`;
    }
    return "I can help with products, stock, and orders. What are you looking for?";
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Escape first, then allow only **bold** and line breaks. */
function renderText(s) {
    return escapeHtml(s)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
}

function loadHistory() {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.slice(-MAX_HISTORY) : [];
    } catch (e) {
        return [];
    }
}

function saveHistory(history) {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
    } catch (e) { /* storage unavailable, ignore */ }
}

async function askLiveAssistant(history) {
    const { client } = await import('./supaBase.js');
    const { data: { session } } = await client.auth.getSession();
    if (!session) {
        return 'Please sign in to chat with the assistant.';
    }
    const res = await fetch(`${SUPABASE_URL}/functions/v1/support-chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ messages: history.slice(-MAX_HISTORY) })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        return data.error || 'Sorry, the assistant is unavailable right now.';
    }
    return data.reply || 'Sorry, I did not get a response. Please try again.';
}

export function initSupportChat(options = {}) {
    if (document.getElementById('support-chat-root')) return; // already mounted
    const { mock = true, getListings = () => [] } = options;
    const history = loadHistory();
    let busy = false;

    const root = document.createElement('div');
    root.id = 'support-chat-root';
    root.innerHTML = `
        <button id="support-chat-toggle" type="button" aria-label="Open support chat" aria-expanded="false"
            class="fixed bottom-5 right-5 z-[55] w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 shadow-xl flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h8M8 14h5m-9 6l2.6-3.1A8 8 0 1112 20H4z"/></svg>
        </button>
        <section id="support-chat-panel" role="dialog" aria-label="Scamazon support chat"
            class="hidden fixed bottom-24 right-3 sm:right-5 z-[55] w-[calc(100vw-1.5rem)] sm:w-96 h-[32rem] max-h-[70vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
            <header class="flex items-center justify-between px-4 py-3 bg-slate-900 text-white border-b border-slate-800">
                <div>
                    <p class="text-sm font-black tracking-tight">Scamazon Assistant</p>
                    <p class="text-[11px] text-slate-400">${mock ? 'Demo mode' : 'Ask about products and orders'}</p>
                </div>
                <button id="support-chat-close" type="button" aria-label="Close support chat" class="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </header>
            <div id="support-chat-messages" class="flex-1 overflow-y-auto px-3 py-3 space-y-2 text-sm" aria-live="polite"></div>
            <div id="support-chat-suggestions" class="px-3 pb-2 flex flex-wrap gap-1.5"></div>
            <form id="support-chat-form" class="flex items-center gap-2 p-3 border-t border-slate-200 dark:border-slate-700">
                <input id="support-chat-input" type="text" maxlength="${MAX_INPUT}" autocomplete="off" placeholder="Type your question…"
                    class="flex-1 px-3 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 border border-transparent focus:border-amber-500 focus:outline-none">
                <button type="submit" class="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:opacity-50">Send</button>
            </form>
        </section>`;
    document.body.appendChild(root);

    const toggle = root.querySelector('#support-chat-toggle');
    const panel = root.querySelector('#support-chat-panel');
    const closeBtn = root.querySelector('#support-chat-close');
    const list = root.querySelector('#support-chat-messages');
    const suggestions = root.querySelector('#support-chat-suggestions');
    const form = root.querySelector('#support-chat-form');
    const input = root.querySelector('#support-chat-input');
    const sendBtn = form.querySelector('button[type="submit"]');

    function addBubble(role, text) {
        const el = document.createElement('div');
        const isUser = role === 'user';
        el.className = isUser
            ? 'ml-auto max-w-[85%] px-3 py-2 rounded-2xl rounded-br-md bg-amber-500 text-slate-950 font-medium'
            : 'mr-auto max-w-[85%] px-3 py-2 rounded-2xl rounded-bl-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100';
        if (isUser) el.textContent = text;
        else el.innerHTML = renderText(text);
        list.appendChild(el);
        list.scrollTop = list.scrollHeight;
        return el;
    }

    function setOpen(open) {
        panel.classList.toggle('hidden', !open);
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Close support chat' : 'Open support chat');
        if (open) input.focus();
    }

    function renderSuggestions() {
        suggestions.innerHTML = '';
        if (history.length) return;
        ['What do you have in stock?', 'Where is my order?', 'Do you have coupons?'].forEach((label) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = label;
            b.className = 'px-2.5 py-1 text-xs font-semibold rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors';
            b.addEventListener('click', () => send(label));
            suggestions.appendChild(b);
        });
    }

    async function send(rawText) {
        const text = String(rawText || '').trim().slice(0, MAX_INPUT);
        if (!text || busy) return;
        busy = true;
        sendBtn.disabled = true;
        input.value = '';

        history.push({ role: 'user', content: text });
        addBubble('user', text);
        renderSuggestions();
        const typing = addBubble('assistant', '…');

        let reply;
        try {
            if (mock) {
                await new Promise((r) => setTimeout(r, 600));
                reply = mockReply(text, getListings() || []);
            } else {
                reply = await askLiveAssistant(history);
            }
        } catch (err) {
            console.error('Support chat error:', err);
            reply = 'Sorry, something went wrong. Please try again.';
        }

        typing.innerHTML = renderText(reply);
        list.scrollTop = list.scrollHeight;
        history.push({ role: 'assistant', content: reply });
        saveHistory(history);
        busy = false;
        sendBtn.disabled = false;
        input.focus();
    }

    toggle.addEventListener('click', () => setOpen(panel.classList.contains('hidden')));
    closeBtn.addEventListener('click', () => setOpen(false));
    form.addEventListener('submit', (e) => { e.preventDefault(); send(input.value); });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !panel.classList.contains('hidden')) setOpen(false);
    });

    // Restore earlier messages from this browser session, or greet.
    if (history.length) {
        history.forEach((m) => addBubble(m.role, m.content));
    } else {
        addBubble('assistant', "Hi! I'm the Scamazon assistant. Ask me about products, stock, or your order.");
    }
    renderSuggestions();
}