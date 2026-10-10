import {provinces} from '@/lib/config';
export function LocationFields({city='',province=''}:{city?:string;province?:string}){
 return <><label className="field">Provincia<select name="province" required defaultValue={province}><option value="">Elegí una provincia</option>{provinces.map(p=><option key={p}>{p}</option>)}</select></label><label className="field">Ciudad o localidad<input name="city" required minLength={2} maxLength={80} defaultValue={city} autoComplete="address-level2"/></label></>;
}

