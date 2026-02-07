/*
 * Reticulum License
 *
 * Copyright (c) 2026 Jindrich Vavruska
 *
 * LICENSE
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
  *
  * This module provides custom msgpack encoding and decoding functions that handle Buffers as binary format (0xC4/C5/C6) 
  * for binary compatibility with files created and used by Python RNS (Reticulum Network Stack).
  * It recursively encodes and decodes nested structures while preserving Buffer
  * binary format, and uses BufferMap for maps with Buffer keys to enable content-based comparison. 
  * The decode function returns both the decoded value and the number of bytes consumed, allowing for 
  * efficient parsing of complex msgpack data.
 */

import * as msgpack from 'msgpack-lite';
import { BufferMap } from 'buffer-collections';

const standardEncode = msgpack.encode;
const standardDecode = msgpack.decode;

/**
 * Generic msgpack encoder that handles Buffers as binary format (0xC4/C5/C6).
 * Recursively encodes nested structures (arrays, maps, objects) while preserving
 * Buffer binary format for Python RNS compatibility.
 * 
 * @param data - Any data structure to encode
 * @returns Encoded msgpack Buffer
 */
export function encode(data: any): Buffer {
  const parts: Buffer[] = [];
  
  if (Buffer.isBuffer(data)) {
    // Encode Buffer as binary (bin8/bin16/bin32)
    if (data.length <= 255) {
      const header = Buffer.allocUnsafe(2);
      header.writeUInt8(0xC4, 0);
      header.writeUInt8(data.length, 1);
      parts.push(header, data);
    } else if (data.length <= 65535) {
      const header = Buffer.allocUnsafe(3);
      header.writeUInt8(0xC5, 0);
      header.writeUInt16BE(data.length, 1);
      parts.push(header, data);
    } else {
      const header = Buffer.allocUnsafe(5);
      header.writeUInt8(0xC6, 0);
      header.writeUInt32BE(data.length, 1);
      parts.push(header, data);
    }
  } else if (data instanceof Map) {
    // Encode Map (handles both Buffer keys and regular keys)
    if (data.size <= 15) {
      parts.push(Buffer.from([0x80 | data.size]));
    } else if (data.size <= 65535) {
      const header = Buffer.allocUnsafe(3);
      header.writeUInt8(0xDE, 0);
      header.writeUInt16BE(data.size, 1);
      parts.push(header);
    } else {
      const header = Buffer.allocUnsafe(5);
      header.writeUInt8(0xDF, 0);
      header.writeUInt32BE(data.size, 1);
      parts.push(header);
    }
    
    for (const [key, value] of data.entries()) {
      parts.push(encode(key));
      parts.push(encode(value));
    }
  } else if (Array.isArray(data)) {
    // Encode Array
    if (data.length <= 15) {
      parts.push(Buffer.from([0x90 | data.length]));
    } else if (data.length <= 65535) {
      const header = Buffer.allocUnsafe(3);
      header.writeUInt8(0xDC, 0);
      header.writeUInt16BE(data.length, 1);
      parts.push(header);
    } else {
      const header = Buffer.allocUnsafe(5);
      header.writeUInt8(0xDD, 0);
      header.writeUInt32BE(data.length, 1);
      parts.push(header);
    }
    
    for (const element of data) {
      parts.push(encode(element));
    }
  } else if (data === null || data === undefined) {
    // Encode nil
    parts.push(Buffer.from([0xC0]));
  } else if (typeof data === 'object' && data.constructor === Object) {
    // Encode plain object as map
    const entries = Object.entries(data);
    if (entries.length <= 15) {
      parts.push(Buffer.from([0x80 | entries.length]));
    } else if (entries.length <= 65535) {
      const header = Buffer.allocUnsafe(3);
      header.writeUInt8(0xDE, 0);
      header.writeUInt16BE(entries.length, 1);
      parts.push(header);
    } else {
      const header = Buffer.allocUnsafe(5);
      header.writeUInt8(0xDF, 0);
      header.writeUInt32BE(entries.length, 1);
      parts.push(header);
    }
    
    for (const [key, value] of entries) {
      parts.push(encode(key));
      parts.push(encode(value));
    }
  } else {
    // Use standard msgpack for primitives (numbers, strings, booleans)
    parts.push(standardEncode(data));
  }
  
  return Buffer.concat(parts);
}

/**
 * Generic msgpack decoder that decodes binary format (0xC4/C5/C6) as Buffers.
 * Reads the first byte to determine type and handles all msgpack formats.
 * Returns BufferMap for maps with Buffer keys for content-based comparison.
 * 
 * @param data - Encoded msgpack Buffer
 * @param offset - Current read offset (for recursion)
 * @returns Object with decoded value and bytes consumed
 */
export function decode(data: Buffer, offset: number = 0): { value: any; bytesConsumed: number } {
  if (offset >= data.length) {
    throw new Error('Unexpected end of msgpack data');
  }
  
  const startOffset = offset;
  const firstByte = data.readUInt8(offset++);
  
  // Positive fixint (0x00-0x7F)
  if ((firstByte & 0x80) === 0x00) {
    return { value: firstByte, bytesConsumed: offset - startOffset };
  }
  
  // Fixmap (0x80-0x8F)
  if ((firstByte & 0xF0) === 0x80) {
    const size = firstByte & 0x0F;
    return decodeMap(data, offset, size, startOffset);
  }
  
  // Fixarray (0x90-0x9F)
  if ((firstByte & 0xF0) === 0x90) {
    const size = firstByte & 0x0F;
    return decodeArray(data, offset, size, startOffset);
  }
  
  // Fixstr (0xA0-0xBF)
  if ((firstByte & 0xE0) === 0xA0) {
    const length = firstByte & 0x1F;
    const str = data.toString('utf8', offset, offset + length);
    return { value: str, bytesConsumed: offset + length - startOffset };
  }
  
  // Nil (0xC0)
  if (firstByte === 0xC0) {
    return { value: undefined, bytesConsumed: offset - startOffset };
  }
  
  // False (0xC2)
  if (firstByte === 0xC2) {
    return { value: false, bytesConsumed: offset - startOffset };
  }
  
  // True (0xC3)
  if (firstByte === 0xC3) {
    return { value: true, bytesConsumed: offset - startOffset };
  }
  
  // Bin8 (0xC4)
  if (firstByte === 0xC4) {
    const length = data.readUInt8(offset++);
    const buffer = data.subarray(offset, offset + length);
    return { value: buffer, bytesConsumed: offset + length - startOffset };
  }
  
  // Bin16 (0xC5)
  if (firstByte === 0xC5) {
    const length = data.readUInt16BE(offset);
    offset += 2;
    const buffer = data.subarray(offset, offset + length);
    return { value: buffer, bytesConsumed: offset + length - startOffset };
  }
  
  // Bin32 (0xC6)
  if (firstByte === 0xC6) {
    const length = data.readUInt32BE(offset);
    offset += 4;
    const buffer = data.subarray(offset, offset + length);
    return { value: buffer, bytesConsumed: offset + length - startOffset };
  }
  
  // Float32 (0xCA)
  if (firstByte === 0xCA) {
    const value = data.readFloatBE(offset);
    return { value, bytesConsumed: offset + 4 - startOffset };
  }
  
  // Float64 (0xCB)
  if (firstByte === 0xCB) {
    const value = data.readDoubleBE(offset);
    return { value, bytesConsumed: offset + 8 - startOffset };
  }
  
  // Uint8 (0xCC)
  if (firstByte === 0xCC) {
    const value = data.readUInt8(offset);
    return { value, bytesConsumed: offset + 1 - startOffset };
  }
  
  // Uint16 (0xCD)
  if (firstByte === 0xCD) {
    const value = data.readUInt16BE(offset);
    return { value, bytesConsumed: offset + 2 - startOffset };
  }
  
  // Uint32 (0xCE)
  if (firstByte === 0xCE) {
    const value = data.readUInt32BE(offset);
    return { value, bytesConsumed: offset + 4 - startOffset };
  }
  
  // Uint64 (0xCF)
  if (firstByte === 0xCF) {
    // JavaScript doesn't have native 64-bit integers, use BigInt
    const high = data.readUInt32BE(offset);
    const low = data.readUInt32BE(offset + 4);
    const value = (BigInt(high) << BigInt(32)) | BigInt(low);
    return { value: Number(value), bytesConsumed: offset + 8 - startOffset };
  }
  
  // Int8 (0xD0)
  if (firstByte === 0xD0) {
    const value = data.readInt8(offset);
    return { value, bytesConsumed: offset + 1 - startOffset };
  }
  
  // Int16 (0xD1)
  if (firstByte === 0xD1) {
    const value = data.readInt16BE(offset);
    return { value, bytesConsumed: offset + 2 - startOffset };
  }
  
  // Int32 (0xD2)
  if (firstByte === 0xD2) {
    const value = data.readInt32BE(offset);
    return { value, bytesConsumed: offset + 4 - startOffset };
  }
  
  // Int64 (0xD3)
  if (firstByte === 0xD3) {
    const high = data.readInt32BE(offset);
    const low = data.readUInt32BE(offset + 4);
    const value = (BigInt(high) << BigInt(32)) | BigInt(low);
    return { value: Number(value), bytesConsumed: offset + 8 - startOffset };
  }
  
  // Str8 (0xD9)
  if (firstByte === 0xD9) {
    const length = data.readUInt8(offset++);
    const str = data.toString('utf8', offset, offset + length);
    return { value: str, bytesConsumed: offset + length - startOffset };
  }
  
  // Str16 (0xDA)
  if (firstByte === 0xDA) {
    const length = data.readUInt16BE(offset);
    offset += 2;
    const str = data.toString('utf8', offset, offset + length);
    return { value: str, bytesConsumed: offset + length - startOffset };
  }
  
  // Str32 (0xDB)
  if (firstByte === 0xDB) {
    const length = data.readUInt32BE(offset);
    offset += 4;
    const str = data.toString('utf8', offset, offset + length);
    return { value: str, bytesConsumed: offset + length - startOffset };
  }
  
  // Array16 (0xDC)
  if (firstByte === 0xDC) {
    const size = data.readUInt16BE(offset);
    offset += 2;
    return decodeArray(data, offset, size, startOffset);
  }
  
  // Array32 (0xDD)
  if (firstByte === 0xDD) {
    const size = data.readUInt32BE(offset);
    offset += 4;
    return decodeArray(data, offset, size, startOffset);
  }
  
  // Map16 (0xDE)
  if (firstByte === 0xDE) {
    const size = data.readUInt16BE(offset);
    offset += 2;
    return decodeMap(data, offset, size, startOffset);
  }
  
  // Map32 (0xDF)
  if (firstByte === 0xDF) {
    const size = data.readUInt32BE(offset);
    offset += 4;
    return decodeMap(data, offset, size, startOffset);
  }
  
  // Negative fixint (0xE0-0xFF)
  if ((firstByte & 0xE0) === 0xE0) {
    return { value: firstByte - 256, bytesConsumed: offset - startOffset };
  }
  
  throw new Error(`Unsupported msgpack format byte: 0x${firstByte.toString(16)}`);
}

/**
 * Helper function to decode msgpack array.
 * @private
 */
function decodeArray(data: Buffer, offset: number, size: number, startOffset: number): { value: any[]; bytesConsumed: number } {
  const result: any[] = [];
  
  for (let i = 0; i < size; i++) {
    const { value, bytesConsumed } = decode(data, offset);
    result.push(value);
    offset += bytesConsumed;
  }
  
  return { value: result, bytesConsumed: offset - startOffset };
}

/**
 * Helper function to decode msgpack map.
 * Returns BufferMap if any key is a Buffer, otherwise returns plain object.
 * @private
 */
function decodeMap(data: Buffer, offset: number, size: number, startOffset: number): { value: any; bytesConsumed: number } {
  const entries: [any, any][] = [];
  let hasBufferKeys = false;
  
  for (let i = 0; i < size; i++) {
    const { value: key, bytesConsumed: keyBytes } = decode(data, offset);
    offset += keyBytes;
    
    const { value, bytesConsumed: valueBytes } = decode(data, offset);
    offset += valueBytes;
    
    if (Buffer.isBuffer(key)) {
      hasBufferKeys = true;
    }
    
    entries.push([key, value]);
  }
  
  // Use BufferMap for maps with Buffer keys (content-based comparison)
  const result = hasBufferKeys ? new BufferMap(entries) : Object.fromEntries(entries);
  
  return { value: result, bytesConsumed: offset - startOffset };
}

/**
 * Convenience function to decode and return just the value (without bytesConsumed).
 * Useful when you know you're decoding the entire buffer.
 * 
 * @param data - Encoded msgpack Buffer
 * @returns Decoded value
 */
export function decodeValue(data: Buffer): any {
  return decode(data, 0).value;
}
