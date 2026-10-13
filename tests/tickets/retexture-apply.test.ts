import {test,expect} from 'vitest';
import {applyCommand} from '@coedit/domain';
import {context as originalContext,command,scene} from '../fixtures/scene';
import {BUILTIN_LIBRARY} from '@coedit/contracts';
const context={...originalContext,library:BUILTIN_LIBRARY};
test('approved asset replacement preserves identity and placement and requires the exact requested revision/generation',()=>{
 const input=scene(),object=input.objects.a;input.seq=object.revision;
 const op={op:'replace_asset',id:'a',assetId:'table',expectedRevision:object.revision,expectedGeneration:input.generation};
 const result=applyCommand(input,command([op]),context);expect(result.ok).toBe(true);
 if(!result.ok)throw Error(result.code);expect(result.snapshot.objects.a).toMatchObject({...object,assetId:'table',revision:input.seq+1,lastActor:context.actor});expect(input.objects.a.assetId).toBe(object.assetId);
 for(const change of [{expectedRevision:object.revision+1},{expectedGeneration:input.generation+1}])expect(applyCommand(input,command([{...op,...change}]),context)).toMatchObject({ok:false,code:'STALE_RETEXTURE'});
 expect(applyCommand(input,command([{...op,assetId:'unapproved'}]),context)).toMatchObject({ok:false,code:'ASSET_UNAVAILABLE'});
 expect(applyCommand(input,command([op]),{...context,locks:{}})).toMatchObject({ok:false,code:'LOCK_REQUIRED'});
});
