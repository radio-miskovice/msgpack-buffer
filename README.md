# msgpack-buffer

Python msgpack encoder/decoder with Buffer support.

## Overview

This library provides msgpack encoding and decoding that maintains compatibility with custom umsgpack
implementation used in Reticulum Network Stack implemented in Python. It properly handles Node.js Buffers 
as binary format (0xC4/C5/C6) instead of encoding them as strings, which is, among other possible use,
essential for cross-platform data exchange with Python RNS ecosystem.

## Features

- ✅ Single generic `encode()` function for all data types
- ✅ Single generic `decode()` function that reads format byte first (proper msgpack philosophy)
- ✅ Handles nested structures recursively
- ✅ Encodes Buffers as binary format (0xC4/C5/C6) matching Python umsgpack
- ✅ Returns BufferMap for maps with Buffer keys (content-based comparison)
- ✅ Full msgpack spec support

## Installation

```bash
npm install msgpack-buffer
```

## Usage

```typescript
import { encode, decode, decodeWithOffset } from 'msgpack-buffer';

// Encode data with Buffers
const data = {
  name: "test",
  buffer: Buffer.from([1, 2, 3]),
  nested: [Buffer.from("hello"), 42]
};

const encoded = encode(data);

// Decode with full info
const { value, bytesConsumed } = decodeWithOffset(encoded);

// Or just get the value
const decoded = decode(encoded);
```

## API

### `encode(data: any): Buffer`

Encodes any data structure to msgpack format. Buffers are encoded as binary (0xC4/C5/C6).

### `decodeWithOffset(data: Buffer, offset?: number): { value: any; bytesConsumed: number }`

Decodes msgpack data starting at offset. Returns the decoded value and bytes consumed.

### `decode(data: Buffer): any`

Convenience function that decodes and returns just the value.

## License

MIT
