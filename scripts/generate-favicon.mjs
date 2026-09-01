import { writeFile } from "node:fs/promises";
import sharp from "sharp";

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="30" fill="#d7f226"/>
  <path d="M8 17c12 2 19 10 20 22 1 8 6 14 13 18M56 47c-12-2-19-10-20-22-1-8-6-14-13-18" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
</svg>`;

const png = await sharp(Buffer.from(svg)).resize(64, 64).png().toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header.writeUInt8(64, 6);
header.writeUInt8(64, 7);
header.writeUInt8(0, 8);
header.writeUInt8(0, 9);
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18);

await writeFile(new URL("../app/favicon.ico", import.meta.url), Buffer.concat([header, png]));
