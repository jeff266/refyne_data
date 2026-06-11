/**
 * Vitest setup file for React component tests (jsdom environment only)
 */

import '@testing-library/jest-dom';

// Mock scrollIntoView (not implemented in jsdom)
Element.prototype.scrollIntoView = () => {};
