/**
 * @fileoverview Simple test to verify Jest setup
 * @lastmodified 2025-01-28T10:30:00Z
 */

describe('Basic Jest Setup', () => {
  it('should run basic tests', () => {
    expect(1 + 1).toBe(2)
  })

  it('should handle async operations', async () => {
    const result = await Promise.resolve('test')
    expect(result).toBe('test')
  })

  it('should handle object equality', () => {
    const obj = { name: 'test', value: 123 }
    expect(obj).toEqual({ name: 'test', value: 123 })
  })

  it('should handle environment variables', () => {
    expect(process.env.NODE_ENV).toBe('test')
    expect(process.env.JWT_SECRET).toBe('test-secret-key-for-testing-only')
  })

  it('should handle mocking', () => {
    const mockFn = jest.fn()
    mockFn('test-arg')
    
    expect(mockFn).toHaveBeenCalledWith('test-arg')
    expect(mockFn).toHaveBeenCalledTimes(1)
  })
})