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

let settings = { ...defaultSettings };
let fillTimer = null;

function normalizeDigits(value) {
  return (value || "").replace(/\D/g, "");
}

function padTwo(value) {
  if (!value) {
    return "";
  }
  return value.toString().padStart(2, "0");
}

function formatExpiry(month, year) {
  const mm = padTwo(normalizeDigits(month));
  const yy = normalizeDigits(year);
  if (!mm || !yy) {
    return "";
  }
  const yearPart = yy.length === 4 ? yy.slice(-2) : yy.padStart(2, "0");
  return `${mm}/${yearPart}`;
}

function isStripeContext() {
  if (window.location.hostname.includes("stripe.com")) {
    return true;
  }
  if (document.querySelector("iframe[src*='stripe.com']")) {
    return true;
  }
  if (document.querySelector("[data-stripe]")) {
    return true;
  }
  if (document.querySelector("form[action*='stripe']")) {
    return true;
  }
  return false;
}

function isFillableElement(element) {
  if (!element || element.disabled || element.readOnly) {
    return false;
  }
  const tag = element.tagName.toLowerCase();
  if (tag === "input") {
    const type = (element.type || "").toLowerCase();
    const blocked = [
      "hidden",
      "submit",
      "button",
      "checkbox",
      "radio",
      "file",
      "image",
      "range",
      "color",
      "password"
    ];
    return !blocked.includes(type);
  }
  return tag === "select" || tag === "textarea";
}

function getLabelText(element) {
  if (!element) {
    return "";
  }
  if (element.id) {
    const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
    if (label) {
      return label.textContent || "";
    }
  }
  const wrapped = element.closest("label");
  if (wrapped) {
    return wrapped.textContent || "";
  }
  return "";
}

function getAriaLabelledByText(element) {
  const ids = (element.getAttribute("aria-labelledby") || "")
    .split(/\s+/)
    .filter(Boolean);
  if (!ids.length) {
    return "";
  }
  return ids
    .map((id) => {
      const target = document.getElementById(id);
      return target ? target.textContent : "";
    })
    .join(" ");
}

function buildFieldSignature(element) {
  const parts = [
    element.getAttribute("autocomplete"),
    element.getAttribute("name"),
    element.getAttribute("id"),
    element.getAttribute("placeholder"),
    element.getAttribute("aria-label"),
    getAriaLabelledByText(element),
    getLabelText(element)
  ];
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function hasAutocomplete(element, value) {
  const ac = (element.getAttribute("autocomplete") || "").toLowerCase();
  return ac === value;
}

function detectFieldType(element) {
  const signature = buildFieldSignature(element);

  if (hasAutocomplete(element, "cc-number") || /card number|cardnumber|cc-number|pan/.test(signature)) {
    return "cardNumber";
  }
  if (hasAutocomplete(element, "cc-exp") || /expir|expiry|exp date|mm\s*\/\s*yy/.test(signature)) {
    return "exp";
  }
  if (
    hasAutocomplete(element, "cc-exp-month") ||
    /(exp.*month|month.*exp|\bmm\b)/.test(signature)
  ) {
    return "expMonth";
  }
  if (
    hasAutocomplete(element, "cc-exp-year") ||
    /(exp.*year|year.*exp|\byy\b|\byyyy\b)/.test(signature)
  ) {
    return "expYear";
  }
  if (hasAutocomplete(element, "cc-csc") || /cvc|cvv|csc|security code/.test(signature)) {
    return "cvc";
  }
  if (
    hasAutocomplete(element, "cc-name") ||
    /name on card|cardholder|card holder/.test(signature)
  ) {
    return "fullName";
  }
  if (hasAutocomplete(element, "email") || /\bemail\b/.test(signature)) {
    return "email";
  }
  if (hasAutocomplete(element, "tel") || /\b(phone|mobile|tel)\b/.test(signature)) {
    return "phone";
  }
  if (
    hasAutocomplete(element, "address-line1") ||
    /address line 1|address1|line1/.test(signature)
  ) {
    return "addressLine1";
  }
  if (
    hasAutocomplete(element, "address-line2") ||
    /address line 2|address2|line2/.test(signature)
  ) {
    return "addressLine2";
  }
  if (hasAutocomplete(element, "address-level2") || /\bcity\b|town/.test(signature)) {
    return "city";
  }
  if (hasAutocomplete(element, "address-level1") || /state|province|region/.test(signature)) {
    return "state";
  }
  if (hasAutocomplete(element, "postal-code") || /zip|postal|postcode/.test(signature)) {
    return "zip";
  }
  if (hasAutocomplete(element, "country") || /\bcountry\b/.test(signature)) {
    return "country";
  }
  if (/billing name|full name|\bname\b/.test(signature)) {
    if (!/user(name)?|company|organization|account/.test(signature)) {
      return "fullName";
    }
  }
  return null;
}

function getValueForField(fieldType) {
  const data = settings;
  switch (fieldType) {
    case "cardNumber":
      return normalizeDigits(data.cardNumber);
    case "exp":
      return formatExpiry(data.expMonth, data.expYear);
    case "expMonth":
      return padTwo(normalizeDigits(data.expMonth));
    case "expYear":
      return normalizeDigits(data.expYear);
    case "cvc":
      return normalizeDigits(data.cvc);
    case "fullName":
      return data.fullName;
    case "email":
      return data.email;
    case "phone":
      return data.phone;
    case "addressLine1":
      return data.addressLine1;
    case "addressLine2":
      return data.addressLine2;
    case "city":
      return data.city;
    case "state":
      return data.state;
    case "zip":
      return data.zip;
    case "country":
      return data.country;
    default:
      return "";
  }
}

function shouldFill(element, force) {
  if (force) {
    return true;
  }
  if (element.tagName.toLowerCase() === "select") {
    return !element.value;
  }
  return !(element.value && element.value.toString().trim().length > 0);
}

function dispatchInputEvents(element) {
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function setSelectValue(select, candidates) {
  const options = Array.from(select.options || []);
  const normalized = candidates.map((candidate) =>
    (candidate || "").toString().trim().toLowerCase()
  );
  let match = null;

  match = options.find((option) => normalized.includes((option.value || "").trim().toLowerCase()));
  if (!match) {
    match = options.find((option) =>
      normalized.includes((option.textContent || "").trim().toLowerCase())
    );
  }
  if (!match) {
    match = options.find((option) =>
      normalized.some((candidate) =>
        candidate && (option.textContent || "").trim().toLowerCase().includes(candidate)
      )
    );
  }

  if (!match) {
    return;
  }

  select.value = match.value;
  dispatchInputEvents(select);
}

function setMonthSelect(select, monthValue) {
  const monthNumber = parseInt(monthValue, 10);
  if (!monthNumber || monthNumber < 1 || monthNumber > 12) {
    return;
  }
  const monthNames = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december"
  ];
  const shortName = monthNames[monthNumber - 1].slice(0, 3);
  const candidates = [
    monthNumber.toString(),
    padTwo(monthNumber),
    monthNames[monthNumber - 1],
    shortName
  ];
  setSelectValue(select, candidates);
}

function setYearSelect(select, yearValue) {
  const digits = normalizeDigits(yearValue);
  if (!digits) {
    return;
  }
  const fullYear = digits.length === 2 ? `20${digits}` : digits;
  const shortYear = fullYear.slice(-2);
  setSelectValue(select, [fullYear, shortYear]);
}

function applyValue(element, fieldType, force) {
  const value = getValueForField(fieldType);
  if (!value || !shouldFill(element, force)) {
    return;
  }

  if (element.tagName.toLowerCase() === "select") {
    if (fieldType === "expMonth") {
      setMonthSelect(element, value);
      return;
    }
    if (fieldType === "expYear") {
      setYearSelect(element, value);
      return;
    }
    if (fieldType === "country") {
      setSelectValue(element, [value, value.toUpperCase(), value.toLowerCase()]);
      return;
    }
    setSelectValue(element, [value]);
    return;
  }

  if (fieldType === "expMonth") {
    const monthDigits = normalizeDigits(value);
    if (!monthDigits) {
      return;
    }
    const monthNumber = parseInt(monthDigits, 10);
    if (!monthNumber || monthNumber < 1 || monthNumber > 12) {
      return;
    }
    const monthValue =
      element.maxLength > 0 && element.maxLength <= 1
        ? String(monthNumber)
        : padTwo(monthNumber);
    element.value = monthValue;
    dispatchInputEvents(element);
    return;
  }

  if (fieldType === "expYear") {
    const digits = normalizeDigits(value);
    if (!digits) {
      return;
    }
    let yearValue = digits;
    if (element.maxLength > 0 && element.maxLength <= 2) {
      yearValue = digits.length === 4 ? digits.slice(-2) : digits.padStart(2, "0");
    }
    element.value = yearValue;
    dispatchInputEvents(element);
    return;
  }

  element.value = value;
  dispatchInputEvents(element);
}

function fillInputs(force = false) {
  if (!settings.enabled || !isStripeContext()) {
    return;
  }

  const elements = Array.from(document.querySelectorAll("input, select, textarea"));
  for (const element of elements) {
    if (!isFillableElement(element)) {
      continue;
    }
    const fieldType = detectFieldType(element);
    if (!fieldType) {
      continue;
    }
    applyValue(element, fieldType, force);
  }
}

function scheduleFill(force = false) {
  if (fillTimer) {
    clearTimeout(fillTimer);
  }
  fillTimer = setTimeout(() => {
    fillInputs(force);
  }, 150);
}

function observeDomChanges() {
  if (!document.documentElement) {
    return;
  }
  const observer = new MutationObserver(() => {
    scheduleFill(false);
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}

chrome.runtime.onMessage.addListener((message) => {
  if (message && message.type === "fill-now") {
    scheduleFill(true);
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") {
    return;
  }
  Object.keys(changes).forEach((key) => {
    settings[key] = changes[key].newValue;
  });
  scheduleFill(false);
});

chrome.storage.sync.get(defaultSettings, (stored) => {
  settings = { ...defaultSettings, ...stored };
  scheduleFill(false);
  observeDomChanges();
});
