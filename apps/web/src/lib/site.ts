export const SITE_URL = process.env.APP_URL ?? 'http://localhost:3000';
export const SITE_NAME = 'lokacia.ge';
export const SITE_DESCRIPTION = 'კომერციული ფართები საქართველოში — ოფისები, მაღაზიები, საწყობები, კაფეს ფართები. ფილტრები ბიზნესის ტიპის მიხედვით, ტექნიკური პასპორტი და ლოკაციის ანალიტიკა.';
export const CITY_NAMES_KA: Record<string, string> = { tbilisi: 'თბილისი', batumi: 'ბათუმი', kutaisi: 'ქუთაისი', rustavi: 'რუსთავი' };
export const absUrl = (path: string) => (path.startsWith('http') ? path : `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`);
