(function () {
    'use strict';

    // Frontend no longer contains data; queries backend API only

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

            if (!value || !value.trim()) {
                setFeedback('Please enter a postal code to search.');
                renderResults(resultContainer, null);
                return;
            }
            setFeedback('');

            try {
                var resp = await fetch('/api/incidents?postal_code=' + encodeURIComponent(value));
                if (!resp.ok) throw new Error('Network error');
                var data = await resp.json();
                renderResults(resultContainer, data);
            } catch (e) {
                setFeedback('Failed to fetch data. Please try again.');
            }
        });

        form.dispatchEvent(new Event('submit'));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onReady);
    } else {
        onReady();
    }
})();


