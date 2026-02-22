// ==================== MEMBERS PAGE ====================
const membersContainer = document.getElementById('membersContainer');
const memberSearch = document.getElementById('memberSearch');
const totalMembersEl = document.getElementById('totalMembers');

let allMembers = [];
let sortCol = 'xp';
let sortAsc = false;

// Load members on page load
loadMembers();

async function loadMembers() {
    try {
        const resp = await fetch(proxyUrl(RS_APIS.clanMembers('Statuesque')));
        if (!resp.ok) throw new Error('API returned ' + resp.status);
        // Jagex API returns Latin-1 encoded text - decode properly to handle special chars in names
        const buffer = await resp.arrayBuffer();
        const text = new TextDecoder('iso-8859-1').decode(buffer);

        if (text.includes('<!DOCTYPE') || text.includes('<html')) {
            throw new Error('API returned an error page');
        }

        allMembers = parseClanCSV(text);
        totalMembersEl.textContent = allMembers.length;
        renderMembers(allMembers);
    } catch (e) {
        console.error('Failed to load members:', e);
        showError(membersContainer, 'Could not load clan members. The RuneScape API may be temporarily unavailable. Try refreshing the page.');
    }
}

function parseClanCSV(text) {
    const lines = text.trim().split('\n');
    const members = [];

    // Skip header line (Clanmate, Clan Rank, Total XP, Kills)
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // CSV format: name with spaces allowed, then comma-separated fields
        // Format: "Clanmate, Clan Rank, Total XP, Kills"
        const parts = line.split(',');
        if (parts.length < 4) continue;

        // Jagex API uses non-breaking spaces (0xA0) instead of regular spaces - replace them
        const rsn = parts[0].trim().replace(/\uFEFF/g, '').replace(/\u00A0/g, ' ');
        const rank = parts[1].trim();
        const xp = parseInt(parts[2].trim()) || 0;
        const kills = parseInt(parts[3].trim()) || 0;

        if (rsn) {
            members.push({ rsn, rank, xp, kills });
        }
    }

    return members;
}

function renderMembers(members) {
    if (members.length === 0) {
        membersContainer.innerHTML = '<div class="error-msg">No members found.</div>';
        return;
    }

    let html = `
        <div class="members-table-wrap">
            <table class="members-table">
                <thead>
                    <tr>
                        <th data-sort="index">#</th>
                        <th data-sort="rsn">Player Name ${sortIcon('rsn')}</th>
                        <th data-sort="rank">Rank ${sortIcon('rank')}</th>
                        <th data-sort="xp">Total XP ${sortIcon('xp')}</th>
                        <th data-sort="kills">Kills ${sortIcon('kills')}</th>
                    </tr>
                </thead>
                <tbody>
    `;

    members.forEach((m, i) => {
        html += `
            <tr>
                <td style="color:var(--text-dim);">${i + 1}</td>
                <td>
                    <a href="stats.html?rsn=${encodeURIComponent(m.rsn)}" style="color:var(--text-bright); font-weight:600;">
                        ${m.rsn}
                    </a>
                </td>
                <td><span class="rank-badge ${rankClass(m.rank)}">${m.rank}</span></td>
                <td style="font-family:var(--font-mono);">${m.xp.toLocaleString()}</td>
                <td style="font-family:var(--font-mono);">${m.kills.toLocaleString()}</td>
            </tr>
        `;
    });

    html += '</tbody></table></div>';
    membersContainer.innerHTML = html;

    // Add sort listeners
    membersContainer.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.sort;
            if (col === 'index') return;
            if (sortCol === col) {
                sortAsc = !sortAsc;
            } else {
                sortCol = col;
                sortAsc = col === 'rsn';
            }
            sortAndRender();
        });
    });
}

function sortIcon(col) {
    if (sortCol !== col) return '';
    return sortAsc ? ' &#9650;' : ' &#9660;';
}

function sortAndRender() {
    const filtered = filterMembers(memberSearch.value);
    filtered.sort((a, b) => {
        let va = a[sortCol];
        let vb = b[sortCol];
        if (typeof va === 'string') {
            va = va.toLowerCase();
            vb = vb.toLowerCase();
            return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
        }
        return sortAsc ? va - vb : vb - va;
    });
    renderMembers(filtered);
    totalMembersEl.textContent = filtered.length + (filtered.length < allMembers.length ? ` / ${allMembers.length}` : '');
}

function filterMembers(query) {
    if (!query) return [...allMembers];
    const q = query.toLowerCase();
    return allMembers.filter(m =>
        m.rsn.toLowerCase().includes(q) ||
        m.rank.toLowerCase().includes(q)
    );
}

// Search filtering
memberSearch.addEventListener('input', () => {
    sortAndRender();
});
