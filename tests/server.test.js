import { jest } from '@jest/globals';

jest.unstable_mockModule('../backend/jobs/queue.js', () => ({
  enqueueBulkAudit: jest.fn(),
  getBatchProgress: jest.fn(),
  batchStore: new Map(),
  bulkAuditQueue: {
    add: jest.fn(),
    on: jest.fn(),
  },
  default: {}
}));

jest.unstable_mockModule('../backend/jobs/worker.js', () => ({
  default: {}
}));

const { hashPassword, passwordMatches, applySM2, validateSignup } = await import('../server.js');
import crypto from 'crypto';

describe('server.js Utility Functions', () => {
  describe('Password Hashing & Matching', () => {
    it('should generate a valid hash object with salt', () => {
      const password = 'TestPassword123!';
      const result = hashPassword(password);
      
      expect(result).toHaveProperty('hash');
      expect(result).toHaveProperty('salt');
      expect(result).toHaveProperty('iterations', 210000);
      expect(result).toHaveProperty('digest', 'sha256');
    });

    it('should successfully match a correct password', () => {
      const password = 'SecurePassword1!';
      const storedHash = hashPassword(password);
      
      expect(passwordMatches(password, storedHash)).toBe(true);
    });

    it('should fail to match an incorrect password', () => {
      const password = 'SecurePassword1!';
      const storedHash = hashPassword(password);
      
      expect(passwordMatches('WrongPassword!', storedHash)).toBe(false);
    });

    it('should generate deterministic hashes with the same salt', () => {
      const password = 'Password';
      const salt = crypto.randomBytes(16).toString('hex');
      const hash1 = hashPassword(password, salt);
      const hash2 = hashPassword(password, salt);

      expect(hash1.hash).toEqual(hash2.hash);
      expect(hash1.salt).toEqual(hash2.salt);
    });
  });

  describe('SM-2 Algorithm (applySM2)', () => {
    it('should initialize a new card correctly on a perfect score', () => {
      const card = null;
      const result = applySM2(card, 5);
      
      expect(result.repetitions).toBe(1);
      expect(result.interval).toBe(1);
      expect(result.easeFactor).toBeGreaterThan(2.5);
      expect(result.lastQuality).toBe(5);
    });

    it('should reset interval and repetitions on a score < 3', () => {
      const card = { repetitions: 5, easeFactor: 2.6, interval: 14 };
      const result = applySM2(card, 2); // Blackout
      
      expect(result.repetitions).toBe(0);
      expect(result.interval).toBe(1);
      expect(result.lastQuality).toBe(2);
    });

    it('should increase interval for score >= 3', () => {
      const card = { repetitions: 1, easeFactor: 2.5, interval: 1 };
      const result = applySM2(card, 4);
      
      expect(result.repetitions).toBe(2);
      expect(result.interval).toBe(6);
    });
  });

  describe('validateSignup', () => {
    it('should validate correctly formatted input', () => {
      const input = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'ValidPassword123!',
        confirmPassword: 'ValidPassword123!'
      };
      expect(validateSignup(input)).toBeNull(); // null means no error
    });

    it('should return error for mismatched passwords', () => {
      const input = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'ValidPassword123!',
        confirmPassword: 'DifferentPassword1!'
      };
      expect(validateSignup(input)).toBe('Passwords do not match.');
    });

    it('should return error for missing uppercase/lowercase/number in password', () => {
      const input = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'weakpassword',
        confirmPassword: 'weakpassword'
      };
      expect(validateSignup(input)).toBe('Password must include uppercase, lowercase, and a number.');
    });

    it('should return error for invalid email', () => {
      const input = {
        name: 'John Doe',
        email: 'john.com', // invalid
        password: 'ValidPassword123!',
        confirmPassword: 'ValidPassword123!'
      };
      expect(validateSignup(input)).toBe('Enter a valid email address.');
    });
  });
});
