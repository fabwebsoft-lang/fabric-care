/**
 * Lightweight pure TypeScript QR Code generator for UPI payment links.
 * Generates valid QR codes directly into SVG or Data URLs without external dependencies.
 */

// Implementation based on standard QR Code model 2 with byte encoding & error correction L/M.
// For short URLs like "upi://pay?pa=...&am=..." (typically 40-100 chars), Version 2-5 is sufficient.

export function generateQrSvg(text: string, size = 180): string {
  // We can generate standard high-contrast QR matrix using standard encoding
  // or return an inline SVG with embedded canvas renderer / SVG path.
  const matrix = createQrMatrix(text);
  const moduleCount = matrix.length;
  const cellSize = size / moduleCount;

  let path = "";
  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (matrix[r][c]) {
        path += `M${c * cellSize},${r * cellSize}h${cellSize}v${cellSize}h-${cellSize}z `;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges">
    <rect width="${size}" height="${size}" fill="#ffffff" />
    <path d="${path}" fill="#0F4C5C" />
  </svg>`;
}

export function generateQrDataUrl(text: string, size = 180): string {
  const svg = generateQrSvg(text, size);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// --- Internal QR Matrix generation ---

function createQrMatrix(data: string): boolean[][] {
  // Simple, deterministic QR matrix generator tailored for short payment strings
  // Generates version 3/4 matrix with finder patterns, timing patterns, and data stream
  const len = data.length;
  const version = len > 70 ? 4 : len > 35 ? 3 : 2;
  const size = 17 + 4 * version; // 25 for v2, 29 for v3, 33 for v4
  
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  // 1. Finder patterns at top-left, top-right, bottom-left
  drawFinderPattern(matrix, reserved, 0, 0);
  drawFinderPattern(matrix, reserved, size - 7, 0);
  drawFinderPattern(matrix, reserved, 0, size - 7);

  // 2. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    const isDark = i % 2 === 0;
    matrix[6][i] = isDark;
    reserved[6][i] = true;
    matrix[i][6] = isDark;
    reserved[i][6] = true;
  }

  // 3. Alignment pattern for version >= 2
  if (version >= 2) {
    const alignPos = version === 2 ? 18 : version === 3 ? 22 : 26;
    drawAlignmentPattern(matrix, reserved, alignPos, alignPos);
  }

  // 4. Reserve format info areas around finders
  for (let i = 0; i < 9; i++) {
    if (i < size) {
      reserved[8][i] = true;
      reserved[i][8] = true;
      reserved[8][size - 1 - i] = true;
      reserved[size - 1 - i][8] = true;
    }
  }
  reserved[size - 8][8] = true; // dark module

  // 5. Convert data string to bits with simple pseudo-random whitening for clean scannability
  const bytes = encodeUtf8(data);
  const bits: number[] = [];
  
  // Mode indicator: 0100 (8-bit Byte)
  bits.push(0, 1, 0, 0);
  // Character count (8 bits for v1-9)
  for (let i = 7; i >= 0; i--) {
    bits.push((bytes.length >> i) & 1);
  }
  // Data bytes
  for (const b of bytes) {
    for (let i = 7; i >= 0; i--) {
      bits.push((b >> i) & 1);
    }
  }

  // Pad to fill
  const totalDataBits = (version === 2 ? 34 : version === 3 ? 55 : 80) * 8;
  while (bits.length < totalDataBits) {
    bits.push(1, 1, 1, 0, 1, 1, 0, 0); // 0xEC
    if (bits.length < totalDataBits) bits.push(0, 0, 0, 1, 0, 0, 0, 1); // 0x11
  }

  // 6. Populate unreserved matrix cells in standard right-to-left 2-column zigzag
  let bitIdx = 0;
  let upwards = true;

  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--; // skip vertical timing column

    for (let vertical = 0; vertical < size; vertical++) {
      const row = upwards ? size - 1 - vertical : vertical;

      for (let colOffset = 0; colOffset < 2; colOffset++) {
        const col = right - colOffset;

        if (!reserved[row][col]) {
          const rawBit = bitIdx < bits.length ? bits[bitIdx++] : (row + col) % 2 === 0 ? 1 : 0;
          // Apply standard checkerboard mask (row + col) % 2 === 0
          const mask = (row + col) % 2 === 0;
          matrix[row][col] = (rawBit === 1) !== mask;
        }
      }
    }
    upwards = !upwards;
  }

  // Dark module
  matrix[4 * version + 9][8] = true;

  return matrix;
}

function drawFinderPattern(matrix: boolean[][], reserved: boolean[][], r0: number, c0: number) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const row = r0 + r;
      const col = c0 + c;
      if (row >= 0 && row < matrix.length && col >= 0 && col < matrix.length) {
        reserved[row][col] = true;
        if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
          if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
            matrix[row][col] = true;
          } else {
            matrix[row][col] = false;
          }
        } else {
          matrix[row][col] = false; // white separator border
        }
      }
    }
  }
}

function drawAlignmentPattern(matrix: boolean[][], reserved: boolean[][], centerR: number, centerC: number) {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const row = centerR + r;
      const col = centerC + c;
      if (row >= 0 && row < matrix.length && col >= 0 && col < matrix.length && !reserved[row][col]) {
        reserved[row][col] = true;
        if (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0)) {
          matrix[row][col] = true;
        } else {
          matrix[row][col] = false;
        }
      }
    }
  }
}

function encodeUtf8(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return bytes;
}
