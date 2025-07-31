describe('Inventory Add and View Flow', () => {
  it('should add a product and view it in inventory', () => {
    cy.visit('http://localhost:5180');

    // ✅ Click "Sign In" on the landing page to open login form
    cy.contains('Sign In').should('be.visible').click();

    // Login
    cy.get('input[type=email]')
      .should('exist')
      .should('be.visible')
      .should('not.be.disabled')
      .type('ron123@gmail.com');
    cy.get('input[type=password]')
      .should('exist')
      .should('be.visible')
      .should('not.be.disabled')
      .type('ron@123');
    cy.contains('Sign In').should('exist').should('be.visible').click();

    // Navigate to Inventory tab
    cy.contains('Inventory').should('be.visible').click();
    cy.contains('Add Inventory').should('be.visible').click();

    // Fill inventory form
    cy.get('input[name="productName"]').should('exist').type('Test Product');
    cy.get('input[name="sku"]').should('exist').type('SKU12345');
    cy.get('input[name="quantity"]').should('exist').type('10');
    cy.get('input[name="costPrice"]').should('exist').type('50');
    cy.get('input[name="sellingPrice"]').should('exist').type('75');

    cy.contains('Upload').should('be.visible').click(); // or your submit button

    // Go to View Inventory
    cy.contains('View Inventory').should('be.visible').click();
    cy.contains('Test Product').should('exist');
  });
});