import {randomBytes,scrypt,timingSafeEqual,createHash} from 'node:crypto';
const derive=(password:string,salt:string)=>new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,64,(error,key)=>error?reject(error):resolve(key)));
export const credentialDigest=(value:string)=>createHash('sha256').update(value).digest('hex');
export async function hashPassword(password:string){const salt=randomBytes(16).toString('hex');return salt+':'+(await derive(password,salt)).toString('hex');}
export async function verifyPassword(password:string,stored:string){
  const [salt,key]=stored.split(':');if(!salt||!key)return false;
  const actual=await derive(password,salt),expected=Buffer.from(key,'hex');
  return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
