(function () {
    'use strict';

    /**
     * Normalize an address for more reliable matching.
     * - Lowercase
     * - Trim whitespace
     * - Collapse internal spaces
     */
    function normalizeAddress(input) {
        return String(input || '')
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ');
    }

    // Frontend no longer contains data; queries backend API only

    function severityClass(severity) {
        var key = String(severity || '').toLowerCase();
        if (key === 'major') return 'major';
        if (key === 'moderate') return 'moderate';
        return 'minor';
    }

    function renderResult(container, record, matchesCount) {
        if (!container) return;
        container.innerHTML = '';

        if (!record) {
            var empty = document.createElement('div');
            empty.className = 'record-card';
            empty.innerHTML = '<p class="record-desc">No accident records found for the entered address.</p>';
            container.appendChild(empty);
            return;
        }

        var card = document.createElement('article');
        card.className = 'record-card';

        var header = document.createElement('div');
        header.className = 'record-header';

        var title = document.createElement('h3');
        title.className = 'record-title';
        title.textContent = record.address;

        var badge = document.createElement('span');
        var sevClass = severityClass(record.severity);
        badge.className = 'badge ' + sevClass;
        badge.textContent = record.severity;

        header.appendChild(title);
        header.appendChild(badge);

        var grid = document.createElement('div');
        grid.className = 'record-grid';

        var meta = document.createElement('div');
        meta.className = 'record-meta';
        meta.innerHTML = '<strong>Date:</strong> ' + record.date + '<br>' +
            '<strong>Source:</strong> ' + record.source + (matchesCount > 1 ? ' (showing latest of ' + matchesCount + ')' : '');

        var desc = document.createElement('p');
        desc.className = 'record-desc';
        desc.textContent = record.description;

        grid.appendChild(meta);
        grid.appendChild(desc);

        card.appendChild(header);
        card.appendChild(grid);

        container.appendChild(card);
    }

    function setFeedback(message) {
        var el = document.getElementById('feedback');
        if (!el) return;
        if (!message) {
            el.hidden = true;
            el.textContent = '';
        } else {
            el.hidden = false;
            el.textContent = message;
        }
    }

    function onReady() {
        var records = null; // data fetched from backend
        var form = document.getElementById('search-form');
        var input = document.getElementById('address-input');
        var resultContainer = document.getElementById('result-container');

        if (!form || !input || !resultContainer) return;

        form.addEventListener('submit', async function (ev) {
            ev.preventDefault();
            var value = input.value;
            var normalized = normalizeAddress(value);

            if (!normalized) {
                setFeedback('Please enter an address to search.');
                renderResult(resultContainer, null, 0);
                return;
            }
            setFeedback('');

            try {
                var resp = await fetch('/api/accidents?address=' + encodeURIComponent(value));
                if (!resp.ok) throw new Error('Network error');
                var data = await resp.json();
                if (!data || !data.result) {
                    renderResult(resultContainer, null, 0);
                    return;
                }
                renderResult(resultContainer, data.result, 1);
            } catch (e) {
                setFeedback('Failed to fetch data. Please try again.');
            }
        });

        // Optional demo search: use a known address
        input.value = '10 Anson Road, International Plaza, Singapore 079903';
        form.dispatchEvent(new Event('submit'));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onReady);
    } else {
        onReady();
    }
})();


