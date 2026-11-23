// Calculates shipping based on weight and method
function calculateShipping(weight, method) {
  const rates = {
    standard: {
      base: 5.00,
      perPound: 0.75
    },
    express: {
      base: 10.00,
      perPound: 1.50
    },
    overnight: {
      base: 20.00,
      perPound: 3.00
    }
  };

  const rate = rates[method];

  // Validation check
  if (!rate || !Number.isFinite(weight) || weight <= 0) {
    throw new Error("Invalid shipping information");
  }

  return Number(
    (rate.base + weight * rate.perPound).toFixed(2)
  );
}

// Calculates weight based on dimensions
function calculateDimensionalWeight(length, width, height) {
    const divisor = 139;
    
    // Validation check
    if (![length, width, height].every(n => Number.isFinite(n) && n > 0)) {
      throw new Error("Invalid package dimensions");
    }
  
    return (length * width * height) / divisor;
}

// Returns weight with greater value
function getBillableWeight(actualWeight, dimensionalWeight) {
    return Math.max(actualWeight, dimensionalWeight);
}

// Calculates taxes
function calculateTax(subtotal, shipping, taxRate) {
    const taxableAmount = subtotal + shipping;
  
    return Number((taxableAmount * (taxRate / 100)).toFixed(2));
}

// Calculates total cost
function calculateOrder({
  subtotal,
  weight,
  length,
  width,
  height,
  shippingMethod,
  taxRate
  }) 
  {
  // Validation checks
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    throw new Error("Invalid subtotal");
  }
  
  if (!Number.isFinite(taxRate) || taxRate < 0) {
      throw new Error("Invalid tax rate");
  }
  
  if (!Number.isFinite(weight) || weight <= 0) {
      throw new Error("Invalid actual weight");
  }
  
  const dimensionalWeight =
    calculateDimensionalWeight(length, width, height);
  
  const billableWeight =
    getBillableWeight(weight, dimensionalWeight);
  
  const shipping =
    calculateShipping(billableWeight, shippingMethod);
  
  const tax =
    calculateTax(subtotal, shipping, taxRate);
  
  const total = Number(
    (subtotal + shipping + tax).toFixed(2)
  );
  
  return {
    subtotal,
    actualWeight: weight,
    dimensionalWeight: Number(dimensionalWeight.toFixed(2)),
    billableWeight: Number(billableWeight.toFixed(2)),
    shipping,
    tax,
    total
  };
}