import type { PermissionMetadata } from '../types/permission-metadata.type.js';
import { Controller } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Mode } from '../enums/mode.enum.js';
import { Permission, PERMISSION_KEY } from './permission.decorator.js';

describe('permission Decorator', () => {
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
  });

  describe('single String Permission', () => {
    it('should normalize single string to AND mode with array', () => {
      class TestController {
        @Permission('system:user:view')
        testMethod() {}
      }

      const metadata = reflector.get<PermissionMetadata>(
        PERMISSION_KEY,
        TestController.prototype.testMethod,
      );

      expect(metadata).toEqual({
        value: ['system:user:view'],
        mode: Mode.AND,
      });
    });
  });

  describe('array Permission', () => {
    it('should use AND mode by default for array', () => {
      class TestController {
        @Permission(['system:user:view', 'system:user:edit'])
        testMethod() {}
      }

      const metadata = reflector.get<PermissionMetadata>(
        PERMISSION_KEY,
        TestController.prototype.testMethod,
      );

      expect(metadata).toEqual({
        value: ['system:user:view', 'system:user:edit'],
        mode: Mode.AND,
      });
    });

    it('should support single element array', () => {
      class TestController {
        @Permission(['system:user:view'])
        testMethod() {}
      }

      const metadata = reflector.get<PermissionMetadata>(
        PERMISSION_KEY,
        TestController.prototype.testMethod,
      );

      expect(metadata).toEqual({
        value: ['system:user:view'],
        mode: Mode.AND,
      });
    });
  });

  describe('object with Mode', () => {
    it('should support OR mode', () => {
      class TestController {
        @Permission({ value: ['system:user:view', 'system:user:edit'], mode: Mode.OR })
        testMethod() {}
      }

      const metadata = reflector.get<PermissionMetadata>(
        PERMISSION_KEY,
        TestController.prototype.testMethod,
      );

      expect(metadata).toEqual({
        value: ['system:user:view', 'system:user:edit'],
        mode: Mode.OR,
      });
    });

    it('should support explicit AND mode', () => {
      class TestController {
        @Permission({ value: ['system:user:view', 'system:user:edit'], mode: Mode.AND })
        testMethod() {}
      }

      const metadata = reflector.get<PermissionMetadata>(
        PERMISSION_KEY,
        TestController.prototype.testMethod,
      );

      expect(metadata).toEqual({
        value: ['system:user:view', 'system:user:edit'],
        mode: Mode.AND,
      });
    });

    it('should default to AND mode when mode is not specified', () => {
      class TestController {
        @Permission({ value: ['system:user:view', 'system:user:edit'] })
        testMethod() {}
      }

      const metadata = reflector.get<PermissionMetadata>(
        PERMISSION_KEY,
        TestController.prototype.testMethod,
      );

      expect(metadata).toEqual({
        value: ['system:user:view', 'system:user:edit'],
        mode: Mode.AND,
      });
    });

    it('should support single string value in object', () => {
      class TestController {
        @Permission({ value: 'system:user:view', mode: Mode.OR })
        testMethod() {}
      }

      const metadata = reflector.get<PermissionMetadata>(
        PERMISSION_KEY,
        TestController.prototype.testMethod,
      );

      expect(metadata).toEqual({
        value: ['system:user:view'],
        mode: Mode.OR,
      });
    });
  });

  describe('role Fallback', () => {
    it('should support role fallback', () => {
      class TestController {
        @Permission({ value: 'system:user:view', role: 'admin' })
        testMethod() {}
      }

      const metadata = reflector.get<PermissionMetadata>(
        PERMISSION_KEY,
        TestController.prototype.testMethod,
      );

      expect(metadata).toEqual({
        value: ['system:user:view'],
        mode: Mode.AND,
        role: 'admin',
      });
    });

    it('should support role fallback with OR mode', () => {
      class TestController {
        @Permission({
          value: ['system:user:view', 'system:user:edit'],
          mode: Mode.OR,
          role: 'admin',
        })
        testMethod() {}
      }

      const metadata = reflector.get<PermissionMetadata>(
        PERMISSION_KEY,
        TestController.prototype.testMethod,
      );

      expect(metadata).toEqual({
        value: ['system:user:view', 'system:user:edit'],
        mode: Mode.OR,
        role: 'admin',
      });
    });
  });

  describe('class-level and Method-level', () => {
    it('should support class-level permission', () => {
      @Permission('system:user:view')
      @Controller()
      class TestController {}

      const metadata = reflector.get<PermissionMetadata>(PERMISSION_KEY, TestController);

      expect(metadata).toEqual({
        value: ['system:user:view'],
        mode: Mode.AND,
      });
    });

    it('should support both class-level and method-level permissions', () => {
      @Permission('system:user:view')
      @Controller()
      class TestController {
        @Permission('system:user:edit')
        testMethod() {}
      }

      const classMetadata = reflector.get<PermissionMetadata>(PERMISSION_KEY, TestController);
      const methodMetadata = reflector.get<PermissionMetadata>(
        PERMISSION_KEY,
        TestController.prototype.testMethod,
      );

      expect(classMetadata).toEqual({
        value: ['system:user:view'],
        mode: Mode.AND,
      });

      expect(methodMetadata).toEqual({
        value: ['system:user:edit'],
        mode: Mode.AND,
      });
    });
  });

  describe('validation', () => {
    it('should throw error for empty array', () => {
      expect(() => {
        class TestController {
          @Permission([])
          testMethod() {}
        }
      }).toThrow('Permission value cannot be empty');
    });

    it('should throw error for empty string', () => {
      expect(() => {
        class TestController {
          @Permission('')
          testMethod() {}
        }
      }).toThrow('Invalid permission code');
    });

    it('should throw error for whitespace-only string', () => {
      expect(() => {
        class TestController {
          @Permission('   ')
          testMethod() {}
        }
      }).toThrow('Invalid permission code');
    });

    it('should throw error for array with empty string', () => {
      expect(() => {
        class TestController {
          @Permission(['system:user:view', ''])
          testMethod() {}
        }
      }).toThrow('Invalid permission code');
    });

    it('should throw error for non-string in array', () => {
      expect(() => {
        class TestController {
          @Permission(['system:user:view', 123 as any])
          testMethod() {}
        }
      }).toThrow('Invalid permission code');
    });

    it('should throw error for invalid role type', () => {
      expect(() => {
        class TestController {
          @Permission({ value: 'system:user:view', role: 123 as any })
          testMethod() {}
        }
      }).toThrow('Invalid role');
    });
  });

  describe('array Immutability', () => {
    it('should not allow external modification of value array', () => {
      const inputArray = ['system:user:view', 'system:user:edit'];

      class TestController {
        @Permission(inputArray)
        testMethod() {}
      }

      const metadata = reflector.get<PermissionMetadata>(
        PERMISSION_KEY,
        TestController.prototype.testMethod,
      );

      // Try to modify input array
      inputArray.push('system:user:add');

      // Metadata should not be affected
      expect(metadata.value).toEqual(['system:user:view', 'system:user:edit']);
      expect(metadata.value).toHaveLength(2);
    });
  });
});
