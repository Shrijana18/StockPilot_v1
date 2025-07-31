describe('Billing Flow', () => {
  it('should create a new invoice', () => {
    cy.visit('http://localhost:5180');
    
    // Login
    cy.get('input[type=email]').type('testretailer@email.com');
    cy.get('input[type=password]').type('123456');
    cy.contains('Sign In').click();

    // Navigate to Billing tab
    cy.contains('Billing').click();

    // Fill customer info
    cy.get('input[name="customerName"]').type('Ravi Kumar');
    cy.get('input[name="customerPhone"]').type('9876543210');

    // Add product
    cy.contains('Add Product').click();
    cy.get('input[placeholder="Search Product"]').type('Parle');
    cy.contains('Parle-G').click();

    // Confirm
    cy.contains('Create Bill').click();
    cy.contains('Invoice Preview').should('exist');
  });
});