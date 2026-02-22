// ==================== CLAN ACTIVITY / DROPS PAGE ====================
const dropsContainer = document.getElementById('dropsContainer');
const dropSearch = document.getElementById('dropSearch');

let allActivity = [];
let activeFilter = 'all';

loadDrops();

async function loadDrops() {
    try {
        // Get clan members
        const resp = await proxyFetch(RS_APIS.clanMembers('Statuesque'));
        const buffer = await resp.arrayBuffer();
        const text = new TextDecoder('iso-8859-1').decode(buffer);

        if (text.includes('<!DOCTYPE') || text.includes('<html')) {
            throw new Error('API returned an error page');
        }

        const lines = text.trim().split('\n');
        const members = [];
        for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(',');
            if (parts.length >= 1 && parts[0].trim()) {
                members.push(parts[0].trim().replace(/\uFEFF/g, '').replace(/\u00A0/g, ' '));
            }
        }

        // Sample 30 random members
        const sampled = shuffleArray(members).slice(0, 30);

        dropsContainer.innerHTML = '<div class="loading"><div class="spinner"></div><p>Scanning clan activity feeds...</p></div>';

        // Fetch in batches of 10 to avoid hammering the proxy
        const results = [];
        for (let i = 0; i < sampled.length; i += 10) {
            const batch = sampled.slice(i, i + 10);
            const batchResults = await Promise.all(
                batch.map(rsn => fetchPlayerActivity(rsn))
            );
            results.push(...batchResults);
        }

        allActivity = results.flat().sort((a, b) => b.timestamp - a.timestamp);

        if (allActivity.length === 0) {
            dropsContainer.innerHTML = `
                <div style="text-align:center; padding:3rem; color:var(--text-dim);">
                    <p style="font-size:1.2rem; margin-bottom:0.5rem;">No activity found</p>
                    <p>Most clan members may have private RuneMetrics profiles.<br>Try refreshing to sample different members.</p>
                </div>
            `;
            return;
        }

        renderActivity(allActivity);
    } catch (e) {
        console.error('Activity load error:', e);
        showError(dropsContainer, 'Could not load activity data. The RuneScape API may be temporarily unavailable.');
    }
}

async function fetchPlayerActivity(rsn) {
    try {
        const resp = await proxyFetch(RS_APIS.runemetrics(rsn));
        const data = await resp.json();
        if (data.error || !data.activities) return [];

        const entries = [];
        const playerName = data.name || rsn;

        for (const act of data.activities) {
            const details = (act.details || '').toLowerCase();
            const text = (act.text || '').toLowerCase();

            const type = categorize(details, text);
            if (!type) continue;

            entries.push({
                player: playerName,
                text: act.text,
                details: act.details,
                date: act.date,
                type: type,
                timestamp: parseRSDate(act.date)
            });
        }
        return entries;
    } catch (e) {
        return [];
    }
}

function categorize(details, text) {
    // Drops — "it dropped a ..." or "I found a ..." (items from bosses)
    if (details.includes('dropped') || details.includes('i found a')) {
        // Filter out non-item "found" like "found treasure trail"
        if (details.includes('i found a') && details.includes('treasure trail')) return null;
        return 'drop';
    }
    // Pets
    if (details.includes('pet') || text.includes('pet')) return 'pet';
    // Kill milestones — "I killed X boss"
    if (details.includes('i killed')) return 'kill';
    // Level ups
    if (text.includes('levelled up')) return 'level';
    // Quest completions
    if (details.includes('quest complete') || text.includes('quest complete')) return 'quest';
    // XP milestones — only show big ones (100M+)
    if (text.match(/(\d+)000000xp/i)) {
        const num = parseInt(text.match(/(\d+)000000xp/i)[1]);
        if (num >= 100) return 'xp';
    }

    return null;
}

function renderActivity(entries) {
    // Filter tabs
    const counts = { all: entries.length };
    ['drop', 'pet', 'kill', 'level', 'quest'].forEach(t => {
        counts[t] = entries.filter(e => e.type === t).count;
    });

    let filtered = activeFilter === 'all' ? entries : entries.filter(e => e.type === activeFilter);

    // Apply search
    const q = dropSearch.value.toLowerCase();
    if (q) {
        filtered = filtered.filter(e =>
            e.player.toLowerCase().includes(q) ||
            e.details.toLowerCase().includes(q) ||
            e.text.toLowerCase().includes(q)
        );
    }

    // Type icons and colors
    const typeStyle = {
        drop:  { icon: '&#x1F4B0;', color: 'var(--gold)',    label: 'Drop' },
        pet:   { icon: '&#x1F43E;', color: '#e056a0',        label: 'Pet' },
        kill:  { icon: '&#x2694;',  color: 'var(--error)',    label: 'Kill' },
        level: { icon: '&#x2B06;',  color: 'var(--success)',  label: 'Level' },
        quest: { icon: '&#x1F4DC;', color: 'var(--warning)',  label: 'Quest' },
        xp:    { icon: '&#x2728;',  color: 'var(--accent)',   label: 'XP' }
    };

    // Filter buttons
    let html = '<div class="activity-filters">';
    const filters = [
        { key: 'all', label: 'All' },
        { key: 'drop', label: 'Drops' },
        { key: 'pet', label: 'Pets' },
        { key: 'kill', label: 'Kills' },
        { key: 'level', label: 'Levels' },
        { key: 'quest', label: 'Quests' }
    ];
    for (const f of filters) {
        const count = f.key === 'all' ? entries.length : entries.filter(e => e.type === f.key).length;
        if (f.key !== 'all' && count === 0) continue;
        const active = activeFilter === f.key ? ' active' : '';
        html += `<button class="activity-filter-btn${active}" data-filter="${f.key}">${f.label} <span class="activity-filter-count">${count}</span></button>`;
    }
    html += '</div>';

    if (filtered.length === 0) {
        html += '<div style="text-align:center; padding:2rem; color:var(--text-dim);">No matching activity found.</div>';
    } else {
        html += '<div class="activity-feed">';
        for (const entry of filtered.slice(0, 50)) {
            const style = typeStyle[entry.type] || typeStyle.xp;
            // Use details for full text, fall back to text
            const displayText = entry.details || entry.text;

            html += `
                <div class="activity-entry">
                    <span class="activity-icon" style="color:${style.color}">${style.icon}</span>
                    <div class="activity-body">
                        <div class="activity-text">${escapeHtml(displayText)}</div>
                        <div class="activity-meta">
                            <a href="stats.html?rsn=${encodeURIComponent(entry.player)}" class="activity-player">${escapeHtml(entry.player)}</a>
                            <span class="activity-date">${entry.date}</span>
                        </div>
                    </div>
                    <span class="activity-tag" style="color:${style.color}; border-color:${style.color}">${style.label}</span>
                </div>
            `;
        }
        html += '</div>';
    }

    dropsContainer.innerHTML = html;

    // Attach filter listeners
    dropsContainer.querySelectorAll('.activity-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            activeFilter = btn.dataset.filter;
            renderActivity(allActivity);
        });
    });
}

// Search filtering
dropSearch.addEventListener('input', () => {
    renderActivity(allActivity);
});

// ==================== HELPERS ====================
function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function parseRSDate(dateStr) {
    try {
        return new Date(dateStr).getTime() || 0;
    } catch {
        return 0;
    }
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
