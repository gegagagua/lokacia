import path from 'node:path';

export const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3100';
export const CRM_URL = process.env.CRM_URL ?? 'http://localhost:3101';
export const ADMIN_URL = process.env.ADMIN_URL ?? 'http://localhost:3102';
export const API_URL = process.env.API_URL ?? 'http://localhost:4000';
export const OTP_CODE = process.env.OTP_DEV_CODE ?? '123456';
export const AUTH_DIR = path.join(__dirname, '..', '.auth');
