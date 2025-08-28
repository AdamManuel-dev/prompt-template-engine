/**
 * @fileoverview Test setup configuration for React Testing Library
 * @lastmodified 2025-01-28T10:30:00Z
 * 
 * Features: Jest DOM matchers, global test utilities
 * Main APIs: Testing Library setup, DOM assertions
 * Constraints: Must be imported before all tests
 * Patterns: Extends expect with custom matchers for DOM testing
 */

import '@testing-library/jest-dom'
import { expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Runs a cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup()
})