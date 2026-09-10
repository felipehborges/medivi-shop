## ADDED Requirements

### Requirement: Static storefront catalog
The demo SHALL render its catalog, categories, products, imagery, and promotions from versioned assets without a database or runtime API.

#### Scenario: Visitor opens the storefront
- **WHEN** a visitor loads the demo with no prior browser state
- **THEN** the storefront displays the bundled catalog and promotional content without requiring credentials or backend connectivity

### Requirement: Browser-persisted shopping interactions
The demo SHALL allow a visitor to add, update, and remove cart items and wishlist entries, with state persisted only in that browser.

#### Scenario: Cart survives reload
- **WHEN** a visitor adds an in-stock variant to the cart and reloads the page
- **THEN** the same item and quantity remain in the cart from local browser storage

#### Scenario: Stock limit is respected
- **WHEN** a visitor attempts to increase a cart quantity beyond the fixture stock
- **THEN** the demo caps or rejects the quantity and explains the stock limit

### Requirement: Simulated checkout and payment
The demo SHALL provide checkout, payment outcome, and confirmation screens without transmitting personal or payment data or creating a real charge.

#### Scenario: Visitor completes a successful demonstration
- **WHEN** a visitor enters demonstration checkout details and selects the simulated approval outcome
- **THEN** the demo creates a browser-local order, clears the cart, and displays an order confirmation

#### Scenario: Visitor simulates a declined payment
- **WHEN** a visitor selects the simulated decline outcome
- **THEN** the demo reports the decline and preserves the cart for another attempt

### Requirement: Demonstration disclosure
The demo SHALL clearly state that it is a demonstration and that no purchase or charge will occur wherever a visitor could reasonably believe a transaction is real.

#### Scenario: Visitor reaches checkout
- **WHEN** a visitor opens the checkout or payment screen
- **THEN** a prominent disclosure states that submitted data stays in the browser and no real payment will occur

### Requirement: Browser-local admin showcase
The demo SHALL provide an admin showcase whose mutations are isolated to the current browser and can be reset to bundled defaults.

#### Scenario: Visitor edits demo catalog content
- **WHEN** a visitor changes supported catalog content in the admin showcase
- **THEN** the storefront reflects that local override without changing another visitor's data

#### Scenario: Visitor resets the demonstration
- **WHEN** a visitor activates the reset control
- **THEN** local demo state is removed and bundled fixture data is restored
