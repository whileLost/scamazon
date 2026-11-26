// Payment Plans

// Get HTML elements
const priceInput = document.getElementById("price");
const monthlyPayment = document.getElementById("monthlyPayment");
const totalPayment = document.getElementById("totalPayment");
const totalInterest = document.getElementById("totalInterest");
const paymentSchedule = document.getElementById("paymentSchedule");
const finalPaymentNote = document.getElementById("finalPaymentNote");
const confirmation = document.getElementById("confirmation");
const confirmButton = document.getElementById("confirmButton");

// APR and interest settings
const APR = 0.35;
const monthlyRate = APR / 12;

// Format currency
function formatMoney(cents) {
    return "$" + (cents / 100).toFixed(2);
}

// Calculate payments
function calculatePayment() {
    const principal = Number(priceInput.value);
    const selectedPlan = document.querySelector('input[name="months"]:checked');

    // Clear prior information
    paymentSchedule.innerHTML = "";
    confirmation.textContent = "";
    finalPaymentNote.textContent = "";

    // Validate purchases
    if (priceInput.value.trim() === "" || !priceInput.checkValidity() || !Number.isFinite(principal)) {
        monthlyPayment.textContent = "$0.00";
        totalPayment.textContent = "$0.00";
        totalInterest.textContent = "$0.00";
        confirmButton.disabled = true;
        return null;
    }

    // Validate payment plans
    if (!selectedPlan) {
        monthlyPayment.textContent = "$0.00";
        totalPayment.textContent = "$0.00";
        totalInterest.textContent = "$0.00";
        confirmButton.disabled = true;
        return null;
    }
    const months = Number(selectedPlan.value);
    if (![3, 6, 12].includes(months)) {
        confirmButton.disabled = true;
        return null;
    }

    // Convert purchase price to cents
    const principalCents = Math.round(principal * 100);
    if (!Number.isSafeInteger(principalCents) || principalCents < 1) {
        confirmButton.disabled = true;
        return null;
    }

    // Calculate standard payments
    const rawPayment = principalCents * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
    const regularPayment = Math.round(rawPayment);

    // Initialize calculations
    let balance = principalCents;
    let totalPaid = 0;
    let interestPaid = 0;
    const schedule = [];

    // Generate monthly payment schedule
    for (let month = 1; month <= months; month++) {
        // Calculate monthly interest
        const interest = Math.round(balance * monthlyRate);
        // Calculate payments
        const payment = month === months ? balance + interest : Math.min(regularPayment, balance + interest);
        // Calculate principal paid
        const principalPaid = payment - interest;
        // Update balance
        balance -= principalPaid;
        // Update totals
        totalPaid += payment;
        interestPaid += interest;
        // Save payment information
        schedule.push({
            month: month,
            payment: payment,
            interest: interest,
            balance: Math.max(0, balance)
        });
    }

    // Verify that the balance has been fully paid
    if (balance !== 0) {
        confirmButton.disabled = true;
        return null;
    }

    // Display payment information
    monthlyPayment.textContent =
        formatMoney(regularPayment);
    totalPayment.textContent =
        formatMoney(totalPaid);
    totalInterest.textContent =
        formatMoney(interestPaid);

    // Display schedule
    schedule.forEach(item => {
        const row = document.createElement("tr");
        const monthCell = document.createElement("td");
        const paymentCell = document.createElement("td");
        const interestCell = document.createElement("td");
        const balanceCell = document.createElement("td");
        monthCell.textContent = item.month;
        paymentCell.textContent =
            formatMoney(item.payment);
        interestCell.textContent =
            formatMoney(item.interest);
        balanceCell.textContent =
            formatMoney(item.balance);
        row.appendChild(monthCell);
        row.appendChild(paymentCell);
        row.appendChild(interestCell);
        row.appendChild(balanceCell);
        paymentSchedule.appendChild(row);
    });

    // Explain last payment adjustment
    const lastPayment = schedule[schedule.length - 1].payment;
    if (lastPayment !== regularPayment) {
        finalPaymentNote.textContent = `Final installment adjusted to ${formatMoney(lastPayment)} to clear the remaining balance.`;
    }

    // Enable confirmation
    confirmButton.disabled = false;

    // Return payment info
    return {
        months: months,
        principal: principalCents,
        regularPayment: regularPayment,
        totalPaid: totalPaid,
        interestPaid: interestPaid
    };
}

// Update when purchase amount changes
priceInput.addEventListener("input", calculatePayment);

// Update when payment duration changes
document.querySelectorAll('input[name="months"]')
    .forEach(option => {
        option.addEventListener("change", calculatePayment);
    });

// Confirmation button
confirmButton.addEventListener("click", function() {
    const result = calculatePayment();
    if (!result) {
        confirmation.textContent =
            "Please enter a valid purchase amount and select a payment plan.";
        return;
    }
    confirmation.textContent =
        `Your ${result.months}-month payment plan has been selected.`;
});
calculatePayment();