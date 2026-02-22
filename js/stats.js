// ==================== STATS PAGE ====================
const rsnInput = document.getElementById('rsnInput');
const searchBtn = document.getElementById('searchBtn');
const resultsDiv = document.getElementById('statsResults');

// Search on button click or Enter
searchBtn.addEventListener('click', () => lookupPlayer());
rsnInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') lookupPlayer();
});

// Check URL params for pre-filled RSN
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('rsn')) {
    rsnInput.value = urlParams.get('rsn');
    lookupPlayer();
}

async function lookupPlayer() {
    const rsn = rsnInput.value.trim();
    if (!rsn) return;

    showLoading(resultsDiv);

    // Fetch both APIs in parallel
    const [hiscoresData, runemetricsData] = await Promise.all([
        fetchHiscores(rsn),
        fetchRuneMetrics(rsn)
    ]);

    if (!hiscoresData && !runemetricsData) {
        showError(resultsDiv, `Could not find player "<strong>${rsn}</strong>". Check the spelling or try again.`);
        return;
    }

    renderStats(rsn, hiscoresData, runemetricsData);
}

async function fetchHiscores(rsn) {
    try {
        const resp = await fetch(proxyUrl(RS_APIS.hiscores(rsn)));
        if (!resp.ok) return null;
        const text = await resp.text();
        if (text.includes('<!DOCTYPE') || text.includes('<html')) return null;
        return parseHiscores(text);
    } catch (e) {
        console.log('Hiscores fetch failed:', e);
        return null;
    }
}

async function fetchRuneMetrics(rsn) {
    try {
        const resp = await fetch(proxyUrl(RS_APIS.runemetrics(rsn)));
        if (!resp.ok) return null;
        const data = await resp.json();
        if (data.error) return null;
        return data;
    } catch (e) {
        console.log('RuneMetrics fetch failed:', e);
        return null;
    }
}

function parseHiscores(text) {
    const lines = text.trim().split('\n');
    const skills = [];

    for (let i = 0; i < Math.min(lines.length, SKILL_NAMES.length); i++) {
        const parts = lines[i].split(',');
        if (parts.length >= 3) {
            skills.push({
                name: SKILL_NAMES[i],
                rank: parseInt(parts[0]),
                level: parseInt(parts[1]),
                xp: parseInt(parts[2])
            });
        }
    }

    return skills;
}

function renderStats(rsn, hiscores, runemetrics) {
    const displayName = runemetrics ? runemetrics.name : rsn;
    const totalLevel = hiscores ? hiscores[0].level : (runemetrics ? runemetrics.totalskill : 0);
    const totalXP = hiscores ? hiscores[0].xp : (runemetrics ? runemetrics.totalxp : 0);
    const combatLevel = runemetrics ? runemetrics.combatlevel : calculateCombat(hiscores);
    const questsComplete = runemetrics ? runemetrics.questscomplete : null;
    // RuneMetrics returns rank as comma-formatted string like "56,803" — parse it to a number
    const rawRank = runemetrics ? runemetrics.rank : (hiscores ? hiscores[0].rank : null);
    const rank = rawRank ? parseInt(String(rawRank).replace(/,/g, '')) || null : null;

    let html = `
        <!-- Player Header -->
        <div style="text-align:center; margin-bottom:2rem;">
            <img src="${RS_APIS.avatar(displayName)}" alt="${displayName}"
                 style="width:80px; height:80px; border-radius:50%; border:3px solid var(--accent); margin-bottom:1rem;"
                 onerror="this.style.display='none'">
            <h2 style="color:var(--text-bright); font-size:2rem;">${displayName}</h2>
        </div>

        <!-- Overview Cards -->
        <div class="stats-overview">
            <div class="stat-card">
                <div class="stat-card-value">${totalLevel.toLocaleString()}</div>
                <div class="stat-card-label">Total Level</div>
            </div>
            <div class="stat-card">
                <div class="stat-card-value">${formatXP(totalXP)}</div>
                <div class="stat-card-label">Total XP</div>
            </div>
            <div class="stat-card">
                <div class="stat-card-value">${combatLevel || '--'}</div>
                <div class="stat-card-label">Combat Level</div>
            </div>
            ${questsComplete !== null ? `
            <div class="stat-card">
                <div class="stat-card-value">${questsComplete}</div>
                <div class="stat-card-label">Quests Done</div>
            </div>` : ''}
            ${rank ? `
            <div class="stat-card">
                <div class="stat-card-value">#${rank.toLocaleString()}</div>
                <div class="stat-card-label">Overall Rank</div>
            </div>` : ''}
        </div>

        <!-- Skills Grid -->
        <h3 style="color:var(--text-bright); margin-bottom:1rem; font-size:1.3rem;">Skills</h3>
        <div class="skills-grid">
    `;

    // Build skills from hiscores (skip Overall at index 0)
    const skillData = hiscores ? hiscores.slice(1) : buildSkillsFromRuneMetrics(runemetrics);

    for (const skill of skillData) {
        const isMaxed = skill.level >= 99;
        const is120 = skill.level >= 120;
        html += `
            <div class="skill-item">
                <img src="${skillIcon(skill.name)}" alt="${skill.name}" class="skill-icon"
                     onerror="this.style.display='none'">
                <span class="skill-name">${skill.name}</span>
                <span class="skill-level ${is120 ? 'maxed' : isMaxed ? 'maxed' : ''}">${skill.level}</span>
            </div>
        `;
    }

    html += '</div>';

    // Recent Activities (from RuneMetrics)
    if (runemetrics && runemetrics.activities && runemetrics.activities.length > 0) {
        html += `
            <h3 style="color:var(--text-bright); margin:2rem 0 1rem; font-size:1.3rem;">Recent Activity</h3>
            <div style="display:grid; gap:0.5rem;">
        `;
        for (const act of runemetrics.activities.slice(0, 10)) {
            html += `
                <div class="card" style="padding:12px 16px; display:flex; justify-content:space-between; align-items:center;">
                    <span>${formatActivityText(act.text)}</span>
                    <span style="color:var(--text-dim); font-size:0.85rem; white-space:nowrap; margin-left:1rem;">${act.date}</span>
                </div>
            `;
        }
        html += '</div>';
    }

    resultsDiv.innerHTML = html;
}

function buildSkillsFromRuneMetrics(rm) {
    if (!rm || !rm.skillvalues) return [];
    // RuneMetrics skill IDs map to skill names
    const rmSkillOrder = [
        'Attack', 'Defence', 'Strength', 'Constitution', 'Ranged',
        'Prayer', 'Magic', 'Cooking', 'Woodcutting', 'Fletching',
        'Fishing', 'Firemaking', 'Crafting', 'Smithing', 'Mining',
        'Herblore', 'Agility', 'Thieving', 'Slayer', 'Farming',
        'Runecrafting', 'Hunter', 'Construction', 'Summoning',
        'Dungeoneering', 'Divination', 'Invention', 'Archaeology',
        'Necromancy'
    ];

    return rm.skillvalues.map((sv, i) => ({
        name: rmSkillOrder[sv.id] || `Skill ${sv.id}`,
        level: sv.level,
        xp: sv.xp / 10
    }));
}

// Format activity text - convert raw XP numbers to readable format (72000000XP -> 72M XP)
function formatActivityText(text) {
    return text.replace(/(\d{1,3}(?:,?\d{3})*)\s*XP/gi, (match, numStr) => {
        const n = parseInt(numStr.replace(/,/g, ''));
        if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B XP';
        if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M XP';
        if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K XP';
        return n.toLocaleString() + ' XP';
    });
}

function calculateCombat(hiscores) {
    if (!hiscores || hiscores.length < 8) return null;
    // RS3 combat formula (approximate)
    const att = hiscores[1].level;
    const def = hiscores[2].level;
    const str = hiscores[3].level;
    const con = hiscores[4].level;
    const ran = hiscores[5].level;
    const pra = hiscores[6].level;
    const mag = hiscores[7].level;
    const sum = hiscores.length > 24 ? hiscores[24].level : 1;

    const combat = Math.floor(
        ((13/10) * Math.max(att + str, 2 * mag, 2 * ran) + def + con + Math.floor(pra / 2) + Math.floor(sum / 2)) / 4
    );
    return combat;
}
