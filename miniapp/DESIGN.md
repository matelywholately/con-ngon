# Bữa Kịp Mini App design

Reference researched: the official [ZaUI Bistro template](https://github.com/Zalo-MiniApp/zaui-bistro),
including its home/category/filter composition, product cards and navigation.
The template's README limits its examples to non-commercial testing and
evaluation. This implementation uses independently written components, styles,
icons and original artwork; it does not copy template code or assets.

The audience is someone choosing an affordable nearby meal and collecting it
on time, often one-handed. Bistro's menu/search/order patterns are adapted to
that purpose: one restaurant reservation at a time, accurate availability and
a directly accessible pickup pass. A multi-restaurant cart, delivery options,
toppings and loyalty tiers would introduce decisions the marketplace does not
support, so the interface does not offer them.

- Pandan green, rice-water surfaces and readable system typography extend the
  existing app palette. Amber is used for remaining pickup time.
- The home screen places the selected district, waiting meal and QR shortcut
  before search and meal cards. Credits are shown during checkout and account
  management, not as a customer label on the pickup pass.
- Search accepts Vietnamese with or without diacritics. Dietary filtering uses
  `is_vegetarian`; price filtering uses integer VND; ending-soon filtering uses
  the earlier of pickup and safety deadlines. Sorting does not mutate data.
- Checkout groups quantity, payment and pickup guidance. The total and reserve
  button remain reachable above the phone navigation. Unknown reservation
  outcomes retain the same idempotency key and locked selections.
- Waiting orders and history have separate tabs. The receipt-style pass keeps
  the QR and four-digit fallback together; cancellation remains an inline
  confirmation and removes the QR after success.
- Actual listing photos load over HTTPS. Original generated food illustrations
  are labelled and used only for demo fixtures. Production excludes the entire
  illustration asset and uses a neutral fallback for missing merchant photos.

Artwork: `src/assets/meal-illustrations.png`, generated for this project using
the image generation skill. It is one original five-panel Vietnamese food
illustration; the panels are displayed with CSS, without editing the source.

Verification covers 390px and 320px phone layouts, desktop layout, Vietnamese
search, filters/sorting, two-portion credit reservations, QR decoding,
cancellation/refund, and English navigation. These browser checks use explicitly
labelled fixtures and do not claim to validate a live Zalo login or handover.
