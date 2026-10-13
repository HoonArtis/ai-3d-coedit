import ts from 'typescript';
import { readdirSync, readFileSync } from 'node:fs';
import { posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
type Violation = {file:string; reason:string};
const moduleOf=(p:string)=>p.split('/').slice(0,2).join('/');
// Explicit package.json export, kept separate so the web renderer does not import NodeIO.
const publicSubpaths=new Map([['@coedit/geometry/export','packages/geometry/src/export']]);
const allowed:Record<string,string[]>={
  'packages/contracts':[], 'packages/domain':['packages/contracts'],
  'packages/placement':['packages/contracts'],
  'packages/jobs':['packages/contracts'], 'packages/artifacts':[], 'packages/geometry':['packages/contracts'],
  'apps/web':['packages/contracts','packages/geometry','packages/placement'],
  'apps/server':['packages/contracts','packages/domain','packages/placement','packages/jobs','packages/artifacts','packages/geometry'],
  'apps/llm':['packages/contracts','packages/jobs'],'apps/workers':['packages/contracts','packages/jobs','packages/artifacts','packages/geometry'],
};
export function checkImports(files:Record<string,string>):Violation[] {
  const violations:Violation[]=[];const graph:Record<string,string[]>={};
  for(const [file,source] of Object.entries(files)){
    graph[file]=[];
    const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
    const inspect=(specifier:string)=>{
      let target:string;
      if(specifier.startsWith('.')) target=posix.normalize(posix.join(posix.dirname(file),specifier));
      else if(specifier.startsWith('@coedit/')){const [name,...subpath]=specifier.slice(8).split('/');target='packages/'+name+'/src/'+(subpath.length?subpath.join('/'):'index');}
      else {
        if(moduleOf(file)==='packages/domain'||moduleOf(file)==='packages/placement')
          violations.push({file,reason:'direction: pure package importing external '+specifier});
        return;
      }
      const resolved=[target,target+'.ts',target+'.tsx',target+'/index.ts'].find(p=>Object.hasOwn(files,p));
      if(resolved)graph[file].push(resolved);
      const from=moduleOf(file),to=moduleOf(target);
      if(from===to)return;
      if(!allowed[from]?.includes(to))violations.push({file,reason:'direction: '+from+' -> '+to});
      if(to.startsWith('packages/')&&!/\/src\/index(\.ts)?$/.test(target)&&publicSubpaths.get(specifier)!==target)
        violations.push({file,reason:'private import: '+target});
    };
    const walk=(node:ts.Node)=>{
      if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier))inspect(node.moduleSpecifier.text);
      if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0]))inspect(node.arguments[0].text);
      ts.forEachChild(node,walk);
    };walk(ast);
  }
  const done=new Set<string>(),stack:string[]=[];
  const visit=(file:string)=>{
    if(stack.includes(file)){violations.push({file,reason:'cycle: '+[...stack,file].join(' -> ')});return;}
    if(done.has(file))return;
    stack.push(file);for(const next of graph[file]??[])visit(next);stack.pop();done.add(file);
  };
  Object.keys(graph).forEach(visit);return violations;
}
export function readSources(root:string):Record<string,string>{
  const files:Record<string,string>={};
  const walk=(dir:string)=>{
    for(const entry of readdirSync(resolve(root,dir),{withFileTypes:true})){
      if(['node_modules','dist'].includes(entry.name))continue;
      const path=posix.join(dir,entry.name);
      if(entry.isDirectory())walk(path);
      else if(/\.(ts|tsx)$/.test(path))files[path]=readFileSync(resolve(root,path),'utf8');
    }
  };
  for(const dir of ['apps','packages'])walk(dir);
  return files;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=checkImports(readSources(process.cwd()));
  if(result.length){console.error(result);process.exitCode=1;}
  else console.log('Module boundaries and import cycles: PASS');
}
