---
name: lokacia-georgian-copy
description: Georgian UI copy rules for lokacia.ge — tone, action-named buttons, number/date/currency formatting, script validation (pnpm check:ka). Use when writing any user-facing Georgian text, notifications, seeds or PDFs.
---

# Georgian copy

- Plain, concrete, short. Say what happens. Buttons name the action: „ფართის გამოქვეყნება“, „ჩვენების ჯავშნა“, „ნომრის ჩვენება“, „ძებნის შენახვა“, „შეთავაზების გაგზავნა“ — never „გაგზავნა“/„OK“ alone.
- Numbers: space as thousands separator, `₾` after the amount: `3 000 ₾`. Use `formatMoney(minor)`.
- Area `64 მ²`, power `25 კვტ`, ceiling `3,4 მ` (comma decimal in prose is fine; UI helpers handle it).
- Dates: `16 სექტემბერი, 2026` (`formatDateKa`), relative: `დადასტურდა 3 დღის წინ`.
- Never mix scripts inside a word. Latin allowed only for brand names/units (lokacia.ge, VIP, CRM, API, PDF, kW in technical tables, URLs).
- Errors: say what went wrong and what to do: „კოდი არასწორია ან ვადა გაუვიდა“.
- Empty states: explain and offer the next action.
- Formal „თქვენ“ form.
- Common terms: ფართი (space), იჯარა (rent), მესაკუთრე (owner), ბროკერი, მოიჯარე (tenant), ჩვენება (viewing), შეთავაზება (offer), ტექნიკური პასპორტი, ვერიფიცირებული მესაკუთრე, ფავორიტები, შედარება, მოთხოვნა (demand request), ლოკაციის ანალიტიკა, კომისია, ხელშეკრულება, ჯავშნა.
- `pnpm check:ka` validates `messages/ka/*.json` in all apps: each string may contain Georgian letters, digits, punctuation, symbols (₾ ² № % / – — „ “), whitespace, and whitelisted Latin tokens (see `scripts/check-ka.mjs`). ICU placeholders `{name}` are allowed.
