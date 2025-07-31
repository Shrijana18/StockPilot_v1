describe('Login Flow', () => {
  it('Retailer Login should redirect to dashboard', () => {
    cy.visit('http://localhost:5180'); // Adjust if needed

    // Click Sign In button
    cy.contains('Sign In').should('be.visible').click();

    // Wait for login form route to mount (optional: adjust based on your routing)
    cy.location('pathname', { timeout: 10000 }).should('include', '/signin'); // or '/login'

    // Wait for the email and password fields to appear
    cy.get('input[type="email"]', { timeout: 10000 })
      .should('exist')
      .should('be.enabled')
      .type('ron123@gmail.com');

    cy.get('input[type="password"]', { timeout: 10000 })
      .should('exist')
      .should('be.enabled')
      .type('ron@123');

    // Click final sign in
    cy.get('button').contains('Sign In').should('be.visible').click();

    // Validate dashboard
    cy.url({ timeout: 10000 }).should('include', '/dashboard');
    cy.contains('Retailer Dashboard').should('exist');
  });
});