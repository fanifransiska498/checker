# Stripe Checkout Autofill Extension

Browser extension to autofill Stripe checkout fields with saved data.

## Install (Chrome)

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this folder.

## Usage

1. Click the extension icon.
2. Fill card details, name, address, and contact info.
3. Click **Save**.
4. Open a Stripe checkout page and the fields should autofill automatically.
5. You can also click **Fill current page** to trigger autofill manually.

## Notes

- The extension only fills fields when a Stripe checkout or Stripe Elements
  iframe is detected on the page.
- Card and address data is stored in `chrome.storage.sync`.
- Use test data when possible.
