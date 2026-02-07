import { encode, decode, decodeValue } from '../src/msgpack-buffer';
import { BufferMap } from 'buffer-collections';

describe('msgpack-buffer - Basic Types', () => {
  describe('Buffers', () => {
    test('encodes small Buffer (bin8)', () => {
      const buf = Buffer.from([1, 2, 3]);
      const encoded = encode(buf);
      
      expect(encoded[0]).toBe(0xC4); // bin8
      expect(encoded[1]).toBe(3); // length
      expect(encoded.slice(2)).toEqual(buf);
    });

    test('encodes medium Buffer (bin16)', () => {
      const buf = Buffer.alloc(300).fill(42);
      const encoded = encode(buf);
      
      expect(encoded[0]).toBe(0xC5); // bin16
      expect(encoded.readUInt16BE(1)).toBe(300);
    });

    test('encodes large Buffer (bin32)', () => {
      const buf = Buffer.alloc(70000).fill(99);
      const encoded = encode(buf);
      
      expect(encoded[0]).toBe(0xC6); // bin32
      expect(encoded.readUInt32BE(1)).toBe(70000);
    });

    test('round-trips Buffer correctly', () => {
      const original = Buffer.from([0xDE, 0xAD, 0xBE, 0xEF]);
      const encoded = encode(original);
      const decoded = decodeValue(encoded);
      
      expect(Buffer.isBuffer(decoded)).toBe(true);
      expect(decoded).toEqual(original);
    });
  });

  describe('Numbers', () => {
    test('encodes positive fixint', () => {
      expect(encode(42)[0]).toBe(42);
      expect(decodeValue(encode(42))).toBe(42);
    });

    test('encodes negative fixint', () => {
      expect(decodeValue(encode(-5))).toBe(-5);
      expect(decodeValue(encode(-32))).toBe(-32);
    });

    test('encodes uint8', () => {
      const val = 200;
      const decoded = decodeValue(encode(val));
      expect(decoded).toBe(val);
    });

    test('encodes uint16', () => {
      const val = 50000;
      const decoded = decodeValue(encode(val));
      expect(decoded).toBe(val);
    });

    test('encodes uint32', () => {
      const val = 4000000000;
      const decoded = decodeValue(encode(val));
      expect(decoded).toBe(val);
    });

    test('encodes int8', () => {
      const val = -100;
      const decoded = decodeValue(encode(val));
      expect(decoded).toBe(val);
    });

    test('encodes int16', () => {
      const val = -20000;
      const decoded = decodeValue(encode(val));
      expect(decoded).toBe(val);
    });

    test('encodes int32', () => {
      const val = -2000000000;
      const decoded = decodeValue(encode(val));
      expect(decoded).toBe(val);
    });

    test('encodes float32', () => {
      const val = 3.14159;
      const decoded = decodeValue(encode(val));
      expect(decoded).toBeCloseTo(val, 4);
    });

    test('encodes float64', () => {
      const val = Math.PI;
      const decoded = decodeValue(encode(val));
      expect(decoded).toBeCloseTo(val, 10);
    });
  });

  describe('Strings', () => {
    test('encodes fixstr', () => {
      const str = 'hello';
      const decoded = decodeValue(encode(str));
      expect(decoded).toBe(str);
    });

    test('encodes str8', () => {
      const str = 'a'.repeat(50);
      const decoded = decodeValue(encode(str));
      expect(decoded).toBe(str);
    });

    test('encodes str16', () => {
      const str = 'x'.repeat(300);
      const decoded = decodeValue(encode(str));
      expect(decoded).toBe(str);
    });

    test('encodes UTF-8 correctly', () => {
      const str = 'Hello 世界 🌍';
      const decoded = decodeValue(encode(str));
      expect(decoded).toBe(str);
    });
  });

  describe('Booleans and Nil', () => {
    test('encodes true', () => {
      expect(decodeValue(encode(true))).toBe(true);
    });

    test('encodes false', () => {
      expect(decodeValue(encode(false))).toBe(false);
    });

    test('encodes null as nil', () => {
      expect(decodeValue(encode(null))).toBeUndefined();
    });

    test('encodes undefined as nil', () => {
      expect(decodeValue(encode(undefined))).toBeUndefined();
    });
  });
});

describe('msgpack-buffer - Arrays', () => {
  test('encodes empty array (fixarray)', () => {
    const arr: any[] = [];
    const encoded = encode(arr);
    expect(encoded[0]).toBe(0x90); // fixarray with 0 elements
    expect(decodeValue(encoded)).toEqual([]);
  });

  test('encodes fixarray', () => {
    const arr = [1, 2, 3];
    const decoded = decodeValue(encode(arr));
    expect(decoded).toEqual(arr);
  });

  test('encodes array16', () => {
    const arr = Array(20).fill(42);
    const decoded = decodeValue(encode(arr));
    expect(decoded).toEqual(arr);
  });

  test('encodes nested arrays', () => {
    const arr = [1, [2, 3], [4, [5, 6]]];
    const decoded = decodeValue(encode(arr));
    expect(decoded).toEqual(arr);
  });

  test('encodes arrays with Buffers', () => {
    const arr = [
      Buffer.from([1, 2, 3]),
      'string',
      42,
      Buffer.from('test')
    ];
    const decoded = decodeValue(encode(arr));
    
    expect(decoded[0]).toEqual(arr[0]);
    expect(decoded[1]).toBe(arr[1]);
    expect(decoded[2]).toBe(arr[2]);
    expect(decoded[3]).toEqual(arr[3]);
  });

  test('encodes mixed type arrays', () => {
    const arr = [1, 'two', true, null, Buffer.from([5])];
    const decoded = decodeValue(encode(arr));
    
    expect(decoded[0]).toBe(1);
    expect(decoded[1]).toBe('two');
    expect(decoded[2]).toBe(true);
    expect(decoded[3]).toBeUndefined();
    expect(decoded[4]).toEqual(Buffer.from([5]));
  });
});

describe('msgpack-buffer - Objects and Maps', () => {
  test('encodes empty object (fixmap)', () => {
    const obj = {};
    const encoded = encode(obj);
    expect(encoded[0]).toBe(0x80); // fixmap with 0 elements
    expect(decodeValue(encoded)).toEqual({});
  });

  test('encodes plain object', () => {
    const obj = { a: 1, b: 'two', c: true };
    const decoded = decodeValue(encode(obj));
    expect(decoded).toEqual(obj);
  });

  test('encodes nested objects', () => {
    const obj = {
      level1: {
        level2: {
          value: 42
        }
      }
    };
    const decoded = decodeValue(encode(obj));
    expect(decoded).toEqual(obj);
  });

  test('encodes Map with string keys', () => {
    const map = new Map<string, any>([
      ['key1', 'value1'],
      ['key2', 42]
    ]);
    const decoded = decodeValue(encode(map));
    
    // Should decode as plain object when keys are strings
    expect(decoded).toEqual({
      key1: 'value1',
      key2: 42
    });
  });

  test('encodes Map with Buffer keys as BufferMap', () => {
    const key1 = Buffer.from([1, 2, 3]);
    const key2 = Buffer.from([4, 5, 6]);
    const map = new Map([
      [key1, 'value1'],
      [key2, 'value2']
    ]);
    
    const decoded = decodeValue(encode(map));
    
    expect(decoded).toBeInstanceOf(BufferMap);
    expect(decoded.get(key1)).toBe('value1');
    expect(decoded.get(key2)).toBe('value2');
  });

  test('Buffer keys use content-based comparison', () => {
    const originalKey = Buffer.from([0xDE, 0xAD, 0xBE, 0xEF]);
    const map = new Map([[originalKey, 'test value']]);
    
    const decoded = decodeValue(encode(map));
    
    // Create a new Buffer with same content
    const duplicateKey = Buffer.from([0xDE, 0xAD, 0xBE, 0xEF]);
    
    expect(decoded).toBeInstanceOf(BufferMap);
    expect(decoded.get(duplicateKey)).toBe('test value');
  });
});

describe('msgpack-buffer - Complex Nested Structures', () => {
  test('encodes deeply nested structure', () => {
    const data = {
      users: [
        {
          id: Buffer.from([1, 2, 3, 4]),
          name: 'Alice',
          tags: ['admin', 'user']
        },
        {
          id: Buffer.from([5, 6, 7, 8]),
          name: 'Bob',
          tags: ['user']
        }
      ],
      metadata: {
        version: 1,
        timestamp: Date.now()
      }
    };
    
    const decoded = decodeValue(encode(data));
    
    expect(decoded.users[0].id).toEqual(data.users[0].id);
    expect(decoded.users[0].name).toBe(data.users[0].name);
    expect(decoded.users[1].id).toEqual(data.users[1].id);
    expect(decoded.metadata.version).toBe(data.metadata.version);
  });

  test('encodes Map of Maps with Buffer keys', () => {
    const innerMap1 = new Map([[Buffer.from([1]), 'a']]);
    const innerMap2 = new Map([[Buffer.from([2]), 'b']]);
    const outerMap = new Map([
      [Buffer.from([10]), innerMap1],
      [Buffer.from([20]), innerMap2]
    ]);
    
    const decoded = decodeValue(encode(outerMap));
    
    expect(decoded).toBeInstanceOf(BufferMap);
    const inner1 = decoded.get(Buffer.from([10]));
    expect(inner1).toBeInstanceOf(BufferMap);
    expect(inner1.get(Buffer.from([1]))).toBe('a');
  });

  test('encodes array of tuples with Buffers', () => {
    const data = [
      [Buffer.from([1, 2]), 100, 'first'],
      [Buffer.from([3, 4]), 200, 'second'],
      [Buffer.from([5, 6]), 300, 'third']
    ];
    
    const decoded = decodeValue(encode(data));
    
    expect(decoded.length).toBe(3);
    expect(decoded[0][0]).toEqual(data[0][0]);
    expect(decoded[1][1]).toBe(200);
    expect(decoded[2][2]).toBe('third');
  });
});

describe('msgpack-buffer - decode() with offset', () => {
  test('returns bytesConsumed correctly', () => {
    const data = encode([1, 2, 3]);
    const result = decode(data, 0);
    
    expect(result.bytesConsumed).toBe(data.length);
    expect(result.value).toEqual([1, 2, 3]);
  });

  test('decodes from middle of buffer', () => {
    const first = encode(42);
    const second = encode('hello');
    const combined = Buffer.concat([first, second]);
    
    const { value: value1, bytesConsumed: bytes1 } = decode(combined, 0);
    expect(value1).toBe(42);
    
    const { value: value2 } = decode(combined, bytes1);
    expect(value2).toBe('hello');
  });

  test('handles multiple values in sequence', () => {
    const values = [1, 'two', true, Buffer.from([5])];
    const encoded = Buffer.concat(values.map(v => encode(v)));
    
    let offset = 0;
    const decoded: any[] = [];
    
    for (let i = 0; i < values.length; i++) {
      const { value, bytesConsumed } = decode(encoded, offset);
      decoded.push(value);
      offset += bytesConsumed;
    }
    
    expect(decoded[0]).toBe(1);
    expect(decoded[1]).toBe('two');
    expect(decoded[2]).toBe(true);
    expect(decoded[3]).toEqual(Buffer.from([5]));
  });
});

describe('msgpack-buffer - Error Handling', () => {
  test('handles incomplete data gracefully', () => {
    const incomplete = Buffer.from([0xC4, 0x10]); // bin8 claiming 16 bytes but truncated
    const result = decode(incomplete);
    // Should return whatever data is available
    expect(Buffer.isBuffer(result.value)).toBe(true);
    expect(result.value.length).toBe(0); // No data after the length byte
  });

  test('throws on unsupported format byte', () => {
    // Msgpack doesn't use 0xC1, should throw
    const invalid = Buffer.from([0xC1]);
    expect(() => decode(invalid)).toThrow('Unsupported msgpack format byte');
  });

  test('throws when offset exceeds buffer length', () => {
    const data = encode(42);
    expect(() => decode(data, 100)).toThrow('Unexpected end of msgpack data');
  });
});

describe('msgpack-buffer - Python RNS Compatibility', () => {
  test('encodes Buffer as bin format not str format', () => {
    const buf = Buffer.from('test');
    const encoded = encode(buf);
    
    // Should start with bin8 (0xC4), not fixstr (0xA0-0xBF)
    expect(encoded[0]).toBe(0xC4);
    expect((encoded[0] & 0xE0)).not.toBe(0xA0);
  });

  test('maintains Buffer binary format in nested structures', () => {
    const data = {
      key: Buffer.from([0xDE, 0xAD]),
      nested: [Buffer.from([0xBE, 0xEF])]
    };
    
    const encoded = encode(data);
    
    // Check that buffers are encoded as bin format (0xC4/C5/C6)
    const hexStr = encoded.toString('hex');
    expect(hexStr).toMatch(/c4/); // Contains bin8 marker
  });

  test('produces same output format as Python umsgpack for simple Buffer', () => {
    const buf = Buffer.from([0x01, 0x02, 0x03]);
    const encoded = encode(buf);
    
    // Expected: 0xC4 (bin8) + 0x03 (length) + data
    const expected = Buffer.from([0xC4, 0x03, 0x01, 0x02, 0x03]);
    expect(encoded).toEqual(expected);
  });

  test('handles Map with Buffer keys like Python dict with bytes keys', () => {
    const key = Buffer.from([0xAA, 0xBB]);
    const map = new Map([[key, 42]]);
    const encoded = encode(map);
    
    // Map should be encoded with Buffer key as binary
    expect(encoded[0]).toBe(0x81); // fixmap with 1 entry
    expect(encoded[1]).toBe(0xC4); // key is bin8
    expect(encoded[2]).toBe(2); // key length
  });
});

describe('msgpack-buffer - Edge Cases', () => {
  test('handles empty Buffer', () => {
    const buf = Buffer.alloc(0);
    const decoded = decodeValue(encode(buf));
    expect(Buffer.isBuffer(decoded)).toBe(true);
    expect(decoded.length).toBe(0);
  });

  test('handles Buffer with all zeros', () => {
    const buf = Buffer.alloc(10, 0);
    const decoded = decodeValue(encode(buf));
    expect(decoded).toEqual(buf);
  });

  test('handles Buffer with all 0xFF', () => {
    const buf = Buffer.alloc(10, 0xFF);
    const decoded = decodeValue(encode(buf));
    expect(decoded).toEqual(buf);
  });

  test('handles very long string', () => {
    const str = 'x'.repeat(70000);
    const decoded = decodeValue(encode(str));
    expect(decoded).toBe(str);
  });

  test('handles array at boundary sizes', () => {
    // 15 elements (max fixarray)
    const arr15 = Array(15).fill(1);
    expect(decodeValue(encode(arr15))).toEqual(arr15);
    
    // 16 elements (needs array16)
    const arr16 = Array(16).fill(1);
    expect(decodeValue(encode(arr16))).toEqual(arr16);
  });

  test('handles map at boundary sizes', () => {
    // 15 entries (max fixmap)
    const obj15: any = {};
    for (let i = 0; i < 15; i++) obj15[`k${i}`] = i;
    expect(decodeValue(encode(obj15))).toEqual(obj15);
    
    // 16 entries (needs map16)
    const obj16: any = {};
    for (let i = 0; i < 16; i++) obj16[`k${i}`] = i;
    expect(decodeValue(encode(obj16))).toEqual(obj16);
  });
});
