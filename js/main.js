// ==================== NAVIGATION ====================
document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('navToggle');
    const links = document.getElementById('navLinks');

    if (toggle && links) {
        toggle.addEventListener('click', () => {
            links.classList.toggle('open');
        });

        // Close menu when a link is clicked
        links.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                links.classList.remove('open');
            });
        });
    }

    // Set active nav link based on current page
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a').forEach(a => {
        a.classList.remove('active');
        const href = a.getAttribute('href');
        if (href === currentPage || (currentPage === '' && href === 'index.html')) {
            a.classList.add('active');
        }
    });
});

// ==================== CORS PROXY ====================
// Multiple proxies with automatic fallback - if one is down, try the next
const CORS_PROXIES = [
    { prefix: 'https://api.allorigins.win/raw?url=', encode: true },
    { prefix: 'https://corsproxy.io/?', encode: true },
    { prefix: 'https://api.codetabs.com/v1/proxy?quest=', encode: true }
];

function proxyUrl(url) {
    // Returns the first proxy URL — used for simple cases
    return CORS_PROXIES[0].prefix + encodeURIComponent(url);
}

// Fetch with automatic proxy fallback — tries each proxy until one works
async function proxyFetch(url) {
    let lastError;
    for (const proxy of CORS_PROXIES) {
        const proxyedUrl = proxy.prefix + (proxy.encode ? encodeURIComponent(url) : url);
        try {
            const resp = await fetch(proxyedUrl);
            if (resp.ok) return resp;
            // If we get a non-OK response, try next proxy
            lastError = new Error(`Proxy returned ${resp.status}`);
        } catch (e) {
            lastError = e;
        }
    }
    throw lastError || new Error('All CORS proxies failed');
}

// ==================== RS API HELPERS ====================
const RS_APIS = {
    clanMembers: (clan) => `https://secure.runescape.com/m=clan-hiscores/members_lite.ws?clanName=${encodeURIComponent(clan)}`,
    runemetrics: (rsn) => `https://apps.runescape.com/runemetrics/profile/profile?user=${encodeURIComponent(rsn)}&activities=20`,
    hiscores: (rsn) => `https://secure.runescape.com/m=hiscore/index_lite.ws?player=${encodeURIComponent(rsn)}`,
    avatar: (rsn) => `https://secure.runescape.com/m=avatar-rs/${encodeURIComponent(rsn)}/chat.png`
};

// RS3 Skill names in hiscores order
const SKILL_NAMES = [
    'Overall', 'Attack', 'Defence', 'Strength', 'Constitution', 'Ranged',
    'Prayer', 'Magic', 'Cooking', 'Woodcutting', 'Fletching', 'Fishing',
    'Firemaking', 'Crafting', 'Smithing', 'Mining', 'Herblore', 'Agility',
    'Thieving', 'Slayer', 'Farming', 'Runecrafting', 'Hunter', 'Construction',
    'Summoning', 'Dungeoneering', 'Divination', 'Invention', 'Archaeology',
    'Necromancy'
];

// Skill icon URLs from RS Wiki (hyphen format: Skill-icon.png)
function skillIcon(name) {
    const formatted = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
    return `https://runescape.wiki/images/${formatted}-icon.png`;
}

// ==================== NUMBER FORMATTING ====================
function formatNumber(n) {
    if (n === undefined || n === null) return '0';
    n = Number(n);
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toLocaleString();
}

function formatXP(xp) {
    return formatNumber(xp);
}

// ==================== RANK HELPERS ====================
function rankClass(rank) {
    const r = rank.toLowerCase().replace(/[^a-z]/g, '');
    const map = {
        'owner': 'rank-owner',
        'deputyowner': 'rank-deputy',
        'overseer': 'rank-overseer',
        'coordinator': 'rank-coordinator',
        'organiser': 'rank-organiser',
        'admin': 'rank-admin',
        'general': 'rank-general'
    };
    return map[r] || 'rank-default';
}

// ==================== LOADING / ERROR ====================
function showLoading(container) {
    container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading...</p></div>';
}

function showError(container, message) {
    container.innerHTML = `<div class="error-msg">${message}</div>`;
}
