// ========================================
// Core Functions
// ========================================

// Load WASM module using WASMManager
async function loadWASM() {
    try {
        await wasmManager.initialize();
        showSuccess();
        initializePlayground();
    } catch (err) {
        showError(`Failed to load WebAssembly module: ${err.message}`);
    }
}

// Initialize playground after WASM loads
function initializePlayground() {
    const xmlInput = document.getElementById('xml-input');
    const pathInput = document.getElementById('path-input');
    const resultOutput = document.getElementById('result-output');
    const executeBtn = document.getElementById('execute-btn');
    const shareBtn = document.getElementById('share-btn');
    const copyResultBtn = document.getElementById('copy-result-btn');
    const clearResultBtn = document.getElementById('clear-result-btn');
    const clearXmlBtn = document.getElementById('clear-xml-btn');
    const exampleCategory = document.getElementById('example-category');
    const clearHistoryBtn = document.getElementById('clear-history-btn');

    // Initialize examples
    populateExamples();

    // Initialize collapsible sections
    initializeCollapsibles();

    // Load query history
    loadHistory();

    // Load from URL if present (must be after history load)
    loadFromURL();

    // Event listeners using EventManager
    console.log('Registering event listeners...');
    console.log('executeBtn:', executeBtn);
    console.log('runQuery function:', typeof runQuery);
    eventManager.add(executeBtn, 'click', runQuery);
    console.log('Execute button handler registered');
    eventManager.add(shareBtn, 'click', shareQuery);
    eventManager.add(copyResultBtn, 'click', copyResult);
    eventManager.add(clearResultBtn, 'click', () => {
        resultOutput.value = '';
        resultOutput.className = '';
        clearMetrics();
    });
    eventManager.add(clearXmlBtn, 'click', () => {
        xmlInput.value = '';
        resultOutput.value = '';
        resultOutput.className = '';
        clearMetrics();
    });
    eventManager.add(exampleCategory, 'change', populateExamples);
    eventManager.add(clearHistoryBtn, 'click', clearHistory);

    // Keyboard shortcuts
    const keydownHandler = (e) => {
        // Ctrl+Enter or Cmd+Enter to execute
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            runQuery();
        }
        // Esc to clear results
        if (e.key === 'Escape') {
            resultOutput.value = '';
            resultOutput.className = '';
            clearMetrics();
        }
    };
    eventManager.add(document, 'keydown', keydownHandler);

    // Auto-execute on input (debounced)
    let queryTimeout;
    function runQueryDebounced() {
        clearTimeout(queryTimeout);
        queryTimeout = setTimeout(runQuery, 500);
    }

    eventManager.add(xmlInput, 'input', runQueryDebounced);
    eventManager.add(pathInput, 'input', runQueryDebounced);

    console.log('XMLDOT version:', window.getVersion());
}

// ========================================
// Event Management (Prevents Memory Leaks)
// ========================================

class EventManager {
    constructor() {
        this.listeners = new Map();
    }

    /**
     * Add event listener with automatic cleanup tracking
     * @param {HTMLElement} element - DOM element
     * @param {string} event - Event name (e.g., 'click')
     * @param {Function} handler - Event handler function
     * @param {Object} options - addEventListener options
     */
    add(element, event, handler, options = {}) {
        if (!element || !element.addEventListener) {
            console.error('EventManager.add: Invalid element');
            return;
        }

        const key = `${element.id || 'anonymous'}-${event}`;

        // Remove existing listener if present
        if (this.listeners.has(key)) {
            const old = this.listeners.get(key);
            old.element.removeEventListener(old.event, old.handler, old.options);
        }

        // Add new listener
        element.addEventListener(event, handler, options);
        this.listeners.set(key, { element, event, handler, options });
    }

    /**
     * Remove specific event listener
     * @param {HTMLElement} element - DOM element
     * @param {string} event - Event name
     */
    remove(element, event) {
        const key = `${element.id || 'anonymous'}-${event}`;

        if (this.listeners.has(key)) {
            const listener = this.listeners.get(key);
            listener.element.removeEventListener(
                listener.event,
                listener.handler,
                listener.options
            );
            this.listeners.delete(key);
        }
    }

    /**
     * Clean up all event listeners
     */
    cleanup() {
        for (const [_, listener] of this.listeners) {
            listener.element.removeEventListener(
                listener.event,
                listener.handler,
                listener.options
            );
        }
        this.listeners.clear();
    }
}

// Global event manager instance
const eventManager = new EventManager();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    eventManager.cleanup();
});

// ========================================
// WASM Lifecycle Management (Prevents Race Conditions)
// ========================================

class WASMManager {
    constructor() {
        this.state = 'UNINITIALIZED';  // UNINITIALIZED | LOADING | READY | FAILED
        this.initPromise = null;
        this.wasmInstance = null;
        this.initError = null;
    }

    /**
     * Initialize WASM module
     * @returns {Promise<void>}
     */
    async initialize() {
        // Return existing promise if already initializing
        if (this.initPromise) {
            return this.initPromise;
        }

        this.state = 'LOADING';
        this.initPromise = this._load();

        try {
            await this.initPromise;
            this.state = 'READY';
            console.log('WASM Manager: Initialization complete');
        } catch (error) {
            this.state = 'FAILED';
            this.initError = error;
            console.error('WASM Manager: Initialization failed:', error);
            throw error;
        }

        return this.initPromise;
    }

    /**
     * Internal load method
     * @private
     */
    async _load() {
        try {
            const go = new Go();
            const response = await fetch('xmldot.wasm');

            if (!response.ok) {
                throw new Error(`Failed to fetch WASM: ${response.status} ${response.statusText}`);
            }

            const buffer = await response.arrayBuffer();
            const result = await WebAssembly.instantiate(buffer, go.importObject);
            go.run(result.instance);

            // Wait for WASM functions to be registered
            await new Promise(resolve => setTimeout(resolve, 100));

            // Verify functions are available
            if (typeof window.executeQuery !== 'function' ||
                typeof window.validateXML !== 'function' ||
                typeof window.getVersion !== 'function') {
                throw new Error('WASM functions not properly registered');
            }

            this.wasmInstance = result.instance;

        } catch (error) {
            console.error('WASM loading error:', error);
            throw new Error(`Failed to load WebAssembly module: ${error.message}`);
        }
    }

    /**
     * Ensure WASM is ready before executing queries
     * @returns {Promise<void>}
     * @throws {Error} If WASM failed to initialize
     */
    async ensureReady() {
        switch (this.state) {
            case 'READY':
                return;
            case 'LOADING':
                await this.initPromise;
                return;
            case 'FAILED':
                throw new Error(`WASM initialization failed: ${this.initError.message}`);
            case 'UNINITIALIZED':
                await this.initialize();
                return;
        }
    }

    /**
     * Get current state
     * @returns {string} Current state
     */
    getState() {
        return this.state;
    }

    /**
     * Check if WASM is ready
     * @returns {boolean}
     */
    isReady() {
        return this.state === 'READY';
    }
}

// Global WASM manager instance
const wasmManager = new WASMManager();

// Execute query
async function runQuery() {
    console.log('executeQuery called');
    const xmlInput = document.getElementById('xml-input');
    const pathInput = document.getElementById('path-input');
    const resultOutput = document.getElementById('result-output');
    const metricsDiv = document.getElementById('query-metrics');

    const xml = xmlInput.value.trim();
    const path = pathInput.value.trim();

    console.log('XML length:', xml.length, 'Path:', path);

    if (!xml || !path) {
        console.log('Empty XML or path, clearing results');
        resultOutput.value = '';
        resultOutput.className = '';
        clearMetrics();
        return;
    }

    // Ensure WASM is ready before executing
    try {
        await wasmManager.ensureReady();
    } catch (error) {
        resultOutput.value = `Error: ${error.message}\n\nPlease refresh the page.`;
        resultOutput.className = 'result-error';
        clearMetrics();
        return;
    }

    // Start performance measurement
    const startTime = performance.now();

    // Client-side size validation (matches WASM limits)
    const MAX_XML_SIZE = 10 * 1024 * 1024; // 10MB
    const MAX_PATH_SIZE = 4 * 1024; // 4KB

    if (xml.length > MAX_XML_SIZE) {
        const sizeMB = (xml.length / 1024 / 1024).toFixed(2);
        resultOutput.value = `Error: XML document too large (${sizeMB}MB, max 10MB)`;
        resultOutput.className = 'result-error';
        clearMetrics();
        return;
    }

    if (path.length > MAX_PATH_SIZE) {
        const sizeKB = (path.length / 1024).toFixed(2);
        resultOutput.value = `Error: Query path too large (${sizeKB}KB, max 4KB)`;
        resultOutput.className = 'result-error';
        clearMetrics();
        return;
    }

    try {
        // Skip validation for now - executeQuery will handle errors
        // TODO: Fix validateXML function
        // console.log('About to validate XML...');
        // const isValid = window.validateXML(xml);
        // console.log('Validation result:', isValid);
        // if (!isValid) {
        //     console.log('XML validation failed');
        //     resultOutput.value = 'Error: Invalid XML document. Please check your XML syntax.';
        //     resultOutput.className = 'result-error';
        //     clearMetrics();
        //     return;
        // }

        // Execute query
        console.log('About to execute WASM query...');
        const result = window.executeQuery(xml, path);
        console.log('WASM query result:', result);
        const endTime = performance.now();
        const executionTime = (endTime - startTime).toFixed(2);

        // Check for error
        if (result.error) {
            resultOutput.value = `Error: ${result.error}`;
            resultOutput.className = 'result-error';

            // Show metrics even for errors
            showMetrics(executionTime, 0, result.index || 0, true);

            // Provide helpful hints for common errors
            if (result.error.includes('timeout')) {
                resultOutput.value += '\n\nTip: Try simplifying your query or reducing the XML document size.';
            } else if (result.error.includes('too large')) {
                resultOutput.value += '\n\nTip: The playground has resource limits. Consider breaking your query into smaller parts.';
            }
            return;
        }

        // Format successful result
        const output = [
            `Value: ${result.value}`,
            `Type: ${result.type}`,
            `Exists: ${result.exists}`,
            `Index: ${result.index}`,
            ``,
            `Raw:`,
            result.raw || '(empty)'
        ].join('\n');

        resultOutput.value = output;
        resultOutput.className = 'result-success';

        // Calculate and display performance metrics
        const resultSize = result.raw ? result.raw.length : result.value.length;
        showMetrics(executionTime, resultSize, result.index, false);

        // Save to history and update URL
        saveToHistory(path);
        updateURL(xml, path);

    } catch (err) {
        console.error('Query execution error:', err);
        resultOutput.value = `Error: ${err.message}`;
        resultOutput.className = 'result-error';
        clearMetrics();
    }
}

// Copy result to clipboard
async function copyResult() {
    const resultOutput = document.getElementById('result-output');
    if (!resultOutput.value) {
        showToast('No result to copy', 'error');
        return;
    }

    try {
        // Modern Clipboard API (secure, async)
        await navigator.clipboard.writeText(resultOutput.value);
        showToast('Result copied to clipboard!');
    } catch (err) {
        // Fallback for older browsers or permission denied
        try {
            resultOutput.select();
            const success = document.execCommand('copy');
            if (success) {
                showToast('Result copied to clipboard!');
            } else {
                showToast('Copy failed', 'error');
            }
        } catch (fallbackErr) {
            console.error('Clipboard access failed:', fallbackErr);
            showToast('Clipboard access not supported', 'error');
        }
    }
}

// Populate examples
function populateExamples() {
    const examplesList = document.getElementById('examples-list');
    const category = document.getElementById('example-category').value;

    console.log('Populating examples, category:', category);
    console.log('EXAMPLES object exists:', typeof EXAMPLES !== 'undefined');
    console.log('getAllExamples function exists:', typeof getAllExamples === 'function');

    const examples = category ? EXAMPLES[category] || [] : getAllExamples();
    console.log('Found examples:', examples.length);

    // Clear safely
    examplesList.textContent = '';

    if (examples.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'No examples in this category';
        examplesList.appendChild(empty);
        return;
    }

    // Build DOM elements safely
    examples.forEach((example, index) => {
        const item = document.createElement('div');
        item.className = 'example-item';

        // Store metadata as data attributes for event delegation
        if (category) {
            item.dataset.category = category;
            item.dataset.index = index;  // Use loop index directly
        } else {
            item.dataset.category = example.category;
            // For "All Categories", find the actual index in the category array
            const categoryIndex = EXAMPLES[example.category].findIndex(ex =>
                ex.name === example.name && ex.path === example.path
            );
            item.dataset.index = categoryIndex;
        }

        const name = document.createElement('div');
        name.className = 'example-name';
        name.textContent = example.name; // Safe - no HTML injection

        const description = document.createElement('div');
        description.className = 'example-description';
        description.textContent = example.description; // Safe

        const path = document.createElement('div');
        path.className = 'example-path';
        path.textContent = example.path; // Safe

        item.appendChild(name);
        item.appendChild(description);
        item.appendChild(path);
        examplesList.appendChild(item);
    });

    // Event delegation (no inline onclick)
    if (!examplesList.dataset.listenerAdded) {
        examplesList.addEventListener('click', (e) => {
            const item = e.target.closest('.example-item');
            if (item) {
                const cat = item.dataset.category;
                const idx = parseInt(item.dataset.index, 10);
                loadExample(cat, idx);
            }
        });
        examplesList.dataset.listenerAdded = 'true';
    }
}

// Load example
function loadExample(category, index) {
    console.log('loadExample called:', category, index);

    // Validate category and index
    if (!EXAMPLES || !EXAMPLES[category]) {
        console.error(`Invalid category: ${category}`);
        showToast('Example category not found', 'error');
        return;
    }

    const example = EXAMPLES[category][index];
    if (!example) {
        console.error(`Example not found: ${category}[${index}]`);
        showToast('Example not found', 'error');
        return;
    }

    console.log('Loading example:', example.name);
    document.getElementById('xml-input').value = example.xml;
    document.getElementById('path-input').value = example.path;
    console.log('About to call executeQuery...');
    runQuery();
    showToast(`Loaded: ${example.name}`);
}

// Query history management
function saveToHistory(path) {
    // Validate input
    if (!path || typeof path !== 'string' || path.length > 1000) {
        return;
    }

    try {
        let history = [];
        const raw = localStorage.getItem('xmldot-history');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                history = parsed.filter(item =>
                    typeof item === 'string' &&
                    item.length > 0 &&
                    item.length < 1000
                );
            }
        }

        // Remove duplicates and add new path
        history = history.filter(p => p !== path);
        history.unshift(path);
        history = history.slice(0, 5); // Keep last 5

        localStorage.setItem('xmldot-history', JSON.stringify(history));
        loadHistory();
    } catch (err) {
        console.error('Failed to save history:', err);
        // Gracefully degrade - history feature disabled but app still works
    }
}

function loadHistory() {
    const historyList = document.getElementById('history-list');

    // Clear safely
    historyList.textContent = '';

    // Validate and sanitize history data
    let history = [];
    try {
        const raw = localStorage.getItem('xmldot-history');
        if (raw) {
            const parsed = JSON.parse(raw);
            // Validate: must be array of strings
            if (Array.isArray(parsed)) {
                history = parsed.filter(item =>
                    typeof item === 'string' &&
                    item.length > 0 &&
                    item.length < 1000
                );
            }
        }
    } catch (err) {
        console.error('Failed to load history:', err);
        localStorage.removeItem('xmldot-history');
    }

    if (history.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'No recent queries';
        historyList.appendChild(empty);
        return;
    }

    // Build DOM elements safely
    history.forEach(path => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.dataset.path = path;

        const pathDiv = document.createElement('div');
        pathDiv.className = 'history-path';
        pathDiv.textContent = path; // Safe - no HTML injection

        item.appendChild(pathDiv);
        historyList.appendChild(item);
    });

    // Event delegation (no inline onclick)
    if (!historyList.dataset.listenerAdded) {
        historyList.addEventListener('click', (e) => {
            const item = e.target.closest('.history-item');
            if (item) {
                loadHistoryQuery(item.dataset.path);
            }
        });
        historyList.dataset.listenerAdded = 'true';
    }
}

function loadHistoryQuery(path) {
    document.getElementById('path-input').value = path;
    runQuery();
}

function clearHistory() {
    localStorage.removeItem('xmldot-history');
    loadHistory();
    showToast('History cleared');
}

// Collapsible sections
function initializeCollapsibles() {
    const headers = document.querySelectorAll('.collapsible-header');
    headers.forEach(header => {
        const clickHandler = () => {
            const content = document.getElementById(header.id.replace('-header', '-content'));
            header.classList.toggle('collapsed');
            content.classList.toggle('collapsed');
        };
        eventManager.add(header, 'click', clickHandler);
    });
}

// Toast notification
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    if (type === 'warning') {
        toast.classList.add('toast-warning');
    } else if (type === 'error') {
        toast.classList.add('toast-error');
    }
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// Performance metrics display
function showMetrics(executionTime, resultSize, resultIndex, isError) {
    const metricsDiv = document.getElementById('query-metrics');

    if (isError) {
        metricsDiv.textContent = `Execution time: ${executionTime}ms`;
        metricsDiv.className = 'query-metrics metrics-error';
    } else {
        // Format result size
        const resultSizeFormatted = resultSize < 1024
            ? `${resultSize} bytes`
            : `${(resultSize / 1024).toFixed(2)} KB`;

        // Display comprehensive metrics
        metricsDiv.textContent = `\u26A1 ${executionTime}ms \u00B7 \uD83D\uDCCA ${resultSizeFormatted} \u00B7 \uD83D\uDCCD Index ${resultIndex}`;
        metricsDiv.className = 'query-metrics metrics-success';
    }
}

function clearMetrics() {
    const metricsDiv = document.getElementById('query-metrics');
    metricsDiv.textContent = '';
    metricsDiv.className = 'query-metrics metrics-hidden';
}

// URL parameter sharing functions
function encodeStateToURL(xml, path) {
    const params = new URLSearchParams();

    // Get default XML for comparison
    const defaultXML = getAllExamples()[0]?.xml || '';

    // Only encode non-default XML (URLSearchParams handles encoding automatically)
    if (xml && xml !== defaultXML) {
        try {
            params.set('xml', xml); // URLSearchParams auto-encodes safely
        } catch (err) {
            console.error('Failed to encode XML:', err);
            return '';
        }
    }

    if (path) {
        params.set('path', path);
    }

    return params.toString();
}

function decodeStateFromURL() {
    const params = new URLSearchParams(window.location.search);
    const state = {};

    // URLSearchParams.get() automatically decodes safely
    if (params.has('xml')) {
        try {
            state.xml = params.get('xml');
            // Validate size after decoding
            if (state.xml.length > 10485760) { // 10MB
                console.error('Decoded XML exceeds size limit');
                return {};
            }
        } catch (err) {
            console.error('Failed to decode XML from URL:', err);
        }
    }

    if (params.has('path')) {
        try {
            state.path = params.get('path');
            if (state.path.length > 4096) { // 4KB
                console.error('Decoded path exceeds size limit');
                return {};
            }
        } catch (err) {
            console.error('Failed to decode path from URL:', err);
        }
    }

    return state;
}

function loadFromURL() {
    const state = decodeStateFromURL();

    if (!state.xml && !state.path) {
        return;
    }

    // Validate XML before loading
    if (state.xml) {
        if (state.xml.length > 10485760) {
            showToast('Shared XML too large (max 10MB)', 'error');
            return;
        }

        if (!window.validateXML || !window.validateXML(state.xml)) {
            showToast('Shared XML is invalid', 'error');
            return;
        }

        document.getElementById('xml-input').value = state.xml;
    }

    if (state.path) {
        if (state.path.length > 4096) {
            showToast('Shared path too large (max 4KB)', 'error');
            return;
        }

        document.getElementById('path-input').value = state.path;
        runQuery();
    }
}

function updateURL(xml, path) {
    // Only update URL if we have meaningful content
    if (!path) {
        return;
    }

    const params = encodeStateToURL(xml, path);
    const newURL = params ? `?${params}` : window.location.pathname;

    // Use History API (doesn't reload page)
    try {
        window.history.replaceState({ xml, path }, '', newURL);
    } catch (err) {
        console.error('Failed to update URL:', err);
    }
}

function shareQuery() {
    const xml = document.getElementById('xml-input').value;
    const path = document.getElementById('path-input').value;

    if (!path) {
        showToast('Enter a query path to share', 'error');
        return;
    }

    const params = encodeStateToURL(xml, path);
    const shareURL = `${window.location.origin}${window.location.pathname}?${params}`;

    // Enforce hard limit on URL length
    const MAX_URL_LENGTH = 8000; // Conservative limit
    if (shareURL.length > MAX_URL_LENGTH) {
        showToast(`Share URL too long (${shareURL.length} chars, max ${MAX_URL_LENGTH}). Use shorter XML.`, 'error');
        return; // Don't copy long URLs
    }

    // Copy to clipboard
    navigator.clipboard.writeText(shareURL).then(() => {
        showToast('Share link copied to clipboard!');
    }).catch(() => {
        // Fallback for older browsers
        showToast('Failed to copy share link', 'error');
    });
}

// UI state management
function showSuccess() {
    document.getElementById('loading-status').classList.add('hidden');
    document.getElementById('error-status').classList.add('hidden');
    document.getElementById('success-status').classList.remove('hidden');
    document.getElementById('main-content').classList.remove('hidden');

    setTimeout(() => {
        document.getElementById('success-status').classList.add('hidden');
    }, 3000);
}

function showError(message) {
    document.getElementById('loading-status').classList.add('hidden');
    document.getElementById('success-status').classList.add('hidden');
    document.getElementById('main-content').classList.add('hidden');
    document.getElementById('error-message').textContent = message;
    document.getElementById('error-status').classList.remove('hidden');
}

// ========================================
// Initialize Application
// ========================================

// Feature detection and startup
console.log('Starting initialization...');
console.log('EventManager defined:', typeof EventManager !== 'undefined');
console.log('WASMManager defined:', typeof WASMManager !== 'undefined');
console.log('eventManager instance:', typeof eventManager !== 'undefined');
console.log('wasmManager instance:', typeof wasmManager !== 'undefined');
console.log('loadWASM function:', typeof loadWASM === 'function');

if (!WebAssembly) {
    showError('WebAssembly is not supported in this browser. Please use a modern browser.');
} else {
    console.log('WebAssembly supported, calling loadWASM()...');
    loadWASM();
}
