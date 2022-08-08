import * as crypto from 'crypto';
import * as fs from 'fs';

export function hashFile(fileName: string): string {
    const fileBuffer = fs.readFileSync(fileName);
    const hashSum = crypto.createHash('md5');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}
