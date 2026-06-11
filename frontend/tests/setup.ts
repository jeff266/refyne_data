/**
 * Vitest setup file for React component tests
 */

import '@testing-library/jest-dom';

// Mock scrollIntoView (not implemented in jsdom)
Element.prototype.scrollIntoView = () => {};
