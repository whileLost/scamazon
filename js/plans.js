import { setupNav } from './shared-nav.js';

        // Billing rate toggle
        try {
            const toggleBtn = document.getElementById('billing-toggle');
            const toggleCircle = document.getElementById('toggle-circle');
            const monthlyLabel = document.getElementById('monthly-label');
            const yearlyLabel = document.getElementById('yearly-label');

            const proPrice = document.getElementById('pro-price');
            const proPeriod = document.getElementById('pro-period');
            const proSavings = document.getElementById('pro-savings');

            const enterprisePrice = document.getElementById('enterprise-price');
            const enterprisePeriod = document.getElementById('enterprise-period');
            const enterpriseSavings = document.getElementById('enterprise-savings');

            const LABEL_ACTIVE = ['text-slate-900', 'dark:text-white', 'font-semibold'];
            const LABEL_IDLE = ['text-slate-500', 'dark:text-slate-400', 'font-medium'];

            function setLabelState(label, active) {
                LABEL_ACTIVE.forEach((c) => label.classList.toggle(c, active));
                LABEL_IDLE.forEach((c) => label.classList.toggle(c, !active));
            }

            let isYearly = false;
            if (toggleBtn) {
                toggleBtn.addEventListener('click', () => {
                    isYearly = !isYearly;
                    toggleBtn.setAttribute('aria-checked', String(isYearly));

                    toggleCircle.classList.toggle('translate-x-5', isYearly);
                    toggleCircle.classList.toggle('translate-x-0', !isYearly);

                    setLabelState(monthlyLabel, !isYearly);
                    setLabelState(yearlyLabel, isYearly);

                    proPrice.textContent = isYearly ? '$23' : '$29';
                    enterprisePrice.textContent = isYearly ? '$79' : '$99';

                    const periodText = isYearly ? ' / month, billed annually' : ' / month';
                    proPeriod.textContent = periodText;
                    enterprisePeriod.textContent = periodText;

                    proSavings.textContent = isYearly ? 'Save $72 per year!' : '';
                    enterpriseSavings.textContent = isYearly ? 'Save $240 per year!' : '';
                });
            }
        } catch (toggleErr) {
            console.error('Toggle initialization failed:', toggleErr);
        }

        setupNav('plans.html');
