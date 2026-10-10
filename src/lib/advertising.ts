export type AdPlacementName='home'|'search'|'device'|'guides';
export function adAllowed({enabled,production,host,client,slot,consent,moderated}:{enabled:boolean;production:boolean;host:string;client:string;slot:string;consent:boolean;moderated:boolean}){
 return enabled&&production&&['reacondicionargdos.com','www.reacondicionargdos.com'].includes(host)&&/^ca-pub-\d{16}$/.test(client)&&/^\d{1,20}$/.test(slot)&&consent&&moderated;
}
export function authorizedAdsTxt(line:string,client:string){
 const publisher=client.replace(/^ca-/,'');
 return /^ca-pub-\d{16}$/.test(client)&&line.trim()===`google.com, ${publisher}, DIRECT, f08c47fec0942fa0`?line.trim()+'\n':'# AdSense pending authorized publisher configuration.\n';
}

