/**
 * When a photo was taken, from its EXIF data: DateTimeOriginal (falling back
 * to DateTime), as the camera's local wall-clock "YYYY-MM-DDTHH:MM:SS".
 * JPEG only — iOS hands web pages JPEGs from the photo picker. Returns null
 * when there's no EXIF date (screenshots, edited exports, other formats).
 */
export async function exifTakenAt(file: Blob): Promise<string | null> {
  // EXIF lives in the APP1 segment near the start of the file
  const buf = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
  if (buf.byteLength < 4 || buf.getUint16(0) !== 0xffd8) return null;
  let off = 2;
  while (off + 4 <= buf.byteLength) {
    const marker = buf.getUint16(off);
    const size = buf.getUint16(off + 2);
    if ((marker & 0xff00) !== 0xff00) return null;
    if (marker === 0xffe1 && buf.getUint32(off + 4) === 0x45786966) {
      return readTiff(buf, off + 10); // after "Exif\0\0"
    }
    if (marker === 0xffda) return null; // image data: no EXIF before it
    off += 2 + size;
  }
  return null;
}

function readTiff(v: DataView, tiff: number): string | null {
  if (tiff + 8 > v.byteLength) return null;
  const le = v.getUint16(tiff) === 0x4949;
  const u16 = (o: number) => v.getUint16(tiff + o, le);
  const u32 = (o: number) => v.getUint32(tiff + o, le);

  /** Value offsets of the wanted tags in one IFD. */
  const scan = (ifd: number, tags: number[]) => {
    const found = new Map<number, number>();
    if (tiff + ifd + 2 > v.byteLength) return found;
    const n = u16(ifd);
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12;
      if (tiff + e + 12 > v.byteLength) break;
      const tag = u16(e);
      if (tags.includes(tag)) found.set(tag, e);
    }
    return found;
  };
  const ascii = (entry: number) => {
    const count = u32(entry + 4);
    const at = count > 4 ? u32(entry + 8) : entry + 8;
    let s = "";
    for (let i = 0; i < count - 1 && tiff + at + i < v.byteLength; i++) {
      s += String.fromCharCode(v.getUint8(tiff + at + i));
    }
    return s;
  };
  const toIso = (s: string) => {
    const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(s);
    return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}` : null;
  };

  const ifd0 = scan(u32(4), [0x8769, 0x0132]);
  const exifPtr = ifd0.get(0x8769);
  if (exifPtr !== undefined) {
    const original = scan(u32(exifPtr + 8), [0x9003]).get(0x9003);
    if (original !== undefined) {
      const iso = toIso(ascii(original));
      if (iso) return iso;
    }
  }
  const dt = ifd0.get(0x0132);
  return dt !== undefined ? toIso(ascii(dt)) : null;
}
