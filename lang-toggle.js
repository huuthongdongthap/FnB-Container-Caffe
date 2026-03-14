/**
 * Language Toggle Component
 * Component toggle ngôn ngữ VI/EN
 */

// Render language toggle button
function renderLanguageToggle(container) {
    if (!container) return;

    container.innerHTML = `
        <div class="lang-toggle" role="group" aria-label="Language selector">
            <button
                class="lang-btn ${i18n.getCurrentLang() === 'vi' ? 'active' : ''}"
                data-lang="vi"
                aria-label="Tiếng Việt"
                title="Chuyển sang tiếng Việt">
                🇻🇳 VI
            </button>
            <span class="lang-separator">|</span>
            <button
                class="lang-btn ${i18n.getCurrentLang() === 'en' ? 'active' : ''}"
                data-lang="en"
                aria-label="English"
                title="Switch to English">
                🇬🇧 EN
            </button>
        </div>
    `;

    // Add event listeners
    container.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const lang = e.target.dataset.lang;
            i18n.setLanguage(lang);
            updateLanguageToggle(container);
        });
    });
}

// Update active state sau khi đổi ngôn ngữ
function updateLanguageToggle(container) {
    if (!container) return;

    const currentLang = i18n.getCurrentLang();
    container.querySelectorAll('.lang-btn').forEach(btn => {
        if (btn.dataset.lang === currentLang) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// Export
window.langToggle = {
    render: renderLanguageToggle,
    update: updateLanguageToggle
};
