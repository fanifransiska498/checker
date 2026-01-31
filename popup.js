const defaultSettings = {
  enabled: true,
  binPrefix: "",
  cardNumber: "",
  expMonth: "",
  expYear: "",
  cvc: "",
  fullName: "",
  email: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  zip: "",
  country: ""
};

const elements = {
  enabled: document.getElementById("enabled"),
  binPrefix: document.getElementById("binPrefix"),
  cardNumber: document.getElementById("cardNumber"),
  expMonth: document.getElementById("expMonth"),
  expYear: document.getElementById("expYear"),
  cvc: document.getElementById("cvc"),
  fullName: document.getElementById("fullName"),
  email: document.getElementById("email"),
  phone: document.getElementById("phone"),
  addressLine1: document.getElementById("addressLine1"),
  addressLine2: document.getElementById("addressLine2"),
  city: document.getElementById("city"),
  state: document.getElementById("state"),
  zip: document.getElementById("zip"),
  country: document.getElementById("country"),
  generateCard: document.getElementById("generateCard"),
  fillNow: document.getElementById("fillNow"),
  status: document.getElementById("status"),
  form: document.getElementById("settings-form")
};

let statusTimer = null;

function normalizeDigits(value) {
  return (value || "").replace(/\D/g, "");
}

function formatCardNumber(value) {
  const digits = normalizeDigits(value);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

function showStatus(message) {
  if (statusTimer) {
    clearTimeout(statusTimer);
  }
  elements.status.textContent = message;
  statusTimer = setTimeout(() => {
    elements.status.textContent = "";
  }, 2500);
}

function readForm() {
  return {
    enabled: elements.enabled.checked,
    binPrefix: normalizeDigits(elements.binPrefix.value),
    cardNumber: normalizeDigits(elements.cardNumber.value),
    expMonth: normalizeDigits(elements.expMonth.value),
    expYear: normalizeDigits(elements.expYear.value),
    cvc: normalizeDigits(elements.cvc.value),
    fullName: elements.fullName.value.trim(),
    email: elements.email.value.trim(),
    phone: elements.phone.value.trim(),
    addressLine1: elements.addressLine1.value.trim(),
    addressLine2: elements.addressLine2.value.trim(),
    city: elements.city.value.trim(),
    state: elements.state.value.trim(),
    zip: elements.zip.value.trim(),
    country: elements.country.value.trim()
  };
}

function writeForm(settings) {
  elements.enabled.checked = Boolean(settings.enabled);
  elements.binPrefix.value = settings.binPrefix || "";
  elements.cardNumber.value = formatCardNumber(settings.cardNumber || "");
  elements.expMonth.value = settings.expMonth || "";
  elements.expYear.value = settings.expYear || "";
  elements.cvc.value = settings.cvc || "";
  elements.fullName.value = settings.fullName || "";
  elements.email.value = settings.email || "";
  elements.phone.value = settings.phone || "";
  elements.addressLine1.value = settings.addressLine1 || "";
  elements.addressLine2.value = settings.addressLine2 || "";
  elements.city.value = settings.city || "";
  elements.state.value = settings.state || "";
  elements.zip.value = settings.zip || "";
  elements.country.value = settings.country || "";
}

function saveSettings() {
  const settings = readForm();
  return new Promise((resolve) => {
    chrome.storage.sync.set(settings, () => {
      resolve(settings);
    });
  });
}

function calculateLuhnCheckDigit(number) {
  let sum = 0;
  let doubleDigit = true;
  for (let i = number.length - 1; i >= 0; i -= 1) {
    let digit = Number(number[i]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }
  return (10 - (sum % 10)) % 10;
}

function generateCardNumber(binPrefix, length = 16) {
  const prefix = normalizeDigits(binPrefix);
  if (prefix.length < 6 || prefix.length > length - 1) {
    return null;
  }
  let number = prefix;
  while (number.length < length - 1) {
    number += Math.floor(Math.random() * 10).toString();
  }
  const checkDigit = calculateLuhnCheckDigit(number);
  return `${number}${checkDigit}`;
}

function sendFillNow() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0] || !tabs[0].id) {
      showStatus("No active tab found.");
      return;
    }
    chrome.tabs.sendMessage(tabs[0].id, { type: "fill-now" }, () => {
      if (chrome.runtime.lastError) {
        showStatus("Unable to reach the page.");
        return;
      }
      showStatus("Fill requested.");
    });
  });
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  saveSettings().then(() => {
    showStatus("Saved.");
  });
});

elements.generateCard.addEventListener("click", () => {
  const generated = generateCardNumber(elements.binPrefix.value, 16);
  if (!generated) {
    showStatus("BIN prefix must be 6-15 digits.");
    return;
  }
  elements.cardNumber.value = formatCardNumber(generated);
  showStatus("Card number generated.");
});

elements.fillNow.addEventListener("click", () => {
  saveSettings().then(() => {
    sendFillNow();
  });
});

chrome.storage.sync.get(defaultSettings, (settings) => {
  writeForm(settings);
});
