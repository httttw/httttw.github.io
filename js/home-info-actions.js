(function () {
    const overlay = document.getElementById('home-info-modal');
    const titleEl = document.getElementById('home-info-modal-title');
    const bodyEl = document.getElementById('home-info-modal-body');
    const closeBtn = document.getElementById('home-info-modal-close');
    if (!overlay || !titleEl || !bodyEl || !closeBtn) return;

    const infoContent = {
        institutional: {
            title: 'Institutional Services',
            body: `
                <p>Our institutional desk is designed for higher-volume clients who need dedicated execution, account support, and custom settlement coordination.</p>
                <p>Typical use cases include treasury allocation, managed client accounts, and large OTC conversions that should not be routed through a standard retail flow.</p>
                <p>Next steps:</p>
                <p><a href="signup.html">Open an account</a> or email <a href="mailto:institutional@easycoinst0re.com?subject=Institutional%20Trading%20Request">institutional@easycoinst0re.com</a> with your expected volume and preferred settlement currency.</p>
            `
        },
        otc: {
            title: 'OTC Desk',
            body: `
                <p>The OTC desk is intended for larger conversions where direct quote negotiation and manual trade handling are more appropriate than placing a standard order online.</p>
                <p>This route is useful for minimizing slippage on bigger tickets and coordinating funding or settlement windows with support.</p>
                <p>To proceed, contact <a href="mailto:otc@easycoinst0re.com?subject=OTC%20Quote%20Request">otc@easycoinst0re.com</a> or create an account first through <a href="signup.html">Sign up</a>.</p>
            `
        },
        careers: {
            title: 'Careers',
            body: `
                <p>We are building teams across product, operations, customer support, and growth. Most roles require a strong bias toward execution and attention to compliance.</p>
                <p>If you want to be considered, send your resume and a short introduction to <a href="mailto:careers@easycoinst0re.com?subject=Career%20Application">careers@easycoinst0re.com</a>.</p>
            `
        },
        about: {
            title: 'About EasyCrypto',
            body: `
                <p>EasyCrypto Exchange focuses on accessible crypto trading with a familiar exchange-style interface, KYC onboarding, multi-language support, and both spot-style and contract experiences.</p>
                <p>The platform combines guided onboarding for new users with live market views, perpetual trading, delivery contracts, asset pages, and admin-side controls.</p>
            `
        },
        stats: {
            title: 'Platform Stats',
            body: `
                <p>Current desktop homepage metrics shown to users are:</p>
                <p>1. Real-time market preview with live price, 24H change, and 24H volume</p>
                <p>2. Testimonials section showing customer trust signals</p>
                <p>3. News feed with platform and market-related article highlights</p>
                <p>For a deeper market table, open <a href="markets.html">All Markets</a>.</p>
            `
        },
        terms: {
            title: 'Terms of Service',
            body: `
                <p>Use of the platform requires account registration, KYC completion where applicable, and compliance with your local laws and the platform's risk controls.</p>
                <p>Trading in spot and contract products involves market risk. Users are responsible for the accuracy of submitted account details, wallet addresses, and order inputs.</p>
                <p>If you need a full legal version prepared for production deployment, replace this summary with your final reviewed policy text.</p>
            `
        },
        privacy: {
            title: 'Privacy Policy',
            body: `
                <p>We collect account data, authentication data, KYC materials, and trading-related activity required to operate the exchange experience and admin review workflows.</p>
                <p>This information is used for onboarding, compliance review, account recovery, fraud prevention, customer support, and service improvement.</p>
                <p>If you are preparing for public launch, this summary should be replaced with your finalized legal privacy policy.</p>
            `
        }
    };

    const newsContent = {
        news1: {
            title: '"Not my keys, not my crypto?" Maybe it\'s time for an upgrade?',
            body: `
                <p><strong>October 21, 2025</strong></p>
                <p>Self-custody remains one of the most discussed topics in crypto. As more users move from passive holding to active portfolio management, expectations around wallet security and access control continue to rise.</p>
                <p>This article focuses on the practical question: when should a user keep assets on-platform for speed, and when should they move long-term holdings into their own storage workflow?</p>
                <p>The short answer is that convenience and control solve different problems. A strong exchange experience helps users trade and settle quickly, while self-custody becomes more important once operational discipline is in place.</p>
            `
        },
        news2: {
            title: 'Weekly Crypto Market Update: Whale Games & Speculation',
            body: `
                <p><strong>October 15, 2025</strong></p>
                <p>Large wallets once again drove short-term narrative shifts this week, especially in majors where liquidity pockets amplified intraday moves.</p>
                <p>For traders, the main takeaway is straightforward: large-position behavior can distort momentum, but it does not automatically define trend direction. Risk management matters more than predicting every move.</p>
            `
        },
        news3: {
            title: 'Institutions Set to Benefit from New Sponsorship Deal',
            body: `
                <p><strong>October 13, 2025</strong></p>
                <p>Institutional participation keeps expanding beyond direct trading and into branding, infrastructure, and financial partnerships.</p>
                <p>The piece highlights how sponsorship and distribution deals increasingly act as gateways for broader crypto adoption, especially when paired with exchange liquidity and simple onboarding.</p>
            `
        },
        news4: {
            title: 'Blockchain Set for Multimillion-Dollar Investment Industry-First',
            body: `
                <p><strong>October 9, 2025</strong></p>
                <p>Investment capital continues to rotate toward infrastructure and distribution rather than purely speculative token launches.</p>
                <p>Projects that can show real usage, clear settlement mechanics, and exchange accessibility are gaining more attention than concept-only launches.</p>
            `
        },
        news5: {
            title: 'Weekly Market Update: Let the Good Times Roll',
            body: `
                <p><strong>October 8, 2025</strong></p>
                <p>Improving sentiment across large-cap crypto pushed more traders back into active positioning, especially where leveraged products were available.</p>
                <p>Momentum phases can feel easy in hindsight, but platform-side execution quality and disciplined sizing still determine whether traders actually capture those moves.</p>
            `
        },
        news6: {
            title: 'AI Agents Meet Stablecoins.. When Money Gets Interesting!',
            body: `
                <p><strong>October 2, 2025</strong></p>
                <p>Automation, agent-based workflows, and stablecoin rails are starting to overlap in more practical ways.</p>
                <p>The important theme is not hype alone, but programmable money handling: faster settlement, lower friction for routine actions, and clearer operational logic between systems.</p>
            `
        }
    };

    function openModal(title, html) {
        titleEl.textContent = title;
        bodyEl.innerHTML = html;
        overlay.classList.add('active');
        document.body.classList.add('modal-open');
    }

    function closeModal() {
        overlay.classList.remove('active');
        document.body.classList.remove('modal-open');
    }

    function handleInfoKey(key) {
        const entry = infoContent[key];
        if (!entry) return;
        openModal(entry.title, entry.body);
    }

    function handleNewsKey(key) {
        const entry = newsContent[key];
        if (!entry) return;
        openModal(entry.title, entry.body);
    }

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) closeModal();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && overlay.classList.contains('active')) {
            closeModal();
        }
    });

    document.addEventListener('click', (event) => {
        const infoTrigger = event.target.closest('[data-home-info]');
        if (infoTrigger) {
            event.preventDefault();
            handleInfoKey(infoTrigger.getAttribute('data-home-info'));
            return;
        }

        const newsTrigger = event.target.closest('[data-home-news]');
        if (newsTrigger) {
            event.preventDefault();
            handleNewsKey(newsTrigger.getAttribute('data-home-news'));
        }
    });

    document.querySelectorAll('.news-card[data-home-news]').forEach((card) => {
        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleNewsKey(card.getAttribute('data-home-news'));
            }
        });
    });
})();
